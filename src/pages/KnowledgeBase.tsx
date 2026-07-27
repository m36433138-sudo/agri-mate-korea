import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type KnowledgeDoc = {
  id: string;
  title: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  status: string;
  error_message: string | null;
  chunk_count: number | null;
  total_segments: number | null;
  processed_segments: number | null;
  created_at: string;
};

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,image/heic";
const MAX_SIZE = 50 * 1024 * 1024; // 50MB (Gemini 파일 처리 한계)

type UploadProgress = {
  id: string;
  name: string;
  size: number;
  progress: number; // 0-100
  error?: string;
};

export default function KnowledgeBase() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as KnowledgeDoc[];
    },
    refetchInterval: (q) => {
      const list = (q.state.data as KnowledgeDoc[] | undefined) ?? [];
      return list.some((d) => d.status === "processing") ? 3000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: KnowledgeDoc) => {
      await supabase.storage.from("knowledge-docs").remove([doc.file_path]);
      const { error } = await supabase
        .from("knowledge_documents" as any)
        .delete()
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-documents"] });
      toast({ title: "삭제 완료" });
    },
    onError: (e: any) =>
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const uploadWithProgress = (signedUrl: string, file: File, uploadId: string) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, progress: pct } : u)),
        );
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`업로드 실패 (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("네트워크 오류"));
      xhr.send(file);
    });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "로그인이 필요합니다", variant: "destructive" });
      return;
    }

    for (const file of Array.from(files)) {
      const uploadId = crypto.randomUUID();

      if (file.size > MAX_SIZE) {
        toast({
          title: `${file.name} 용량 초과`,
          description: `현재 최대 50MB까지 지원합니다 (선택하신 파일: ${(file.size / 1024 / 1024).toFixed(0)}MB). 큰 PDF는 분할해서 올려주세요.`,
          variant: "destructive",
        });
        continue;
      }

      setUploads((prev) => [
        ...prev,
        { id: uploadId, name: file.name, size: file.size, progress: 0 },
      ]);

      try {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

        // 1. Create signed upload URL for progress tracking
        const { data: signed, error: sErr } = await supabase.storage
          .from("knowledge-docs")
          .createSignedUploadUrl(path);
        if (sErr || !signed) throw sErr ?? new Error("서명 URL 생성 실패");

        // 2. Upload with XHR progress
        await uploadWithProgress(signed.signedUrl, file, uploadId);

        // 3. Register in DB — triggers ingestion
        const { data: docRow, error: insErr } = await supabase
          .from("knowledge_documents" as any)
          .insert({
            title: file.name,
            file_path: path,
            mime_type: file.type,
            file_size: file.size,
            status: "processing",
            uploaded_by: user.id,
          } as any)
          .select()
          .single();
        if (insErr) throw insErr;

        // Remove from upload list, refresh doc list
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        qc.invalidateQueries({ queryKey: ["knowledge-documents"] });

        // Fire-and-forget ingest
        supabase.functions
          .invoke("ingest-document", { body: { document_id: (docRow as any).id } })
          .then(() => qc.invalidateQueries({ queryKey: ["knowledge-documents"] }))
          .catch((e) => console.error(e));
      } catch (e: any) {
        setUploads((prev) =>
          prev.map((u) => (u.id === uploadId ? { ...u, error: e.message } : u)),
        );
        toast({ title: "업로드 실패", description: e.message, variant: "destructive" });
      }
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const reprocess = async (doc: KnowledgeDoc) => {
    await supabase
      .from("knowledge_documents" as any)
      .update({ status: "processing", error_message: null } as any)
      .eq("id", doc.id);
    supabase.functions
      .invoke("ingest-document", { body: { document_id: doc.id } })
      .then(() => qc.invalidateQueries({ queryKey: ["knowledge-documents"] }));
    qc.invalidateQueries({ queryKey: ["knowledge-documents"] });
  };

  const readyCount = docs.filter((d) => d.status === "ready").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          지식베이스
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          매뉴얼·카탈로그를 업로드하면 AI 어시스턴트가 답변할 때 자동으로 참고합니다.
        </p>
      </div>

      <Card className="p-6 border-dashed border-2">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">PDF 또는 이미지 업로드</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF · JPG · PNG · WEBP · HEIC (파일당 최대 50MB)
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              더 큰 매뉴얼은 챕터별로 분할해 올려주세요
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploads.length > 0}>
            <Upload className="h-4 w-4 mr-2" />
            파일 선택
          </Button>
        </div>
      </Card>

      {uploads.length > 0 && (
        <div className="grid gap-2">
          {uploads.map((u) => (
            <Card key={u.id} className="p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground truncate flex-1">{u.name}</span>
                <span className={u.error ? "text-red-400 text-xs" : "text-muted-foreground text-xs"}>
                  {u.error ? u.error : `${u.progress}%`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${u.error ? "bg-red-400" : "bg-primary"}`}
                  style={{ width: `${u.progress}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {(u.size / 1024 / 1024).toFixed(1)}MB · {u.progress === 100 ? "서버 등록 중..." : "업로드 중"}
              </p>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          업로드된 자료 <span className="text-foreground">{docs.length}개</span>
          {readyCount > 0 && (
            <span className="ml-2 text-xs text-emerald-400">· AI 학습 완료 {readyCount}개</span>
          )}
        </h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          아직 업로드된 자료가 없습니다
        </div>
      ) : (
        <div className="grid gap-2">
          {docs.map((d) => (
            <Card key={d.id} className="p-3 flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                {d.mime_type?.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span>
                    {format(new Date(d.created_at), "yyyy.MM.dd HH:mm", { locale: ko })}
                  </span>
                  {d.file_size && (
                    <>
                      <span>·</span>
                      <span>{(d.file_size / 1024 / 1024).toFixed(1)}MB</span>
                    </>
                  )}
                  {d.status === "ready" && d.chunk_count != null && (
                    <>
                      <span>·</span>
                      <span>{d.chunk_count} 조각</span>
                    </>
                  )}
                </div>
                {d.status === "processing" && d.total_segments && d.total_segments > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        학습 진행 {d.processed_segments ?? 0} / {d.total_segments} 세그먼트
                      </span>
                      <span>
                        {Math.round(((d.processed_segments ?? 0) / d.total_segments) * 100)}%
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all"
                        style={{
                          width: `${Math.round(((d.processed_segments ?? 0) / d.total_segments) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {d.status === "error" && d.error_message && (
                  <p className="text-xs text-red-400 mt-1 truncate">{d.error_message}</p>
                )}
              </div>
              <StatusPill status={d.status} doc={d} />
              {d.status === "error" && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => reprocess(d)}
                  title="재시도"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setDeleteId(d.id)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>자료를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 AI가 이 자료를 더 이상 참고하지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const doc = docs.find((d) => d.id === deleteId);
                if (doc) deleteMutation.mutate(doc);
                setDeleteId(null);
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "processing")
    return (
      <Badge variant="outline" className="gap-1 text-amber-400 border-amber-400/40">
        <Loader2 className="h-3 w-3 animate-spin" />
        학습 중
      </Badge>
    );
  if (status === "ready")
    return (
      <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-400/40">
        <CheckCircle2 className="h-3 w-3" />
        완료
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 text-red-400 border-red-400/40">
      <AlertCircle className="h-3 w-3" />
      오류
    </Badge>
  );
}
