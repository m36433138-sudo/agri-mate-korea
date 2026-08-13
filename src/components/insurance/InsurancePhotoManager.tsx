import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  useInsurancePhotos,
  useUploadInsurancePhoto,
  useDeleteInsurancePhoto,
  type InsurancePhoto,
} from "@/hooks/useInsurance";

const KINDS: InsurancePhoto["kind"][] = ["수리전", "수리후", "기타"];

export default function InsurancePhotoManager({ repairId }: { repairId: string }) {
  const { toast } = useToast();
  const { data: photos = [], isLoading } = useInsurancePhotos(repairId);
  const upload = useUploadInsurancePhoto();
  const del = useDeleteInsurancePhoto();

  const [kind, setKind] = useState<InsurancePhoto["kind"]>("수리전");
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      for (const file of Array.from(files)) {
        await upload.mutateAsync({ repairId, file, kind });
      }
      toast({ title: `사진 ${files.length}장을 업로드했습니다.` });
    } catch (e: any) {
      toast({ title: "업로드 실패", description: e.message, variant: "destructive" });
    } finally {
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (p: InsurancePhoto) => {
    if (!confirm("이 사진을 삭제할까요?")) return;
    try {
      await del.mutateAsync(p);
      toast({ title: "사진을 삭제했습니다." });
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {KINDS.map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={kind === k ? "default" : "outline"}
              onClick={() => setKind(k)}
            >
              {k}
            </Button>
          ))}
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
        <Button type="button" size="sm" variant="outline" disabled={upload.isPending}
          onClick={() => cameraRef.current?.click()}>
          {upload.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
          촬영
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4 mr-1" /> 이미지 선택
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">선택 구분: {kind}</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">사진 불러오는 중...</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center border rounded-lg border-dashed">
          등록된 수리사진이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative group rounded-lg overflow-hidden border bg-muted/30">
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer">
                  <img src={p.url} alt={`${p.kind} 수리사진`} loading="lazy"
                    className="w-full h-24 object-cover" />
                </a>
              ) : (
                <div className="w-full h-24 flex items-center justify-center text-xs text-muted-foreground">불러오기 실패</div>
              )}
              <Badge variant="secondary" className="absolute top-1 left-1 text-[10px] px-1.5 py-0">{p.kind}</Badge>
              <button type="button" onClick={() => handleDelete(p)}
                className="absolute top-1 right-1 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
