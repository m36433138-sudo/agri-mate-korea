import { supabase } from "@/integrations/supabase/client";
import type { QuoteProduct } from "./quoteTypes";

/** 견적 제품 대분류 (농기계 종류). 순서 = 화면 탭 순서 */
export const MACHINE_GROUPS = ["트랙터", "이앙기", "콤바인", "작업기", "관리기·방제기", "옵션·부속", "기타"] as const;
export type MachineGroup = (typeof MACHINE_GROUPS)[number];

export const PRODUCT_BUCKET = "product-images";

/** 대분류를 모를 때 소분류·이름으로 짐작 (DB 이전 때와 같은 규칙) */
export function groupOf(p: Pick<QuoteProduct, "category" | "name"> & { machine_group?: string | null }): MachineGroup {
  if (p.machine_group && (MACHINE_GROUPS as readonly string[]).includes(p.machine_group)) return p.machine_group as MachineGroup;
  const c = `${p.category ?? ""}`;
  if (/옵션|부속|자율주행/.test(c)) return "옵션·부속";
  if (/트랙터/.test(c) || /^YT\d/i.test(p.name)) return "트랙터";
  if (/콤바인/.test(c) || /^(YH|AW)\d/i.test(p.name)) return "콤바인";
  if (/이앙기/.test(c) || /^(YR|VP)\d/i.test(p.name)) return "이앙기";
  if (/로타리|해로우|쟁기|작업기|써레|비료|파종/.test(c)) return "작업기";
  if (/관리기|방제기/.test(c)) return "관리기·방제기";
  return "기타";
}

/** 공개 버킷이라 바로 쓸 수 있는 주소 (견적서 그림 저장에도 그대로 들어간다) */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** 사진을 긴 변 1600px JPEG로 줄여 올린다 (휴대폰 사진 그대로 올리면 너무 크다) */
export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("사진 변환 실패"))), "image/jpeg", 0.86));
  const path = `${productId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(PRODUCT_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** 대분류 → 소분류 → 정렬 순서 → 이름 */
export function sortProducts(list: QuoteProduct[]): QuoteProduct[] {
  const gi = (p: QuoteProduct) => MACHINE_GROUPS.indexOf(groupOf(p));
  return [...list].sort((a, b) =>
    gi(a) - gi(b) || (a.category ?? "").localeCompare(b.category ?? "", "ko") || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ko"));
}

export function searchProducts(list: QuoteProduct[], q: string): QuoteProduct[] {
  const t = q.trim().toLowerCase();
  if (!t) return list;
  return list.filter((p) => [p.name, p.spec, p.category, p.brand, p.highlights, p.machine_group].some((v) => (v ?? "").toLowerCase().includes(t)));
}
