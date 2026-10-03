import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Camera, Trash2, X, Loader2 } from "lucide-react";

type Tip = {
  id: string;
  part_code: string;
  part_name: string | null;
  content: string;
  photo_paths: string[];
  created_at: string;
};

const BUCKET = "part-photos";

async function compressImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", 0.82)
  );
}

function useSignedUrls(paths: string[]) {
  return useQuery({
    queryKey: ["part-tip-photos", paths],
    enabled: paths.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((d) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl; });
      return map;
    },
    staleTime: 1000 * 60 * 50,
  });
}

export default function PartTipsDialog({
  partCode,
  partName,
  open,
  onOpenChange,
}: {
  partCode: string;
  partName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: tips, isLoading } = useQuery({
    queryKey: ["part-tips", partCode],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("part_tips")
        .select("*")
        .eq("part_code", partCode)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tip[];
    },
  });

  const allPaths = (tips || []).flatMap((t) => t.photo_paths || []);
  const { data: urlMap = {} } = useSignedUrls(allPaths);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...arr]);
    arr.forEach((f) => setPreviews((prev) => [...prev, URL.createObjectURL(f)]));
  };

  const removeFile = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const paths: string[] = [];
      for (const f of files) {
        const blob = await compressImage(f);
        const path = `${partCode}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        paths.push(path);
      }
      const { error } = await (supabase as any).from("part_tips").insert({
        part_code: partCode,
        part_name: partName,
        content: content.trim(),
        photo_paths: paths,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["part-tips", partCode] });
      qc.invalidateQueries({ queryKey: ["part-tip-counts"] });
      toast({ title: "팁이 등록되었습니다." });
      setContent("");
      setFiles([]);
      previews.forEach((p) => URL.revokeObjectURL(p));
      setPreviews([]);
    },
    onError: (e: any) => toast({ title: "등록 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (tip: Tip) => {
      const { error } = await (supabase as any).from("part_tips").delete().eq("id", tip.id);
      if (error) throw error;
      if (tip.photo_paths?.length) {
        await supabase.storage.from(BUCKET).remove(tip.photo_paths);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["part-tips", partCode] });
      qc.invalidateQueries({ queryKey: ["part-tip-counts"] });
      toast({ title: "삭제되었습니다." });
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-400" /> 부품 팁 · 사진
            </DialogTitle>
            <p className="text-sm text-muted-foreground font-mono">{partCode} — {partName}</p>
          </DialogHeader>

          {/* 입력 영역 */}
          <div className="space-y-2 border-b pb-3">
            <Textarea
              placeholder="구별법, 교환 팁, 주의사항 등을 자유롭게 적어주세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previews.map((p, i) => (
                  <div key={i} className="relative">
                    <img src={p} alt="" className="h-16 w-16 object-cover rounded-lg border" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4 mr-1" /> 사진 추가
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
              <Button
                size="sm"
                className="ml-auto"
                disabled={(!content.trim() && files.length === 0) || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "등록"}
              </Button>
            </div>
          </div>

          {/* 팁 목록 */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-[120px]">
            {isLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
            ) : !tips || tips.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                아직 등록된 팁이 없습니다. 첫 팁을 남겨보세요.
              </p>
            ) : (
              tips.map((tip) => (
                <div key={tip.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm whitespace-pre-wrap flex-1">{tip.content}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => deleteMutation.mutate(tip)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  {tip.photo_paths?.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {tip.photo_paths.map((path) =>
                        urlMap[path] ? (
                          <img
                            key={path}
                            src={urlMap[path]}
                            alt=""
                            className="h-20 w-20 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                            onClick={() => setViewerUrl(urlMap[path])}
                          />
                        ) : (
                          <Skeleton key={path} className="h-20 w-20 rounded-lg" />
                        )
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(tip.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 사진 크게 보기 */}
      <Dialog open={!!viewerUrl} onOpenChange={() => setViewerUrl(null)}>
        <DialogContent className="sm:max-w-3xl p-2">
          {viewerUrl && <img src={viewerUrl} alt="" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
