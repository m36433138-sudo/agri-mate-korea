import { supabase } from "@/integrations/supabase/client";
import type { EstimateItem } from "./insuranceEstimate";
import type { EstimateDiagramSheet } from "./printInsuranceEstimate";

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
  const db = supabase as any;
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
