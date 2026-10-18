import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinance } from "@/hooks/useFinance";
import { useUserRole } from "@/hooks/useUserRole";
import { FinanceModal } from "@/components/workspace/modals/FinanceModal";
import type { FinanceRecord } from "@/types/workspace";
import { outstandingOf, SOURCE_TYPE_LABELS } from "@/types/workspace";
import {
  Plus, Wallet, AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, Users,
} from "lucide-react";

const fmt = (n: number) => `₩${Math.round(Number(n)).toLocaleString("ko-KR")}`;

type Filter = "all" | "overdue" | "soon" | "paid";

const dayDiff = (due: string | null, today: string) => {
  if (!due) return null;
  const a = new Date(due).getTime();
  const b = new Date(today).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
};

export default function ReceivablesPage() {
  const { finance, isLoading } = useFinance();
  const { hasPermission } = useUserRole();
  const canManage = hasPermission("manage_receivables");

  const [filter, setFilter] = useState<Filter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FinanceRecord | undefined>();

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const receivables = useMemo(
    () => finance.filter((f) => f.record_type === "receivable"),
    [finance]
  );

  const unpaid = receivables.filter((f) => !f.is_paid && outstandingOf(f) > 0);
  const overdue = unpaid.filter((f) => {
    const d = dayDiff(f.due_date, today);
    return d !== null && d < 0;
  });
  const soon = unpaid.filter((f) => {
    const d = dayDiff(f.due_date, today);
    return d !== null && d >= 0 && d <= 3;
  });
  const paid = receivables.filter((f) => f.is_paid);

  const totalOutstanding = unpaid.reduce((s, f) => s + outstandingOf(f), 0);
  const overdueAmount = overdue.reduce((s, f) => s + outstandingOf(f), 0);

  const monthIncome = useMemo(() => {
    let sum = 0;
    finance.forEach((f) =>
      (f.finance_payments ?? []).forEach((p) => {
        if (p.paid_date?.startsWith(thisMonth)) sum += Number(p.amount);
      })
    );
    return sum;
  }, [finance, thisMonth]);

  const filtered =
    filter === "all" ? unpaid
    : filter === "overdue" ? overdue
    : filter === "soon" ? soon
    : paid;

  // 고객별 그룹 (잔액 큰 순)
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; customerId: string | null; rows: FinanceRecord[]; total: number }>();
    filtered.forEach((f) => {
      const key = f.customer_id ?? "none";
      const g = map.get(key) ?? {
        name: f.customers?.name ?? "고객 미지정",
        customerId: f.customer_id,
        rows: [],
        total: 0,
      };
      g.rows.push(f);
      g.total += f.is_paid ? Number(f.amount) : outstandingOf(f);
      map.set(key, g);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const openNew = () => { setEditTarget(undefined); setModalOpen(true); };
  const openEdit = (r: FinanceRecord) => { setEditTarget(r); setModalOpen(true); };

  const recordTitle = (r: FinanceRecord) =>
    r.documents?.title || r.notes || `${SOURCE_TYPE_LABELS[r.source_type] ?? "미수금"} 미수금`;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">미수금 관리</h1>
        </div>
        {canManage && (
          <Button onClick={openNew} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1" /> 미수금 등록
          </Button>
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">총 미수 잔액</p>
            <p className="text-lg font-extrabold tabular-nums mt-1">
              {isLoading ? "–" : fmt(totalOutstanding)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{unpaid.length}건</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-destructive" /> 연체
            </p>
            <p className="text-lg font-extrabold tabular-nums mt-1 text-destructive">
              {isLoading ? "–" : fmt(overdueAmount)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{overdue.length}건</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarClock className="h-3 w-3 text-amber-500" /> 만기 임박 (3일)
            </p>
            <p className="text-lg font-extrabold tabular-nums mt-1 text-amber-500">
              {isLoading ? "–" : soon.length}건
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLoading ? "" : fmt(soon.reduce((s, f) => s + outstandingOf(f), 0))}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> 이번 달 입금
            </p>
            <p className="text-lg font-extrabold tabular-nums mt-1 text-green-500">
              {isLoading ? "–" : fmt(monthIncome)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "all", label: `미결제 ${unpaid.length}` },
            { key: "overdue", label: `연체 ${overdue.length}` },
            { key: "soon", label: `만기 임박 ${soon.length}` },
            { key: "paid", label: `완납 ${paid.length}` },
          ] as { key: Filter; label: string }[]
        ).map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* 고객별 목록 */}
      {isLoading ? (
        <Card className="border-0 shadow-card">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            불러오는 중...
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {filter === "paid" ? "완납된 미수금이 없습니다." : "미수금이 없습니다."}
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.customerId ?? "none"} className="border-0 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border/40">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                {g.customerId ? (
                  <Link
                    to={`/customers/${g.customerId}`}
                    className="font-semibold text-sm truncate hover:text-primary transition-colors flex items-center gap-1"
                  >
                    {g.name}
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                  </Link>
                ) : (
                  <span className="font-semibold text-sm truncate">{g.name}</span>
                )}
                <Badge variant="secondary" className="shrink-0 text-xs">{g.rows.length}건</Badge>
              </div>
              <p className="text-sm font-bold tabular-nums">
                {filter === "paid" ? `완납 ${fmt(g.total)}` : `잔액 ${fmt(g.total)}`}
              </p>
            </div>
            <CardContent className="p-0 divide-y divide-border/40">
              {g.rows.map((r) => {
                const balance = outstandingOf(r);
                const d = dayDiff(r.due_date, today);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => canManage && openEdit(r)}
                    className={`w-full text-left px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 transition-colors ${
                      canManage ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[11px] shrink-0">
                          {SOURCE_TYPE_LABELS[r.source_type] ?? "미수금"}
                        </Badge>
                        <span className="text-sm font-medium truncate">{recordTitle(r)}</span>
                        {r.is_paid ? (
                          <Badge className="text-[11px] bg-green-950/60 text-green-400 shrink-0">완납</Badge>
                        ) : d !== null && d < 0 ? (
                          <Badge className="text-[11px] bg-destructive/15 text-destructive shrink-0">
                            연체 {Math.abs(d)}일
                          </Badge>
                        ) : d !== null && d <= 3 ? (
                          <Badge className="text-[11px] bg-amber-950/60 text-amber-400 shrink-0">
                            {d === 0 ? "오늘 만기" : `만기 ${d}일 전`}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        등록 {r.created_at?.slice(0, 10)}
                        {r.due_date ? ` · 만기 ${r.due_date}` : ""}
                        {(r.finance_payments?.length ?? 0) > 0
                          ? ` · 입금 ${r.finance_payments!.length}회`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums">{fmt(balance)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {fmt(Number(r.amount))} 중 입금 {fmt(Number(r.paid_amount ?? 0))}
                      </p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))
      )}

      <FinanceModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
        initialData={editTarget}
      />
    </div>
  );
}
