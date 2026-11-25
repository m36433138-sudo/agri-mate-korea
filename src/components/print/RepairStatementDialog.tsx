import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { StatementPrintDialog } from "@/components/print/StatementPrintDialog";
import { loadRepairForStatement, repairToStatement } from "@/lib/repairStatement";

/** 수리 한 건의 거래명세서: 부품·공임·미수금을 불러와 인쇄 창을 연다 (수리 목록 ⋯ 메뉴, 수리 저장 직후) */
export function RepairStatementDialog({ repairId, onClose }: { repairId: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["repair-statement", repairId],
    enabled: !!repairId,
    staleTime: 0,
    queryFn: () => loadRepairForStatement(repairId!),
  });
  if (!repairId) return null;
  if (!data) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>거래명세서</DialogTitle></DialogHeader>
          {isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> 수리 내역 불러오는 중…</p>
          ) : (
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : "수리 내역을 불러오지 못했어요"}</p>
          )}
        </DialogContent>
      </Dialog>
    );
  }
  return <StatementPrintDialog doc={repairToStatement(data)} open onOpenChange={(v) => !v && onClose()} />;
}
