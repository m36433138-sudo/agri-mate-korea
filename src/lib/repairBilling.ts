/** free = 무상(서비스): 청구하지 않고 원래 금액은 waived_amount로 남긴다 */
export type RepairPaymentMode = "paid" | "unpaid" | "partial" | "free";

export interface RepairReceivablePlan {
  amount: number;
  paidAmount: number;
  isPaid: boolean;
  dueDate: string;
}

/** 수리 저장 시 미수금으로 남길 금액 계산. 남을 금액이 없으면 null. */
export function planRepairReceivable(
  total: number,
  mode: RepairPaymentMode,
  partialPaid: number,
  repairDate: string,
  dueDays = 30,
): RepairReceivablePlan | null {
  const amount = Math.max(0, Math.round(total));
  if (amount <= 0 || mode === "paid" || mode === "free") return null;
  const paid = mode === "partial" ? Math.min(Math.max(0, Math.round(partialPaid)), amount) : 0;
  if (paid >= amount) return null;
  const d = new Date(`${repairDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dueDays);
  return { amount, paidAmount: paid, isPaid: false, dueDate: d.toISOString().slice(0, 10) };
}
