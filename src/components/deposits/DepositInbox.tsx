import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/formatters";
import type { FinanceRecord } from "@/types/workspace";
import { outstandingOf, SOURCE_TYPE_LABELS } from "@/types/workspace";
import {
  allocateDeposit, confidenceOf, suggestMatches,
  type Allocation, type MatchCandidate, type OpenReceivable,
} from "@/lib/depositMatch";
import { useDeposits, fmtDepositTime, type BankDeposit } from "./useDeposits";
import { DepositPasteDialog } from "./DepositPasteDialog";
import { DepositSetupDialog } from "./DepositSetupDialog";
import { Banknote, Check, ClipboardPaste, EyeOff, Settings2, Undo2 } from "lucide-react";

const confClass = (score: number) =>
  score >= 90 ? "bg-green-500/15 text-green-700 dark:text-green-400" : score >= 60 ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400";

export function DepositInbox({ finance, canManage, isAdmin }: { finance: FinanceRecord[]; canManage: boolean; isAdmin: boolean }) {
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const { data: deposits = [], isLoading } = useDeposits(tab);

  const open: OpenReceivable[] = useMemo(
    () =>
      finance
        .filter((f) => f.record_type === "receivable" && !f.is_paid && outstandingOf(f) > 0)
        .map((f) => ({
          id: f.id, customer_id: f.customer_id, customer_name: f.customers?.name ?? null,
          outstanding: outstandingOf(f), due_date: f.due_date, created_at: f.created_at,
          label: f.documents?.title || f.notes || `${SOURCE_TYPE_LABELS[f.source_type] ?? "미수금"}`,
        })),
    [finance],
  );
  const labelOf = useMemo(() => new Map(open.map((r) => [r.id, r])), [open]);
  const financeById = useMemo(() => new Map(finance.map((f) => [f.id, f])), [finance]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">입금 확인</span>
          <div className="flex gap-1 ml-1">
            <Button size="sm" variant={tab === "pending" ? "secondary" : "ghost"} className="h-7" onClick={() => setTab("pending")}>
              대기{tab === "pending" && deposits.length > 0 ? ` ${deposits.length}` : ""}
            </Button>
            <Button size="sm" variant={tab === "done" ? "secondary" : "ghost"} className="h-7" onClick={() => setTab("done")}>처리됨</Button>
          </div>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="h-4 w-4 mr-1" /> 문자 붙여넣기
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="ghost" onClick={() => setSetupOpen(true)} aria-label="자동 받기 설정">
              <Settings2 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">자동 받기 설정</span>
            </Button>
          )}
        </div>
      </div>
      <CardContent className="p-0 divide-y divide-border/40">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">불러오는 중...</p>
        ) : deposits.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {tab === "pending" ? "확인할 입금이 없어요. 입금 문자가 들어오면 여기에 떠요." : "처리한 입금이 없어요."}
          </p>
        ) : tab === "pending" ? (
          deposits.map((d) => (
            <PendingRow key={d.id} deposit={d} open={open} labelOf={labelOf} canManage={canManage} />
          ))
        ) : (
          deposits.map((d) => <DoneRow key={d.id} deposit={d} financeById={financeById} canManage={canManage} />)
        )}
      </CardContent>
      <DepositPasteDialog open={pasteOpen} onOpenChange={setPasteOpen} />
      {isAdmin && <DepositSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />}
    </Card>
  );
}

function useDepositActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const refresh = () => {
    ["bank-deposits", "finance", "customer-receivables"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
  const approve = useMutation({
    mutationFn: async ({ id, allocations }: { id: string; allocations: Allocation[]; name: string }) => {
      const { error } = await (supabase as any).rpc("approve_bank_deposit", { _deposit_id: id, _allocations: allocations });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { refresh(); toast({ title: `${v.name} 미수금에 입금 처리했어요` }); },
    onError: (e: any) => toast({ title: "승인하지 못했어요", description: e.message, variant: "destructive" }),
  });
  const ignore = useMutation({
    mutationFn: async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("bank_deposits")
        .update({ status: "ignored", decided_by: auth.user?.id, decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast({ title: "미수금과 관계없는 입금으로 넘겼어요" }); },
    onError: (e: any) => toast({ title: "처리하지 못했어요", description: e.message, variant: "destructive" }),
  });
  const revert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("revert_bank_deposit", { _deposit_id: id });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast({ title: "다시 확인 대기로 돌렸어요", description: "넣었던 입금 기록도 지웠어요." }); },
    onError: (e: any) => toast({ title: "되돌리지 못했어요", description: e.message, variant: "destructive" }),
  });
  return { approve, ignore, revert };
}

function PendingRow({ deposit, open, labelOf, canManage }: {
  deposit: BankDeposit; open: OpenReceivable[]; labelOf: Map<string, OpenReceivable>; canManage: boolean;
}) {
  const { approve, ignore } = useDepositActions();
  const candidates = useMemo(
    () => suggestMatches({ amount: Number(deposit.amount), depositorName: deposit.depositor_name }, open),
    [deposit, open],
  );
  const customers = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number; rows: OpenReceivable[] }>();
    for (const r of open) {
      if (!r.customer_id) continue;
      const g = m.get(r.customer_id) ?? { id: r.customer_id, name: r.customer_name ?? "-", total: 0, rows: [] };
      g.total += r.outstanding; g.rows.push(r); m.set(r.customer_id, g);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [open]);

  const [pickedCustomer, setPickedCustomer] = useState<string | null>(null);
  const manual: MatchCandidate | null = useMemo(() => {
    if (!pickedCustomer) return null;
    const g = customers.find((c) => c.id === pickedCustomer);
    if (!g) return null;
    const { allocations, unallocated } = allocateDeposit(Number(deposit.amount), g.rows);
    return { customerId: g.id, customerName: g.name, score: 0, reasons: ["직접 고름"], allocations, unallocated, outstandingTotal: g.total };
  }, [pickedCustomer, customers, deposit.amount]);

  const chosen = manual ?? candidates[0] ?? null;
  const busy = approve.isPending || ignore.isPending;

  return (
    <div className="px-4 sm:px-5 py-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant="outline" className="text-[11px]">{deposit.bank}</Badge>
        <span className="text-xs text-muted-foreground tabular-nums">{fmtDepositTime(deposit.deposited_at)}</span>
        <span className="font-semibold">{deposit.depositor_name ?? "입금자 모름"}</span>
        <span className="ml-auto text-base font-extrabold tabular-nums text-green-500">+{formatPrice(deposit.amount)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground whitespace-pre-line line-clamp-2">{deposit.raw_text}</p>

      {chosen ? (
        <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{chosen.customerName}</span>
            {!manual && <Badge className={`text-[11px] ${confClass(chosen.score)}`}>{confidenceOf(chosen.score)}</Badge>}
            <span className="text-xs text-muted-foreground">{chosen.reasons.join(" · ")}</span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">미수 잔액 {formatPrice(chosen.outstandingTotal)}</span>
          </div>
          <ul className="text-xs space-y-0.5">
            {chosen.allocations.map((a) => (
              <li key={a.finance_id} className="flex justify-between gap-3">
                <span className="truncate text-muted-foreground">{labelOf.get(a.finance_id)?.label ?? "미수금"}</span>
                <span className="tabular-nums shrink-0">{formatPrice(a.amount)}</span>
              </li>
            ))}
          </ul>
          {chosen.unallocated > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">미수금보다 {formatPrice(chosen.unallocated)} 더 들어왔어요. 남는 금액은 따로 확인해 주세요.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-3">
          이름·금액이 맞는 미수금이 없어요. 가족·농장 이름으로 들어온 입금이면 아래에서 고객을 직접 골라 주세요.
        </p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!chosen || busy || chosen.allocations.length === 0}
            onClick={() => chosen && approve.mutate({ id: deposit.id, allocations: chosen.allocations, name: chosen.customerName })}>
            <Check className="h-4 w-4 mr-1" /> {chosen ? `${chosen.customerName} 입금 승인` : "승인"}
          </Button>
          <Select value={pickedCustomer ?? "__auto"} onValueChange={(v) => setPickedCustomer(v === "__auto" ? null : v)}>
            <SelectTrigger className="h-9 w-auto min-w-[150px] text-xs"><SelectValue placeholder="다른 고객 고르기" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto">{candidates.length > 0 ? "추천 고객" : "다른 고객 고르기"}</SelectItem>
              {candidates.slice(1).filter((c) => c.customerId).map((c) => (
                <SelectItem key={`c-${c.customerId}`} value={c.customerId!}>추천 · {c.customerName} ({formatPrice(c.outstandingTotal)})</SelectItem>
              ))}
              {customers.filter((c) => !candidates.slice(1).some((x) => x.customerId === c.id)).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({formatPrice(c.total)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="text-muted-foreground ml-auto" disabled={busy} onClick={() => ignore.mutate(deposit.id)}>
            <EyeOff className="h-4 w-4 mr-1" /> 미수금 아님
          </Button>
        </div>
      )}
    </div>
  );
}

function DoneRow({ deposit, financeById, canManage }: { deposit: BankDeposit; financeById: Map<string, FinanceRecord>; canManage: boolean }) {
  const { revert } = useDepositActions();
  return (
    <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Badge variant="outline" className="text-[11px]">{deposit.bank}</Badge>
      <span className="text-xs text-muted-foreground tabular-nums">{fmtDepositTime(deposit.deposited_at)}</span>
      <span className="font-medium">{deposit.depositor_name ?? "입금자 모름"}</span>
      {deposit.status === "approved" ? (
        <Badge className="text-[11px] bg-green-500/15 text-green-700 dark:text-green-400">→ {deposit.customers?.name ?? "고객"} 입금 처리</Badge>
      ) : (
        <Badge variant="secondary" className="text-[11px]">미수금 아님</Badge>
      )}
      {deposit.status === "approved" && deposit.allocations.length > 1 && (
        <span className="text-xs text-muted-foreground">{deposit.allocations.length}건에 나눠 넣음</span>
      )}
      {Number(deposit.unallocated_amount) > 0 && (
        <span className="text-xs text-amber-600 dark:text-amber-400">남은 {formatPrice(deposit.unallocated_amount)}</span>
      )}
      <span className="ml-auto font-semibold tabular-nums">{formatPrice(deposit.amount)}</span>
      {canManage && (
        <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" disabled={revert.isPending}
          onClick={() => revert.mutate(deposit.id)}>
          <Undo2 className="h-3.5 w-3.5 mr-1" /> 되돌리기
        </Button>
      )}
    </div>
  );
}
