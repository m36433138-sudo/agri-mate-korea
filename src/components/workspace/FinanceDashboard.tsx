import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle2, Link2 } from "lucide-react";
import type { FinanceRecord, WorkspaceFilters } from "@/types/workspace";
import { FINANCE_TYPE_LABELS } from "@/types/workspace";
import { useFinance } from "@/hooks/useFinance";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { differenceInDays, format } from "date-fns";
import { ko } from "date-fns/locale";

interface Props {
  filters: WorkspaceFilters;
  onAdd: () => void;
  onEdit: (record: FinanceRecord) => void;
}

export function FinanceDashboard({ filters, onAdd, onEdit }: Props) {
  const { finance, isLoading, deleteFinance, markPaid } = useFinance();
  const { userId, isAdmin } = useUserRole();
  const { toast } = useToast();

  const [showPaid, setShowPaid] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  // 필터 적용
  const filtered = finance.filter((f) => {
    if (filters.myOnly && f.created_by !== userId) return false;
    if (!showPaid && f.is_paid) return false;
    if (filters.customerSearch) {
      const search = filters.customerSearch.toLowerCase();
      const name = f.customers?.name?.toLowerCase() ?? "";
      if (!name.includes(search)) return false;
    }
    return true;
  });

  // 요약 통계
  const unpaid = finance.filter((f) => !f.is_paid && f.record_type === "receivable");
  const totalReceivable = unpaid.reduce((sum, f) => sum + Number(f.amount), 0);
  const overdueCount = unpaid.filter((f) => f.due_date && f.due_date < today).length;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyPayments = finance
    .filter((f) => f.is_paid && f.paid_date?.startsWith(thisMonth))
    .reduce((sum, f) => sum + Number(f.amount), 0);

  const handleDelete = async (record: FinanceRecord) => {
    if (!window.confirm("삭제하시겠어요?")) return;
    try {
      await deleteFinance.mutateAsync(record.id);
      toast({ title: "삭제됐어요." });
    } catch {
      toast({ title: "삭제 실패", variant: "destructive" });
    }
  };

  const handleMarkPaid = async (record: FinanceRecord) => {
    try {
      await markPaid.mutateAsync({ id: record.id, paid_date: today });
      toast({ title: "입금 처리됐어요." });
    } catch {
      toast({ title: "처리 실패", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="미수금 합계"
          value={totalReceivable.toLocaleString("ko-KR") + "원"}
          highlight={totalReceivable > 0}
        />
        <SummaryCard
          label="이번 달 입금"
          value={monthlyPayments.toLocaleString("ko-KR") + "원"}
        />
        <SummaryCard
          label="미수금 건수"
          value={`${unpaid.length}건`}
          highlight={unpaid.length > 0}
        />
        <SummaryCard
          label="연체 건수"
          value={`${overdueCount}건`}
          highlight={overdueCount > 0}
          danger
        />
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowPaid(!showPaid)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              showPaid ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border"
            }`}
          >
            {showPaid ? "✓ " : ""}입금 완료 포함
          </button>
        </div>
        <Button size="sm" onClick={onAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> 미수금 등록
        </Button>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12 border border-dashed rounded-lg">
          재무 기록이 없어요
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">고객</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">유형</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">금액</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">만기/상태</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((record) => (
                  <FinanceRow
                    key={record.id}
                    record={record}
                    today={today}
                    canEdit={isAdmin || record.created_by === userId}
                    onEdit={() => onEdit(record)}
                    onDelete={() => handleDelete(record)}
                    onMarkPaid={() => handleMarkPaid(record)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, highlight = false, danger = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-3 ${
        danger ? "border-red-200 bg-red-50" : highlight ? "border-orange-200 bg-orange-50" : ""
      }`}
    >
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-bold ${danger ? "text-red-600" : highlight ? "text-orange-600" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function FinanceRow({
  record, today, canEdit, onEdit, onDelete, onMarkPaid,
}: {
  record: FinanceRecord;
  today: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPaid: () => void;
}) {
  const isOverdue = !record.is_paid && record.due_date && record.due_date < today;
  const daysOverdue = record.due_date
    ? differenceInDays(new Date(), new Date(record.due_date))
    : null;

  return (
    <tr
      className={`hover:bg-muted/30 transition-colors ${
        isOverdue ? "bg-red-50" : record.is_paid ? "opacity-50" : ""
      }`}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 text-xs">
          {record.customers ? (
            <>
              <Link2 className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{record.customers.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
        {record.documents && (
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]">
            {record.documents.title}
          </div>
        )}
      </td>
      <td className="px-3 py-2 hidden md:table-cell">
        <Badge variant="outline" className="text-[10px]">
          {FINANCE_TYPE_LABELS[record.record_type]}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right font-semibold text-xs">
        {Number(record.amount).toLocaleString("ko-KR")}원
      </td>
      <td className="px-3 py-2 text-center">
        {record.is_paid ? (
          <span className="text-[11px] text-green-600 font-medium">
            입금완료 {record.paid_date ? format(new Date(record.paid_date), "MM/dd", { locale: ko }) : ""}
          </span>
        ) : isOverdue ? (
          <span className="text-[11px] text-red-600 font-semibold">
            D+{daysOverdue} 연체
          </span>
        ) : record.due_date ? (
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(record.due_date), "MM/dd", { locale: ko })} 만기
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          {!record.is_paid && canEdit && (
            <button
              onClick={onMarkPaid}
              className="p-0.5 rounded hover:bg-green-100 text-muted-foreground hover:text-green-600 transition-colors"
              title="입금 처리"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && (
            <>
              <button
                onClick={onEdit}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-0.5 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
