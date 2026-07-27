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

  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
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
    }
  }, [open, repair]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!repair) return;
      const labor = parseInt(laborCost) || 0;
      const { error } = await supabase
        .from("repairs")
        .update({
          repair_date: repairDate,
          repair_content: repairContent,
          technician: technician || null,
          labor_cost: labor,
          total_cost: labor,
          operating_hours: parseInt(operatingHours) || null,
          notes: notes || null,
          accounting_posted: accountingPosted,
        })
        .eq("id", repair.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-repairs"] });
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["repairs-recent"] });
      toast({ title: "수정되었습니다." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "수정 실패", description: e.message, variant: "destructive" }),
  });

  const valid = repairDate && repairContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>수리 이력 수정</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={() => updateMutation.mutate()} disabled={!valid || updateMutation.isPending}>
            {updateMutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
