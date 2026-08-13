import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, Download, FileText, ImagePlus, Loader2, Trash2 } from "lucide-react";
import {
  useInsurancePhotos,
  useUploadInsurancePhoto,
  useDeleteInsurancePhoto,
  downloadInsuranceAttachment,
  type InsurancePhoto,
  type InsuranceAttachmentKind,
} from "@/hooks/useInsurance";

const KINDS: InsuranceAttachmentKind[] = ["수리전", "수리후", "기타", "견적서"];

const isImage = (p: InsurancePhoto) =>
  (p.mime_type ? p.mime_type.startsWith("image/") : true) &&
  !/\.pdf$/i.test(p.file_name || p.file_path);

export default function InsurancePhotoManager({ repairId }: { repairId: string }) {
  const { toast } = useToast();
  const { data: photos = [], isLoading } = useInsurancePhotos(repairId);
  const upload = useUploadInsurancePhoto();
  const del = useDeleteInsurancePhoto();

  const [kind, setKind] = useState<InsuranceAttachmentKind>("수리전");
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null, forcedKind?: InsuranceAttachmentKind) => {
    if (!files || files.length === 0) return;
    try {
      for (const file of Array.from(files)) {
        await upload.mutateAsync({ repairId, file, kind: forcedKind || kind });
      }
      toast({ title: `파일 ${files.length}개를 업로드했습니다.` });
    } catch (e: any) {
      toast({ title: "업로드 실패", description: e.message, variant: "destructive" });
    } finally {
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
      if (docRef.current) docRef.current.value = "";
    }
  };

  const handleDelete = async (p: InsurancePhoto) => {
    if (!confirm("이 첨부를 삭제할까요?")) return;
    try {
      await del.mutateAsync(p);
      toast({ title: "삭제했습니다." });
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    }
  };

  const handleDownload = async (p: InsurancePhoto) => {
    try {
      await downloadInsuranceAttachment(p);
    } catch (e: any) {
      toast({ title: "다운로드 실패", description: e.message, variant: "destructive" });
    }
  };

  const downloadAll = async () => {
    setBusy(true);
    try {
      for (const p of photos) {
        await downloadInsuranceAttachment(p);
        await new Promise((r) => setTimeout(r, 400));
      }
      toast({ title: `${photos.length}개 파일을 다운로드했습니다.` });
    } catch (e: any) {
      toast({ title: "다운로드 실패", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
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
        <input ref={docRef} type="file" accept="application/pdf,image/*" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files, "견적서")} />
        <Button type="button" size="sm" variant="outline" disabled={upload.isPending}
          onClick={() => cameraRef.current?.click()}>
          {upload.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
          촬영
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4 mr-1" /> 이미지 선택
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={upload.isPending}
          onClick={() => docRef.current?.click()}>
          <FileText className="h-4 w-4 mr-1" /> 견적서 업로드 (PDF/이미지)
        </Button>
        {photos.length > 0 && (
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={downloadAll}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            전체 다운로드
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">선택 구분: {kind}</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">첨부 불러오는 중...</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center border rounded-lg border-dashed">
          등록된 수리사진·견적서가 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative group rounded-lg overflow-hidden border bg-muted/30">
              {isImage(p) && p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer">
                  <img src={p.url} alt={`${p.kind} 첨부`} loading="lazy"
                    className="w-full h-24 object-cover" />
                </a>
              ) : (
                <a href={p.url} target="_blank" rel="noreferrer"
                  className="w-full h-24 flex flex-col items-center justify-center gap-1 px-2 text-center">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground truncate w-full">
                    {p.file_name || "파일"}
                  </span>
                </a>
              )}
              <Badge variant="secondary" className="absolute top-1 left-1 text-[10px] px-1.5 py-0">{p.kind}</Badge>
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => handleDownload(p)} title="다운로드"
                  className="p-1 rounded bg-background/80">
                  <Download className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => handleDelete(p)} title="삭제"
                  className="p-1 rounded bg-background/80">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
