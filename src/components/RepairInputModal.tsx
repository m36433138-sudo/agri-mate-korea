import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Search, ListChecks, X } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import { ScrollArea } from "@/components/ui/scroll-area";

type PartRow = {
  part_id: string;
  part_name: string;
  part_number: string;
  unit: string;
  quantity: number;
  fromTemplate?: string; // template id
};

export type DraftPrefill = {
  technician?: string;
  repairContent?: string;
  laborCost?: number;
  notes?: string;
  draftId?: string;
  parts?: { part_code?: string; part_name: string; quantity: number; unit_price: number }[];
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  machineId?: string;
  machineName?: string;
  draftPrefill?: DraftPrefill | null;
  onDraftFinalized?: (draftId: string) => void;
};

export default function RepairInputModal({ open, onOpenChange, machineId, machineName, draftPrefill, onDraftFinalized }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [repairDate, setRepairDate] = useState(new Date().toISOString().split("T")[0]);
  const [repairContent, setRepairContent] = useState("");
  const [technician, setTechnician] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [notes, setNotes] = useState("");

  // Machine search (if not pre-filled)
  const [machineSearch, setMachineSearch] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState(machineId || "");
  const [selectedMachineName, setSelectedMachineName] = useState(machineName || "");
  const [machineResults, setMachineResults] = useState<any[]>([]);

  // Parts
  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [partResults, setPartResults] = useState<any[]>([]);

  // Templates
  const [appliedTemplates, setAppliedTemplates] = useState<{ id: string; name: string }[]>([]);

  const { data: templates } = useQuery({
    queryKey: ["repair-templates-for-modal"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_templates")
        .select("*, repair_template_items(*, parts(id, part_name, part_number, unit))")
        .order("template_name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (open) {
      setRepairDate(new Date().toISOString().split("T")[0]);
      setRepairContent(draftPrefill?.repairContent || "");
      setTechnician(draftPrefill?.technician || "");
      setLaborCost(draftPrefill?.laborCost ? String(draftPrefill.laborCost) : "");
      setNotes(draftPrefill?.notes || "");
      setPartRows([]);
      setPartSearch("");
      setMachineSearch("");
      setSelectedMachineId(machineId || "");
      setSelectedMachineName(machineName || "");
      setAppliedTemplates([]);
    }
  }, [open, machineId, machineName, draftPrefill]);

  // Machine search
  const searchMachines = async (q: string) => {
    setMachineSearch(q);
    if (!q.trim()) { setMachineResults([]); return; }
    const like = `%${q}%`;
    const { data } = await supabase
      .from("machines")
      .select("id, model_name, serial_number")
      .or(`model_name.ilike.${like},serial_number.ilike.${like}`)
      .limit(8);
    setMachineResults(data || []);
  };

  const pickMachine = (m: any) => {
    setSelectedMachineId(m.id);
    setSelectedMachineName(`${m.model_name} (${m.serial_number})`);
    setMachineSearch("");
    setMachineResults([]);
  };

  // Part search
  const searchParts = async (q: string) => {
    setPartSearch(q);
    if (!q.trim()) { setPartResults([]); return; }
    const like = `%${q}%`;
    const { data } = await supabase
      .from("parts")
      .select("*")
      .or(`part_name.ilike.${like},part_number.ilike.${like}`)
      .limit(10);
    setPartResults(data || []);
  };

  const addPart = (part: any) => {
    const existing = partRows.findIndex((r) => r.part_id === part.id && !r.fromTemplate);
    if (existing >= 0) {
      setPartRows((prev) =>
        prev.map((r, i) => (i === existing ? { ...r, quantity: r.quantity + 1 } : r))
      );
    } else {
      setPartRows((prev) => [
        ...prev,
        { part_id: part.id, part_name: part.part_name, part_number: part.part_number, unit: part.unit || "개", quantity: 1 },
      ]);
    }
    setPartSearch("");
    setPartResults([]);
  };

  // Apply template
  const applyTemplate = (template: any) => {
    if (appliedTemplates.some((t) => t.id === template.id)) return;

    const items: PartRow[] = (template.repair_template_items || []).map((item: any) => ({
      part_id: item.parts?.id || item.part_id,
      part_name: item.parts?.part_name || "",
      part_number: item.parts?.part_number || "",
      unit: item.parts?.unit || "개",
      quantity: item.quantity,
      fromTemplate: template.id,
    }));

    // Merge: if same part exists from same template, sum quantities
    setPartRows((prev) => {
      const merged = [...prev];
      for (const item of items) {
        const existingIdx = merged.findIndex((r) => r.part_id === item.part_id);
        if (existingIdx >= 0) {
          merged[existingIdx] = { ...merged[existingIdx], quantity: merged[existingIdx].quantity + item.quantity };
        } else {
          merged.push(item);
        }
      }
      return merged;
    });

    setAppliedTemplates((prev) => [...prev, { id: template.id, name: template.template_name }]);
  };

  const removeTemplate = (templateId: string) => {
    setPartRows((prev) => prev.filter((r) => r.fromTemplate !== templateId));
    setAppliedTemplates((prev) => prev.filter((t) => t.id !== templateId));
  };

  const updatePartRow = (i: number, field: keyof PartRow, value: any) => {
    setPartRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const removePartRow = (i: number) => setPartRows((prev) => prev.filter((_, idx) => idx !== i));

  const totalCost = (parseInt(laborCost) || 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save repair
      const { data, error } = await supabase
        .from("repairs")
        .insert({
          machine_id: selectedMachineId,
          repair_date: repairDate,
          repair_content: repairContent,
          technician: technician || null,
          labor_cost: parseInt(laborCost) || 0,
          total_cost: totalCost,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Save repair parts
      if (partRows.length > 0) {
        const { error: partsError } = await supabase.from("repair_parts").insert(
          partRows.map((r) => ({
            repair_id: data.id,
            part_id: r.part_id,
            quantity: r.quantity,
            notes: null,
          }))
        );
        if (partsError) throw partsError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["all-repairs"] });
      qc.invalidateQueries({ queryKey: ["repairs-recent"] });
      // Finalize draft if exists
      if (draftPrefill?.draftId && onDraftFinalized) {
        onDraftFinalized(draftPrefill.draftId);
      }
      toast({ title: "수리 이력이 저장되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const valid = selectedMachineId && repairDate && repairContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>수리 이력 추가</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5">
            {/* Section A: Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">기본 정보</h3>

              {/* Machine selection */}
              {machineId ? (
                <div>
                  <Label>기계</Label>
                  <Input value={selectedMachineName} disabled className="bg-muted" />
                </div>
              ) : (
                <div className="relative">
                  <Label>기계 선택 *</Label>
                  {selectedMachineId ? (
                    <div className="flex items-center gap-2">
                      <Input value={selectedMachineName} disabled className="bg-muted flex-1" />
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setSelectedMachineId(""); setSelectedMachineName(""); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="모델명 또는 제조번호 검색..."
                          value={machineSearch}
                          onChange={(e) => searchMachines(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {machineResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          {machineResults.map((m) => (
                            <button key={m.id} onClick={() => pickMachine(m)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors">
                              <span className="font-medium">{m.model_name}</span>
                              <span className="ml-2 text-xs text-muted-foreground font-mono">{m.serial_number}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>수리일 *</Label>
                  <Input type="date" value={repairDate} onChange={(e) => setRepairDate(e.target.value)} />
                </div>
                <div>
                  <Label>담당 기사</Label>
                  <Input value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="예: 박기사" />
                </div>
              </div>

              <div>
                <Label>수리 내용 *</Label>
                <Textarea value={repairContent} onChange={(e) => setRepairContent(e.target.value)} placeholder="수리 내용을 입력하세요" rows={2} />
              </div>

              <div>
                <Label>공임비 (원)</Label>
                <Input type="number" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0" />
              </div>
            </div>

            {/* Section B: Parts */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground">사용 부품</h3>

              {/* Applied template chips */}
              {appliedTemplates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {appliedTemplates.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      <ListChecks className="h-3 w-3" />
                      {t.name}
                      <button onClick={() => removeTemplate(t.id)} className="hover:bg-primary/20 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <Tabs defaultValue="template">
                <TabsList className="w-full">
                  <TabsTrigger value="template" className="flex-1">템플릿으로 추가</TabsTrigger>
                  <TabsTrigger value="manual" className="flex-1">부품 개별 추가</TabsTrigger>
                </TabsList>

                <TabsContent value="template" className="mt-3">
                  {!templates?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4">등록된 템플릿이 없습니다.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {templates.map((t: any) => {
                        const applied = appliedTemplates.some((a) => a.id === t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => !applied && applyTemplate(t)}
                            disabled={applied}
                            className={`text-left p-3 rounded-lg border transition-colors ${
                              applied ? "bg-primary/5 border-primary/30 opacity-60" : "hover:bg-accent hover:border-primary/20"
                            }`}
                          >
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              <ListChecks className="h-3.5 w-3.5 text-primary" />
                              {t.template_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {(t.repair_template_items || []).map((item: any) => item.parts?.part_name).filter(Boolean).join(", ") || "부품 없음"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="manual" className="mt-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="부품 검색 (품명 또는 부품번호 suffix)..."
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
                            <span className="text-xs text-muted-foreground ml-1">({p.unit})</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {partSearch.trim() && partResults.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 p-3 text-sm text-muted-foreground">
                        부품을 찾을 수 없습니다. <a href="/parts" className="text-primary hover:underline">부품 관리</a>에서 먼저 등록해주세요.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Combined parts list */}
              {partRows.length > 0 && (
                <div className="space-y-2 mt-3">
                  <Label className="text-xs text-muted-foreground">사용 부품 목록 ({partRows.length}건)</Label>
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
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-sm text-muted-foreground">총 비용:</span>
            <span className="text-sm font-bold">{formatPrice(totalCost)}</span>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!valid || saveMutation.isPending}>
            {saveMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
