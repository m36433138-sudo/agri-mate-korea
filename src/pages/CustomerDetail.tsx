import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { formatPrice, formatDate } from "@/lib/formatters";
import { ArrowLeft, Pencil, UserCheck, FolderOpen, Plus, Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Machine, Repair } from "@/types/database";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Customer & { user_id: string | null };
    },
  });

  const { data: machines } = useQuery({
    queryKey: ["customer-machines", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*").eq("customer_id", id!).order("sale_date", { ascending: false });
      if (error) throw error;
      return data as Machine[];
    },
  });

  const { data: driveLinks } = useQuery({
    queryKey: ["customer-drive-links", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_drive_links")
        .select("*")
        .eq("customer_id", id!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("customer_drive_links").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-drive-links", id] }),
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const machineIds = machines?.map(m => m.id) ?? [];

  const { data: repairs } = useQuery({
    queryKey: ["customer-repairs", id],
    enabled: machineIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*, machines(model_name)")
        .in("machine_id", machineIds)
        .order("repair_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /></div>;
  if (!customer) return <p className="text-muted-foreground">고객을 찾을 수 없습니다.</p>;

  // Group repairs by machine
  const repairsByMachine: Record<string, { machineName: string; items: any[] }> = {};
  repairs?.forEach((r: any) => {
    const mid = r.machine_id;
    if (!repairsByMachine[mid]) {
      repairsByMachine[mid] = { machineName: r.machines?.model_name || "알 수 없음", items: [] };
    }
    repairsByMachine[mid].items.push(r);
  });

  return (
    <div>
      <Link to="/customers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> 고객 목록
      </Link>

      <Card className="shadow-card border-0 mb-6">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              {customer.user_id && (
                <Badge variant="secondary" className="gap-1">
                  <UserCheck className="h-3 w-3" /> 계정 연동됨
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t">
            <div><p className="text-xs text-muted-foreground">연락처</p><p className="font-medium">{customer.phone}</p></div>
            <div><p className="text-xs text-muted-foreground">주소</p><p className="font-medium">{customer.address || "-"}</p></div>
            {customer.notes && <div><p className="text-xs text-muted-foreground">비고</p><p className="font-medium">{customer.notes}</p></div>}
          </div>
        </CardContent>
      </Card>

      {/* 구글 드라이브 링크 */}
      <Card className="shadow-card border-0 mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            사진/서류 (드라이브)
            {driveLinks && driveLinks.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({driveLinks.length})</span>
            )}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 링크 추가
          </Button>
        </CardHeader>
        <CardContent>
          {!driveLinks || driveLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              등록된 드라이브 링크가 없습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {driveLinks.map((link: any) => (
                <div key={link.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <FolderOpen className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{link.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors"
                    title="드라이브 열기"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { if (confirm(`"${link.label}" 링크를 삭제하시겠습니까?`)) deleteLinkMutation.mutate(link.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card border-0 mb-6">
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">보유/구매 기계</CardTitle></CardHeader>
        <CardContent>
          {machines?.length === 0 ? (
            <p className="text-sm text-muted-foreground">구매 기계가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {machines?.map(m => (
                <Link key={m.id} to={`/machines/${m.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{m.model_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.serial_number}</p>
                    {(m as any).engine_number && <p className="text-xs text-muted-foreground">엔진: {(m as any).engine_number}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <TypeBadge type={m.machine_type} />
                      {(m as any).classification && <Badge variant="outline" className="text-xs">{(m as any).classification}</Badge>}
                    </div>
                    {m.sale_date && <span className="text-xs text-muted-foreground">{formatDate(m.sale_date)}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card border-0">
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">전체 수리 이력</CardTitle></CardHeader>
        <CardContent>
          {!repairs || repairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">수리 이력이 없습니다.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(repairsByMachine).map(([mid, group]) => (
                <div key={mid}>
                  <h4 className="text-sm font-semibold mb-2">{group.machineName}</h4>
                  <div className="space-y-2">
                    {group.items.map((r: any) => (
                      <div key={r.id} className="p-3 rounded-lg bg-muted/30">
                        <div className="flex justify-between">
                          <p className="text-sm font-medium">{r.repair_content}</p>
                          {r.total_cost > 0 && <span className="text-sm tabular-nums font-medium">{formatPrice(r.total_cost)}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(r.repair_date)}{r.technician ? ` · ${r.technician}` : ""}
                          {r.labor_cost > 0 ? ` · 공임비 ${formatPrice(r.labor_cost)}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {customer && <EditCustomerDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />}
      <AddDriveLinkDialog open={linkOpen} onOpenChange={setLinkOpen} customerId={id!} />
    </div>
  );
}

function AddDriveLinkDialog({ open, onOpenChange, customerId }: { open: boolean; onOpenChange: (v: boolean) => void; customerId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ label: "", url: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customer_drive_links").insert({
        customer_id: customerId,
        label: form.label,
        url: form.url,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-drive-links", customerId] });
      toast({ title: "링크가 추가되었습니다." });
      onOpenChange(false);
      setForm({ label: "", url: "" });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const isValid = form.label.trim() && form.url.trim().startsWith("http");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-blue-600" /> 드라이브 링크 추가
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>분류명 *</Label>
            <Input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="예: 융자서류, 인물사진, 수리사진 2024"
            />
          </div>
          <div>
            <Label>구글 드라이브 링크 *</Label>
            <Input
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://drive.google.com/drive/folders/..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              드라이브에서 폴더 우클릭 → 공유 → 링크 복사
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending}>
            {mutation.isPending ? "추가 중..." : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCustomerDialog({ open, onOpenChange, customer }: { open: boolean; onOpenChange: (v: boolean) => void; customer: Customer }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: customer.name, phone: customer.phone, address: customer.address || "", notes: customer.notes || "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").update({
        name: form.name, phone: form.phone, address: form.address || null, notes: form.notes || null,
      }).eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", customer.id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "고객 정보가 수정되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>고객 정보 수정</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>고객명</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
          <div><Label>연락처</Label><Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} /></div>
          <div><Label>주소</Label><Input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} /></div>
          <div><Label>비고</Label><Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "저장 중..." : "저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
