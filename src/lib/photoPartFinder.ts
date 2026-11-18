import { modelsOf } from "@/lib/diagramModelGroup";

type D = { id: string; kind: string; model_name: string | null };

/** 사진으로 찾기에 고를 수 있는 기종 버튼 (부품 도면이 있는 기종만, 공용 책은 각 기종에 펼침) */
export function photoModelOptions(diagrams: D[]): string[] {
  const set = new Set<string>();
  for (const d of diagrams) if (d.kind === "diagram") modelsOf(d.model_name).forEach((m) => m && set.add(m));
  return [...set].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
}

/** 고른 기종의 부품 도면 id (공용 엔진·커터 책 포함, 기계 사진 제외) */
export function diagramIdsForModel(diagrams: D[], model: string): string[] {
  return diagrams.filter((d) => d.kind === "diagram" && modelsOf(d.model_name).includes(model)).map((d) => d.id);
}
