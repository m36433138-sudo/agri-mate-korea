import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Trash2, Pencil, Phone, Mail, MapPin } from "lucide-react";
import {
  useInsuranceCompanies,
  useSaveInsuranceCompany,
  useDeleteInsuranceCompany,
  type InsuranceCompany,
} from "@/hooks/useInsurance";

const empty = {
  name: "",
  contact_person: "",
  phone: "",
  fax: "",
  email: "",
  address: "",
  notes: "",
};

export default function InsuranceCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const { data: companies = [] } = useInsuranceCompanies();
  const save = useSaveInsuranceCompany();
  const del = useDeleteInsuranceCompany();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);

  const set = (k: keyof typeof empty, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const startEdit = (c: InsuranceCompany) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      contact_person: c.contact_person || "",
      phone: c.phone || "",
      fax: c.fax || "",
      email: c.email || "",
      address: c.address || "",
      notes: c.notes || "",
    });
  };

  const reset = () => {
    setEditingId(null);
    setForm(empty);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "보험사명을 입력하세요", variant: "destructive" });
      return;
    }
    try {
      await save.mutateAsync({
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        fax: form.fax || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
      } as any);
      toast({ title: editingId ? "보험사 정보를 수정했습니다." : "보험사를 등록했습니다." });
      reset();
    } catch (e: any) {
      toast({ title: "저장 실패", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (c: InsuranceCompany) => {
    if (!confirm(`'${c.name}' 보험사를 삭제할까요?`)) return;
    try {
      await del.mutateAsync(c.id);
      toast({ title: "삭제했습니다." });
      if (editingId === c.id) reset();
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            보험사 주소록
            <Badge variant="secondary" className="ml-1">{companies.length}곳</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 입력 폼 */}
          <div className="space-y-3 rounded-xl border p-4 bg-muted/20">
            <p className="text-sm font-semibold">{editingId ? "보험사 수정" : "보험사 등록"}</p>
            <div>
              <Label className="text-xs">보험사명 *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="예: NH농협손해보험" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">담당자</Label>
                <Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">연락처</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">팩스</Label>
                <Input value={form.fax} onChange={(e) => set("fax", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">이메일</Label>
                <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">주소</Label>
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">메모</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={save.isPending} className="flex-1">
                <Plus className="h-4 w-4 mr-1" />
                {editingId ? "수정 저장" : "등록"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={reset}>취소</Button>
              )}
            </div>
          </div>

          {/* 목록 */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {companies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">등록된 보험사가 없습니다.</p>
            ) : (
              companies.map((c) => (
                <div key={c.id} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm flex-1">{c.name}</p>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {c.contact_person && <p className="text-xs text-muted-foreground">담당: {c.contact_person}</p>}
                  {c.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </p>
                  )}
                  {c.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {c.email}
                    </p>
                  )}
                  {c.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {c.address}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
