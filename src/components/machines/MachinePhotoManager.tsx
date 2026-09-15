import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "machine-photos";
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

type MachinePhoto = {
  id: string;
  machine_id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  original_size: number | null;
  compressed_size: number | null;
  created_at: string;
  url?: string;
};

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 등록할 수 있습니다.");

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진 크기를 줄일 수 없습니다.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("사진 압축에 실패했습니다.")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "machine-photo";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function MachinePhotoManager({ machineId }: { machineId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<MachinePhoto | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["machine-photos", machineId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("machine_photos")
        .select("*")
        .eq("machine_id", machineId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return Promise.all(((data || []) as MachinePhoto[]).map(async (photo) => {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(photo.file_path, 60 * 60);
        return { ...photo, url: signed?.signedUrl };
      }));
    },
    staleTime: 1000 * 60 * 10,
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: MachinePhoto) => {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.file_path]);
      if (storageError) throw storageError;
      const { error } = await (supabase as any).from("machine_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine-photos", machineId] });
      toast({ title: "사진을 삭제했습니다." });
    },
    onError: (error: Error) => toast({ title: "사진 삭제 실패", description: error.message, variant: "destructive" }),
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let completed = 0;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("로그인 정보를 확인할 수 없습니다.");

      for (const original of Array.from(files)) {
        const compressed = await compressPhoto(original);
        const path = `${machineId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, compressed, {
          contentType: "image/jpeg",
          cacheControl: "3600",
        });
        if (uploadError) throw uploadError;

        const { error: insertError } = await (supabase as any).from("machine_photos").insert({
          machine_id: machineId,
          file_path: path,
          file_name: original.name,
          mime_type: "image/jpeg",
          original_size: original.size,
          compressed_size: compressed.size,
          uploaded_by: authData.user.id,
        });
        if (insertError) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw insertError;
        }
        completed += 1;
      }
      await qc.invalidateQueries({ queryKey: ["machine-photos", machineId] });
      toast({ title: `사진 ${completed}장을 등록했습니다.`, description: "사진 크기를 줄여 저장했습니다." });
    } catch (error) {
      toast({
        title: completed ? `${completed}장 등록 후 중단되었습니다.` : "사진 등록 실패",
        description: error instanceof Error ? error.message : "다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs text-muted-foreground">사진은 최대 1600px로 줄여 저장됩니다.</p>
        <div className="flex gap-2 print:hidden">
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => cameraRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
            촬영
          </Button>
          <Button type="button" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4 mr-1" /> 사진 선택
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="aspect-[4/3] w-full" />)}</div>
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">등록된 기계 사진이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group overflow-hidden rounded-lg border bg-muted/30 aspect-[4/3]">
              <button type="button" className="block h-full w-full" onClick={() => setPreview(photo)} aria-label={`${photo.file_name} 크게 보기`}>
                <img src={photo.url} alt={`${photo.file_name} 기계 사진`} loading="lazy" className="h-full w-full object-cover" />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-background/80 px-2 py-1.5">
                <span className="min-w-0 truncate text-[11px] text-muted-foreground">{formatBytes(photo.compressed_size)}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive print:hidden"
                  disabled={deletePhoto.isPending}
                  onClick={() => {
                    if (confirm("이 사진을 삭제할까요?")) deletePhoto.mutate(photo);
                  }}
                  title="사진 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{preview?.file_name || "기계 사진"}</DialogTitle></DialogHeader>
          {preview?.url && <img src={preview.url} alt={`${preview.file_name} 크게 보기`} className="max-h-[75vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}