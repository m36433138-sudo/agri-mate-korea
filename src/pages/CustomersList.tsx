import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function CustomersList() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = customers?.filter(c => c.name.includes(search) || c.phone.includes(search));

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">고객관리</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> 고객 등록</Button>
      </div>

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="이름 또는 연락처 검색..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered?.length === 0 ? (
        <Card className="shadow-card border-0"><CardContent className="py-12 text-center text-muted-foreground">등록된 고객이 없습니다.</CardContent></Card>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">고객명</th>
                <th className="text-left p-3 font-medium text-muted-foreground">연락처</th>
                <th className="text-left p-3 font-medium text-muted-foreground">주소</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3"><Link to={`/customers/${c.id}`} className="font-medium hover:text-primary">{c.name}</Link></td>
                  <td className="p-3 text-muted-foreground">{c.phone}</td>
                  <td className="p-3 text-muted-foreground">{c.address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <AddCustomerDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function AddCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("customers").insert({
        name: form.name,
        phone: form.phone,
        address: form.address || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "고객이 등록되었습니다." });
      onOpenChange(false);
      setForm({ name: "", phone: "", address: "", notes: "" });
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>고객 등록</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>고객명 *</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
          <div><Label>연락처 *</Label><Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="010-0000-0000" /></div>
          <div><Label>주소</Label><Input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} /></div>
          <div><Label>비고</Label><Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={!(form.name && form.phone) || mutation.isPending}>{mutation.isPending ? "등록 중..." : "등록"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
