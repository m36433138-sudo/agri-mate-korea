import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PartCodeAutocomplete from "@/components/PartCodeAutocomplete";
import PartsStockList from "@/components/diagrams/PartsStockList";
import { salesPriceOf } from "@/components/diagrams/PartsStockList";
import EstimateDiagramPicker from "./EstimateDiagramPicker";
import { fetchDiagramInventory } from "@/lib/diagramInventory";
import { addEstimateItem, estimateTotals, lineAmount, newKey, type EstimateItem, type EstimateItemType } from "@/lib/insuranceEstimate";
import { FileText, Map as MapIcon, MapPin, Plus, Printer, Trash2, Wrench } from "lucide-react";

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const toNum = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
const cellCls = "h-9 px-2 text-sm";

type Props = {
  items: EstimateItem[];
  setItems: Dispatch<SetStateAction<EstimateItem[]>>;
  machineModel: string | null;
  onPrint: () => void;
};

/** 보험사에 낼 수리 견적서: 도면에서 눌러 담거나 직접 입력 */
export default function InsuranceEstimateEditor({ items, setItems, machineModel, onPrint }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const totals = estimateTotals(items);
  const partCodes = items.filter((i) => i.item_type === "부품" && i.part_code.trim()).map((i) => ({ code: i.part_code.trim(), name: i.part_name }));

  const addMany = (list: EstimateItem[]) => setItems((prev) => list.reduce(addEstimateItem, prev));
  const update = (key: string, patch: Partial<EstimateItem>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const remove = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));
  const blank = (type: EstimateItemType) => setItems((prev) => [...prev, { key: newKey(), item_type: type, part_code: "", part_name: type === "공임" ? "수리 공임" : "", quantity: 1, unit_price: 0 }]);

  const addFromInventory = async (p: { part_code: string; part_name: string }) => {
    let price: number | null = null;
    try { price = salesPriceOf(p.part_code, await fetchDiagramInventory([p.part_code])); } catch { /* 가격 없이 담는다 */ }
    addMany([{ key: newKey(), item_type: "부품", part_code: p.part_code, part_name: p.part_name, quantity: 1, unit_price: price ?? 0 }]);
  };

  return (
    <div className="rounded-xl border p-3 space-y-3 bg-muted/20">
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" /> 보험 견적서</Label>
        <span className="text-[11px] text-muted-foreground">보험사 제출용 · 소비자 판매 견적서와 따로 저장돼요</span>
        <div className="ml-auto flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1" disabled={!partCodes.length} onClick={() => setStockOpen(true)}><MapPin className="h-3.5 w-3.5" /> 재고·위치</Button>
          <Button size="sm" variant="outline" className="gap-1" disabled={!items.length} onClick={onPrint}><Printer className="h-3.5 w-3.5" /> 인쇄</Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
        <Button size="sm" className="gap-1.5" onClick={() => setPickerOpen(true)}><MapIcon className="h-4 w-4" /> 부품 도면에서 담기</Button>
        <PartCodeAutocomplete branch={null} onSelect={(p) => void addFromInventory(p)} placeholder="부품번호·이름으로 추가 (3자 이상)" />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => blank("부품")}><Plus className="h-3.5 w-3.5" /> 부품 직접 입력</Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => blank("공임")}><Wrench className="h-3.5 w-3.5" /> 공임 추가</Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => blank("기타")}><Plus className="h-3.5 w-3.5" /> 기타</Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">도면에서 부품을 누르거나, 부품번호 검색·직접 입력으로 견적을 채워 주세요.</p>
      ) : (
        <div className="space-y-1.5">
          <div className="hidden sm:grid grid-cols-[4.5rem_8.5rem_minmax(8rem,1fr)_3.5rem_6rem_6rem_2.25rem] gap-1.5 text-[11px] text-muted-foreground px-0.5">
            <span>구분</span><span>부품번호</span><span>품명</span><span className="text-right">수량</span><span className="text-right">단가</span><span className="text-right">금액</span><span />
          </div>
          {items.map((it) => (
            <div key={it.key} className="grid grid-cols-[4.5rem_1fr_2.25rem] sm:grid-cols-[4.5rem_8.5rem_minmax(8rem,1fr)_3.5rem_6rem_6rem_2.25rem] gap-1.5 items-center rounded-lg border sm:border-0 p-2 sm:p-0">
              <select aria-label="구분" value={it.item_type} onChange={(e) => update(it.key, { item_type: e.target.value as EstimateItemType })}
                className="h-9 rounded-md border border-input bg-background px-1.5 text-sm">
                <option value="부품">부품</option><option value="공임">공임</option><option value="기타">기타</option>
              </select>
              <Input aria-label="부품번호" value={it.part_code} onChange={(e) => update(it.key, { part_code: e.target.value.toUpperCase() })} placeholder={it.item_type === "부품" ? "부품번호" : "-"} className={`${cellCls} font-mono`} />
              <Button size="icon" variant="ghost" className="h-9 w-9 sm:hidden" aria-label="삭제" onClick={() => remove(it.key)}><Trash2 className="h-4 w-4" /></Button>
              <div className="col-span-3 sm:col-span-1 min-w-0">
                <Input aria-label="품명" value={it.part_name} onChange={(e) => update(it.key, { part_name: e.target.value })} placeholder="품명 · 작업 내용" className={cellCls} />
                {it.diagram_title && <p className="text-[10px] text-muted-foreground truncate mt-0.5">도면: {it.diagram_title}</p>}
              </div>
              <div className="col-span-3 sm:contents grid grid-cols-3 gap-1.5">
                <Input aria-label="수량" inputMode="decimal" value={String(it.quantity)} onChange={(e) => update(it.key, { quantity: toNum(e.target.value) || 1 })} className={`${cellCls} text-right`} />
                <Input aria-label="단가" inputMode="numeric" value={it.unit_price ? it.unit_price.toLocaleString("ko-KR") : ""} placeholder="단가" onChange={(e) => update(it.key, { unit_price: Math.round(toNum(e.target.value)) })} className={`${cellCls} text-right ${it.unit_price ? "" : "border-amber-500/60"}`} />
                <span className="text-sm text-right tabular-nums font-medium self-center">{won(lineAmount(it))}</span>
              </div>
              <Button size="icon" variant="ghost" className="h-9 w-9 hidden sm:inline-flex" aria-label="삭제" onClick={() => remove(it.key)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-sm border-t pt-2">
          <span className="text-muted-foreground">부품 {won(totals.parts)}</span>
          <span className="text-muted-foreground">공임 {won(totals.labor)}</span>
          {totals.other > 0 && <span className="text-muted-foreground">기타 {won(totals.other)}</span>}
          <span className="font-bold">합계 {won(totals.total)}</span>
        </div>
      )}

      <EstimateDiagramPicker open={pickerOpen} onOpenChange={setPickerOpen} machineModel={machineModel} onAdd={addMany} />
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> 견적 부품 재고·위치·가격</DialogTitle></DialogHeader>
          {stockOpen && <PartsStockList parts={partCodes} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
