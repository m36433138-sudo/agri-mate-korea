import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpenText, ChevronLeft, ChevronRight, Gift, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAllRows } from "@/lib/pagination";
import {
  buildLedger, fromLedgerEntries, fromPartSale, fromRepair, ledgerToStatement, ledgerYears, monthCounts, periodOf,
  type AppPartSale, type AppRepair, type LedgerEntryRow, type LedgerLine,
} from "@/lib/customerLedger";
import { StatementPrintDialog } from "@/components/print/StatementPrintDialog";
import { mjBookLabel } from "@/components/customers/MjLedgerImportDialog";

const db = supabase as any;
const won = (v: number) => v.toLocaleString("ko-KR");
const SOURCE_LABEL: Record<LedgerLine["source"], string> = { mjsoft: "천년경영", repair: "수리", part_sale: "부품판매" };
const DAYS_STEP = 60;

/** 고객 한 명의 원장 줄 전부: 천년경영 가져온 줄 + (마지막 가져온 날 이후) 앱 수리·부품 판매 */
function useCustomerLedger(customerId: string, machineIds: string[]) {
  return useQuery({
    queryKey: ["customer-ledger", customerId, machineIds.join(",")],
    queryFn: async () => {
      const [entries, { data: last }] = await Promise.all([
        fetchAllRows<LedgerEntryRow>((from, to) => db.from("ledger_entries")
          .select("id, book, legacy_customer_code, source_key, entry_date, kind, item_code, item_name, spec, quantity, unit, unit_price, supply_amount, vat_amount, total_amount, paid_amount, discount_amount, is_free, recorded_at")
          .eq("customer_id", customerId).order("entry_date").order("source_key").range(from, to)),
        db.from("ledger_entries").select("entry_date").order("entry_date", { ascending: false }).limit(1),
      ]);
      // 천년경영을 마지막으로 가져온 날까지는 천년경영 기록이 정본 — 앱 기록은 그 다음 날부터만 더한다
      const cutoff: string | null = last?.[0]?.entry_date ?? null;
      const lines = fromLedgerEntries(entries);

      if (machineIds.length) {
        let q = db.from("repairs")
          .select("id, repair_date, repair_content, technician, labor_cost, total_cost, is_free_service, free_reason, waived_amount, created_at, machines(model_name), repair_parts(quantity, unit_price, parts(part_number, part_name))")
          .in("machine_id", machineIds);
        if (cutoff) q = q.gt("repair_date", cutoff);
        const { data: repairs } = await q;
        const ids = (repairs ?? []).map((r: AppRepair) => r.id);
        const { data: recs } = ids.length
          ? await db.from("finance_records").select("source_id, amount, paid_amount, is_paid").eq("source_type", "repair").in("source_id", ids)
          : { data: [] };
        const owe = new Map<string, number>((recs ?? []).map((f: any) => [f.source_id, f.is_paid ? 0 : Math.max(0, Number(f.amount) - Number(f.paid_amount))]));
        for (const r of (repairs ?? []) as AppRepair[]) lines.push(...fromRepair(r, owe.get(r.id) ?? 0));
      }
      // 부품 판매는 권한이 없으면 RLS가 비워서 준다
      let sq = db.from("part_sales").select("id, sale_date, subtotal, discount, total_amount, paid_amount, payment_method, created_at, part_sale_items(part_code, part_name, quantity, unit_price)").eq("customer_id", customerId);
      if (cutoff) sq = sq.gt("sale_date", cutoff);
      const { data: sales } = await sq;
      for (const s of (sales ?? []) as AppPartSale[]) lines.push(...fromPartSale(s));
      return { lines, cutoff };
    },
  });
}

/**
 * 천년경영 「거래처 원장」처럼 고객의 거래를 해·달로 넘겨 본다.
 * 날짜를 골라 거래명세서를 바로 뽑을 수 있다.
 */
export function CustomerLedgerCard({ customer, machineIds }: {
  customer: { id: string; name: string; phone: string | null; address: string | null };
  machineIds: string[];
}) {
  const { data, isLoading } = useCustomerLedger(customer.id, machineIds);
  const lines = data?.lines ?? [];
  const years = useMemo(() => ledgerYears(lines), [lines]);
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [printOpen, setPrintOpen] = useState(false);
  const [shownDays, setShownDays] = useState(DAYS_STEP);

  const y = year ?? years[0] ?? new Date().getFullYear();
  useEffect(() => { setPicked(new Set()); setShownDays(DAYS_STEP); }, [y, month]);

  const counts = useMemo(() => monthCounts(lines, y), [lines, y]);
  const view = useMemo(() => buildLedger(lines, ...periodOf(y, month)), [lines, y, month]);
  const yi = years.indexOf(y);

  const pickedLines = view.days.filter((d) => picked.has(d.date)).flatMap((d) => d.lines);
  const pickedBalance = pickedLines.length ? pickedLines[pickedLines.length - 1].balance : undefined;
  const doc = pickedLines.length ? ledgerToStatement(pickedLines, customer, pickedBalance) : null;
  const toggle = (date: string) => setPicked((p) => { const n = new Set(p); n.has(date) ? n.delete(date) : n.add(date); return n; });

  if (isLoading) return <Skeleton className="h-40 w-full mb-6" />;
  if (!lines.length) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
        <CardTitle className="min-w-0 text-base font-semibold flex items-center gap-2">
          <BookOpenText className="h-4 w-4 shrink-0 text-muted-foreground" /> 거래 원장
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-9 w-9" disabled={yi < 0 || yi >= years.length - 1} onClick={() => { setYear(years[yi + 1]); setMonth(null); }} aria-label="이전 해">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center font-bold tabular-nums">{y}년</span>
          <Button size="icon" variant="outline" className="h-9 w-9" disabled={yi <= 0} onClick={() => { setYear(years[yi - 1]); setMonth(null); }} aria-label="다음 해">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <MonthChip on={month === null} onClick={() => setMonth(null)} label="전체" />
          {counts.map((c, i) => (
            <MonthChip key={i} on={month === i + 1} disabled={!c} onClick={() => setMonth(i + 1)} label={`${i + 1}월`} dot={c > 0} />
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
          <Stat label="이월 잔액" value={view.opening} />
          <Stat label="매출" value={view.sum.total} sub={`공급가 ${won(view.sum.supply)} · 부가세 ${won(view.sum.vat)}`} />
          <Stat label="입금" value={view.sum.paid} tone="text-sky-700 dark:text-sky-300" />
          <Stat label="할인" value={view.sum.discount} />
          <Stat label="잔액 (미수)" value={view.closing} tone={view.closing > 0 ? "text-rose-600 dark:text-rose-400" : undefined} />
        </div>
        {view.sum.free > 0 && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <Gift className="h-3.5 w-3.5" /> 무상(서비스) {view.sum.free}줄{view.sum.freeAmount ? ` · ${won(view.sum.freeAmount)}원` : ""}
          </p>
        )}

        {view.days.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">이 기간에는 거래가 없어요.</p>
        ) : (
          <ul className="divide-y rounded-2xl border overflow-hidden">
            {view.days.slice(0, shownDays).map((d) => {
              const on = picked.has(d.date);
              const end = d.lines[d.lines.length - 1].balance;
              return (
                <li key={d.date} className={cn("p-3", on && "bg-primary/[0.05]")}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={on} onCheckedChange={() => toggle(d.date)} aria-label={`${d.date} 고르기`} />
                    <span className="font-semibold tabular-nums">{d.date}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">잔액 <b className="text-foreground">{won(end)}</b></span>
                  </label>
                  <ul className="mt-2 space-y-1 pl-6">
                    {d.lines.map((l) => <LedgerRow key={l.key} l={l} />)}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
        {view.days.length > shownDays && (
          <Button variant="outline" className="w-full" onClick={() => setShownDays((n) => n + DAYS_STEP)}>
            더 보기 ({shownDays}/{view.days.length}일)
          </Button>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <p className="text-xs text-muted-foreground mr-auto">
            {data?.cutoff ? `${data.cutoff}까지는 천년경영 기록, 그 뒤는 앱 수리·부품 판매예요.` : "앱 수리·부품 판매 기록이에요."}
          </p>
          {view.days.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setPicked(picked.size === view.days.length ? new Set() : new Set(view.days.map((d) => d.date)))}>
              {picked.size === view.days.length ? "선택 해제" : "기간 전체 선택"}
            </Button>
          )}
          <Button size="sm" className="gap-1.5" disabled={!doc} onClick={() => setPrintOpen(true)}>
            <Printer className="h-4 w-4" /> 거래명세서{picked.size ? ` (${picked.size}일)` : ""}
          </Button>
        </div>
      </CardContent>
      {doc && <StatementPrintDialog doc={doc} open={printOpen} onOpenChange={setPrintOpen} />}
    </Card>
  );
}

function MonthChip({ on, onClick, label, disabled, dot }: { on: boolean; onClick: () => void; label: string; disabled?: boolean; dot?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn("relative shrink-0 h-9 px-3 rounded-full border text-sm font-medium transition-colors disabled:opacity-35",
        on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted")}>
      {label}
      {dot && !on && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />}
    </button>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 px-3 py-2 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-bold tabular-nums truncate", tone)}>{won(value)}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

function LedgerRow({ l }: { l: LedgerLine }) {
  if (l.kind === "adjust") {
    return (
      <li className="flex items-baseline gap-2 text-xs text-amber-700 dark:text-amber-400">
        <span className="min-w-0 flex-1 break-words">⚖ {l.name}</span>
        <span className="tabular-nums font-semibold shrink-0">{l.total > 0 ? "+" : ""}{won(l.total)}</span>
      </li>
    );
  }
  if (l.kind === "memo") {
    return <li className={cn("text-xs italic", l.isFree ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>※ {l.name}</li>;
  }
  if (l.kind === "payment" || l.kind === "discount") {
    return (
      <li className="flex items-baseline gap-2 text-sm">
        <span className={cn("min-w-0 truncate", l.kind === "payment" ? "text-sky-700 dark:text-sky-300" : "text-muted-foreground")}>{l.name}</span>
        <span className="ml-auto tabular-nums font-medium">−{won(l.paid + l.discount)}</span>
      </li>
    );
  }
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span className="min-w-0 flex-1">
        <span className="break-words">{l.name}</span>
        {l.spec && <span className="text-xs text-muted-foreground"> {l.spec}</span>}
        {l.isFree && <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 text-[10px] font-semibold align-middle"><Gift className="h-2.5 w-2.5" />무상</span>}
        {l.source !== "mjsoft" && <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 text-[10px] align-middle">{SOURCE_LABEL[l.source]}</span>}
        {l.book && l.book !== "new" && <span className="ml-1 rounded-full bg-muted text-muted-foreground px-1.5 text-[10px] align-middle">{mjBookLabel(l.book)}</span>}
        {l.qty != null && <span className="block text-[11px] text-muted-foreground tabular-nums">{l.code ? `${l.code} · ` : ""}{l.qty}{l.unit ?? ""} × {won(l.unitPrice)}</span>}
      </span>
      <span className="tabular-nums font-semibold shrink-0">
        {l.isFree && l.waived ? <span className="text-xs text-muted-foreground line-through mr-1">{won(l.waived)}</span> : null}
        {won(l.total)}
      </span>
    </li>
  );
}
