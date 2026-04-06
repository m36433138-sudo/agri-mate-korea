import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, Pencil, Building2 } from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  representative: string | null;
  phone: string | null;
  business_number: string | null;
  items: string | null;
  notes: string | null;
  created_at: string;
}

interface VendorForm {
  name: string;
  representative: string;
  phone: string;
  business_number: string;
  items: string;
  notes: string;
}

const emptyForm = (): VendorForm => ({
  name: "", representative: "", phone: "", business_number: "", items: "", notes: "",
});

export default function VendorsList() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorForm>(emptyForm());
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendors")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Vendor[];
    },
  });

  const filtered = search.trim()
    ? vendors.filter(v =>
        v.name.includes(search) ||
        (v.phone || "").includes(search) ||
        (v.representative || "").includes(search) ||
        (v.items || "").includes(search)
      )
    : vendors;

  const set = (key: keyof VendorForm, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditTarget(v);
    setForm({
      name: v.name,
      representative: v.representative || "",
      phone: v.phone || "",
      business_number: v.business_number || "",
      items: v.items || "",
      notes: v.notes || "",
    });
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        representative: form.representative || null,
        phone: form.phone || null,
        business_number: form.business_number || null,
        items: form.items || null,
        notes: form.notes || null,
      };
      if (editTarget) {
        const { error } = await (supabase as any).from("vendors").update(payload).eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("vendors").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast({ title: editTarget ? "업체 정보가 수정되었습니다." : "업체가 등록되었습니다." });
      setFormOpen(false);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("vendors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast({ title: "업체가 삭제되었습니다." });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {isLoading ? "..." : `전체 ${vendors.length}개`}
            </p>
            {search && !isLoading && (
              <p className="text-xs text-muted-foreground">검색결과 {filtered.length}개</p>
            )}
          </div>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> 업체 등록
        </Button>
      </div>

      {/* 검색 */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="상호명, 대표자, 전화번호, 거래품목 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 목록 */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {search ? `"${search}"에 해당하는 업체가 없습니다.` : "등록된 업체가 없습니다."}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card border-0 overflow-hidden">
          {filtered.map((v, idx) => (
            <div
              key={v.id}
              className={`flex items-start gap-3 px-4 py-4 hover:bg-muted/40 transition-colors group ${idx !== 0 ? "border-t" : ""}`}
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0 mt-0.5">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{v.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {v.representative && <span className="text-xs text-muted-foreground">대표: {v.representative}</span>}
                  {v.phone && <span className="text-xs text-muted-foreground">{v.phone}</span>}
                  {v.business_number && <span className="text-xs text-muted-foreground">사업자: {v.business_number}</span>}
                </div>
                {v.items && <p className="text-xs text-muted-foreground mt-1">거래품목: {v.items}</p>}
                {v.notes && <p className="text-xs text-muted-foreground/70 mt-0.5">{v.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(v)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* 등록/수정 다이얼로그 */}
      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "업체 수정" : "업체 등록"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>상호명 *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="상호명" />
            </div>
            <div>
              <Label>대표자</Label>
              <Input value={form.representative} onChange={e => set("representative", e.target.value)} placeholder="대표자 이름" />
            </div>
            <div>
              <Label>전화번호</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="010-0000-0000" />
            </div>
            <div className="col-span-2">
              <Label>사업자번호</Label>
              <Input value={form.business_number} onChange={e => set("business_number", e.target.value)} placeholder="000-00-00000" />
            </div>
            <div className="col-span-2">
              <Label>거래품목</Label>
              <Input value={form.items} onChange={e => set("items", e.target.value)} placeholder="예: 농기계 부품, 유압 호스 등" />
            </div>
            <div className="col-span-2">
              <Label>비고</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="기타 메모" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saveMutation.isPending}>취소</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "저장 중..." : editTarget ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>업체를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} 업체 정보가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
