import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFinance } from "@/hooks/useFinance";
import { useUserRole } from "@/hooks/useUserRole";
import { FinanceModal } from "@/components/workspace/modals/FinanceModal";
import { PageHeader, Segmented } from "@/components/page/PageParts";
import { DepositInbox } from "@/components/deposits/DepositInbox";
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
  const { hasPermission, isAdmin } = useUserRole();
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
      <PageHeader
        title="미수금 관리"
        sub={isLoading ? "불러오는 중…" : <>미결제 {unpaid.length}건{overdue.length > 0 && <> · <span className="text-destructive font-semibold">연체 {overdue.length}건</span></>}</>}
        actions={canManage ? (
          <Button onClick={openNew} className="h-11 rounded-full px-5">
            <Plus className="h-4 w-4 mr-1" /> 미수금 등록
          </Button>
        ) : undefined}
      />

      {/* 요약 카드 (누르면 거르기) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {([
          { key: "all" as Filter, label: "총 미수 잔액", icon: Wallet, value: fmt(totalOutstanding), sub: `${unpaid.length}건`, tone: "" },
          { key: "overdue" as Filter, label: "연체", icon: AlertTriangle, value: fmt(overdueAmount), sub: `${overdue.length}건`, tone: overdueAmount > 0 ? "text-destructive" : "" },
          { key: "soon" as Filter, label: "만기 임박 (3일)", icon: CalendarClock, value: `${soon.length}건`, sub: fmt(soon.reduce((sum, f) => sum + outstandingOf(f), 0)), tone: soon.length > 0 ? "text-amber-600 dark:text-amber-400" : "" },
          { key: "paid" as Filter, label: "이번 달 입금", icon: CheckCircle2, value: fmt(monthIncome), sub: `완납 ${paid.length}건`, tone: "text-up" },
        ]).map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={`text-left rounded-3xl border bg-card card-shadow p-4 sm:p-5 transition-all ${
              filter === c.key ? "border-transparent ring-2 ring-primary" : "border-border/70 hover:border-foreground/20"
            }`}
          >
            <span className="flex items-center gap-2 text-[13px] sm:text-sm font-medium text-muted-foreground">
              <span className="hidden sm:flex w-8 h-8 rounded-full bg-foreground/[0.06] items-center justify-center"><c.icon className="h-4 w-4" /></span>
              {c.label}
            </span>
            <span className={`block mt-2.5 text-[20px] sm:text-[26px] leading-none font-extrabold tracking-tight tabular-nums ${c.tone}`}>
              {isLoading ? "–" : c.value}
            </span>
            <span className="block mt-1.5 text-xs text-muted-foreground">{isLoading ? "" : c.sub}</span>
          </button>
        ))}
      </div>

      {/* 입금 문자 → 미수금 매칭 대기 */}
      <DepositInbox finance={finance} canManage={canManage} isAdmin={isAdmin} />

      {/* 필터 */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <Segmented<Filter>
          label="미수금 거르기"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `미결제 ${unpaid.length}` },
            { value: "overdue", label: `연체 ${overdue.length}` },
            { value: "soon", label: `만기 임박 ${soon.length}` },
            { value: "paid", label: `완납 ${paid.length}` },
          ]}
        />
      </div>

      {/* 고객별 목록 */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            불러오는 중...
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {filter === "paid" ? "완납된 미수금이 없습니다." : "미수금이 없습니다."}
          </CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.customerId ?? "none"} className="overflow-hidden">
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
                        {r.assignee && <span className="shrink-0 text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5">담당 {r.assignee}</span>}
                        {r.is_paid ? (
                          <Badge className="text-[11px] bg-green-500/15 text-green-700 dark:text-green-400 shrink-0 hover:bg-green-500/15">완납</Badge>
                        ) : d !== null && d < 0 ? (
                          <Badge className="text-[11px] bg-destructive/15 text-destructive shrink-0 hover:bg-destructive/15">
                            연체 {Math.abs(d)}일
                          </Badge>
                        ) : d !== null && d <= 3 ? (
                          <Badge className="text-[11px] bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0 hover:bg-amber-500/15">
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
