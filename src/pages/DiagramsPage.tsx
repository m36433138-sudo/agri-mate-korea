import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDiagrams, useDiagramImageUrl, useDiagramPartSearch, DIAGRAM_BUCKET, type Diagram } from "@/hooks/useDiagrams";
import DiagramViewer from "@/components/diagrams/DiagramViewer";
import DiagramThumbnail from "@/components/diagrams/DiagramThumbnail";
import { Map, Plus, Camera, ImagePlus, Trash2, Loader2, Tag, FileUp, Search, X } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { modelGroup } from "@/lib/diagramModelGroup";
import { searchDiagrams } from "@/lib/diagramSearch";
import LabelPhotoDialog from "@/components/diagrams/LabelPhotoDialog";
import PdfDiagramImportDialog from "@/components/diagrams/PdfDiagramImportDialog";

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

function DiagramCard({ diagram, match, onClick, onDelete }: {
  diagram: Diagram;
  match?: { codes: string[]; count: number };
  onClick: () => void;
  onDelete: () => void;
}) {
  const { data: url } = useDiagramImageUrl(diagram.image_path);
  return (
    <div className="border rounded-xl overflow-hidden bg-card hover:border-primary/60 transition-colors cursor-pointer group relative">
      <Button variant="ghost" onClick={onClick} aria-label={`${diagram.title} 열기`}
        className="block h-auto w-full rounded-none p-0 text-left whitespace-normal hover:bg-transparent">
        {url ? (
          diagram.kind === "photo" ? (
            <img src={url} alt={diagram.title} loading="lazy" className="w-full object-cover aspect-[4/3]" />
          ) : <DiagramThumbnail key={url} src={url} title={diagram.title} />
        ) : (
          <Skeleton className={`w-full ${diagram.kind === "photo" ? "aspect-[4/3]" : "aspect-square"}`} />
        )}
        <div className="p-3">
          <p className="font-semibold line-clamp-2 min-h-10 text-sm" title={diagram.title}>{diagram.title}</p>
          {diagram.model_name && (
            <p className="text-xs text-muted-foreground truncate">{diagram.model_name}</p>
          )}
          {match && match.codes.length > 0 && (
            <p className="text-xs text-primary truncate" title={match.codes.join(", ")}>
              부품번호 {match.codes[0]}
              {match.count > 1 ? ` 외 ${match.count - 1}건` : ""}
            </p>
          )}
        </div>
      </Button>
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
  const [stack, setStack] = useState<Diagram[]>([]);
  const selected = stack[stack.length - 1] ?? null;
  const [kindTab, setKindTab] = useState<"photo" | "diagram">("photo");
  const [modelFilter, setModelFilter] = useState("전체");
  const [kind, setKind] = useState<"photo" | "diagram">("photo");
  // 트랙터 도면 분류: YT488은 따로, YT490·5101·5113(공용 엔진 포함)은 하나로 묶는다.
  const models = ["전체", ...Array.from(new Set(diagrams.map((d) => modelGroup(d.model_name)).filter(Boolean)))];
  const [term, setTerm] = useState("");
  const { hits: partHits, pending: partPending } = useDiagramPartSearch(term);
  const [initialPart, setInitialPart] = useState<string | null>(null);
  const results = useMemo(
    () => searchDiagrams(diagrams, term, partHits, { kind: kindTab, model: modelFilter }),
    [diagrams, term, partHits, kindTab, modelFilter],
  );
  const openDiagram = (d: Diagram, code?: string) => {
    setInitialPart(code ?? null);
    setStack([d]);
  };

  const { isAdmin } = useUserRole();
  const [labelOpen, setLabelOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
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
        kind,
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
    return (
      <DiagramViewer
        key={selected.id}
        diagram={selected}
        allDiagrams={diagrams}
        initialPartCode={initialPart}
        onBack={() => { setInitialPart(null); setStack((s) => s.slice(0, -1)); }}
        onOpenDiagram={(d) => { setInitialPart(null); setStack((s) => [...s, d]); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Map className="h-6 w-6 text-primary" /> 부품 도면
        </h1>
        <Button variant="outline" className="ml-auto gap-1.5" onClick={() => setLabelOpen(true)}>
          <Tag className="h-4 w-4" /> 부품 사진(라벨)
        </Button>
        {isAdmin && (
          <Button variant="outline" className="gap-1.5" onClick={() => setPdfOpen(true)}>
            <FileUp className="h-4 w-4" /> PDF 자동 등록
          </Button>
        )}
        <Button className="gap-1.5" onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4" /> 도면 등록
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="부품번호 · 기종 · 도면명으로 검색 (예: 129978-01331, YH1150, 예취부)"
          aria-label="도면 검색"
          className="pl-9 pr-9"
        />
        {term && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="검색어 지우기"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setTerm("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {term.trim() && (
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
          {partPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          「{term.trim()}」 도면 {results.length}개
          {partPending ? " · 부품번호 검색 중" : ""}
        </p>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Tabs value={kindTab} onValueChange={(v) => setKindTab(v as "photo" | "diagram")}>
          <TabsList>
            <TabsTrigger value="photo">기계 사진</TabsTrigger>
            <TabsTrigger value="diagram">부품 도면</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-1 flex-wrap">
          {models.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModelFilter(m)}
              className={`text-xs px-2.5 py-1 rounded-full border ${modelFilter === m ? "border-primary text-primary" : "text-muted-foreground"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-xl p-8 text-center">
          {term.trim()
            ? `「${term.trim()}」에 해당하는 도면이 없습니다. 부품번호는 하이픈을 빼고 적어도 찾습니다.`
            : kindTab === "photo"
              ? "등록된 기계 사진이 없습니다. 「도면 등록」에서 '기계 사진'을 골라 올려 주세요."
              : "등록된 도면이 없습니다. 「도면 등록」을 눌러 부품 배치도를 올려 주세요."}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.map((r) => (
            <DiagramCard
              key={r.diagram.id}
              diagram={r.diagram}
              match={r.partCount > 0 ? { codes: r.partCodes, count: r.partCount } : undefined}
              onClick={() => openDiagram(r.diagram, r.partCodes[0])}
              onDelete={() => deleteDiagram.mutate(r.diagram, {
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
            <Tabs value={kind} onValueChange={(v) => setKind(v as "photo" | "diagram")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="photo">기계 사진</TabsTrigger>
                <TabsTrigger value="diagram">부품 도면</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input placeholder={kind === "photo" ? "사진 이름 (예: YH1150 좌측면)" : "도면 이름 (예: HV2200 헤머 벨트 배치도)"} value={title} onChange={(e) => setTitle(e.target.value)} />
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
      <LabelPhotoDialog open={labelOpen} onOpenChange={setLabelOpen} />
      {isAdmin && <PdfDiagramImportDialog open={pdfOpen} onOpenChange={setPdfOpen} />}
    </div>
  );
}
