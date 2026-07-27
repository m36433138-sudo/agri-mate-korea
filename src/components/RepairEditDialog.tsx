import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search } from "lucide-react";
import LastModifiedInfo from "@/components/LastModifiedInfo";
import { formatPrice } from "@/lib/formatters";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type PartRow = {
  key: string;
  part_id: string; // uuid if from parts table, else empty for manual
  part_name: string;
  part_number: string;
  unit: string;
  quantity: number;
  unit_price: number;
  branch: "장흥" | "강진";
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  repair: any | null;
};

export default function RepairEditDialog({ open, onOpenChange, repair }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [repairDate, setRepairDate] = useState("");
  const [repairContent, setRepairContent] = useState("");
  const [technician, setTechnician] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [operatingHours, setOperatingHours] = useState("");
  const [notes, setNotes] = useState("");
  const [accountingPosted, setAccountingPosted] = useState(false);

  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [defaultBranch, setDefaultBranch] = useState<"장흥" | "강진">("장흥");
  const [partSearch, setPartSearch] = useState("");
  const [partOpen, setPartOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [manualQty, setManualQty] = useState("1");

  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: existingParts } = useQuery({
    queryKey: ["repair-parts-edit", repair?.id],
    enabled: open && !!repair?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_parts")
        .select("id, part_id, quantity, unit_price, branch, parts(id, part_name, part_number, unit)")
        .eq("repair_id", repair!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: partSearchResults = [] } = useQuery({
    queryKey: ["parts-search-edit", partSearch],
    enabled: open && partSearch.length >= 2,
    queryFn: async () => {
      const like = `%${partSearch}%`;
      const { data, error } = await supabase
        .from("parts")
        .select("id, part_name, part_number, unit")
        .or(`part_name.ilike.${like},part_number.ilike.${like}`)
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open && repair) {
      setRepairDate(repair.repair_date || "");
      setRepairContent(repair.repair_content || "");
      setTechnician(repair.technician || "");
      setLaborCost(repair.labor_cost ? String(repair.labor_cost) : "");
      setOperatingHours(repair.operating_hours ? String(repair.operating_hours) : "");
      setNotes(repair.notes || "");
      setAccountingPosted(!!repair.accounting_posted);
      setPartSearch("");
      setManualName("");
      setManualNumber("");
      setManualQty("1");
    }
  }, [open, repair]);

  useEffect(() => {
    if (existingParts) {
      setPartRows(
        existingParts.map((rp: any) => ({
          key: rp.id,
          part_id: rp.part_id,
          part_name: rp.parts?.part_name || "",
          part_number: rp.parts?.part_number || "",
          unit: rp.parts?.unit || "개",
          quantity: rp.quantity ?? 1,
          unit_price: Number(rp.unit_price) || 0,
          branch: (rp.branch === "강진" ? "강진" : "장흥") as "장흥" | "강진",
        }))
      );
    }
  }, [existingParts]);

  const addFromSearch = async (p: any) => {
    // 매출가는 inventory(부품관리)에서 최신 값을 조회
    let unitPrice = 0;
    if (p.part_number) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("sales_price")
        .eq("part_code", p.part_number)
        .not("sales_price", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      unitPrice = Number(inv?.sales_price) || 0;
    }
    setPartRows((prev) => {
      const idx = prev.findIndex((r) => r.part_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + 1,
          unit_price: next[idx].unit_price || unitPrice,
        };
        return next;
      }
      return [
        ...prev,
        {
          key: `new-${crypto.randomUUID()}`,
          part_id: p.id,
          part_name: p.part_name,
          part_number: p.part_number || "",
          unit: p.unit || "개",
          quantity: 1,
          unit_price: unitPrice,
        },
      ];
    });
    setPartSearch("");
    setPartOpen(false);
  };

  const addManual = () => {
    if (!manualName.trim()) {
      toast({ title: "부품명을 입력하세요", variant: "destructive" });
      return;
    }
    setPartRows((prev) => [
      ...prev,
      {
        key: `manual-${crypto.randomUUID()}`,
        part_id: "",
        part_name: manualName.trim(),
        part_number: manualNumber.trim(),
        unit: "개",
        quantity: parseInt(manualQty) || 1,
        unit_price: 0,
      },
    ]);
    setManualName("");
    setManualNumber("");
    setManualQty("1");
  };

  const updateQty = (key: string, qty: number) => {
    setPartRows((prev) => prev.map((r) => (r.key === key ? { ...r, quantity: qty } : r)));
  };

  const updateUnitPrice = (key: string, price: number) => {
    setPartRows((prev) => prev.map((r) => (r.key === key ? { ...r, unit_price: price } : r)));
  };

  const removeRow = (key: string) => {
    setPartRows((prev) => prev.filter((r) => r.key !== key));
  };

  const laborCostNum = parseInt(laborCost) || 0;
  const partsSubtotal = partRows.reduce((sum, r) => sum + (Number(r.unit_price) || 0) * (Number(r.quantity) || 0), 0);
  const totalCost = laborCostNum + partsSubtotal;

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!repair) return;
      const { error } = await supabase
        .from("repairs")
        .update({
          repair_date: repairDate,
          repair_content: repairContent,
          technician: technician || null,
          labor_cost: laborCostNum,
          total_cost: totalCost,
          operating_hours: parseInt(operatingHours) || null,
          notes: notes || null,
          accounting_posted: accountingPosted,
        })
        .eq("id", repair.id);
      if (error) throw error;

      // Resolve parts: create rows in `parts` for manual entries
      const resolved: any[] = [];
      for (const row of partRows) {
        let partId = row.part_id;
        if (!partId) {
          // find or create by part_number if provided, else by name
          const query = supabase.from("parts").select("id").limit(1);
          const { data: existing } = row.part_number
            ? await query.eq("part_number", row.part_number).maybeSingle()
            : await query.eq("part_name", row.part_name).maybeSingle();

          if (existing) {
            partId = existing.id;
          } else {
            const { data: created, error: createError } = await supabase
              .from("parts")
              .insert({
                part_number: row.part_number || `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                part_name: row.part_name,
                unit: row.unit || "개",
              })
              .select("id")
              .single();
            if (createError) throw createError;
            partId = created.id;
          }
        }
        resolved.push({
          repair_id: repair.id,
          part_id: partId,
          quantity: row.quantity || 1,
          unit_price: Number(row.unit_price) || 0,
          notes: null,
        });
      }

      // Replace existing repair_parts
      const { error: delError } = await supabase.from("repair_parts").delete().eq("repair_id", repair.id);
      if (delError) throw delError;

      if (resolved.length > 0) {
        const { error: insError } = await supabase.from("repair_parts").insert(resolved);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-repairs"] });
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["repairs-recent"] });
      qc.invalidateQueries({ queryKey: ["repair-parts-edit", repair?.id] });
      toast({ title: "수정되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "수정 실패", description: e.message, variant: "destructive" }),
  });

  const valid = repairDate && repairContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>수리 이력 수정</DialogTitle>
          {repair && (
            <LastModifiedInfo updatedBy={repair.updated_by} updatedAt={repair.updated_at} className="pt-1" />
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 -mx-6 px-6">
          {repair?.machines && (
            <div className="rounded-md border bg-muted/30 p-2 text-sm">
              <span className="font-medium">{repair.machines.model_name}</span>{" "}
              <span className="text-xs font-mono text-muted-foreground">{repair.machines.serial_number}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>수리일 *</Label>
              <Input type="date" value={repairDate} onChange={(e) => setRepairDate(e.target.value)} />
            </div>
            <div>
              <Label>담당 기사</Label>
              <select
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">선택하세요</option>
                {employees?.map((emp: any) => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>수리 내용 *</Label>
            <Textarea value={repairContent} onChange={(e) => setRepairContent(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>공임비 (원)</Label>
              <Input type="number" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>사용시간 (Hr)</Label>
              <Input type="number" value={operatingHours} onChange={(e) => setOperatingHours(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>비고</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="edit-accounting"
              checked={accountingPosted}
              onCheckedChange={(v) => setAccountingPosted(!!v)}
            />
            <Label htmlFor="edit-accounting" className="cursor-pointer text-sm">전산 기표 완료</Label>
          </div>

          {/* Parts editor */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">사용 부품</h3>
              <span className="text-xs text-muted-foreground">{partRows.length}개</span>
            </div>

            {/* Search from parts */}
            <Popover open={partOpen} onOpenChange={setPartOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="부품명/부품번호 검색 (2자 이상)..."
                    value={partSearch}
                    onChange={(e) => {
                      setPartSearch(e.target.value);
                      setPartOpen(e.target.value.length >= 2);
                    }}
                    className="pl-9"
                  />
                </div>
              </PopoverTrigger>
              {partSearch.length >= 2 && (
                <PopoverContent
                  className="p-0 w-[var(--radix-popover-trigger-width)]"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <Command>
                    <CommandList>
                      <CommandEmpty>검색 결과 없음</CommandEmpty>
                      <CommandGroup>
                        {partSearchResults.map((p: any) => (
                          <CommandItem key={p.id} value={p.part_name} onSelect={() => addFromSearch(p)}>
                            <div className="flex-1">
                              {p.part_number && (
                                <span className="font-mono text-xs text-muted-foreground">[{p.part_number}]</span>
                              )}{" "}
                              <span className="font-medium">{p.part_name}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              )}
            </Popover>

            {/* Manual add */}
            <div className="grid grid-cols-[1fr_1fr_80px_auto] gap-2">
              <Input placeholder="부품명 (직접 입력)" value={manualName} onChange={(e) => setManualName(e.target.value)} />
              <Input placeholder="부품번호 (선택)" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} />
              <Input type="number" min={1} value={manualQty} onChange={(e) => setManualQty(e.target.value)} />
              <Button type="button" variant="outline" size="sm" onClick={addManual}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Rows */}
            {partRows.length > 0 && (
              <div className="space-y-1">
                {partRows.map((row) => (
                  <div key={row.key} className="flex items-center gap-2 rounded border bg-muted/20 px-2 py-1.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{row.part_name}</div>
                      {row.part_number && (
                        <div className="text-xs font-mono text-muted-foreground truncate">{row.part_number}</div>
                      )}
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={row.unit_price || ""}
                      onChange={(e) => updateUnitPrice(row.key, parseInt(e.target.value) || 0)}
                      className="w-24 h-8 text-right"
                      placeholder="단가"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => updateQty(row.key, parseInt(e.target.value) || 1)}
                      className="w-16 h-8 text-center"
                    />
                    <span className="text-xs text-muted-foreground w-6">{row.unit}</span>
                    <span className="text-xs font-medium w-20 text-right tabular-nums">
                      {formatPrice((Number(row.unit_price) || 0) * (Number(row.quantity) || 0))}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(row.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex flex-col mr-auto text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>공임비 {formatPrice(laborCostNum)}</span>
              <span>부품 {formatPrice(partsSubtotal)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span>총 비용:</span>
              <span className="text-base font-bold text-foreground">{formatPrice(totalCost)}</span>
            </div>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => updateMutation.mutate()} disabled={!valid || updateMutation.isPending}>
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
