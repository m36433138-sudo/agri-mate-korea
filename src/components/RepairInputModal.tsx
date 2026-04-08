import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Search, ListChecks, X, GripVertical, CheckCircle2 } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import { ScrollArea } from "@/components/ui/scroll-area";

type PartRow = {
  part_id: string;
  part_name: string;
  part_number: string;
  unit: string;
  quantity: number;
  fromTemplate?: string;
};

export type DraftPrefill = {
  technician?: string;
  repairContent?: string;
  laborCost?: number;
  notes?: string;
  draftId?: string;
  operatingHours?: number;
  customerName?: string;
  customerPhone?: string;
  machineType?: string;
  model?: string;
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

type MachineCandidate = {
  id: string;
  model_name: string;
  serial_number: string;
  machine_type: string | null;
  customer_id: string | null;
};

const sanitizeToken = (value?: string | null) =>
  (value || "").trim().replace(/[,%]/g, " ").replace(/\s+/g, " ");

const normalizeText = (value?: string | null) =>
  (value || "").replace(/[\s-]/g, "").toLowerCase();

const getTextScore = (
  source: string | null | undefined,
  target: string | null | undefined,
  exactPoints: number,
  partialPoints: number,
) => {
  const sourceText = normalizeText(source);
  const targetText = normalizeText(target);

  if (!sourceText || !targetText) return 0;
  if (sourceText === targetText) return exactPoints;
  if (sourceText.includes(targetText) || targetText.includes(sourceText)) return partialPoints;
  return 0;
};

const getMachineMatchScore = (
  machine: MachineCandidate,
  draftPrefill: DraftPrefill | null | undefined,
  customerIds: Set<string>,
) => {
  let score = 0;

  score += getTextScore(machine.serial_number, draftPrefill?.model, 120, 90);
  score += getTextScore(machine.model_name, draftPrefill?.machineType, 100, 70);
  score += getTextScore(machine.model_name, draftPrefill?.model, 60, 40);
  score += getTextScore(machine.machine_type, draftPrefill?.machineType, 40, 25);

  if (machine.customer_id && customerIds.has(machine.customer_id)) {
    score += 80;
  }

  return score;
};

const reorderList = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export default function RepairInputModal({ open, onOpenChange, machineId, machineName, draftPrefill, onDraftFinalized }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, button, [draggable='true'], select, [role='combobox']")) return;
    const el = scrollRef.current;
    if (!el) return;
    isDragging.current = true;
    startY.current = e.clientY;
    startScroll.current = el.scrollTop;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dy = e.clientY - startY.current;
    scrollRef.current.scrollTop = startScroll.current - dy;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    const el = scrollRef.current;
    if (el) {
      el.style.cursor = "grab";
      el.style.userSelect = "";
    }
  }, []);

  const [repairDate, setRepairDate] = useState(new Date().toISOString().split("T")[0]);
  const [repairContent, setRepairContent] = useState("");
  const [technician, setTechnician] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [operatingHours, setOperatingHours] = useState("");
  const [notes, setNotes] = useState("");

  const [machineSearch, setMachineSearch] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState(machineId || "");
  const [selectedMachineName, setSelectedMachineName] = useState(machineName || "");
  const [machineResults, setMachineResults] = useState<any[]>([]);

  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [partResults, setPartResults] = useState<any[]>([]);
  const [draggedPartIndex, setDraggedPartIndex] = useState<number | null>(null);

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

  const searchMachines = async (q: string) => {
    setMachineSearch(q);
    if (!q.trim()) {
      setMachineResults([]);
      return;
    }

    const like = `%${q}%`;
    const { data } = await supabase
      .from("machines")
      .select("id, model_name, serial_number, machine_type")
      .or(`model_name.ilike.${like},serial_number.ilike.${like},machine_type.ilike.${like}`)
      .limit(8);

    setMachineResults(data || []);
  };

  const pickMachine = (m: any) => {
    setSelectedMachineId(m.id);
    setSelectedMachineName(`${m.model_name} (${m.serial_number})`);
    setMachineSearch("");
    setMachineResults([]);
  };

  useEffect(() => {
    let cancelled = false;

    if (open) {
      const fallbackMachineQuery = [draftPrefill?.machineType, draftPrefill?.model].filter(Boolean).join(" ");

      setRepairDate(new Date().toISOString().split("T")[0]);
      setRepairContent(draftPrefill?.repairContent || "");
      setTechnician(draftPrefill?.technician || "");
      setLaborCost(draftPrefill?.laborCost ? String(draftPrefill.laborCost) : "");
      setOperatingHours(draftPrefill?.operatingHours ? String(draftPrefill.operatingHours) : "");
      setNotes(draftPrefill?.notes || "");
      setPartRows(
        draftPrefill?.parts?.length
          ? draftPrefill.parts.map((p, i) => ({
              part_id: p.part_code || `draft-${i}`,
              part_name: p.part_name,
              part_number: p.part_code || "",
              unit: "개",
              quantity: p.quantity,
            }))
          : [],
      );
      setPartSearch("");
      setMachineSearch(machineId ? "" : fallbackMachineQuery);
      setSelectedMachineId(machineId || "");
      setSelectedMachineName(machineName || "");
      setMachineResults([]);
      setAppliedTemplates([]);
      setDraggedPartIndex(null);

      const resolveDraftMachine = async () => {
        if (machineId || !draftPrefill) return;

        const tokens = [draftPrefill.machineType, draftPrefill.model]
          .map((token) => sanitizeToken(token))
          .filter(Boolean);

        if (tokens.length === 0) return;

        let matchedCustomerIds = new Set<string>();

        if (draftPrefill.customerName || draftPrefill.customerPhone) {
          try {
            const customerFilters: string[] = [];
            const customerName = sanitizeToken(draftPrefill.customerName);
            const customerPhone = sanitizeToken(draftPrefill.customerPhone);

            if (customerName) customerFilters.push(`name.ilike.%${customerName}%`);
            if (customerPhone) customerFilters.push(`phone.ilike.%${customerPhone}%`);

            if (customerFilters.length > 0) {
              const { data: customers } = await supabase
                .from("customers")
                .select("id")
                .or(customerFilters.join(","))
                .limit(10);

              matchedCustomerIds = new Set((customers || []).map((customer) => customer.id));
            }
          } catch {
            matchedCustomerIds = new Set<string>();
          }
        }

        const machineFilters = tokens.flatMap((token) => [
          `model_name.ilike.%${token}%`,
          `serial_number.ilike.%${token}%`,
          `machine_type.ilike.%${token}%`,
        ]);

        const { data, error } = await supabase
          .from("machines")
          .select("id, model_name, serial_number, machine_type, customer_id")
          .or(machineFilters.join(","))
          .limit(20);

        if (cancelled || error || !data?.length) return;

        const ranked = (data as MachineCandidate[])
          .map((machine) => ({
            machine,
            score: getMachineMatchScore(machine, draftPrefill, matchedCustomerIds),
          }))
          .sort((a, b) => b.score - a.score);

        if (!ranked[0] || ranked[0].score <= 0 || cancelled) return;
        pickMachine(ranked[0].machine);
      };

      void resolveDraftMachine();
    }

    return () => {
      cancelled = true;
    };
  }, [open, machineId, machineName, draftPrefill]);

  const searchParts = async (q: string) => {
    setPartSearch(q);
    if (!q.trim()) {
      setPartResults([]);
      return;
    }

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

    const existingIndex = partRows.findIndex((row) => row.part_id === partRecord.id && !row.fromTemplate);

    if (existingIndex >= 0) {
      setPartRows((prev) =>
        prev.map((row, index) => (index === existingIndex ? { ...row, quantity: row.quantity + 1 } : row)),
      );
    } else {
      setPartRows((prev) => [
        ...prev,
        {
          part_id: partRecord.id,
          part_name: partRecord.part_name,
          part_number: partRecord.part_number,
          unit: partRecord.unit,
          quantity: 1,
        },
      ]);
    }

    setPartSearch("");
    setPartResults([]);
  };

  const applyTemplate = (template: any) => {
    if (appliedTemplates.some((item) => item.id === template.id)) return;

    const items: PartRow[] = (template.repair_template_items || []).map((item: any) => ({
      part_id: item.parts?.id || item.part_id,
      part_name: item.parts?.part_name || "",
      part_number: item.parts?.part_number || "",
      unit: item.parts?.unit || "개",
      quantity: item.quantity,
      fromTemplate: template.id,
    }));

    setPartRows((prev) => {
      const merged = [...prev];

      for (const item of items) {
        const existingIndex = merged.findIndex((row) => row.part_id === item.part_id);
        if (existingIndex >= 0) {
          merged[existingIndex] = {
            ...merged[existingIndex],
            quantity: merged[existingIndex].quantity + item.quantity,
          };
        } else {
          merged.push(item);
        }
      }

      return merged;
    });

    setAppliedTemplates((prev) => [...prev, { id: template.id, name: template.template_name }]);
  };

  const removeTemplate = (templateId: string) => {
    setPartRows((prev) => prev.filter((row) => row.fromTemplate !== templateId));
    setAppliedTemplates((prev) => prev.filter((template) => template.id !== templateId));
  };

  const updatePartRow = (index: number, field: keyof PartRow, value: any) => {
    setPartRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const removePartRow = (index: number) => {
    setPartRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handlePartDrop = (dropIndex: number) => {
    if (draggedPartIndex === null || draggedPartIndex === dropIndex) {
      setDraggedPartIndex(null);
      return;
    }

    setPartRows((prev) => reorderList(prev, draggedPartIndex, dropIndex));
    setDraggedPartIndex(null);
  };

  const totalCost = parseInt(laborCost) || 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
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
          operating_hours: parseInt(operatingHours) || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (partRows.length > 0) {
        const resolvedParts: { repair_id: string; part_id: string; quantity: number; notes: string | null }[] = [];

        for (const row of partRows) {
          let partId = row.part_id;
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(partId);

          if (!isUuid) {
            const { data: existing } = await supabase
              .from("parts")
              .select("id")
              .eq("part_number", row.part_number || partId)
              .maybeSingle();

            if (existing) {
              partId = existing.id;
            } else {
              const { data: created, error: createError } = await supabase
                .from("parts")
                .insert({
                  part_number: row.part_number || partId,
                  part_name: row.part_name,
                  unit: row.unit || "개",
                })
                .select("id")
                .single();

              if (createError) throw createError;
              partId = created.id;
            }
          }

          resolvedParts.push({
            repair_id: data.id,
            part_id: partId,
            quantity: row.quantity,
            notes: null,
          });
        }

        const { error: partsError } = await supabase.from("repair_parts").insert(resolvedParts);
        if (partsError) throw partsError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["all-repairs"] });
      qc.invalidateQueries({ queryKey: ["repairs-recent"] });

      if (draftPrefill?.draftId && onDraftFinalized) {
        onDraftFinalized(draftPrefill.draftId);
      }

      toast({ title: "수리 이력이 저장되었습니다." });
      onOpenChange(false);
    },
    onError: (error: any) => toast({ title: "오류", description: error.message, variant: "destructive" }),
  });

  const valid = selectedMachineId && repairDate && repairContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>수리 이력 추가</DialogTitle>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 -mx-6 px-6 overflow-y-auto cursor-grab"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">기본 정보</h3>

              {draftPrefill?.customerName && !machineId && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label className="text-xs">고객</Label>
                      <p className="text-sm font-medium">{draftPrefill.customerName}</p>
                      {draftPrefill.customerPhone && (
                        <p className="text-xs text-muted-foreground">{draftPrefill.customerPhone}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">작업표 기계</Label>
                      <p className="text-sm font-medium">{draftPrefill.machineType || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-xs">작업표 품목</Label>
                      <p className="text-sm font-medium">{draftPrefill.model || "-"}</p>
                    </div>
                  </div>
                </div>
              )}

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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => {
                          setSelectedMachineId("");
                          setSelectedMachineName("");
                          setMachineSearch([draftPrefill?.machineType, draftPrefill?.model].filter(Boolean).join(" "));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="모델명, 제조번호, 기종 검색..."
                          value={machineSearch}
                          onChange={(e) => searchMachines(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {machineResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          {machineResults.map((machine) => (
                            <button
                              key={machine.id}
                              onClick={() => pickMachine(machine)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{machine.model_name}</span>
                                {machine.machine_type && (
                                  <span className="text-xs text-muted-foreground">{machine.machine_type}</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground font-mono">{machine.serial_number}</span>
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
                <Textarea
                  value={repairContent}
                  onChange={(e) => setRepairContent(e.target.value)}
                  placeholder="수리 내용을 입력하세요"
                  rows={2}
                />
              </div>

              <div>
                <Label>공임비 (원)</Label>
                <Input type="number" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>사용시간 (Hr)</Label>
                <Input
                  type="number"
                  value={operatingHours}
                  onChange={(e) => setOperatingHours(e.target.value)}
                  placeholder="예: 1500"
                />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground">사용 부품</h3>

              {appliedTemplates.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {appliedTemplates.map((template) => (
                    <span
                      key={template.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                    >
                      <ListChecks className="h-3 w-3" />
                      {template.name}
                      <button onClick={() => removeTemplate(template.id)} className="hover:bg-primary/20 rounded-full p-0.5">
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
                    <div className="max-h-[200px] overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {templates.map((template: any) => {
                          const applied = appliedTemplates.some((item) => item.id === template.id);

                          return (
                            <button
                              key={template.id}
                              onClick={() => !applied && applyTemplate(template)}
                              disabled={applied}
                              className={`text-left p-3 rounded-lg border transition-all ${
                                applied
                                  ? "bg-destructive/10 border-destructive/40 ring-1 ring-destructive/30"
                                  : "hover:bg-accent hover:border-primary/20"
                              }`}
                            >
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                {applied ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-destructive" />
                                ) : (
                                  <ListChecks className="h-3.5 w-3.5 text-primary" />
                                )}
                                {template.template_name}
                                {applied && <span className="text-[10px] text-destructive font-bold ml-auto">적용됨</span>}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {(template.repair_template_items || [])
                                  .map((item: any) => item.parts?.part_name)
                                  .filter(Boolean)
                                  .join(", ") || "부품 없음"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
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
                        {partResults.map((part: any) => (
                          <button
                            key={part.id}
                            onClick={() => addPart(part)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                          >
                            <span>
                              <span className="font-mono text-xs text-muted-foreground">[{part.part_code}]</span>{" "}
                              <span className="font-medium">{part.part_name}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">재고: {part.quantity ?? 0} ({part.branch})</span>
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

              {partRows.length > 0 && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">사용 부품 목록 ({partRows.length}건)</Label>
                    <span className="text-[11px] text-muted-foreground">드래그 또는 스크롤로 순서 변경</span>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto space-y-2 pr-1">
                    {partRows.map((row, index) => (
                      <div
                        key={`${row.part_id}-${index}`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handlePartDrop(index)}
                        className={`flex items-center gap-2 p-2 rounded-md border ${
                          draggedPartIndex === index ? "bg-accent/60 border-primary/30" : "bg-muted/50"
                        }`}
                      >
                        <div
                          draggable
                          onDragStart={() => setDraggedPartIndex(index)}
                          onDragEnd={() => setDraggedPartIndex(null)}
                          className="shrink-0 cursor-grab rounded-md p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
                          title="드래그하여 순서 변경"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{row.part_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{row.part_number}</p>
                        </div>
                        <Input
                          type="number"
                          value={row.quantity}
                          onChange={(e) => updatePartRow(index, "quantity", Number(e.target.value) || 1)}
                          className="w-20 h-8 text-sm text-center"
                          min={1}
                        />
                        <span className="text-xs text-muted-foreground w-8">{row.unit}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removePartRow(index)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

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
