export type PartSalePaymentMode = "paid" | "unpaid" | "partial";

export interface PartSaleLine {
  part_code: string;
  part_name: string;
  quantity: number;
  unit_price: number;
  /** 판매 시점 해당 지점 재고 (없으면 null = 재고 목록에 없는 부품) */
  stock?: number | null;
}

export interface PartSaleTotals {
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  receivable: number;
}

/** 합계·할인·입금·미수금 계산 (서버 create_part_sale 과 같은 규칙) */
export function partSaleTotals(
  lines: PartSaleLine[],
  discount: number,
  mode: PartSalePaymentMode,
  partialPaid: number,
): PartSaleTotals {
  const subtotal = lines.reduce(
    (s, l) => s + Math.max(0, Math.round(l.quantity)) * Math.max(0, Math.round(l.unit_price)),
    0,
  );
  const d = Math.min(Math.max(0, Math.round(discount || 0)), subtotal);
  const total = subtotal - d;
  const paid = mode === "paid" ? total : mode === "unpaid" ? 0 : Math.min(Math.max(0, Math.round(partialPaid || 0)), total);
  return { subtotal, discount: d, total, paid, receivable: total - paid };
}

/** 저장 전 확인. 문제가 있으면 사용자에게 보여줄 문장, 없으면 null */
export function validatePartSale(input: {
  lines: PartSaleLine[];
  customerId: string | null;
  buyerName: string;
  discount: number;
  mode: PartSalePaymentMode;
  partialPaid: number;
}): string | null {
  if (input.lines.length === 0) return "판매할 부품을 한 개 이상 넣어주세요";
  if (input.lines.some((l) => !l.part_code.trim())) return "부품번호가 비어 있는 줄이 있어요";
  if (input.lines.some((l) => !Number.isFinite(l.quantity) || l.quantity <= 0 || !Number.isInteger(l.quantity)))
    return "수량은 1개 이상으로 입력해주세요";
  if (input.lines.some((l) => !Number.isFinite(l.unit_price) || l.unit_price < 0)) return "단가를 확인해주세요";
  const subtotal = partSaleTotals(input.lines, 0, "paid", 0).subtotal;
  if ((input.discount || 0) > subtotal) return "할인이 합계보다 클 수 없어요";
  if (!input.customerId && !input.buyerName.trim()) return "고객을 고르거나 손님 이름을 적어주세요";
  if (input.mode !== "paid" && !input.customerId) return "외상·일부 입금은 등록된 고객을 골라야 해요";
  if (input.mode === "partial") {
    const total = subtotal - (input.discount || 0);
    if (!(input.partialPaid > 0 && input.partialPaid < total)) return "일부 입금액은 0원보다 크고 합계보다 작아야 해요";
  }
  return null;
}

/** 같은 부품을 다시 담으면 수량만 늘린다 */
export function addPartSaleLine(lines: PartSaleLine[], line: PartSaleLine): PartSaleLine[] {
  const code = line.part_code.trim();
  const i = lines.findIndex((l) => l.part_code.trim() === code);
  if (i < 0) return [...lines, { ...line, part_code: code }];
  return lines.map((l, idx) => (idx === i ? { ...l, quantity: l.quantity + line.quantity } : l));
}

/** 판매 후 재고가 모자라는 부품 (음수 허용, 경고용) */
export function shortageLines(lines: PartSaleLine[]): PartSaleLine[] {
  return lines.filter((l) => typeof l.stock === "number" && l.stock - l.quantity < 0);
}
