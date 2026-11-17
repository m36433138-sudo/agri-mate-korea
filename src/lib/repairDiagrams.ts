import { modelsOf } from "./diagramModelGroup";

export type RepairDiagramCandidate = {
  diagramId: string;
  title: string;
  model: string | null;
  codes: string[];
  sameModel: boolean;
};

const bare = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");

/** 기계 모델(예: YH7140)이 도면 책(예: 「YH6140 / YH7140」)에 들어가는지 */
export function bookMatchesMachine(bookModel: string | null, machineModel: string | null): boolean {
  const m = bare(machineModel);
  if (!m || !bookModel) return false;
  const names = [bookModel, ...modelsOf(bookModel)].flatMap((n) => n.split(/[\/,]/)).map(bare).filter(Boolean);
  // 「YH7140DXK」처럼 뒤에 사양이 붙어도 책 기종(YH7140)으로 시작하면 같은 기종
  return names.some((n) => m.startsWith(n) || n.startsWith(m));
}

/**
 * 수리에 들어간 부품번호가 나오는 도면 후보: 같은 기종 책 먼저, 그다음 많이 겹치는 도면 순.
 */
export function rankRepairDiagrams(
  hits: { diagram_id: string; part_code: string }[],
  diagrams: Map<string, { id: string; title: string; model_name: string | null }>,
  machineModel: string | null,
): RepairDiagramCandidate[] {
  const byDiagram = new Map<string, Set<string>>();
  for (const h of hits) {
    if (!diagrams.has(h.diagram_id)) continue;
    const set = byDiagram.get(h.diagram_id) ?? new Set<string>();
    set.add(h.part_code);
    byDiagram.set(h.diagram_id, set);
  }
  const out: RepairDiagramCandidate[] = [];
  for (const [id, codes] of byDiagram) {
    const d = diagrams.get(id)!;
    out.push({ diagramId: id, title: d.title, model: d.model_name, codes: [...codes].sort(), sameModel: bookMatchesMachine(d.model_name, machineModel) });
  }
  out.sort((a, b) => Number(b.sameModel) - Number(a.sameModel) || b.codes.length - a.codes.length || a.title.localeCompare(b.title, "ko"));
  return out;
}
