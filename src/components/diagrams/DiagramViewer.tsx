import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useDiagramImageUrl, useHotspots, type Diagram, type DiagramHotspot } from "@/hooks/useDiagrams";
import PartCodeAutocomplete from "@/components/PartCodeAutocomplete";
import PartDetailSheet from "@/components/diagrams/PartDetailSheet";
import { ArrowLeft, Pencil, Check, Trash2, MousePointerClick } from "lucide-react";

type Rect = { x: number; y: number; w: number; h: number };

type Props = {
  diagram: Diagram;
  onBack: () => void;
};

export default function DiagramViewer({ diagram, onBack }: Props) {
  const { toast } = useToast();
  const { data: imageUrl, isLoading: imgLoading } = useDiagramImageUrl(diagram.image_path);
  const { hotspots, isLoading, addHotspot, deleteHotspot } = useHotspots(diagram.id);

  const [editing, setEditing] = useState(false);
  const [drawRect, setDrawRect] = useState<Rect | null>(null);
  const [pendingRect, setPendingRect] = useState<Rect | null>(null);
  const [selected, setSelected] = useState<{ code: string; name: string | null } | null>(null);

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
    addHotspot.mutate(
      {
        diagram_id: diagram.id,
        part_code: item.part_code,
        part_name: item.part_name,
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

  const uniqueCodes = Array.from(new Map(hotspots.map((h) => [h.part_code, h])).values());

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
          부품 라벨 위를 드래그해서 네모 상자를 그리면 부품번호를 지정할 수 있습니다. 상자 왼쪽 위 × 버튼으로 삭제합니다.
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
                : "border-transparent hover:border-primary hover:bg-primary/20 active:bg-primary/30"
            }`}
            style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }}
            onClick={(e) => {
              e.stopPropagation();
              if (!editing) setSelected({ code: h.part_code, name: h.part_name });
            }}
          >
            <span
              className={`absolute -top-4 left-0 text-[9px] leading-none px-1 py-0.5 rounded whitespace-nowrap font-mono ${
                editing ? "bg-amber-400 text-black font-bold" : "bg-primary text-primary-foreground opacity-0 hover:opacity-100"
              }`}
            >
              {h.part_code}
            </span>
            {editing && (
              <span
                role="button"
                tabIndex={0}
                className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full p-0.5 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteHotspot.mutate(h.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </span>
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
          도면 위 부품 영역을 누르면 재고 위치·가격과 수리 이력을 볼 수 있습니다. 아래 부품 목록을 눌러도 됩니다.
        </p>
      )}

      {/* 부품 칩 목록 */}
      {uniqueCodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {uniqueCodes.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setSelected({ code: h.part_code, name: h.part_name })}
              className="text-xs font-mono px-2.5 py-1.5 rounded-lg border bg-card hover:border-primary hover:text-primary transition-colors"
            >
              {h.part_code}
            </button>
          ))}
        </div>
      )}
      {!isLoading && hotspots.length === 0 && !editing && (
        <p className="text-sm text-muted-foreground">
          아직 부품 영역이 등록되지 않았습니다. 위의 「영역 편집」을 눌러 추가하세요.
        </p>
      )}

      {/* 부품번호 지정 다이얼로그 */}
      <Dialog open={!!pendingRect} onOpenChange={(v) => !v && setPendingRect(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>부품번호 지정</DialogTitle>
          </DialogHeader>
          <PartCodeAutocomplete branch={null} onSelect={handleAssign} placeholder="부품번호 또는 이름 검색..." />
          <p className="text-xs text-muted-foreground">
            목록에 없는 부품번호는 부품관리에 먼저 등록해 주세요.
          </p>
        </DialogContent>
      </Dialog>

      {/* 부품 상세 */}
      <PartDetailSheet
        partCode={selected?.code ?? null}
        partName={selected?.name ?? null}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      />
    </div>
  );
}
