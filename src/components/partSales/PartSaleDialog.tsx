import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/formatters";
import { inventorySearchFilter } from "@/lib/partSearch";
import {
  addPartSaleLine, partSaleTotals, shortageLines, validatePartSale,
  type PartSaleLine, type PartSalePaymentMode,
} from "@/lib/partSales";
import { PAYMENT_METHODS } from "@/types/workspace";
import { Minus, Plus, Search, Trash2, UserCheck, X } from "lucide-react";

type InvHit = {
  id: string; part_code: string; part_name: string; part_name_en: string | null;
  quantity: number | null; sales_price: number | null; location_main: string | null; location_sub: string | null;
};

export interface PartSaleCustomer { id: string; name: string; phone: string | null }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomer?: PartSaleCustomer | null;
  onSaved?: (saleId: string) => void;
}

const today = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export function PartSaleDialog({ open, onOpenChange, initialCustomer, onSaved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [saleDate, setSaleDate] = useState(today());
  const [branch, setBranch] = useState<"장흥" | "강진">("장흥");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [lines, setLines] = useState<PartSaleLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [mode, setMode] = useState<PartSalePaymentMode>("paid");
  const [partialPaid, setPartialPaid] = useState("");
  const [method, setMethod] = useState("현금");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [manual, setManual] = useState({ code: "", name: "", price: "" });
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaleDate(today());
    setCustomerId(initialCustomer?.id ?? null);
    setBuyerName(initialCustomer?.name ?? "");
    setBuyerPhone(initialCustomer?.phone ?? "");
    setLines([]); setDiscount(""); setMode("paid"); setPartialPaid(""); setMethod("현금"); setNotes("");
    setSearch(""); setManual({ code: "", name: "", price: "" }); setShowManual(false);
  }, [open, initialCustomer]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["part-sale-inventory", branch, debounced],
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("id, part_code, part_name, part_name_en, quantity, sales_price, location_main, location_sub")
        .eq("branch", branch)
        .or(inventorySearchFilter(debounced))
        .order("part_code")
        .limit(20);
      if (error) throw error;
      return (data ?? []) as InvHit[];
    },
  });

  // 지점을 바꾸면 담긴 부품의 재고 수량을 그 지점 기준으로 다시 읽는다
  const codes = useMemo(() => lines.map((l) => l.part_code).sort().join("|"), [lines]);
  const { data: stockMap } = useQuery({
    queryKey: ["part-sale-stock", branch, codes],
    enabled: open && lines.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory").select("part_code, quantity").eq("branch", branch).in("part_code", lines.map((l) => l.part_code));
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.part_code as string, Number(r.quantity ?? 0)]));
    },
  });
  const linesWithStock = useMemo(
    () => lines.map((l) => ({ ...l, stock: stockMap ? (stockMap.has(l.part_code) ? stockMap.get(l.part_code)! : null) : l.stock })),
    [lines, stockMap],
  );

  const discountNum = parseInt(discount.replace(/[^0-9]/g, "")) || 0;
  const partialNum = parseInt(partialPaid.replace(/[^0-9]/g, "")) || 0;
  const totals = partSaleTotals(lines, discountNum, mode, partialNum);
  const problem = validatePartSale({ lines, customerId, buyerName, discount: discountNum, mode, partialPaid: partialNum });
  const shortages = shortageLines(linesWithStock);

  const addHit = (h: InvHit) => {
    setLines((prev) => addPartSaleLine(prev, {
      part_code: h.part_code, part_name: h.part_name, quantity: 1,
      unit_price: Number(h.sales_price ?? 0), stock: h.quantity == null ? null : Number(h.quantity),
    }));
    setSearch("");
  };

  const addManual = () => {
    if (!manual.code.trim()) return;
    setLines((prev) => addPartSaleLine(prev, {
      part_code: manual.code.trim(), part_name: manual.name.trim(), quantity: 1,
      unit_price: parseInt(manual.price.replace(/[^0-9]/g, "")) || 0, stock: null,
    }));
    setManual({ code: "", name: "", price: "" });
  };

  const updateLine = (i: number, patch: Partial<PartSaleLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("create_part_sale", {
        _sale: {
          sale_date: saleDate, branch, customer_id: customerId,
          buyer_name: customerId ? null : buyerName, buyer_phone: buyerPhone || null,
          discount: discountNum, payment_mode: mode, paid_amount: mode === "partial" ? partialNum : null,
          payment_method: mode === "unpaid" ? null : method, notes: notes || null,
        },
        _items: lines.map((l) => ({
          part_code: l.part_code.trim(), part_name: l.part_name, quantity: l.quantity, unit_price: Math.round(l.unit_price),
        })),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      ["part-sales", "customer-part-sales", "finance", "customer-receivables", "inventory", "part-sale-inventory"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }));
      toast({
        title: "부품 판매가 저장됐어요",
        description: [
          `${branch} 재고에서 ${lines.reduce((s, l) => s + l.quantity, 0)}개 차감`,
          totals.receivable > 0 ? `미수금 ${formatPrice(totals.receivable)} 등록` : null,
          shortages.length > 0 ? `재고 부족(마이너스) ${shortages.length}종 확인 필요` : null,
        ].filter(Boolean).join(" · "),
        variant: shortages.length > 0 ? "destructive" : undefined,
      });
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "저장하지 못했어요", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-3xl max-h-[92vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>부품 판매 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">판매일</Label>
              <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">출고 지점</Label>
              <Select value={branch} onValueChange={(v) => setBranch(v as "장흥" | "강진")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="장흥">장흥</SelectItem>
                  <SelectItem value="강진">강진</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs flex items-center gap-1.5">
                고객 / 손님 이름
                {customerId && (
                  <Badge className="text-[10px] h-4 px-1.5 bg-primary/15 text-primary gap-0.5">
                    <UserCheck className="h-3 w-3" /> 등록 고객
                  </Badge>
                )}
              </Label>
              <CustomerSearchInput
                value={buyerName}
                onChange={(name) => { setBuyerName(name); setCustomerId(null); }}
                onSelect={(c) => { setCustomerId(c.id); setBuyerName(c.name); setBuyerPhone(c.phone ?? ""); }}
                placeholder="고객 검색 또는 손님 이름"
              />
            </div>
          </div>
          {!customerId && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">손님 전화 (선택)</Label>
                <Input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="010-0000-0000" inputMode="tel" />
              </div>
              <p className="col-span-2 self-end text-xs text-muted-foreground pb-2">
                고객 목록에 없는 손님은 이름만 적어도 판매할 수 있어요. 외상은 등록된 고객만 가능해요.
              </p>
            </div>
          )}

          {/* 부품 찾기 */}
          <div className="space-y-2">
            <Label className="text-xs">부품 담기 · {branch} 재고에서 찾기</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="부품번호(뒷자리만도 가능) 또는 부품명"
                className="pl-9 pr-9"
              />
              {search && (
                <button type="button" aria-label="검색어 지우기" onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {debounced.length >= 2 && (
              <div className="rounded-lg border border-border/60 max-h-60 overflow-y-auto divide-y divide-border/40">
                {hits.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    {isFetching ? "찾는 중..." : `${branch} 재고에 없어요. 아래 「목록에 없는 부품 직접 입력」을 써주세요.`}
                  </div>
                ) : hits.map((h) => (
                  <button key={h.id} type="button" onClick={() => addHit(h)}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        <span className="font-mono text-xs text-muted-foreground mr-1.5">{h.part_code}</span>
                        <span className="font-medium">{h.part_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        위치 {[h.location_main, h.location_sub].filter(Boolean).join(" / ") || "-"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{h.sales_price ? formatPrice(h.sales_price) : "가격 없음"}</p>
                      <p className={`text-xs tabular-nums ${Number(h.quantity ?? 0) > 0 ? "text-muted-foreground" : "text-destructive"}`}>
                        재고 {h.quantity ?? 0}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setShowManual((v) => !v)}>
              {showManual ? "직접 입력 닫기" : "+ 목록에 없는 부품 직접 입력 (타사 부품 등)"}
            </button>
            {showManual && (
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_1.4fr_1fr_auto] gap-2">
                <Input placeholder="부품번호" value={manual.code} onChange={(e) => setManual({ ...manual, code: e.target.value })} />
                <Input placeholder="품명" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
                <Input placeholder="단가" inputMode="numeric" value={manual.price} onChange={(e) => setManual({ ...manual, price: e.target.value })} />
                <Button type="button" variant="secondary" onClick={addManual} disabled={!manual.code.trim()}>담기</Button>
              </div>
            )}
          </div>

          {/* 담은 부품 */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            {linesWithStock.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">위에서 부품을 찾아 담아주세요.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {linesWithStock.map((l, i) => {
                  const after = typeof l.stock === "number" ? l.stock - l.quantity : null;
                  return (
                    <div key={l.part_code} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="flex-1 min-w-[180px]">
                        <p className="text-sm truncate">
                          <span className="font-mono text-xs text-muted-foreground mr-1.5">{l.part_code}</span>
                          <span className="font-medium">{l.part_name || "-"}</span>
                        </p>
                        <p className={`text-xs ${after !== null && after < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {after === null ? `${branch} 재고 목록에 없음 (차감 없이 기록)` : `${branch} 재고 ${l.stock} → 판매 후 ${after}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="수량 줄이기"
                          onClick={() => updateLine(i, { quantity: Math.max(1, l.quantity - 1) })}>
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input className="h-8 w-14 text-center tabular-nums" inputMode="numeric" value={l.quantity}
                          aria-label="수량"
                          onChange={(e) => updateLine(i, { quantity: Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, "")) || 1) })} />
                        <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="수량 늘리기"
                          onClick={() => updateLine(i, { quantity: l.quantity + 1 })}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Input className="h-8 w-28 text-right tabular-nums" inputMode="numeric" aria-label="단가"
                        value={l.unit_price ? l.unit_price.toLocaleString("ko-KR") : ""}
                        placeholder="단가"
                        onChange={(e) => updateLine(i, { unit_price: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0 })} />
                      <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatPrice(l.quantity * l.unit_price)}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="빼기" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 결제 */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">결제</Label>
                <div className="flex gap-2">
                  {(["paid", "unpaid", "partial"] as const).map((v) => (
                    <Button key={v} type="button" size="sm" variant={mode === v ? "default" : "outline"} onClick={() => setMode(v)}>
                      {v === "paid" ? "완납" : v === "unpaid" ? "외상" : "일부 입금"}
                    </Button>
                  ))}
                </div>
              </div>
              {mode !== "unpaid" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">결제 수단</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {mode === "partial" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">지금 받은 금액</Label>
                  <Input inputMode="numeric" value={partialPaid} onChange={(e) => setPartialPaid(e.target.value)} placeholder="0" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">메모 (선택)</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="예: 기계 YT5113용, 택배 발송" />
              </div>
            </div>
            <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm self-start">
              <div className="flex justify-between"><span className="text-muted-foreground">소계</span><span className="tabular-nums">{formatPrice(totals.subtotal)}</span></div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-muted-foreground">할인</span>
                <Input className="h-8 w-32 text-right tabular-nums" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              </div>
              <div className="flex justify-between text-base font-bold border-t border-border/50 pt-2">
                <span>합계</span><span className="tabular-nums">{formatPrice(totals.total)}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">받은 금액</span><span className="tabular-nums">{formatPrice(totals.paid)}</span></div>
              {totals.receivable > 0 && (
                <div className="flex justify-between text-destructive font-semibold">
                  <span>미수금 (만기 30일)</span><span className="tabular-nums">{formatPrice(totals.receivable)}</span>
                </div>
              )}
              {shortages.length > 0 && (
                <p className="text-xs text-destructive pt-1">재고보다 많이 팔아 {shortages.length}종이 마이너스가 돼요. 그래도 저장할 수 있어요.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:items-center">
          {problem && lines.length > 0 && <p className="text-xs text-destructive mr-auto">{problem}</p>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => save.mutate()} disabled={!!problem || save.isPending}>
            {save.isPending ? "저장 중..." : `판매 저장 ${totals.total > 0 ? formatPrice(totals.total) : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
