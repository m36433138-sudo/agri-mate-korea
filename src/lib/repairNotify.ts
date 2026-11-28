import { sendPush } from "@/lib/appPush";
import { splitNames } from "@/hooks/useTechnicians";

/** 수리 저장 때 알림 받을 사람 (마지막 선택을 이 기기에 기억) */
const KEY = "repair.notifyTo";
export function rememberedNotifyTo(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}
export function rememberNotifyTo(v: string) {
  try { localStorage.setItem(KEY, v); } catch { /* 기억 못 해도 이번엔 보낸다 */ }
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/** 「수리 완료」 알림 글: 누구 기계 무엇을, 누가, 얼마 */
export function repairNotice(r: {
  id: string; customer?: string | null; machine?: string | null; content: string; technician?: string | null;
  total: number; free?: boolean; receivable?: number;
}) {
  const who = [r.customer, r.machine].filter(Boolean).join(" · ");
  const money = r.free ? "무상(서비스)" : r.receivable && r.receivable > 0 ? `${won(r.total)} · 미수 ${won(r.receivable)}` : r.total > 0 ? won(r.total) : "";
  const body = [r.content.replace(/\s+/g, " ").trim().slice(0, 90), [r.technician && `담당 ${r.technician}`, money].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
  return { title: `수리 완료${who ? ` · ${who}` : ""}`, body, url: "/repairs", tag: `repair-${r.id}` };
}

/** 고른 사람들에게 보낸다. 실패해도 저장은 이미 끝났으니 결과만 돌려준다. */
export async function notifyRepairSaved(to: string, notice: ReturnType<typeof repairNotice>) {
  const names = splitNames(to);
  if (!names.length) return null;
  return sendPush("repair", { employee_names: names }, notice);
}
