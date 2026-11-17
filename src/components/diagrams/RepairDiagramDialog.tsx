import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDiagrams } from "@/hooks/useDiagrams";
import { rankRepairDiagrams } from "@/lib/repairDiagrams";
import { ChevronRight, Map as MapIcon } from "lucide-react";

const db = supabase as any;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  repair: { id: string; repair_date?: string | null; repair_content?: string | null; machines?: { model_name?: string | null } | null } | null;
};

/** 수리에 들어간 부품이 나오는 도면을 골라, 그 부품들이 체크된 채로 연다 */
export default function RepairDiagramDialog({ open, onOpenChange, repair }: Props) {
  const navigate = useNavigate();
  const { diagrams, isLoading: diagramsLoading } = useDiagrams();
  const repairId = repair?.id ?? null;

  const { data: parts = [], isLoading: partsLoading } = useQuery({
    queryKey: ["repair-diagram-parts", repairId],
    enabled: open && !!repairId,
    queryFn: async () => {
      const { data, error } = await db
        .from("repair_parts")
        .select("quantity, parts(part_number, part_name)")
        .eq("repair_id", repairId);
      if (error) throw error;
      const map = new Map<string, { code: string; name: string | null; qty: number }>();
      for (const r of data ?? []) {
        const code = r.parts?.part_number?.trim();
        if (!code) continue;
        const prev = map.get(code);
        map.set(code, { code, name: r.parts?.part_name ?? null, qty: (prev?.qty ?? 0) + Number(r.quantity ?? 0) });
      }
      return [...map.values()];
    },
  });

  const codes = parts.map((p) => p.code);
  const { data: hits = [], isLoading: hitsLoading } = useQuery({
    queryKey: ["repair-diagram-hits", codes.join("|")],
    enabled: open && codes.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from("diagram_hotspots")
        .select("diagram_id, part_code")
        .in("part_code", codes)
        .is("target_diagram_id", null)
        .limit(3000);
      if (error) throw error;
      return (data ?? []) as { diagram_id: string; part_code: string }[];
    },
  });

  const byId = useMemo(() => new Map(diagrams.map((d) => [d.id, d])), [diagrams]);
  const machineModel = repair?.machines?.model_name ?? null;
  const ranked = useMemo(() => rankRepairDiagrams(hits, byId, machineModel), [hits, byId, machineModel]);
  const loading = partsLoading || (codes.length > 0 && (hitsLoading || diagramsLoading));
  const found = new Set(ranked.flatMap((r) => r.codes));
  const missing = parts.filter((p) => !found.has(p.code));

  const openOne = (diagramId: string, matched: string[]) => {
    onOpenChange(false);
    navigate(`/diagrams?d=${diagramId}&check=${encodeURIComponent(matched.join(","))}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MapIcon className="h-5 w-5 text-primary" /> 도면에서 사용 부품 보기</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {machineModel ?? "기종 미상"} · {repair?.repair_date ?? ""} {repair?.repair_content ? `· ${repair.repair_content}` : ""}
        </p>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : parts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">이 수리에 등록된 부품이 없습니다. 수리 수정에서 부품을 넣으면 도면에서 체크해 볼 수 있습니다.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {parts.map((p) => (
                <Badge key={p.code} variant="outline" className={`font-mono text-[11px] ${found.has(p.code) ? "border-success/60 text-success" : "text-muted-foreground"}`}>
                  {p.code}{p.qty ? ` ×${p.qty}` : ""}
                </Badge>
              ))}
            </div>
            {ranked.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">등록된 도면에서 이 부품번호를 찾지 못했습니다.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {ranked.slice(0, 40).map((r) => (
                  <li key={r.diagramId}>
                    <button type="button" onClick={() => openOne(r.diagramId, r.codes)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.model}{r.sameModel ? " · 같은 기종" : ""} · 부품 {r.codes.length}개 체크
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {missing.length > 0 && (
              <p className="text-xs text-muted-foreground">도면에 없는 부품: {missing.map((m) => m.code).join(", ")}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
