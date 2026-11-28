import { supabase } from "@/integrations/supabase/client";
import { db } from "@/components/partReceipts/receiptData";
import type { EstimateItem } from "./insuranceEstimate";
import type { EstimateDiagramSheet, PartLocations } from "./printInsuranceEstimate";

const DIAGRAM_BUCKET = "diagram-images";
const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

type DiagramRow = { id: string; title: string; model_name: string | null; image_path: string };
type HotspotRow = { diagram_id: string; part_code: string; x: number; y: number; w: number; h: number; callout_no?: string | null; target_diagram_id?: string | null };

/**
 * 견적 줄(번호 = 순서+1) 중 도면에서 담은 부품을 그 도면 위 자리에 표시할 수 있게 묶는다.
 * 같은 도면에 담긴 다른 견적 부품도 함께 칠한다. 다른 도면으로 가는 링크 영역은 뺀다.
 */
export function buildEstimateSheets(
  items: EstimateItem[],
  diagrams: DiagramRow[],
  hotspots: HotspotRow[],
  urlOf: (imagePath: string) => string | null,
): EstimateDiagramSheet[] {
  const byCode = new Map<string, number[]>();
  items.forEach((it, i) => {
    if (it.item_type !== "부품" || !it.part_code.trim()) return;
    const k = norm(it.part_code);
    byCode.set(k, [...(byCode.get(k) ?? []), i + 1]);
  });
  // 견적에 처음 나온 순서대로 도면을 놓는다
  const order: string[] = [];
  for (const it of items) if (it.diagram_id && !order.includes(it.diagram_id)) order.push(it.diagram_id);

  const sheets: EstimateDiagramSheet[] = [];
  for (const id of order) {
    const d = diagrams.find((x) => x.id === id);
    const url = d ? urlOf(d.image_path) : null;
    if (!d || !url) continue;
    const marks = hotspots
      .filter((h) => h.diagram_id === id && !h.target_diagram_id && byCode.has(norm(h.part_code)))
      .flatMap((h) => (byCode.get(norm(h.part_code)) ?? []).slice(0, 1).map((no) => ({
        no, x: Number(h.x), y: Number(h.y), w: Number(h.w), h: Number(h.h), round: !!h.callout_no,
      })));
    if (marks.length) sheets.push({ id, title: d.title, model: d.model_name, imageUrl: url, marks });
  }
  return sheets;
}

/** 견적에 담긴 도면들과 부품 자리를 불러와 인쇄용 도면 목록을 만든다 */
export async function loadEstimateSheets(items: EstimateItem[]): Promise<EstimateDiagramSheet[]> {
  const ids = [...new Set(items.map((i) => i.diagram_id).filter(Boolean) as string[])];
  if (!ids.length) return [];
  const [{ data: diagrams, error: dErr }, { data: hotspots, error: hErr }] = await Promise.all([
    db.from("diagrams").select("id, title, model_name, image_path").in("id", ids),
    db.from("diagram_hotspots").select("*").in("diagram_id", ids),
  ]);
  if (dErr) throw dErr;
  if (hErr) throw hErr;
  const paths = (diagrams ?? []).map((d: DiagramRow) => d.image_path);
  const { data: signed } = await supabase.storage.from(DIAGRAM_BUCKET).createSignedUrls(paths, 3600);
  const urls = new Map<string, string>();
  (signed ?? []).forEach((s: any, i: number) => { if (s?.signedUrl) urls.set(paths[i], s.signedUrl); });
  return buildEstimateSheets(items, diagrams ?? [], hotspots ?? [], (p) => urls.get(p) ?? null);
}

type InvRow = { branch: string; part_code: string; alt_part_code: string | null; quantity: number | null; location_main: string | null; location_sub: string | null };

/**
 * 견적 부품번호별로 장흥·강진 창고의 위치와 수량을 모은다.
 * 부품번호가 그대로 맞는 줄을 먼저 쓰고, 없으면 대체 부품번호로 맞는 줄을 쓴다.
 */
export function partLocationsFrom(codes: string[], rows: InvRow[]): PartLocations {
  const out: PartLocations = {};
  for (const raw of codes) {
    const code = norm(raw);
    if (!code) continue;
    const entry: PartLocations[string] = {};
    for (const b of ["장흥", "강진"] as const) {
      const mine = rows.filter((r) => r.branch === b);
      const r = mine.find((x) => norm(x.part_code) === code) ?? mine.find((x) => norm(x.alt_part_code) === code);
      if (r) entry[b] = { location: [r.location_main, r.location_sub].map((v) => (v ?? "").trim()).filter(Boolean).join(" "), qty: r.quantity ?? 0 };
    }
    out[code] = entry;
  }
  return out;
}

/** 견적 부품들의 두 창고 위치를 불러온다 (도면 인쇄용) */
export async function loadPartLocations(items: EstimateItem[]): Promise<PartLocations> {
  const codes = [...new Set(items.filter((i) => i.item_type === "부품" && i.part_code.trim()).map((i) => i.part_code.trim()))];
  if (!codes.length) return {};
  const cols = "branch, part_code, alt_part_code, quantity, location_main, location_sub";
  const rows: InvRow[] = [];
  for (let i = 0; i < codes.length; i += 200) {
    const chunk = codes.slice(i, i + 200);
    const [a, b] = await Promise.all([
      db.from("inventory").select(cols).in("part_code", chunk),
      db.from("inventory").select(cols).in("alt_part_code", chunk),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    rows.push(...(a.data ?? []), ...(b.data ?? []));
  }
  return partLocationsFrom(codes, rows);
}
