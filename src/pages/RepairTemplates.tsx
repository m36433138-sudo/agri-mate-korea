import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Search, ListChecks } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type TemplateWithItems = {
  id: string;
  template_name: string;
  description: string | null;
  created_at: string;
  repair_template_items: {
    id: string;
    quantity: number;
    notes: string | null;
    part_id: string;
    parts: { part_name: string; part_number: string; unit: string | null } | null;
  }[];
};

export default function RepairTemplates() {
  const [editId, setEditId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["repair-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_templates")
        .select("*, repair_template_items(*, parts(part_name, part_number, unit))")
        .order("template_name");
      if (error) throw error;
      return data as unknown as TemplateWithItems[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("repair_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repair-templates"] });
      toast({ title: "템플릿이 삭제되었습니다." });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">수리 템플릿</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> 템플릿 추가
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : templates?.length === 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            등록된 템플릿이 없습니다. 자주 사용하는 수리 부품 조합을 템플릿으로 등록하세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates?.map((t) => (
            <Card key={t.id} className="shadow-card border-0 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setEditId(t.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    {t.template_name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(t.id); }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {t.repair_template_items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.parts?.part_name}</span>
                      <span className="font-mono text-xs">{item.quantity} {item.parts?.unit || "개"}</span>
                    </div>
                  ))}
                  {t.repair_template_items.length === 0 && (
                    <p className="text-xs text-muted-foreground">부품이 없습니다</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateDialog
        open={addOpen || !!editId}
        onOpenChange={(v) => { if (!v) { setAddOpen(false); setEditId(null); } }}
        templateId={editId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>템플릿 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 템플릿을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type PartRow = {
  part_id: string;
  part_name: string;
  part_number: string;
  unit: string;
  quantity: number;
  notes: string;
};

function TemplateDialog({ open, onOpenChange, templateId }: { open: boolean; onOpenChange: (v: boolean) => void; templateId: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [partResults, setPartResults] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load template data if editing
  useQuery({
    queryKey: ["template-detail", templateId],
    enabled: !!templateId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_templates")
        .select("*, repair_template_items(*, parts(part_name, part_number, unit))")
        .eq("id", templateId!)
        .single();
      if (error) throw error;
      if (!loaded) {
        setName(data.template_name);
        setDescription(data.description || "");
        setPartRows(
          (data.repair_template_items as any[]).map((item: any) => ({
            part_id: item.part_id,
            part_name: item.parts?.part_name || "",
            part_number: item.parts?.part_number || "",
            unit: item.parts?.unit || "개",
            quantity: item.quantity,
            notes: item.notes || "",
          }))
        );
        setLoaded(true);
      }
      return data;
    },
  });

  // Reset on close
  const handleClose = () => {
    onOpenChange(false);
    setName("");
    setDescription("");
    setPartRows([]);
    setPartSearch("");
    setLoaded(false);
  };

  // Part search — searches inventory table (부품관리)
  const searchParts = async (q: string) => {
    setPartSearch(q);
    if (!q.trim()) { setPartResults([]); return; }
    const like = `%${q}%`;
    const { data } = await supabase
      .from("inventory")
      .select("id, part_code, part_name, quantity, branch")
      .or(`part_code.ilike.${like},part_name.ilike.${like}`)
      .order("part_code")
      .limit(15);
    setPartResults(data || []);
  };

  const addPart = async (inv: any) => {
    // Find or create a matching record in the parts table (needed for FK)
    const { data: existing } = await supabase
      .from("parts")
      .select("id, part_name, part_number, unit")
      .eq("part_number", inv.part_code)
      .maybeSingle();

    let partRecord: { id: string; part_name: string; part_number: string; unit: string };
    if (existing) {
      partRecord = { id: existing.id, part_name: existing.part_name, part_number: existing.part_number, unit: existing.unit || "개" };
    } else {
      const { data: created, error } = await supabase
        .from("parts")
        .insert({ part_name: inv.part_name, part_number: inv.part_code })
        .select("id, part_name, part_number, unit")
        .single();
      if (error || !created) {
        toast({ title: "부품 등록 오류", description: error?.message, variant: "destructive" });
        return;
      }
      partRecord = { id: created.id, part_name: created.part_name, part_number: created.part_number, unit: created.unit || "개" };
    }

    if (partRows.some((r) => r.part_id === partRecord.id)) {
      toast({ title: "이미 추가된 부품입니다." });
      return;
    }
    setPartRows((prev) => [
      ...prev,
      { part_id: partRecord.id, part_name: partRecord.part_name, part_number: partRecord.part_number, unit: partRecord.unit, quantity: 1, notes: "" },
    ]);
    setPartSearch("");
    setPartResults([]);
  };

  const updatePartRow = (i: number, field: keyof PartRow, value: any) => {
    setPartRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const removePartRow = (i: number) => setPartRows((prev) => prev.filter((_, idx) => idx !== i));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (templateId) {
        // Update
        const { error: updateError } = await supabase
          .from("repair_templates")
          .update({ template_name: name, description: description || null })
          .eq("id", templateId);
        if (updateError) throw updateError;

        // Delete old items and re-insert
        await supabase.from("repair_template_items").delete().eq("template_id", templateId);
        if (partRows.length > 0) {
          const { error: itemsError } = await supabase.from("repair_template_items").insert(
            partRows.map((r) => ({
              template_id: templateId,
              part_id: r.part_id,
              quantity: r.quantity,
              notes: r.notes || null,
            }))
          );
          if (itemsError) throw itemsError;
        }
      } else {
        // Create
        const { data, error } = await supabase
          .from("repair_templates")
          .insert({ template_name: name, description: description || null })
          .select("id")
          .single();
        if (error) throw error;

        if (partRows.length > 0) {
          const { error: itemsError } = await supabase.from("repair_template_items").insert(
            partRows.map((r) => ({
              template_id: data.id,
              part_id: r.part_id,
              quantity: r.quantity,
              notes: r.notes || null,
            }))
          );
          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repair-templates"] });
      toast({ title: templateId ? "템플릿이 수정되었습니다." : "템플릿이 등록되었습니다." });
      handleClose();
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{templateId ? "템플릿 수정" : "템플릿 추가"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <Label>템플릿명 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 엔진오일 교체" />
          </div>
          <div>
            <Label>설명</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="선택사항" />
          </div>

          <div>
            <Label className="mb-2 block">포함 부품</Label>

            {/* Part search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="부품 검색 (품명 또는 부품번호)..."
                value={partSearch}
                onChange={(e) => searchParts(e.target.value)}
                className="pl-9"
              />
              {partResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                  {partResults.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => addPart(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <span className="font-mono text-xs text-muted-foreground">[{p.part_number}]</span>{" "}
                      <span className="font-medium">{p.part_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Parts list */}
            {partRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">부품을 검색하여 추가하세요.</p>
            ) : (
              <div className="space-y-2">
                {partRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{row.part_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{row.part_number}</p>
                    </div>
                    <Input
                      type="number"
                      value={row.quantity}
                      onChange={(e) => updatePartRow(i, "quantity", Number(e.target.value) || 1)}
                      className="w-20 h-8 text-sm text-center"
                      min={1}
                    />
                    <span className="text-xs text-muted-foreground w-8">{row.unit}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removePartRow(i)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending}>
            {saveMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
