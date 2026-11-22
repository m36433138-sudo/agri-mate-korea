import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useUserRole } from "@/hooks/useUserRole";
import { formatPrice } from "@/lib/formatters";
import { PartSaleDialog } from "@/components/partSales/PartSaleDialog";
import { PartSaleDetailDialog } from "@/components/partSales/PartSaleDetailDialog";
import { usePartSales } from "@/components/partSales/usePartSales";
import type { PartSaleRow } from "@/components/partSales/types";
import { buyerOf, PAYMENT_MODE_LABELS } from "@/components/partSales/types";
import { ShoppingCart, Plus, Search } from "lucide-react";
import { PageHeader, SearchField, Segmented } from "@/components/page/PageParts";

type Period = "today" | "month" | "last" | "all";

const kst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

function rangeOf(p: Period): [string | null, string | null] {
  const today = kst();
  if (p === "today") return [today, today];
  if (p === "all") return [null, null];
  const [y, m] = today.split("-").map(Number);
  if (p === "month") return [`${today.slice(0, 7)}-01`, null];
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const mm = String(pm).padStart(2, "0");
  return [`${py}-${mm}-01`, `${py}-${mm}-${last}`];
}

export default function PartSalesPage() {
  const { hasPermission } = useUserRole();
  const canManage = hasPermission("manage_part_sales");
  const [period, setPeriod] = useState<Period>("month");
  const [branch, setBranch] = useState<"all" | "장흥" | "강진">("all");
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<PartSaleRow | null>(null);

  const [from, to] = rangeOf(period);
  const { data: sales = [], isLoading } = usePartSales(from, to);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return sales.filter((s) => {
      if (branch !== "all" && s.branch !== branch) return false;
      if (!term) return true;
      const hay = [
        buyerOf(s), s.customers?.phone, s.buyer_phone, s.notes,
        ...(s.part_sale_items ?? []).flatMap((i) => [i.part_code, i.part_name]),
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [sales, branch, q]);

  const total = filtered.reduce((s, r) => s + Number(r.total_amount), 0);
  const credit = filtered.reduce((s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.paid_amount)), 0);
  const qty = filtered.reduce((s, r) => s + (r.part_sale_items ?? []).reduce((a, i) => a + i.quantity, 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="부품 판매"
        sub="카운터 판매 · 외상은 미수금으로 자동 등록"
        actions={canManage ? (
          <Button onClick={() => setNewOpen(true)} className="h-11 rounded-full px-5">
            <Plus className="h-4 w-4 mr-1" /> 부품 판매 등록
          </Button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">판매 금액</p>
          <p className="text-[20px] sm:text-[24px] leading-tight font-extrabold tracking-tight tabular-nums mt-1.5">{isLoading ? "–" : formatPrice(total)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{filtered.length}건</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">받은 금액</p>
          <p className="text-[20px] sm:text-[24px] leading-tight font-extrabold tracking-tight tabular-nums mt-1.5 text-green-500">{isLoading ? "–" : formatPrice(total - credit)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">외상으로 판매</p>
          <p className="text-[20px] sm:text-[24px] leading-tight font-extrabold tracking-tight tabular-nums mt-1.5 text-amber-500">{isLoading ? "–" : formatPrice(credit)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">판매 수량</p>
          <p className="text-[20px] sm:text-[24px] leading-tight font-extrabold tracking-tight tabular-nums mt-1.5">{isLoading ? "–" : `${qty.toLocaleString("ko-KR")}개`}</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <Segmented<Period>
            label="기간"
            value={period}
            onChange={setPeriod}
            options={[{ value: "today", label: "오늘" }, { value: "month", label: "이번 달" }, { value: "last", label: "지난 달" }, { value: "all", label: "전체" }]}
          />
          <Segmented<"all" | "장흥" | "강진">
            label="지점"
            value={branch}
            onChange={setBranch}
            options={[{ value: "all", label: "두 지점" }, { value: "장흥", label: "장흥" }, { value: "강진", label: "강진" }]}
          />
        </div>
        <SearchField value={q} onChange={setQ} placeholder="고객, 전화, 부품번호, 품명" className="lg:max-w-sm lg:ml-auto" />
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border/40">
          {isLoading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-muted-foreground">이 기간에 부품 판매 기록이 없어요.</p>
              {canManage && <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> 첫 판매 등록</Button>}
            </div>
          ) : filtered.map((s) => {
            const items = s.part_sale_items ?? [];
            const owe = Number(s.total_amount) - Number(s.paid_amount);
            return (
              <button key={s.id} type="button" onClick={() => setDetail(s)}
                className="w-full text-left px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground tabular-nums">{s.sale_date}</span>
                    <Badge variant="outline" className="text-[11px]">{s.branch}</Badge>
                    <span className="text-sm font-semibold truncate">{buyerOf(s)}</span>
                    {!s.customer_id && <span className="text-[11px] text-muted-foreground">미등록</span>}
                    <Badge className={`text-[11px] ${s.payment_mode === "paid" ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>
                      {PAYMENT_MODE_LABELS[s.payment_mode]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {items.slice(0, 3).map((i) => `${i.part_name || i.part_code} ×${i.quantity}`).join(", ")}
                    {items.length > 3 ? ` 외 ${items.length - 3}건` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{formatPrice(s.total_amount)}</p>
                  {owe > 0 && <p className="text-xs text-destructive tabular-nums">외상 {formatPrice(owe)}</p>}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <PartSaleDialog open={newOpen} onOpenChange={setNewOpen} />
      <PartSaleDetailDialog sale={detail} onClose={() => setDetail(null)} canManage={canManage} />
    </div>
  );
}
