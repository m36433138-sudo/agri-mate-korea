/** 수리 사진 여러 장 → 부품 후보 합치기 (AI는 후보만, 담는 건 직원이 체크한 것만) */

export type Confidence = "높음" | "보통" | "낮음";

export type PhotoMatch = {
  diagram_id: string | null;
  title: string | null;
  part_code: string;
  part_name: string | null;
  callout_no: string | null;
  confidence: Confidence;
  reason: string;
  source?: "label" | "diagram";
};

export type PhotoCandidate = {
  key: string;
  part_code: string;
  part_name: string | null;
  confidence: Confidence;
  /** 이 부품이 나온 사진 번호 (1부터) */
  photos: number[];
  diagram_id: string | null;
  title: string | null;
  callout_no: string | null;
  reason: string;
  fromLabel: boolean;
};

/** 한 번에 올릴 수 있는 사진 장수 */
export const MAX_REPAIR_PHOTOS = 10;

const RANK: Record<Confidence, number> = { 높음: 3, 보통: 2, 낮음: 1 };
export const codeKey = (c: string | null | undefined) => (c || "").toUpperCase().replace(/[\s-]/g, "");

/**
 * 사진별 결과를 부품번호 기준으로 합친다.
 * 같은 부품이 여러 사진에 나오면 한 줄로, 가장 높은 확신도와 사진 번호를 모두 남긴다.
 * 정렬: 확신도 → 나온 사진 수 → 첫 사진 순서.
 */
export function mergePhotoCandidates(results: { photo: number; matches: PhotoMatch[] }[]): PhotoCandidate[] {
  const map = new Map<string, PhotoCandidate>();
  for (const r of results) {
    for (const m of r.matches) {
      const key = codeKey(m.part_code);
      if (!key) continue;
      const fromLabel = m.source === "label";
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          key, part_code: m.part_code, part_name: m.part_name, confidence: m.confidence,
          photos: [r.photo], diagram_id: m.diagram_id, title: m.title, callout_no: m.callout_no,
          reason: m.reason, fromLabel,
        });
        continue;
      }
      if (!cur.photos.includes(r.photo)) cur.photos.push(r.photo);
      if (!cur.part_name && m.part_name) cur.part_name = m.part_name;
      if (RANK[m.confidence] > RANK[cur.confidence]) {
        Object.assign(cur, { confidence: m.confidence, reason: m.reason, diagram_id: m.diagram_id ?? cur.diagram_id, title: m.title ?? cur.title, callout_no: m.callout_no ?? cur.callout_no });
      }
      cur.fromLabel ||= fromLabel;
    }
  }
  return [...map.values()]
    .map((c) => ({ ...c, photos: [...c.photos].sort((a, b) => a - b) }))
    .sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || b.photos.length - a.photos.length || a.photos[0] - b.photos[0]);
}

/** 미리 체크해 둘 후보: 라벨 번호를 읽었거나, 확신도 높음이거나, 사진 2장 이상에서 같은 부품이 나온 경우 */
export const preChecked = (c: PhotoCandidate) => c.fromLabel || c.confidence === "높음" || c.photos.length >= 2;

/** 크레딧·권한 문제처럼 다른 사진도 다시 해 봐야 소용없는 오류인지 */
export const stopsQueue = (status: number | null | undefined) => status === 401 || status === 402 || status === 403;
