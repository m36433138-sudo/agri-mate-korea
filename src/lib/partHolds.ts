import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/components/partReceipts/receiptData";

export const HOLD_PHOTO_BUCKET = "part-photos";

export type HoldStatus = "held" | "used" | "returned";
export const HOLD_STATUS_LABEL: Record<HoldStatus, string> = { held: "빼놓음", used: "사용함", returned: "다시 넣음" };

export type PartHoldItem = { id?: string; part_code: string; part_name: string; quantity: number };
export type PartHold = {
  id: string;
  branch: string;
  purpose: string;
  customer_id: string | null;
  customer_name: string | null;
  assignee: string | null;
  spot: string | null;
  photo_paths: string[];
  status: HoldStatus;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
  part_hold_items: PartHoldItem[];
  customers?: { name: string } | null;
};

/** 화면에 보일 「누구 것」: 고객 이름(연결 고객 우선) · 담당 */
export function holdOwner(h: Pick<PartHold, "customer_name" | "assignee" | "customers">): string {
  const who = h.customers?.name || h.customer_name || "";
  return [who, h.assignee && `담당 ${h.assignee}`].filter(Boolean).join(" · ") || "대상 미정";
}

/** 빼놓은(아직 안 쓴) 수량을 부품코드별로 더한다. 부품현황 「빼놓음 N」 표시용 */
export function heldQtyByCode(holds: Pick<PartHold, "status" | "branch" | "part_hold_items">[], branch?: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of holds) {
    if (h.status !== "held" || (branch && h.branch !== branch)) continue;
    for (const it of h.part_hold_items) m.set(it.part_code, (m.get(it.part_code) ?? 0) + (Number(it.quantity) || 0));
  }
  return m;
}

/** 같은 부품을 두 번 담으면 수량을 합친다 */
export function addHoldItem(list: PartHoldItem[], it: PartHoldItem): PartHoldItem[] {
  const i = list.findIndex((x) => x.part_code === it.part_code);
  if (i < 0) return [...list, { ...it, quantity: Math.max(1, it.quantity) }];
  return list.map((x, j) => (j === i ? { ...x, quantity: x.quantity + Math.max(1, it.quantity) } : x));
}

export function validateHold(h: { items: PartHoldItem[]; customerName: string; assignee: string; purpose: string }): string | null {
  if (!h.items.length) return "빼놓은 부품을 하나 이상 담아 주세요";
  if (h.items.some((i) => !(i.quantity > 0))) return "수량은 1개 이상이어야 해요";
  if (!h.customerName.trim() && !h.assignee.trim() && !h.purpose.trim()) return "누구 것인지(고객·담당·용도 중 하나)는 적어 주세요";
  return null;
}

export const HOLD_SELECT = "*, customers(name), part_hold_items(id, part_code, part_name, quantity)";

export async function fetchHolds(status: HoldStatus | "all"): Promise<PartHold[]> {
  let q = db.from("part_holds").select(HOLD_SELECT).order("created_at", { ascending: false }).limit(300);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PartHold[];
}

/** 비공개 버킷이라 서명된 주소로 보여 준다 */
export async function signHoldPhotos(paths: string[]): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const { data } = await supabase.storage.from(HOLD_PHOTO_BUCKET).createSignedUrls(paths, 3600);
  return new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path as string, d.signedUrl]));
}

/** 휴대폰 사진을 긴 변 1600px JPEG로 줄인다 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  img.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("사진 변환 실패"))), "image/jpeg", 0.82));
}

/** 사진을 먼저 올리고 한 번에 저장한다. 저장이 실패하면 올린 사진을 지운다. */
export async function createHold(input: {
  branch: string; purpose: string; customer_id: string | null; customer_name: string; assignee: string; spot: string;
  items: PartHoldItem[]; photos: File[];
}): Promise<string> {
  const paths: string[] = [];
  try {
    for (const f of input.photos.slice(0, 6)) {
      const blob = await shrinkPhoto(f);
      const path = `holds/${input.branch}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const up = await supabase.storage.from(HOLD_PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw new Error(up.error.message);
      paths.push(path);
    }
    const { data, error } = await db.from("part_holds").insert({
      branch: input.branch, purpose: input.purpose.trim(), customer_id: input.customer_id,
      customer_name: input.customer_name.trim() || null, assignee: input.assignee.trim() || null,
      spot: input.spot.trim() || null, photo_paths: paths,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const { error: itemErr } = await db.from("part_hold_items").insert(
      input.items.map((i) => ({ hold_id: data.id, part_code: i.part_code, part_name: i.part_name, quantity: i.quantity })),
    );
    if (itemErr) {
      await db.from("part_holds").delete().eq("id", data.id);
      throw new Error(itemErr.message);
    }
    return data.id as string;
  } catch (e) {
    if (paths.length) await supabase.storage.from(HOLD_PHOTO_BUCKET).remove(paths);
    throw e;
  }
}

export function usePartHolds(status: HoldStatus | "all") {
  return useQuery({ queryKey: ["part-holds", status], queryFn: () => fetchHolds(status), staleTime: 30_000 });
}
