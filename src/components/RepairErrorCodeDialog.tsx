import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Plus, Trash2, Loader2, Camera, Images, X } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { compressErrorCodePhoto, parseErrorCodes } from "@/lib/errorCodes";
import ErrorCodePhotos, { ERROR_CODE_PHOTO_BUCKET } from "@/components/ErrorCodePhotos";

export type ErrorCodeRow = {
  id: string;
  repair_id: string;
  error_code: string;
  symptom: string | null;
  action_taken: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  photo_paths: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  repair: any | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export default function RepairErrorCodeDialog({ open, onOpenChange, repair }: Props) {
  const qc = useQueryClient();
  const repairId = repair?.id as string | undefined;

  const [code, setCode] = useState("");
  const [symptom, setSymptom] = useState("");
  const [action, setAction] = useState("");
  const [resolved, setResolved] = useState(false);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const photoRef = useRef(photos);
  photoRef.current = photos;
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const codes = parseErrorCodes(code);
  const clearPhotos = () => {
    photoRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
  };
  useEffect(() => () => photoRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);
  useEffect(() => {
    setCode(""); setSymptom(""); setAction(""); setResolved(false); setNotes("");
    photoRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
  }, [repairId]);
  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (images.length !== files.length) toast({ title: "이미지 파일만 추가할 수 있습니다.", variant: "destructive" });
    setPhotos((previous) => [...previous, ...images.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["repair-error-codes", repairId],
    enabled: !!repairId && open,
    queryFn: async () => {
      if (!repairId) return [];
      const { data, error } = await supabase
        .from("repair_error_codes" as any)
        .select("*")
        .eq("repair_id", repairId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ErrorCodeRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["repair-error-codes"] });
    qc.invalidateQueries({ queryKey: ["error-code-log"] });
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!repairId || !codes.length) throw new Error("수리와 에러코드를 확인해 주세요.");
      const uploaded: string[] = [];
      try {
        const blobs = await Promise.all(photos.map((photo) => compressErrorCodePhoto(photo.file)));
        const records = [];
        for (const errorCode of codes) {
          const id = crypto.randomUUID();
          const paths: string[] = [];
          for (const blob of blobs) {
            const path = `${repairId}/${id}/${crypto.randomUUID()}.jpg`;
            const { error } = await supabase.storage.from(ERROR_CODE_PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
            if (error) throw error;
            uploaded.push(path);
            paths.push(path);
          }
          records.push({
            id, repair_id: repairId, error_code: errorCode,
            symptom: symptom.trim() || null, action_taken: action.trim() || null,
            is_resolved: resolved, resolved_at: resolved ? today() : null,
            notes: notes.trim() || null, photo_paths: paths,
          });
        }
        const { error } = await supabase.from("repair_error_codes" as any).insert(records as any);
        if (error) throw error;
        return records.length;
      } catch (error) {
        if (uploaded.length) {
          const { error: cleanupError } = await supabase.storage.from(ERROR_CODE_PHOTO_BUCKET).remove(uploaded);
          if (cleanupError) toast({ title: "임시 사진 정리 실패", description: "사진 정리가 필요합니다. 관리자에게 알려 주세요.", variant: "destructive" });
        }
        throw error;
      }
    },
    onSuccess: (count) => {
      setCode("");
      setSymptom("");
      setAction("");
      setNotes("");
      setResolved(false);
      clearPhotos();
      invalidate();
      toast({ title: `에러코드 ${count}개가 등록되었습니다.` });
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ErrorCodeRow> }) => {
      const { error } = await supabase
        .from("repair_error_codes" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "수정 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: ErrorCodeRow) => {
      const { data, error } = await supabase.from("repair_error_codes" as any).delete().eq("id", row.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("삭제 권한을 확인해 주세요.");
      if (row.photo_paths?.length) {
        const { error: photoError } = await supabase.storage.from(ERROR_CODE_PHOTO_BUCKET).remove(row.photo_paths);
        if (photoError) toast({ title: "기록은 삭제되었으나 사진 정리에 실패했습니다.", variant: "destructive" });
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "삭제되었습니다." });
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!addMutation.isPending) onOpenChange(value); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            에러코드 기록
          </DialogTitle>
        </DialogHeader>

        {repair && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">
              {repair.machines?.model_name} {repair.machines?.serial_number && (
                <span className="font-mono text-xs text-muted-foreground">({repair.machines.serial_number})</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(repair.repair_date)} · {repair.machines?.customers?.name || "고객 미지정"} · {repair.technician || "담당 미지정"}
            </p>
          </div>
        )}

        {/* 신규 입력 */}
        <fieldset disabled={addMutation.isPending} className="space-y-3 border-b pb-4 min-w-0">
          <div className="space-y-3">
            <div>
              <Label htmlFor="error-codes">에러코드 *</Label>
              <Textarea
                id="error-codes"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={"E-102, P0217\nE-103"}
                className="font-mono"
                rows={2}
              />
              <div className="flex flex-wrap gap-1 mt-2">{codes.map((item) => <Badge key={item} variant="secondary" className="font-mono">{item}</Badge>)}</div>
            </div>
            <div>
              <Label htmlFor="error-symptom">증상</Label>
              <Textarea id="error-symptom" value={symptom} onChange={(e) => setSymptom(e.target.value)} placeholder="예: 출력 저하 후 경고등 점등" rows={2} />
            </div>
          </div>
          <div>
            <Label htmlFor="error-action">조치 방법 · 내용</Label>
            <Textarea id="error-action" value={action} onChange={(e) => setAction(e.target.value)} rows={4} placeholder="예: 점검 순서, 교체 부품, 작업 방법, 조치 결과" />
          </div>
          <div>
            <Label>비고</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="추가 참고 사항" />
          </div>
          <div className="space-y-2">
            <Label>증상 · 조치 사진</Label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => cameraRef.current?.click()}><Camera className="mr-1 h-4 w-4" />촬영</Button>
              <Button size="sm" variant="outline" onClick={() => galleryRef.current?.click()}><Images className="mr-1 h-4 w-4" />갤러리</Button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, index) => <div key={photo.url} className="relative h-20 w-20">
                <img src={photo.url} alt={`선택한 사진 ${index + 1}`} className="h-full w-full rounded-md object-cover border" />
                <Button variant="destructive" size="icon" className="absolute right-0 top-0 h-6 w-6" aria-label={`선택한 사진 ${index + 1} 삭제`} onClick={() => {
                  URL.revokeObjectURL(photo.url); setPhotos((previous) => previous.filter((item) => item.url !== photo.url));
                }}><X className="h-3 w-3" /></Button>
              </div>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={resolved} onCheckedChange={(v) => setResolved(!!v)} />
              조치 완료
            </label>
            <Button
              size="sm"
              disabled={!codes.length || !repairId || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} {codes.length > 1 ? `${codes.length}개 일괄 등록` : "기록 추가"}
            </Button>
          </div>
        </fieldset>

        {/* 기록 목록 */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">아직 기록된 에러코드가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">{r.error_code}</Badge>
                  {r.is_resolved ? (
                    <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-400/40">
                      <CheckCircle2 className="h-3 w-3" /> 조치완료
                      {r.resolved_at && <span className="ml-1">{formatDate(r.resolved_at)}</span>}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-amber-400 border-amber-400/40">
                      <AlertTriangle className="h-3 w-3" /> 미조치
                    </Badge>
                  )}
                  <div className="flex-1" />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={r.is_resolved}
                      onCheckedChange={(v) =>
                        updateMutation.mutate({
                          id: r.id,
                          patch: { is_resolved: !!v, resolved_at: v ? today() : null },
                        })
                      }
                    />
                    완료
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label="에러코드 기록 삭제"
                      disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (confirm("이 에러코드 기록을 삭제할까요?")) deleteMutation.mutate(r);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {r.symptom && <p className="text-sm whitespace-pre-wrap break-words"><span className="text-muted-foreground">증상 </span>{r.symptom}</p>}
                {r.action_taken && <p className="text-sm whitespace-pre-wrap break-words"><span className="text-muted-foreground">조치 방법 </span>{r.action_taken}</p>}
                {r.notes && <p className="text-xs text-muted-foreground break-words">{r.notes}</p>}
                <ErrorCodePhotos paths={r.photo_paths ?? []} />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
