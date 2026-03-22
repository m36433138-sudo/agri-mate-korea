import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, X, Wrench } from "lucide-react";
import PartCodeAutocomplete from "./PartCodeAutocomplete";

type PartUsed = {
  part_code: string;
  part_name: string;
  quantity: number;
};

const MECHANICS = ["유호상", "마성수", "김영일", "이재현", "이동진", "정찬교"];

export default function MechanicRepairForm() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [mechanicName, setMechanicName] = useState(MECHANICS[0]);
  const [branch, setBranch] = useState<"장흥" | "강진">("장흥");
  const [operatingHours, setOperatingHours] = useState("");
  const [description, setDescription] = useState("");
  const [partsUsed, setPartsUsed] = useState<PartUsed[]>([]);

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);

  // Machine search (filtered by customer)
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [selectedMachineName, setSelectedMachineName] = useState("");

  const { data: customerMachines } = useQuery({
    queryKey: ["customer-machines", selectedCustomerId],
    enabled: !!selectedCustomerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("id, model_name, serial_number, machine_type")
        .eq("customer_id", selectedCustomerId);
      if (error) throw error;
      return data;
    },
  });

  const searchCustomers = async (q: string) => {
    setCustomerSearch(q);
    if (!q.trim()) { setCustomerResults([]); return; }
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone")
      .ilike("name", `%${q}%`)
      .limit(8);
    setCustomerResults(data || []);
  };

  const pickCustomer = (c: any) => {
    setSelectedCustomerId(c.id);
    setSelectedCustomerName(c.name);
    setCustomerSearch("");
    setCustomerResults([]);
    setSelectedMachineId("");
    setSelectedMachineName("");
  };

  const pickMachine = (m: any) => {
    setSelectedMachineId(m.id);
    setSelectedMachineName(`${m.machine_type} ${m.model_name} (${m.serial_number})`);
  };

  const addPart = (item: { part_code: string; part_name: string }) => {
    const existing = partsUsed.findIndex((p) => p.part_code === item.part_code);
    if (existing >= 0) {
      setPartsUsed((prev) =>
        prev.map((p, i) => (i === existing ? { ...p, quantity: p.quantity + 1 } : p))
      );
    } else {
      setPartsUsed((prev) => [...prev, { part_code: item.part_code, part_name: item.part_name, quantity: 1 }]);
    }
  };

  const updatePartQuantity = (i: number, qty: number) => {
    setPartsUsed((prev) => prev.map((p, idx) => (idx === i ? { ...p, quantity: Math.max(1, qty) } : p)));
  };

  const removePart = (i: number) => setPartsUsed((prev) => prev.filter((_, idx) => idx !== i));

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Insert repair_log
      const { data, error } = await supabase
        .from("repair_logs")
        .insert({
          customer_id: selectedCustomerId || null,
          machine_id: selectedMachineId || null,
          mechanic_name: mechanicName,
          operating_hours: operatingHours ? parseInt(operatingHours) : null,
          description: description || null,
          branch,
        })
        .select("id")
        .single();
      if (error) throw error;

      // 2. Insert repair_log_parts (trigger will deduct inventory)
      if (partsUsed.length > 0) {
        const { error: partsError } = await supabase.from("repair_log_parts").insert(
          partsUsed.map((p) => ({
            repair_log_id: data.id,
            part_code: p.part_code,
            quantity_used: p.quantity,
          }))
        );
        if (partsError) throw partsError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repair-logs"] });
      qc.invalidateQueries({ queryKey: ["inventory-search"] });
      toast({ title: "정비 기록이 저장되었습니다." });
      // Reset form
      setDescription("");
      setOperatingHours("");
      setPartsUsed([]);
      setSelectedCustomerId("");
      setSelectedCustomerName("");
      setSelectedMachineId("");
      setSelectedMachineName("");
    },
    onError: (e: any) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const canSubmit = mechanicName && description;

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          정비 내역 입력
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-5">
          {/* Row 1: Mechanic & Branch */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>수리기사 *</Label>
              <select
                value={mechanicName}
                onChange={(e) => setMechanicName(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MECHANICS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>지점</Label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value as "장흥" | "강진")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="장흥">장흥</option>
                <option value="강진">강진</option>
              </select>
            </div>
          </div>

          {/* Row 2: Customer search */}
          <div className="relative">
            <Label>고객 검색</Label>
            {selectedCustomerId ? (
              <div className="flex items-center gap-2">
                <Input value={selectedCustomerName} disabled className="bg-muted flex-1" />
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setSelectedCustomerId(""); setSelectedCustomerName(""); setSelectedMachineId(""); setSelectedMachineName(""); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="고객 이름 검색..." value={customerSearch} onChange={(e) => searchCustomers(e.target.value)} className="pl-9" />
                </div>
                {customerResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                    {customerResults.map((c: any) => (
                      <button key={c.id} type="button" onClick={() => pickCustomer(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors">
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Row 3: Machine select (if customer selected) */}
          {selectedCustomerId && customerMachines && customerMachines.length > 0 && (
            <div>
              <Label>기종 및 형식</Label>
              <select
                value={selectedMachineId}
                onChange={(e) => {
                  const m = customerMachines.find((x: any) => x.id === e.target.value);
                  if (m) pickMachine(m);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">기계를 선택하세요</option>
                {customerMachines.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.machine_type} {m.model_name} ({m.serial_number})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Operating hours */}
          <div>
            <Label>사용 시간 (Hours)</Label>
            <Input type="number" value={operatingHours} onChange={(e) => setOperatingHours(e.target.value)} placeholder="예: 122" />
          </div>

          {/* Description */}
          <div>
            <Label>수리/요구사항 내용 *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="정비 내용을 입력하세요" rows={3} />
          </div>

          {/* Parts section */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm font-semibold text-muted-foreground">사용 부품 내역</Label>
            <PartCodeAutocomplete branch={branch} onSelect={addPart} />

            {partsUsed.length > 0 && (
              <div className="space-y-2 mt-3">
                {partsUsed.map((part, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{part.part_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{part.part_code}</p>
                    </div>
                    <Input
                      type="number"
                      value={part.quantity}
                      onChange={(e) => updatePartQuantity(i, parseInt(e.target.value) || 1)}
                      className="w-20 h-8 text-sm text-center"
                      min={1}
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removePart(i)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit || saveMutation.isPending} className="w-full">
            {saveMutation.isPending ? "저장 중..." : "정비 기록 저장 및 재고 차감"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
