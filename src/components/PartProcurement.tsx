import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CustomerSearchInput } from "@/components/CustomerSearchInput";
import PartCodeAutocomplete from "@/components/PartCodeAutocomplete";
import { Plus, Trash2, Pencil, Search, Truck, PackageCheck, Handshake, ClipboardList } from "lucide-react";

const BRANCHES = ["장흥", "강진"] as const;
const STATUSES = ["주문접수", "배송중", "배송완료", "전달완료"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_STYLE: Record<Status, string> = {
  주문접수: "bg-slate-800/60 text-slate-300 border-slate-700",
  배송중: "bg-blue-950/60 text-blue-400 border-blue-900",
  배송완료: "bg-amber-950/60 text-amber-400 border-amber-900",
  전달완료: "bg-emerald-950/60 text-emerald-400 border-emerald-900",
};

const STATUS_ICON: Record<Status, typeof Truck> = {
  주문접수: ClipboardList,
  배송중: Truck,
  배송완료: PackageCheck,
  전달완료: Handshake,
};

interface OrderItem {
  id?: string;
  part_code: string | null;
  part_name: string;
  quantity: number;
  unit_price: number | null;
  notes: string | null;
}

interface Order {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  vendor_id: string | null;
  branch: string;
  order_date: string;
  requester: string | null;
  status: Status;
  shipped_at: string | null;
  delivered_at: string | null;
  handed_over_at: string | null;
  notes: string | null;
  part_order_items: (OrderItem & { id: string })[];
}

const won = (n: number | null | undefined) => (n == null ? "-" : `${n.toLocaleString()}원`);

const emptyForm = () => ({
  id: undefined as string | undefined,
  customer_id: null as string | null,
  customer_name: "",
  customer_phone: "",
  branch: "장흥",
  order_date: new Date().toISOString().slice(0, 10),
  requester: "",
  status: "주문접수" as Status,
  notes: "",
  items: [] as OrderItem[],
});

export default function PartProcurement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"전체" | Status>("전체");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["part_orders"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("part_orders")
        .select("*, part_order_items(*)")
        .order("order_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: orders.length };
    STATUSES.forEach((s) => (c[s] = orders.filter((o) => o.status === s).length));
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return orders.filter((o) => {
      if (tab !== "전체" && o.status !== tab) return false;
      if (!q) return true;
      const hay = [
        o.customer_name,
        o.customer_phone,
        o.requester,
        o.branch,
        o.notes,
        ...(o.part_order_items || []).flatMap((i) => [i.part_code, i.part_name]),
      ]
        .filter(Boolean)
        .join(" ");
      return hay.includes(q);
    });
  }, [orders, tab, search]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.customer_name.trim()) throw new Error("고객명을 입력하세요");
      const validItems = form.items.filter((i) => i.part_name.trim());
      if (!validItems.length) throw new Error("부품을 1개 이상 추가하세요");

      const payload = {
        customer_id: form.customer_id,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone || null,
        branch: form.branch,
        order_date: form.order_date,
        requester: form.requester || null,
        status: form.status,
        notes: form.notes || null,
      };

      let orderId = form.id;
      if (orderId) {
        const { error } = await (supabase as any).from("part_orders").update(payload).eq("id", orderId);
        if (error) throw error;
        const { error: delErr } = await (supabase as any).from("part_order_items").delete().eq("order_id", orderId);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await (supabase as any).from("part_orders").insert(payload).select("id").single();
        if (error) throw error;
        orderId = data.id;
      }

      const rows = validItems.map((i) => ({
        order_id: orderId,
        part_code: i.part_code || null,
        part_name: i.part_name.trim(),
        quantity: Number(i.quantity) || 1,
        unit_price: i.unit_price == null || (i.unit_price as any) === "" ? null : Number(i.unit_price),
        notes: i.notes || null,
      }));
      const { error: itemErr } = await (supabase as any).from("part_order_items").insert(rows);
      if (itemErr) throw itemErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["part_orders"] });
      setOpen(false);
      setForm(emptyForm());
      toast({ title: "저장되었습니다." });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await (supabase as any).from("part_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["part_orders"] });
      toast({ title: `상태가 '${v.status}'(으)로 변경되었습니다.` });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("part_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["part_orders"] });
      toast({ title: "주문이 삭제되었습니다." });
    },
  });

  const openEdit = (o: Order) => {
    setForm({
      id: o.id,
      customer_id: o.customer_id,
      customer_name: o.customer_name || "",
      customer_phone: o.customer_phone || "",
      branch: o.branch,
      order_date: o.order_date,
      requester: o.requester || "",
      status: o.status,
      notes: o.notes || "",
      items: (o.part_order_items || []).map((i) => ({
        part_code: i.part_code,
        part_name: i.part_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        notes: i.notes,
      })),
    });
    setOpen(true);
  };

  const setItem = (idx: number, patch: Partial<OrderItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  const orderTotal = (o: Order) =>
    (o.part_order_items || []).reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 0), 0);

  const formTotal = form.items.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.quantity) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="고객명·전화·부품명·부품코드 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => { setForm(emptyForm()); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> 부품 주문 등록
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["전체", ...STATUSES] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={tab === s ? "default" : "outline"}
            onClick={() => setTab(s)}
            className="gap-1.5"
          >
            {s} <span className="tabular-nums opacity-70">{counts[s] ?? 0}</span>
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            해당 조건의 부품 주문이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const Icon = STATUS_ICON[o.status] ?? ClipboardList;
            return (
              <Card key={o.id} className="border-0 shadow-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-semibold">{o.customer_name || "고객 미지정"}</span>
                        <Badge variant="outline" className={STATUS_STYLE[o.status]}>
                          <Icon className="h-3 w-3 mr-1" />
                          {o.status}
                        </Badge>
                        <Badge variant="secondary">{o.branch}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {[
                          `주문일 ${o.order_date}`,
                          o.customer_phone,
                          o.requester && `담당 ${o.requester}`,
                          o.shipped_at && `발송 ${o.shipped_at}`,
                          o.delivered_at && `도착 ${o.delivered_at}`,
                          o.handed_over_at && `전달 ${o.handed_over_at}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive"
                        onClick={() => confirm("주문을 삭제하시겠습니까?") && remove.mutate(o.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border divide-y">
                    {(o.part_order_items || []).map((i) => (
                      <div key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{i.part_name}</span>
                          {i.part_code && (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{i.part_code}</span>
                          )}
                          {i.notes && <p className="text-xs text-muted-foreground/70">{i.notes}</p>}
                        </div>
                        <span className="text-xs tabular-nums shrink-0">{i.quantity}개</span>
                        <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-20 text-right">
                          {won(i.unit_price)}
                        </span>
                      </div>
                    ))}
                    {(o.part_order_items || []).length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">등록된 부품이 없습니다.</p>
                    )}
                  </div>

                  {o.notes && <p className="text-xs text-muted-foreground">비고: {o.notes}</p>}

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground mr-auto">
                      합계 <span className="font-semibold tabular-nums text-foreground">{won(orderTotal(o))}</span>
                    </span>
                    {STATUSES.filter((s) => s !== o.status).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        disabled={changeStatus.isPending}
                        onClick={() => changeStatus.mutate({ id: o.id, status: s })}
                      >
                        {s}로 변경
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "부품 주문 수정" : "부품 주문 등록"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>주문 고객 *</Label>
              <CustomerSearchInput
                value={form.customer_name}
                onChange={(name) => setForm((f) => ({ ...f, customer_name: name, customer_id: null }))}
                onSelect={(c) =>
                  setForm((f) => ({ ...f, customer_id: c.id, customer_name: c.name, customer_phone: c.phone || "" }))
                }
              />
            </div>
            <div>
              <Label>연락처</Label>
              <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>
            <div>
              <Label>주문일</Label>
              <Input type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
            </div>
            <div>
              <Label>지점</Label>
              <Select value={form.branch} onValueChange={(v) => setForm({ ...form, branch: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>담당자</Label>
              <Input value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} placeholder="주문 담당 직원" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>부품 목록 *</Label>
              <span className="text-xs text-muted-foreground">
                합계 <span className="font-semibold tabular-nums text-foreground">{won(formTotal)}</span>
              </span>
            </div>
            <PartCodeAutocomplete
              branch={form.branch}
              placeholder="재고 부품 검색해서 추가 (3자리 이상)"
              onSelect={(item) =>
                setForm((f) => ({
                  ...f,
                  items: [
                    ...f.items,
                    { part_code: item.part_code, part_name: item.part_name, quantity: 1, unit_price: null, notes: null },
                  ],
                }))
              }
            />
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-3"
                    placeholder="부품코드"
                    value={it.part_code || ""}
                    onChange={(e) => setItem(idx, { part_code: e.target.value })}
                  />
                  <Input
                    className="col-span-4"
                    placeholder="부품명 *"
                    value={it.part_name}
                    onChange={(e) => setItem(idx, { part_name: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    placeholder="수량"
                    value={it.quantity}
                    onChange={(e) => setItem(idx, { quantity: Number(e.target.value) })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    placeholder="단가"
                    value={it.unit_price ?? ""}
                    onChange={(e) => setItem(idx, { unit_price: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="col-span-1 h-9 w-9 hover:text-destructive"
                    onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  items: [...f.items, { part_code: "", part_name: "", quantity: 1, unit_price: null, notes: null }],
                }))
              }
            >
              <Plus className="h-4 w-4 mr-1" /> 직접 입력 추가
            </Button>
          </div>

          <div>
            <Label>비고</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
