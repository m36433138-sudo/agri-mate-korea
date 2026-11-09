import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useDiagramImageUrl, useHotspots, type Diagram, type DiagramHotspot } from "@/hooks/useDiagrams";
import PartCodeAutocomplete from "@/components/PartCodeAutocomplete";
import PartDetailSheet from "@/components/diagrams/PartDetailSheet";
import { ArrowLeft, Pencil, Check, Trash2, MousePointerClick, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  diagram: Diagram;
  onBack: () => void;
  allDiagrams?: Diagram[];
  onOpenDiagram?: (d: Diagram) => void;
};

export default function DiagramViewer({ diagram, onBack, allDiagrams = [], onOpenDiagram }: Props) {
  const isPhoto = diagram.kind === "photo";
  const [assignMode, setAssignMode] = useState<"part" | "link">(isPhoto ? "link" : "part");
  const [linkSearch, setLinkSearch] = useState("");
  const byId = new Map(allDiagrams.map((d) => [d.id, d]));
  const linkCandidates = allDiagrams
    .filter((d) => d.id !== diagram.id)
    .filter((d) => {
      const q = linkSearch.trim().toLowerCase();
      if (!q) return !diagram.model_name || d.model_name === diagram.model_name;
      return `${d.title} ${d.model_name ?? ""}`.toLowerCase().includes(q);
    })
    .slice(0, 50);
  const openHotspot = (h: DiagramHotspot) => {
    if (h.target_diagram_id) {
      const t = byId.get(h.target_diagram_id);
      if (t && onOpenDiagram) onOpenDiagram(t);
      else toast({ title: "연결된 도면을 찾을 수 없습니다." });
    } else {
      setSelected({ code: h.part_code, name: h.part_name, rect: { x: Number(h.x), y: Number(h.y), w: Number(h.w), h: Number(h.h) } });
    }
  };
  const handleLink = (target: Diagram) => {
    if (!pendingRect) return;
    if (editId) {
      updateHotspot.mutate({ id: editId, part_code: "", part_name: target.title, target_diagram_id: target.id }, {
        onSuccess: () => { toast({ title: `「${target.title}」로 연결을 바꿨습니다.` }); setPendingRect(null); setEditId(null); },
        onError: (e: any) => toast({ title: "변경 실패", description: e.message, variant: "destructive" }),
      });
      return;
    }
    addHotspot.mutate(
      {
        diagram_id: diagram.id,
        part_code: "",
        part_name: target.title,
        target_diagram_id: target.id,
        x: Math.round(pendingRect.x * 10) / 10,
        y: Math.round(pendingRect.y * 10) / 10,
        w: Math.round(pendingRect.w * 10) / 10,
        h: Math.round(pendingRect.h * 10) / 10,
        notes: null,
      },
      {
        onSuccess: () => { toast({ title: `「${target.title}」로 연결했습니다.` }); setPendingRect(null); },
        onError: (e: any) => toast({ title: "추가 실패", description: e.message, variant: "destructive" }),
      }
    );
  };
  const { toast } = useToast();
  const { data: imageUrl, isLoading: imgLoading } = useDiagramImageUrl(diagram.image_path);
  const { hotspots: rawHotspots, isLoading, addHotspot, deleteHotspot, updateHotspot } = useHotspots(diagram.id);
  // 드래그 중 위치 (저장 전 미리보기)
  const [overrides, setOverrides] = useState<Record<string, Rect>>({});
  const hotspots = rawHotspots.map((h) => (overrides[h.id] ? { ...h, ...overrides[h.id] } : h));
  const [editId, setEditId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; mode: "move" | "resize"; start: { x: number; y: number }; orig: Rect; moved: boolean } | null>(null);
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const startDrag = (e: React.PointerEvent, h: DiagramHotspot, mode: "move" | "resize") => {
    if (!editing) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: h.id, mode, start: toPercent(e), orig: { x: Number(h.x), y: Number(h.y), w: Number(h.w), h: Number(h.h) }, moved: false };
  };
  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const p = toPercent(e);
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 0.3) d.moved = true;
    const o = d.orig;
    const next = d.mode === "move"
      ? { ...o, x: Math.min(100 - o.w, Math.max(0, o.x + dx)), y: Math.min(100 - o.h, Math.max(0, o.y + dy)) }
      : { ...o, w: Math.min(100 - o.x, Math.max(1, o.w + dx)), h: Math.min(100 - o.y, Math.max(1, o.h + dy)) };
    setOverrides((s) => ({ ...s, [d.id]: next }));
  };
  const endDrag = (e: React.PointerEvent, h: DiagramHotspot) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    dragRef.current = null;
    const r = overrides[d.id];
    if (!d.moved || !r) {
      // 이동 없이 탭 → 연결 대상 변경
      setOverrides((s) => { const { [d.id]: _, ...rest } = s; return rest; });
      setEditId(h.id);
      setAssignMode(h.target_diagram_id ? "link" : "part");
      setPendingRect({ x: Number(h.x), y: Number(h.y), w: Number(h.w), h: Number(h.h) });
      return;
    }
    updateHotspot.mutate(
      { id: d.id, x: r1(r.x), y: r1(r.y), w: r1(r.w), h: r1(r.h) },
      {
        onSettled: () => setOverrides((s) => { const { [d.id]: _, ...rest } = s; return rest; }),
        onError: (err: any) => toast({ title: "위치 저장 실패", description: err.message, variant: "destructive" }),
      }
    );
  };

  const [editing, setEditing] = useState(false);
  const [drawRect, setDrawRect] = useState<Rect | null>(null);
  const [pendingRect, setPendingRect] = useState<Rect | null>(null);
  const [selected, setSelected] = useState<{ code: string; name: string | null; rect?: Rect } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const toPercent = (e: React.PointerEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editing) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toPercent(e);
    startRef.current = p;
    setDrawRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!editing || !startRef.current) return;
    const p = toPercent(e);
    const s = startRef.current;
    setDrawRect({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };

  const onPointerUp = () => {
    if (!editing || !startRef.current) return;
    startRef.current = null;
    const r = drawRect;
    setDrawRect(null);
    if (r && r.w >= 1 && r.h >= 1) {
      setPendingRect(r);
    }
  };

  const handleAssign = (item: { part_code: string; part_name: string }) => {
    if (!pendingRect) return;
    if (editId) {
      updateHotspot.mutate({ id: editId, part_code: item.part_code, part_name: item.part_name, target_diagram_id: null }, {
        onSuccess: () => { toast({ title: `${item.part_code}로 바꿨습니다.` }); setPendingRect(null); setEditId(null); },
        onError: (e: any) => toast({ title: "변경 실패", description: e.message, variant: "destructive" }),
      });
      return;
    }
    addHotspot.mutate(
      {
        diagram_id: diagram.id,
        part_code: item.part_code,
        part_name: item.part_name,
        target_diagram_id: null,
        x: Math.round(pendingRect.x * 10) / 10,
        y: Math.round(pendingRect.y * 10) / 10,
        w: Math.round(pendingRect.w * 10) / 10,
        h: Math.round(pendingRect.h * 10) / 10,
        notes: null,
      },
      {
        onSuccess: () => {
          toast({ title: `${item.part_code} 영역이 추가되었습니다.` });
          setPendingRect(null);
        },
        onError: (e: any) => toast({ title: "추가 실패", description: e.message, variant: "destructive" }),
      }
    );
  };

  const uniqueCodes = Array.from(new Map(hotspots.filter((h) => !h.target_diagram_id).map((h) => [h.part_code, h])).values());
  const links = hotspots.filter((h) => h.target_diagram_id);

  return (
    <div className="space-y-3">
      {/* 상단 바 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> 목록
        </Button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">{diagram.title}</h2>
          {diagram.model_name && (
            <p className="text-xs text-muted-foreground">{diagram.model_name}</p>
          )}
        </div>
        <Button
          variant={editing ? "default" : "outline"}
          size="sm"
          className="ml-auto gap-1.5 shrink-0"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          {editing ? "편집 완료" : "영역 편집"}
        </Button>
      </div>

      {editing && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          빈 곳을 드래그하면 새 상자, 상자를 끌면 이동, 오른쪽 아래 점을 끌면 크기 조절, 상자를 탭하면 부품번호나 연결할 사진·도면을 바꿉니다. 왼쪽 위 버튼으로 삭제합니다.
        </p>
      )}

      {/* 도면 이미지 */}
      <div
        ref={containerRef}
        className={`relative w-full select-none rounded-xl overflow-hidden border bg-card ${editing ? "touch-none cursor-crosshair" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {imgLoading || !imageUrl ? (
          <Skeleton className="w-full aspect-[3/4]" />
        ) : (
          <img src={imageUrl} alt={diagram.title} className="w-full h-auto block" draggable={false} />
        )}

        {/* 핫스팟 */}
        {hotspots.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`absolute rounded-md border-2 transition-colors ${
              editing
                ? "border-amber-400/80 bg-amber-400/15"
                : h.target_diagram_id
                  ? "border-primary/80 bg-primary/10 hover:bg-primary/25 active:bg-primary/35"
                  : "border-transparent hover:border-primary hover:bg-primary/20 active:bg-primary/30"
            }`}
            style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%`, cursor: editing ? "move" : undefined }}
            onPointerDown={(e) => startDrag(e, h, "move")}
            onPointerMove={moveDrag}
            onPointerUp={(e) => endDrag(e, h)}
            onClick={(e) => {
              e.stopPropagation();
              if (!editing) openHotspot(h);
            }}
          >
            <span
              className={`absolute -top-4 left-0 text-[9px] leading-none px-1 py-0.5 rounded whitespace-nowrap font-mono ${
                editing ? "bg-amber-400 text-black font-bold" : h.target_diagram_id ? "bg-primary text-primary-foreground font-sans text-[11px]" : "bg-primary text-primary-foreground opacity-0 hover:opacity-100"
              }`}
            >
              {h.target_diagram_id ? (byId.get(h.target_diagram_id)?.title ?? h.part_name) : h.part_code}
            </span>
            {editing && (
              <span
                role="button"
                tabIndex={0}
                className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full p-0.5 z-10"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteHotspot.mutate(h.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </span>
            )}
            {editing && (
              <span
                aria-label="크기 조절"
                className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-sm bg-amber-400 border border-background z-10 cursor-nwse-resize"
                onPointerDown={(e) => startDrag(e, h, "resize")}
                onPointerMove={moveDrag}
                onPointerUp={(e) => endDrag(e, h)}
              />
            )}
          </button>
        ))}

        {/* 그리는 중인 상자 */}
        {drawRect && (
          <div
            className="absolute border-2 border-dashed border-primary bg-primary/15 pointer-events-none"
            style={{ left: `${drawRect.x}%`, top: `${drawRect.y}%`, width: `${drawRect.w}%`, height: `${drawRect.h}%` }}
          />
        )}
      </div>

      {!editing && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <MousePointerClick className="h-3.5 w-3.5" />
          {isPhoto
            ? "사진의 파란 상자를 누르면 해당 부위의 부품 도면으로 이동합니다."
            : "도면 위 부품 영역을 누르면 재고 위치·가격과 수리 이력을 볼 수 있습니다. 아래 부품 목록을 눌러도 됩니다."}
        </p>
      )}

      {/* 연결된 도면 목록 */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {links.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => openHotspot(h)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-primary/50 bg-card text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
            >
              <Link2 className="h-3 w-3" />
              {byId.get(h.target_diagram_id!)?.title ?? h.part_name}
            </button>
          ))}
        </div>
      )}

      {/* 부품 칩 목록 */}
      {uniqueCodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {uniqueCodes.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setSelected({ code: h.part_code, name: h.part_name })}
              className="text-xs px-2.5 py-1.5 rounded-lg border bg-card hover:border-primary hover:text-primary transition-colors text-left"
            >
              <span className="font-mono font-semibold">{h.part_code}</span>
              {h.part_name && <span className="ml-1.5 text-muted-foreground">{h.part_name}</span>}
            </button>
          ))}
        </div>
      )}
      {!isLoading && hotspots.length === 0 && !editing && (
        <p className="text-sm text-muted-foreground">
          아직 누를 수 있는 영역이 없습니다. 위의 「영역 편집」을 눌러 추가하세요.
        </p>
      )}

      {/* 부품번호 지정 다이얼로그 */}
      <Dialog open={!!pendingRect} onOpenChange={(v) => { if (!v) { setPendingRect(null); setEditId(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>이 영역에 연결</DialogTitle>
          </DialogHeader>
          <Tabs value={assignMode} onValueChange={(v) => setAssignMode(v as "part" | "link")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="link">도면으로 이동</TabsTrigger>
              <TabsTrigger value="part">부품번호</TabsTrigger>
            </TabsList>
          </Tabs>
          {assignMode === "part" ? (
            <>
              <PartCodeAutocomplete branch={null} onSelect={handleAssign} placeholder="부품번호 또는 이름 검색..." />
              <p className="text-xs text-muted-foreground">목록에 없는 부품번호는 부품관리에 먼저 등록해 주세요.</p>
            </>
          ) : (
            <div className="space-y-2">
              <Input placeholder="도면 이름 검색 (비우면 같은 기종)" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} />
              <div className="max-h-72 overflow-y-auto space-y-1">
                {linkCandidates.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">연결할 도면이 없습니다.</p>
                )}
                {linkCandidates.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleLink(d)}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg border bg-card hover:border-primary"
                  >
                    <span className="block truncate">{d.title}</span>
                    <span className="text-xs text-muted-foreground">{d.kind === "photo" ? "사진" : "도면"}{d.model_name ? ` · ${d.model_name}` : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 부품 상세 */}
      <PartDetailSheet
        partCode={selected?.code ?? null}
        partName={selected?.name ?? null}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        diagramUrl={imageUrl ?? null}
        diagramTitle={diagram.title}
        highlight={selected?.rect ?? null}
        currentDiagramId={diagram.id}
        onOpenDiagram={(id) => { const t = byId.get(id); if (t && onOpenDiagram) { setSelected(null); onOpenDiagram(t); } }}
      />
    </div>
  );
}
