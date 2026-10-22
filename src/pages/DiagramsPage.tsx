import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDiagrams, useDiagramImageUrl, DIAGRAM_BUCKET, type Diagram } from "@/hooks/useDiagrams";
import DiagramViewer from "@/components/diagrams/DiagramViewer";
import { Map, Plus, Camera, ImagePlus, Trash2, Loader2 } from "lucide-react";

async function compressImage(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const MAX = 2400;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", 0.85)
  );
}

function DiagramCard({ diagram, onClick, onDelete }: { diagram: Diagram; onClick: () => void; onDelete: () => void }) {
  const { data: url } = useDiagramImageUrl(diagram.image_path);
  return (
    <div className="border rounded-xl overflow-hidden bg-card hover:border-primary/60 transition-colors cursor-pointer group relative">
      <div onClick={onClick}>
        {url ? (
          <img src={url} alt={diagram.title} className="w-full aspect-[3/4] object-cover object-top" />
        ) : (
          <Skeleton className="w-full aspect-[3/4]" />
        )}
        <div className="p-3">
          <p className="font-semibold truncate">{diagram.title}</p>
          {diagram.model_name && (
            <p className="text-xs text-muted-foreground truncate">{diagram.model_name}</p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 bg-background/70 backdrop-blur opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`"${diagram.title}" 도면을 삭제할까요?`)) onDelete();
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

export default function DiagramsPage() {
  const { toast } = useToast();
  const { diagrams, isLoading, addDiagram, deleteDiagram } = useDiagrams();
  const [selected, setSelected] = useState<Diagram | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [modelName, setModelName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const pickFile = (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return;
    setSaving(true);
    try {
      const blob = await compressImage(file);
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(DIAGRAM_BUCKET)
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      await addDiagram.mutateAsync({
        title: title.trim(),
        model_name: modelName.trim() || undefined,
        notes: notes.trim() || undefined,
        image_path: path,
      });
      toast({ title: "도면이 등록되었습니다." });
      setUploadOpen(false);
      setTitle(""); setModelName(""); setNotes(""); setFile(null);
      setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    } catch (e: any) {
      toast({ title: "등록 실패", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    return <DiagramViewer diagram={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Map className="h-6 w-6 text-primary" /> 부품 도면
        </h1>
        <Button className="ml-auto gap-1.5" onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4" /> 도면 등록
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
        </div>
      ) : diagrams.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-xl p-8 text-center">
          등록된 도면이 없습니다. 「도면 등록」을 눌러 부품 배치도를 올려 주세요.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {diagrams.map((d) => (
            <DiagramCard
              key={d.id}
              diagram={d}
              onClick={() => setSelected(d)}
              onDelete={() => deleteDiagram.mutate(d, {
                onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
              })}
            />
          ))}
        </div>
      )}

      {/* 도면 등록 다이얼로그 */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>도면 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="도면 이름 (예: HV2200 헤머 벨트 배치도)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="기종 (선택, 예: HV2200)" value={modelName} onChange={(e) => setModelName(e.target.value)} />
            <Textarea placeholder="메모 (선택)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

            {preview ? (
              <div className="relative">
                <img src={preview} alt="" className="w-full max-h-56 object-contain rounded-lg border bg-muted/30" />
                <button
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1"
                  onClick={() => {
                    URL.revokeObjectURL(preview);
                    setPreview(null);
                    setFile(null);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => cameraRef.current?.click()}>
                  <Camera className="h-4 w-4" /> 촬영
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => galleryRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> 갤러리
                </Button>
              </div>
            )}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { pickFile(e.target.files); e.target.value = ""; }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { pickFile(e.target.files); e.target.value = ""; }}
            />

            <Button
              className="w-full"
              disabled={!file || !title.trim() || saving}
              onClick={handleUpload}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              등록
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
