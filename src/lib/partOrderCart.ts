import { useSyncExternalStore } from "react";

export type CartItem = { partCode: string; partName: string; qty: number; model?: string; unitPrice?: number | null };
const KEY = "agrimate.partOrderCart.v1";
const listeners = new Set<() => void>();
let cache: CartItem[] | null = null;

function read(): CartItem[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { cache = []; }
  return cache!;
}
function write(items: CartItem[]) {
  cache = items;
  localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}

/** 같은 부품번호는 수량만 더함 */
export function mergeItem(items: CartItem[], item: CartItem): CartItem[] {
  const i = items.findIndex((x) => x.partCode === item.partCode);
  if (i < 0) return [...items, { ...item, qty: Math.max(1, item.qty) }];
  const next = [...items];
  next[i] = { ...next[i], qty: next[i].qty + Math.max(1, item.qty), partName: next[i].partName || item.partName };
  return next;
}

export const cart = {
  add: (item: CartItem) => write(mergeItem(read(), item)),
  setQty: (code: string, qty: number) => write(read().map((x) => (x.partCode === code ? { ...x, qty: Math.max(1, qty) } : x))),
  remove: (code: string) => write(read().filter((x) => x.partCode !== code)),
  clear: () => write([]),
};

export function useCart() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    read,
    () => [],
  );
}

/** 얀마 발주용 행: 순번, 부품번호, 부품명, 수량, 기종, 단가, 금액 */
export function toOrderRows(items: CartItem[]) {
  return items.map((x, i) => ({
    순번: i + 1,
    부품번호: x.partCode,
    부품명: x.partName,
    수량: x.qty,
    기종: x.model || "",
    단가: x.unitPrice ?? "",
    금액: x.unitPrice ? x.unitPrice * x.qty : "",
  }));
}
