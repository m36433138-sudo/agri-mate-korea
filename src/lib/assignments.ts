import { sendPush } from "@/lib/appPush";
import { splitNames } from "@/hooks/useTechnicians";

/** 담당자 칸에서 새로 들어온 사람만 (이미 담당이던 사람에게 또 알리지 않는다) */
export function newlyAssigned(next: string | null | undefined, prev: string | null | undefined): string[] {
  const before = new Set(splitNames(prev));
  return splitNames(next).filter((n) => !before.has(n));
}

/** 「김영일, 마성수」 칸에 내 이름이 들었는지 */
export function isMine(field: string | null | undefined, myName: string | null | undefined): boolean {
  if (!myName) return false;
  return splitNames(field).includes(myName.trim());
}

/** 새 담당자 휴대폰에 알림. 실패해도 저장은 끝났다. */
export async function notifyAssignees(next: string | null | undefined, prev: string | null | undefined, msg: { title: string; body?: string; url: string; tag?: string }) {
  const names = newlyAssigned(next, prev);
  if (!names.length) return;
  await sendPush("general", { employee_names: names }, msg);
}
