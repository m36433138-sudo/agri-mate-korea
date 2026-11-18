/** 보험수리 견적서: 항목 계산과 도면 소요 수량 해석 */

export type EstimateItemType = "부품" | "공임" | "기타";

export type EstimateItem = {
  key: string;
  item_type: EstimateItemType;
  part_code: string;
  part_name: string;
  quantity: number;
  unit_price: number;
  diagram_id?: string | null;
  diagram_title?: string | null;
  notes?: string | null;
};

export const newKey = () => Math.random().toString(36).slice(2, 10);

export const lineAmount = (it: Pick<EstimateItem, "quantity" | "unit_price">) =>
  Math.round((Number(it.quantity) || 0) * (Number(it.unit_price) || 0));

export function estimateTotals(items: EstimateItem[]) {
  let parts = 0, labor = 0, other = 0;
  for (const it of items) {
    const a = lineAmount(it);
    if (it.item_type === "공임") labor += a;
    else if (it.item_type === "기타") other += a;
    else parts += a;
  }
  return { parts, labor, other, total: parts + labor + other };
}

const sameCode = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/** 같은 부품번호의 부품은 한 줄로 합쳐 수량만 더한다 (공임·기타나 번호 없는 줄은 새 줄) */
export function addEstimateItem(items: EstimateItem[], item: EstimateItem): EstimateItem[] {
  if (item.item_type === "부품" && item.part_code.trim()) {
    const i = items.findIndex((x) => x.item_type === "부품" && sameCode(x.part_code, item.part_code));
    if (i >= 0) {
      const next = [...items];
      const prev = next[i];
      next[i] = {
        ...prev,
        quantity: (Number(prev.quantity) || 0) + (Number(item.quantity) || 1),
        part_name: prev.part_name || item.part_name,
        unit_price: prev.unit_price || item.unit_price,
      };
      return next;
    }
  }
  return [...items, item];
}

/** 소요 수량 한 칸: 기종이 없으면 model=null, 「-」(이 기종엔 안 쓰임)이면 qty=null */
export type QtyOption = { model: string | null; qty: number | null };

/** "2개", "AW6114 1 / AW7114 -", "EL2200 3개 / EL2400 2개" 같은 도면 소요 수량을 나눈다 */
export function parseQtyNote(note: string | null | undefined): QtyOption[] {
  if (!note) return [];
  const text = note.replace(/^소요\s*수량\s*·\s*/, "").trim();
  if (!text) return [];
  const out: QtyOption[] = [];
  for (const part of text.split("/")) {
    const m = part.trim().match(/^(.*?)\s*(\d+(?:\.\d+)?|-)\s*개?$/u);
    if (!m) continue;
    const model = m[1].trim() || null;
    out.push({ model, qty: m[2] === "-" ? null : Number(m[2]) });
  }
  return out;
}

const bare = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");

export type ResolvedQty = {
  /** 이 기계에 들어가는 수량. 기종을 못 정했거나 안 쓰이면 null */
  qty: number | null;
  /** 해당 기종에 「-」로 표시되어 쓰이지 않는 부품 */
  notUsed: boolean;
  /** 기종별 수량이 달라 사람이 골라야 함 */
  ambiguous: boolean;
  matchedModel: string | null;
  options: QtyOption[];
};

/** 도면 소요 수량을 보험수리 기계(예: YH7140-X)에 맞춰 고른다 */
export function resolveDiagramQty(note: string | null | undefined, machineModel: string | null | undefined): ResolvedQty {
  const options = parseQtyNote(note);
  const base: ResolvedQty = { qty: null, notUsed: false, ambiguous: false, matchedModel: null, options };
  if (options.length === 0) return base;
  if (options.length === 1 && !options[0].model) return { ...base, qty: options[0].qty, notUsed: options[0].qty == null };

  const m = bare(machineModel);
  if (m) {
    const hits = options
      .filter((o) => o.model && (m.startsWith(bare(o.model)) || bare(o.model).startsWith(m)))
      .sort((a, b) => bare(b.model).length - bare(a.model).length);
    const exact = hits.find((o) => bare(o.model) === m) ?? hits[0];
    if (exact) return { ...base, qty: exact.qty, notUsed: exact.qty == null, matchedModel: exact.model };
  }
  const used = options.filter((o) => o.qty != null);
  const distinct = new Set(used.map((o) => o.qty));
  if (used.length > 0 && distinct.size === 1) return { ...base, qty: used[0].qty };
  if (used.length === 0) return { ...base, notUsed: true };
  return { ...base, ambiguous: true };
}
