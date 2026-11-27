import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchField } from "@/components/page/PageParts";
import { useToast } from "@/hooks/use-toast";
import { useMe } from "@/hooks/useMyAttendance";
import { inventorySearchFilter } from "@/lib/partSearch";
import {
  addTransferLine, otherWarehouse, transferParts, usePartTransfers, validateTransfer,
  type TransferLine, type Warehouse,
} from "@/lib/partTransfers";
import { ArrowLeftRight, ArrowRight, History, Loader2, Minus, Plus, Search, Truck, X } from "lucide-react";

type Hit = { id: string; part_code: string; part_name: string; quantity: number | null; location_main: string | null; location_sub: string | null };
const loc = (m: string | null, s: string | null) => [m, s].filter(Boolean).join(" / ");

/**
 * 부품관리 「창고 이동」: 장흥 ↔ 강진 창고 사이에 부품을 옮긴다.
 * 보내는 창고 차감·받는 창고 가산·이력은 transfer_parts 한 번으로 처리된다 (재고가 모자라면 통째로 취소).
 */
export default function PartTransfers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [from, setFrom] = useState<Warehouse>("장흥");
  const to = otherWarehouse(from);
  const [lines, setLines] = useState<TransferLine[]>([]);
  const [memo, setMemo] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [historyQ, setHistoryQ] = useState("");

  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 250); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setLines([]); }, [from]);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["transfer-search", from, debounced],
    enabled: debounced.length >= 2,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory")
        .select("id, part_code, part_name, quantity, location_main, location_sub")
        .eq("branch", from).or(inventorySearchFilter(debounced)).order("part_code").limit(20);
      if (error) throw error;
      return (data ?? []) as Hit[];
    },
  });
  const codes = hits.map((h) => h.part_code);
  const { data: dest = new Map<string, Hit>() } = useQuery({
    queryKey: ["transfer-dest", to, codes.join("|")],
    enabled: codes.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const { data } = await supabase.from("inventory").select("id, part_code, part_name, quantity, location_main, location_sub").eq("branch", to).in("part_code", codes);
      return new Map(((data ?? []) as Hit[]).map((d) => [d.part_code, d]));
    },
  });

  const problem = validateTransfer(lines);
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const send = useMutation({
    mutationFn: () => transferParts(from, to, lines, memo.trim(), me?.name ?? null),
    onSuccess: () => {
      toast({ title: `${from} → ${to} 이동 완료`, description: `${lines.length}종 ${total}개를 옮겼어요` });
      setLines([]); setMemo(""); setSearch("");
      ["part-transfers", "inventory", "inventory-search", "inventory-stats", "transfer-search", "transfer-dest", "inventory_adjustments"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: Error) => toast({ title: "옮기지 못했어요", description: e.message, variant: "destructive" }),
  });
  const setQty = (code: string, q: number) => setLines((l) => l.map((x) => (x.part_code === code ? { ...x, quantity: Math.max(1, Math.min(x.stock, q)) } : x)));

  const { data: history = [], isLoading: histLoading } = usePartTransfers();
  const shownHistory = useMemo(() => {
    const t = historyQ.trim().toLowerCase();
    if (!t) return history;
    return history.filter((h) => [h.memo, h.moved_by_name, ...h.part_transfer_items.flatMap((i) => [i.part_code, i.part_name])].some((v) => (v ?? "").toLowerCase().includes(t)));
  }, [history, historyQ]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <section className="rounded-3xl border border-border/70 bg-card card-shadow p-4 sm:p-5 space-y-4 min-w-0">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold">창고 이동</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-2xl bg-muted/60 px-4 py-3 text-center">
            <p className="text-[11px] text-muted-foreground">보내는 창고</p>
            <p className="text-lg font-bold">{from}</p>
          </div>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-full shrink-0" aria-label="방향 바꾸기" onClick={() => setFrom(to)}>
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <div className="flex-1 rounded-2xl bg-primary/10 px-4 py-3 text-center">
            <p className="text-[11px] text-muted-foreground">받는 창고</p>
            <p className="text-lg font-bold text-primary">{to}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder={`${from} 재고에서 부품번호·이름 검색`} />
          </div>
          {debounced.length >= 2 && (
            <div className="rounded-xl border max-h-64 overflow-y-auto divide-y">
              {isFetching && !hits.length ? <p className="p-3 text-xs text-muted-foreground">찾는 중…</p>
                : hits.length === 0 ? <p className="p-3 text-xs text-muted-foreground">{from} 재고에 없어요.</p>
                : hits.map((h) => {
                  const d = dest.get(h.part_code);
                  const stock = h.quantity ?? 0;
                  return (
                    <button key={h.id} type="button" disabled={stock <= 0} className="w-full text-left px-3 py-2 hover:bg-muted/60 disabled:opacity-50"
                      onClick={() => { setLines((l) => addTransferLine(l, { part_code: h.part_code, part_name: h.part_name, stock, dest_qty: d?.quantity ?? null, dest_location: d ? loc(d.location_main, d.location_sub) || null : null })); setSearch(""); }}>
                      <span className="text-sm font-medium">{h.part_name}</span>
                      <span className="block text-[11px] text-muted-foreground font-mono">
                        {h.part_code} · {from} {stock}개{h.location_main ? ` (${loc(h.location_main, h.location_sub)})` : ""} · {to} {d ? `${d.quantity ?? 0}개` : "없음"}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {lines.length > 0 ? (
          <ul className="rounded-2xl border divide-y">
            {lines.map((l) => (
              <li key={l.part_code} className="px-3 py-2.5 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 basis-full sm:basis-0 flex-1 text-sm">
                    <span className="break-words font-medium">{l.part_name || l.part_code}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{l.part_code} · {from} {l.stock}개 → {to} {l.dest_qty ?? 0}개</span>
                  </span>
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(l.part_code, l.quantity - 1)} aria-label="하나 빼기"><Minus className="h-3.5 w-3.5" /></Button>
                  <Input value={l.quantity} inputMode="numeric" className="h-8 w-14 text-center" onChange={(e) => setQty(l.part_code, parseInt(e.target.value.replace(/\D/g, "")) || 1)} />
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={l.quantity >= l.stock} onClick={() => setQty(l.part_code, l.quantity + 1)} aria-label="하나 더"><Plus className="h-3.5 w-3.5" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLines((x) => x.filter((y) => y.part_code !== l.part_code))} aria-label="빼기"><X className="h-4 w-4" /></Button>
                </div>
                <Input value={l.to_location} onChange={(e) => setLines((x) => x.map((y) => (y.part_code === l.part_code ? { ...y, to_location: e.target.value } : y)))}
                  className="h-8 text-xs" placeholder={`${to} 보관 위치 ${l.dest_location ? `(지금: ${l.dest_location}, 비우면 그대로)` : "(선택)"}`} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6 rounded-2xl border border-dashed">옮길 부품을 검색해서 담으세요</p>
        )}

        <div className="space-y-1.5">
          <Label>메모</Label>
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 강진 YT5113A 수리용, 마성수 차로 운반" />
        </div>

        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground flex-1">{problem && lines.length ? problem : lines.length ? `${lines.length}종 ${total}개` : ""}</p>
          <Button onClick={() => send.mutate()} disabled={!!problem || send.isPending} className="gap-1.5 rounded-full">
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} {to}으로 옮기기
          </Button>
        </div>
      </section>

      <section className="space-y-3 min-w-0">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-bold flex-1">이동 기록</h2>
          <SearchField value={historyQ} onChange={setHistoryQ} placeholder="부품·메모로 찾기" className="max-w-[220px]" />
        </div>
        {histLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…</p>
        ) : shownHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10 rounded-3xl border border-dashed">이동 기록이 없어요</p>
        ) : (
          <ul className="space-y-3">
            {shownHistory.map((h) => (
              <li key={h.id} className="rounded-3xl border border-border/70 bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-bold">{h.from_branch} → {h.to_branch}</span>
                  <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  {h.moved_by_name && <span className="text-xs text-muted-foreground">· {h.moved_by_name}</span>}
                </div>
                {h.memo && <p className="text-sm break-words">{h.memo}</p>}
                <ul className="rounded-2xl bg-muted/50 divide-y divide-border/60">
                  {h.part_transfer_items.map((i) => (
                    <li key={i.id} className="flex items-baseline gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="break-words">{i.part_name || i.part_code}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">{i.part_code}{i.to_location ? ` · ${h.to_branch} ${i.to_location}` : ""}</span>
                      </span>
                      <span className="font-bold tabular-nums shrink-0">{i.quantity}개</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

