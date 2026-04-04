import { useState, useEffect, useCallback } from "react";
import { SheetRow } from "@/types/operations";
import { useRepairDrafts, RepairDraft, RepairDraftPart } from "@/hooks/useRepairDrafts";
import { useTechnicians } from "@/hooks/useTechnicians";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import PartCodeAutocomplete from "@/components/PartCodeAutocomplete";
import { Trash2, Save, Plus, Package, Wrench, ArrowRightCircle } from "lucide-react";
import type { DraftPrefill } from "@/components/RepairInputModal";

interface Props {
  open: boolean;
  onClose: () => void;
  row: SheetRow;
  onTransferToRepair?: (prefill: DraftPrefill) => void;
}

export function RepairDraftModal({ open, onClose, row, onTransferToRepair }: Props) {
  const { fetchDraftWithParts, upsertDraft, addDraftPart, removeDraftPart } = useRepairDrafts();
  const { data: technicians = [] } = useTechnicians();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RepairDraft | null>(null);
  const [parts, setParts] = useState<RepairDraftPart[]>([]);
  const [description, setDescription] = useState("");
  const [laborCost, setLaborCost] = useState(0);
  const [technician, setTechnician] = useState(row.수리기사 || "");

  // New part form
  const [newPartName, setNewPartName] = useState("");
  const [newPartCode, setNewPartCode] = useState("");
  const [newPartQty, setNewPartQty] = useState(1);
  const [newPartPrice, setNewPartPrice] = useState(0);

  const loadDraft = useCallback(async () => {
    setLoading(true);
    try {
      const existing = await fetchDraftWithParts(row._branch, row._rowIndex);
      if (existing) {
        setDraft(existing);
        setParts(existing.parts || []);
        setDescription(existing.description || "");
        setLaborCost(existing.labor_cost || 0);
        setTechnician(existing.technician || row.수리기사 || "");
      } else {
        setDraft(null);
        setParts([]);
        setDescription("");
        setLaborCost(0);
        setTechnician(row.수리기사 || "");
      }
    } catch {
      toast({ title: "불러오기 실패", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [row._branch, row._rowIndex, row.수리기사]);

  useEffect(() => {
    if (open) loadDraft();
  }, [open, loadDraft]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await upsertDraft.mutateAsync({
        branch: row._branch,
        row_index: row._rowIndex,
        customer_name: row.손님성명,
        machine_type: row.기계,
        model: row.품목,
        technician,
        description,
        labor_cost: laborCost,
      });
      setDraft(prev => prev ? { ...prev, ...result } : result as RepairDraft);
      toast({ title: "임시 저장 완료" });
    } catch (err: any) {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPart = async () => {
    if (!newPartName.trim()) {
      toast({ title: "부품명을 입력하세요", variant: "destructive" });
      return;
    }
    // Ensure draft exists first
    let draftId = draft?.id;
    if (!draftId) {
      const result = await upsertDraft.mutateAsync({
        branch: row._branch,
        row_index: row._rowIndex,
        customer_name: row.손님성명,
        machine_type: row.기계,
        model: row.품목,
        technician,
        description,
        labor_cost: laborCost,
      });
      draftId = result.id;
      setDraft(result as RepairDraft);
    }
    try {
      await addDraftPart.mutateAsync({
        draft_id: draftId,
        part_code: newPartCode || undefined,
        part_name: newPartName,
        quantity: newPartQty,
        unit_price: newPartPrice,
      });
      // Reload parts
      const updated = await fetchDraftWithParts(row._branch, row._rowIndex);
      if (updated) setParts(updated.parts || []);
      setNewPartName("");
      setNewPartCode("");
      setNewPartQty(1);
      setNewPartPrice(0);
      toast({ title: "부품 추가됨" });
    } catch (err: any) {
      toast({ title: "부품 추가 실패", description: err.message, variant: "destructive" });
    }
  };

  const handleRemovePart = async (id: string) => {
    try {
      await removeDraftPart.mutateAsync(id);
      setParts(prev => prev.filter(p => p.id !== id));
    } catch {
      toast({ title: "삭제 실패", variant: "destructive" });
    }
  };

  const handlePartSelect = (item: { part_code: string; part_name: string }) => {
    setNewPartCode(item.part_code);
    setNewPartName(item.part_name);
  };

  const partsCost = parts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0);
  const totalCost = partsCost + laborCost;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            수리 내역 — {row.손님성명}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">불러오는 중...</div>
        ) : (
          <div className="space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">기계</Label>
                <p className="text-sm font-medium">{row.기계} {row.품목}</p>
              </div>
              <div>
                <Label className="text-xs">수리기사</Label>
                <Select value={technician} onValueChange={setTechnician}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="기사 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map(t => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                    {/* 기존에 입력된 기사가 목록에 없을 때 */}
                    {technician && !technicians.find(t => t.name === technician) && (
                      <SelectItem value={technician}>{technician} (기존)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 수리 내역 */}
            <div>
              <Label className="text-xs">수리 내역</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="수리 내용을 기록하세요..."
              />
            </div>

            <Separator />

            {/* 사용 부품 목록 */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <Package className="h-3.5 w-3.5" /> 사용 부품
              </Label>

              {parts.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {parts.map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        {p.part_code && (
                          <span className="font-mono text-xs text-muted-foreground">[{p.part_code}] </span>
                        )}
                        <span className="font-medium">{p.part_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {p.quantity}개 × {p.unit_price.toLocaleString()}원
                      </span>
                      <span className="text-xs font-medium whitespace-nowrap">
                        = {(p.quantity * p.unit_price).toLocaleString()}원
                      </span>
                      <button onClick={() => handleRemovePart(p.id)} className="p-1 hover:bg-destructive/10 rounded">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 부품 추가 폼 */}
              <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground">부품 추가</p>
                <PartCodeAutocomplete
                  branch={row._branch}
                  onSelect={handlePartSelect}
                  placeholder="부품 검색 (3자리 이상)..."
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      value={newPartCode}
                      onChange={e => setNewPartCode(e.target.value)}
                      placeholder="부품코드"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      value={newPartName}
                      onChange={e => setNewPartName(e.target.value)}
                      placeholder="부품명 *"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Input
                      type="number"
                      value={newPartQty}
                      onChange={e => setNewPartQty(Number(e.target.value) || 1)}
                      placeholder="수량"
                      className="h-8 text-xs"
                      min={1}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      value={newPartPrice || ""}
                      onChange={e => setNewPartPrice(Number(e.target.value) || 0)}
                      placeholder="단가"
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={handleAddPart} className="h-8 text-xs">
                    <Plus className="h-3.5 w-3.5 mr-1" /> 추가
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* 비용 요약 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">공임비</Label>
                <Input
                  type="number"
                  value={laborCost || ""}
                  onChange={e => setLaborCost(Number(e.target.value) || 0)}
                  placeholder="공임비 (원)"
                />
              </div>
              <div className="flex flex-col justify-end">
                <Label className="text-xs">총 비용</Label>
                <p className="text-lg font-bold text-primary">{totalCost.toLocaleString()}원</p>
                <p className="text-[10px] text-muted-foreground">부품비 {partsCost.toLocaleString()} + 공임 {laborCost.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "저장 중..." : "임시 저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
