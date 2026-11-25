import { supabase } from "@/integrations/supabase/client";
import type { StatementDoc, StatementLine } from "./printPartSale";

const db = supabase as any;

export type RepairForStatement = {
  id: string;
  repair_date: string;
  repair_content: string | null;
  technician: string | null;
  labor_cost: number | null;
  total_cost: number | null;
  notes: string | null;
  is_free_service?: boolean | null;
  free_reason?: string | null;
  waived_amount?: number | null;
  machine?: { model_name: string | null; serial_number: string | null } | null;
  customer?: { name: string; phone: string | null; address: string | null } | null;
  parts: { part_number: string | null; part_name: string | null; quantity: number; unit_price: number }[];
  /** 이 수리로 생긴 미수금 (없으면 완납) */
  receivable?: { amount: number; paid_amount: number; is_paid: boolean } | null;
};

/** 수리번호: RP-YYMMDD-ID앞4자리 */
export const repairDocNumber = (r: Pick<RepairForStatement, "id" | "repair_date">) =>
  `RP-${r.repair_date.replace(/-/g, "").slice(2, 8)}-${r.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;

/** 수리 기록 → 거래명세서. 무상(서비스)이면 원래 금액을 보여 주고 합계는 0원. */
export function repairToStatement(r: RepairForStatement): StatementDoc {
  const lines: StatementLine[] = r.parts.map((p) => ({
    code: p.part_number, name: p.part_name || p.part_number || "부품", qty: Number(p.quantity) || 0, unit: "EA",
    unitPrice: Number(p.unit_price) || 0, amount: (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
  }));
  const labor = Number(r.labor_cost) || 0;
  if (labor > 0) lines.push({ code: null, name: `공임${r.technician ? ` (${r.technician})` : ""}`, qty: 1, unitPrice: labor, amount: labor });
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const free = !!r.is_free_service;
  const waived = free ? Number(r.waived_amount) || subtotal : 0;
  const total = free ? 0 : Number(r.total_cost) || subtotal;
  const rec = r.receivable;
  const outstanding = rec && !rec.is_paid ? Math.max(0, Number(rec.amount) - Number(rec.paid_amount)) : 0;
  const paid = Math.max(0, total - outstanding);
  const machine = [r.machine?.model_name, r.machine?.serial_number && `(${r.machine.serial_number})`].filter(Boolean).join(" ");
  return {
    docNo: repairDocNumber(r),
    date: r.repair_date,
    subtitle: "수리",
    buyerName: r.customer?.name ?? "고객",
    buyerPhone: r.customer?.phone,
    buyerAddress: r.customer?.address,
    lines,
    subtotal,
    total,
    paid,
    payLabel: free ? "무상(서비스)" : outstanding > 0 ? (paid > 0 ? "일부 입금" : "외상") : "완납",
    notes: [machine && `기계: ${machine}`, r.repair_content && `수리 내용: ${r.repair_content}`, r.notes].filter(Boolean).join("\n") || null,
    freeService: free ? { waived, reason: r.free_reason } : null,
  };
}

/** 수리 한 건을 거래명세서용으로 불러온다 (기계·고객·부품·미수금) */
export async function loadRepairForStatement(repairId: string): Promise<RepairForStatement> {
  const [{ data: r, error }, { data: parts }, { data: recs }] = await Promise.all([
    db.from("repairs").select("id, repair_date, repair_content, technician, labor_cost, total_cost, notes, is_free_service, free_reason, waived_amount, machines(model_name, serial_number, customers(name, phone, address))").eq("id", repairId).single(),
    db.from("repair_parts").select("quantity, unit_price, parts(part_number, part_name)").eq("repair_id", repairId),
    db.from("finance_records").select("amount, paid_amount, is_paid").eq("source_type", "repair").eq("source_id", repairId).limit(1),
  ]);
  if (error) throw new Error(error.message);
  return {
    ...r,
    machine: r.machines ? { model_name: r.machines.model_name, serial_number: r.machines.serial_number } : null,
    customer: r.machines?.customers ?? null,
    parts: (parts ?? []).map((p: any) => ({ part_number: p.parts?.part_number ?? null, part_name: p.parts?.part_name ?? null, quantity: p.quantity, unit_price: p.unit_price })),
    receivable: recs?.[0] ?? null,
  };
}
