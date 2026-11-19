import { brandOf, categoryOf, modelGroup, modelsOf, type DiagramCategory } from "./diagramModelGroup";

export type SearchableDiagram = {
  id: string;
  title: string;
  model_name: string | null;
  machine_type?: string | null;
  kind: "photo" | "diagram";
  manufacturer?: string | null;
};

/** 부품번호 검색(RPC)이 돌려주는 도면 1건어 대한_hit_ */
export type PartHit = { codes: string[]; count: number };

/** 1글자는 부품번호·이름 조회로 의미가 없으므로 2글자부터 서버 검색을 보낸다 */
export function isSearchTerm(term: string): boolean {
  return term.trim().length >= 2;
}

/** 도면명에서 그림 번호를 꺼낸다: 「Fig.341.」「Fig 10 .」「p.205」「WLZ 18.」 → "341"/"10"/"205"/"18" */
export function figNumberOf(title: string): string | null {
  const m = title.match(/fig\s*\.?\s*(\d{1,4})/i) ?? title.match(/(?:^|\s)p\.\s*(\d{1,4})/i);
  if (m) return String(Number(m[1]));
  const lead = title.match(/^[A-Za-z]{2,4}\s+(\d{1,3})\.\s/);
  return lead ? String(Number(lead[1])) : null;
}

/**
 * 검색어에서 도면 번호를 찾는다. 「fig341」「fig.341」「f341」「그림341」「p.12」는 확실한 도면 번호,
 * 숫자만 1~3자리(「341」)도 도면 번호로 본다. 나머지 낱말(기종 등)은 rest로 돌려준다.
 */
export function parseFigQuery(term: string): { fig: string; explicit: boolean; rest: string[] } | null {
  const words = term.trim().toLowerCase().replace(/(fig|그림|p)\s*\.?\s+(?=\d)/g, "$1").split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const ex = w.match(/^(?:fig\.?|f\.?|그림|p\.?|no\.?)(\d{1,4})\.?$/);
    const plain = w.match(/^(\d{1,3})\.?$/);
    if (ex || plain) {
      return { fig: String(Number((ex ?? plain)![1])), explicit: !!ex, rest: words.filter((_, k) => k !== i) };
    }
  }
  return null;
}

/** 확실한 도면 번호 검색(fig341, 「YH7140 341」 등)은 부품번호 서버 검색을 보내지 않는다 */
export function needsPartSearch(term: string): boolean {
  if (!isSearchTerm(term)) return false;
  const f = parseFigQuery(term);
  return !(f && (f.explicit || f.rest.length > 0));
}

export type DiagramSearchHit<T> = {
  diagram: T;
  partCodes: string[];
  partCount: number;
  matchedTitle: boolean;
  matchedModel: boolean;
  /** 도면 번호(Fig.)가 정확히 같음 */
  matchedFig?: boolean;
};

function score(h: DiagramSearchHit<SearchableDiagram>): number {
  return (h.matchedFig ? 1_000_000 : 0) + h.partCount * 100 + (h.matchedTitle ? 10 : 0) + (h.matchedModel ? 5 : 0);
}

/**
 * 도면 목록 검색: 도면명·기종은 여기서, 부품번호는 RPC가 준 partHits로 합친다.
 * term이 비면 필터만 적용해 전체를 그대로 돌려준다.
 */
export function searchDiagrams<T extends SearchableDiagram>(
  diagrams: T[],
  term: string,
  partHits: Map<string, PartHit>,
  filter: { kind: "photo" | "diagram"; model: string; category?: DiagramCategory | "전체"; brand?: string },
): DiagramSearchHit<T>[] {
  const q = term.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const figQ = parseFigQuery(q);
  const hits: DiagramSearchHit<T>[] = [];

  for (const d of diagrams) {
    if (d.kind !== filter.kind) continue;
    if (filter.brand && filter.brand !== "전체" && brandOf(d.manufacturer) !== filter.brand) continue;
    if (filter.category && filter.category !== "전체" && categoryOf(d.model_name, d.machine_type) !== filter.category) continue;
    if (filter.model !== "전체" && !modelsOf(d.model_name).includes(filter.model)) continue;

    const part = partHits.get(d.id);
    const group = modelGroup(d.model_name).toLowerCase();
    // 「YH7140 탱크커버」처럼 기종과 도면명을 띄어 써도 찾도록 낱말마다 확인한다
    const title = d.title.toLowerCase();
    const model = `${d.model_name?.toLowerCase() ?? ""} ${group}`;
    const allWords = words.length > 0 && words.every((w) => title.includes(w) || model.includes(w));
    const matchedTitle = allWords && words.some((w) => title.includes(w));
    const matchedModel = allWords && words.some((w) => model.includes(w));

    // 「341」「fig 341」「YH7140 341」 → 그 기종의 Fig.341을 맨 위에 (Fig.3410, 부품번호 341xx보다 먼저)
    const matchedFig = !!figQ && figNumberOf(d.title) === figQ.fig
      && figQ.rest.every((w) => title.includes(w) || model.includes(w));

    if (q !== "" && !part && !allWords && !matchedFig) continue;

    hits.push({
      diagram: d,
      partCodes: part?.codes ?? [],
      partCount: part?.count ?? 0,
      matchedTitle,
      matchedModel,
      matchedFig,
    });
  }

  // 점수순(부품번호 → 도면명 → 기종). 동점이면 목록 정렬(sort_order)을 유지한다.
  if (q !== "") hits.sort((a, b) => score(b) - score(a));
  return hits;
}
