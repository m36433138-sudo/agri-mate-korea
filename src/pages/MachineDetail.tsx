import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function MachineDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saleOpen, setSaleOpen] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: machine, isLoading } = useQuery({
    queryKey: ["machine", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*, customers(id, name, phone)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: repairs, isLoading: repairsLoading } = useQuery({
    queryKey: ["repairs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("repair_history").select("*").eq("machine_id", id!).order("repair_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!machine) return <p className="text-muted-foreground">기계를 찾을 수 없습니다.</p>;

  return (
    <div>
      <Link to="/machines" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> 기계 목록
      </Link>

      {/* Machine Header Card */}
      <Card className="shadow-card border-0 mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold">{machine.model_name}</h1>
              <p className="text-sm text-muted-foreground font-mono mt-1">제조번호: {machine.serial_number}</p>
            </div>
            <div className="flex gap-2 items-center">
              <TypeBadge type={machine.machine_type} />
              <StatusBadge status={machine.status} />
              <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 mt-6 pt-6 border-t">
            <InfoItem label="입고일" value={formatDate(machine.entry_date)} />
            <InfoItem label="매입가" value={formatPrice(machine.purchase_price)} bold />
            {machine.status === "판매완료" && (
              <>
                <InfoItem label="판매가" value={machine.sale_price ? formatPrice(machine.sale_price) : "-"} bold primary />
                <InfoItem label="판매일" value={machine.sale_date ? formatDate(machine.sale_date) : "-"} />
                {machine.customers && (
                  <InfoItem label="고객" value={
                    <Link to={`/customers/${(machine.customers as any).id}`} className="text-primary hover:underline">
                      {(machine.customers as any).name}
                    </Link>
                  } />
                )}
              </>
            )}
            {machine.notes && <InfoItem label="특이사항" value={machine.notes} />}
          </div>

          {machine.status === "재고중" && (
            <div className="mt-6 pt-4 border-t">
              <Button onClick={() => setSaleOpen(true)}>판매 처리</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repair History */}
      <Card className="shadow-card border-0">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">수리 이력</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setRepairOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 수리 이력 추가
          </Button>
        </CardHeader>
        <CardContent>
          {repairsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : repairs?.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">수리 이력이 없습니다.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-6 pl-8">
                {repairs?.map((r) => (
                  <div key={r.id} className="relative">
                    <div className="absolute -left-[22px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-card" />
                    <p className="text-sm font-semibold">{formatDate(r.repair_date)}</p>
                    <p className="text-sm mt-1">{r.repair_content}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                      {r.parts_used && <span>부품: {r.parts_used}</span>}
                      {r.cost != null && <span>비용: {formatPrice(r.cost)}</span>}
                      {r.technician && <span>담당: {r.technician}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SaleDialog open={saleOpen} onOpenChange={setSaleOpen} machineId={machine.id} />
      <RepairDialog open={repairOpen} onOpenChange={setRepairOpen} machineId={machine.id} />
      <EditMachineDialog open={editOpen} onOpenChange={setEditOpen} machine={machine} />
    </div>
  );
}

function InfoItem({ label, value, bold, primary }: { label: string; value: any; bold?: boolean; primary?: boolean }) {
  return (
    <div>
      <p className={`text-xs mb-1 ${primary ? "text-primary font-semibold" : "text-muted-foreground"}`}>{label}</p>
      <div className={`${bold ? "font-bold tabular-nums" : "font-medium"} ${primary ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function SaleDialog({ open, onOpenChange, machineId }: { open: boolean; onOpenChange: (v: boolean) => void; machineId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ customer_id: "", sale_price: "", sale_date: "" });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("machines").update({
        status: "판매완료",
        customer_id: form.customer_id,
        sale_price: parseInt(form.sale_price),
        sale_date: form.sale_date,
      }).eq("id", machineId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine", machineId] });
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: "판매 처리가 완료되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const valid = form.customer_id && form.sale_price && form.sale_date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>판매 처리</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>고객 선택 *</Label>
            <Select value={form.customer_id} onValueChange={v => setForm(f => ({...f, customer_id: v}))}>
              <SelectTrigger><SelectValue placeholder="고객을 선택하세요" /></SelectTrigger>
              <SelectContent>
                {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>판매가 (원) *</Label><Input type="number" value={form.sale_price} onChange={e => setForm(f => ({...f, sale_price: e.target.value}))} /></div>
          <div><Label>판매일 *</Label><Input type="date" value={form.sale_date} onChange={e => setForm(f => ({...f, sale_date: e.target.value}))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>{mutation.isPending ? "처리 중..." : "판매 완료"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepairDialog({ open, onOpenChange, machineId }: { open: boolean; onOpenChange: (v: boolean) => void; machineId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ repair_date: "", repair_content: "", parts_used: "", cost: "", technician: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("repair_history").insert({
        machine_id: machineId,
        repair_date: form.repair_date,
        repair_content: form.repair_content,
        parts_used: form.parts_used || null,
        cost: form.cost ? parseInt(form.cost) : null,
        technician: form.technician || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repairs", machineId] });
      qc.invalidateQueries({ queryKey: ["repairs-recent"] });
      toast({ title: "수리 이력이 성공적으로 저장되었습니다." });
      onOpenChange(false);
      setForm({ repair_date: "", repair_content: "", parts_used: "", cost: "", technician: "" });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const valid = form.repair_date && form.repair_content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>수리 이력 추가</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>수리일 *</Label><Input type="date" value={form.repair_date} onChange={e => setForm(f => ({...f, repair_date: e.target.value}))} /></div>
          <div><Label>수리 내용 *</Label><Textarea value={form.repair_content} onChange={e => setForm(f => ({...f, repair_content: e.target.value}))} placeholder="수리 내용을 입력하세요" /></div>
          <div><Label>사용 부품</Label><Input value={form.parts_used} onChange={e => setForm(f => ({...f, parts_used: e.target.value}))} /></div>
          <div><Label>수리 비용 (원)</Label><Input type="number" value={form.cost} onChange={e => setForm(f => ({...f, cost: e.target.value}))} /></div>
          <div><Label>담당 기사</Label><Input value={form.technician} onChange={e => setForm(f => ({...f, technician: e.target.value}))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>{mutation.isPending ? "저장 중..." : "저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMachineDialog({ open, onOpenChange, machine }: { open: boolean; onOpenChange: (v: boolean) => void; machine: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    model_name: machine.model_name,
    serial_number: machine.serial_number,
    machine_type: machine.machine_type,
    entry_date: machine.entry_date,
    purchase_price: String(machine.purchase_price),
    notes: machine.notes || "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("machines").update({
        model_name: form.model_name,
        serial_number: form.serial_number,
        machine_type: form.machine_type,
        entry_date: form.entry_date,
        purchase_price: parseInt(form.purchase_price),
        notes: form.notes || null,
      }).eq("id", machine.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine", machine.id] });
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: "기계 정보가 수정되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>정보 수정</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>모델명</Label><Input value={form.model_name} onChange={e => setForm(f => ({...f, model_name: e.target.value}))} /></div>
          <div><Label>제조번호</Label><Input value={form.serial_number} onChange={e => setForm(f => ({...f, serial_number: e.target.value}))} /></div>
          <div>
            <Label>구분</Label>
            <Select value={form.machine_type} onValueChange={v => setForm(f => ({...f, machine_type: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="새기계">새기계</SelectItem><SelectItem value="중고기계">중고기계</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>입고일</Label><Input type="date" value={form.entry_date} onChange={e => setForm(f => ({...f, entry_date: e.target.value}))} /></div>
          <div><Label>매입가 (원)</Label><Input type="number" value={form.purchase_price} onChange={e => setForm(f => ({...f, purchase_price: e.target.value}))} /></div>
          <div><Label>특이사항</Label><Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "저장 중..." : "저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
