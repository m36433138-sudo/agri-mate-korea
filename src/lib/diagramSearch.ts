import { modelGroup } from "./diagramModelGroup";

export type SearchableDiagram = {
  id: string;
  title: string;
  model_name: string | null;
  kind: "photo" | "diagram";
};

/** 부품번호 검색(RPC)이 돌려주는 도면 1건어 대한_hit_ */
export type PartHit = { codes: string[]; count: number };

/** 1글자는 부품번호·이름 조회로 의미가 없으므로 2글자부터 서버 검색을 보낸다 */
export function isSearchTerm(term: string): boolean {
  return term.trim().length >= 2;
}

export type DiagramSearchHit<T> = {
  diagram: T;
  partCodes: string[];
  partCount: number;
  matchedTitle: boolean;
  matchedModel: boolean;
};

function score(h: DiagramSearchHit<SearchableDiagram>): number {
  return h.partCount * 100 + (h.matchedTitle ? 10 : 0) + (h.matchedModel ? 5 : 0);
}

/**
 * 도면 목록 검색: 도면명·기종은 여기서, 부품번호는 RPC가 준 partHits로 합친다.
 * term이 비면 필터만 적용해 전체를 그대로 돌려준다.
 */
export function searchDiagrams<T extends SearchableDiagram>(
  diagrams: T[],
  term: string,
  partHits: Map<string, PartHit>,
  filter: { kind: "photo" | "diagram"; model: string },
): DiagramSearchHit<T>[] {
  const q = term.trim().toLowerCase();
  const hits: DiagramSearchHit<T>[] = [];

  for (const d of diagrams) {
    if (d.kind !== filter.kind) continue;
    if (filter.model !== "전체" && modelGroup(d.model_name) !== filter.model) continue;

    const part = partHits.get(d.id);
    const group = modelGroup(d.model_name).toLowerCase();
    const matchedTitle = q !== "" && d.title.toLowerCase().includes(q);
    const matchedModel =
      q !== "" && ((d.model_name?.toLowerCase().includes(q) ?? false) || group.includes(q));

    if (q !== "" && !part && !matchedTitle && !matchedModel) continue;

    hits.push({
      diagram: d,
      partCodes: part?.codes ?? [],
      partCount: part?.count ?? 0,
      matchedTitle,
      matchedModel,
    });
  }

  // 점수순(부품번호 → 도면명 → 기종). 동점이면 목록 정렬(sort_order)을 유지한다.
  if (q !== "") hits.sort((a, b) => score(b) - score(a));
  return hits;
}
