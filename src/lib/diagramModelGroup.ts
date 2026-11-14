/** 도면 분류: YT488은 따로, YT490·5101·5113(공용 엔진 포함)은 하나로 묶는다. */
export function modelGroup(name?: string | null): string {
  if (!name) return "";
  if (name.includes("YT490") || name.includes("YT5101") || name.includes("YT5113")) return "YT490 / YT5101 / YT5113";
  if (name.includes("YT488")) return "YT488";
  return name;
}

/** 여러 기종이 함께 쓰는 공용 책(예: YH470·570·5101 커터, AW465·473·573 커터): 각 기종 버튼에 모두 보이게 한다 */
const SHARED_BOOKS: Record<string, string[]> = {
  "YH470 / YH570 / YH5101": ["YH470 / YH570", "YH5101"],
  "AW465 / AW473 / AW573": ["AW465 / AW573", "AW473"],
};

/** 공용 엔진(YT488·490·5101·5113)처럼 여러 기종에 걸친 도면이면 해당 기종들을 펼쳐 반환 */
export function modelsOf(name?: string | null): string[] {
  if (!name) return [];
  if (SHARED_BOOKS[name]) return SHARED_BOOKS[name];
  // YT488·490 묶음이 들어간 공용 책만 펼친다. 「YT6135 / YT6145」 같은 한 권짜리 책은 버튼 하나로 둔다.
  const yt = name.match(/YT\d{3,4}/g);
  if (yt && yt.length > 1 && yt.some((m) => m === "YT488" || modelGroup(m) !== m)) {
    const set = new Set<string>();
    yt.forEach((m) => set.add(modelGroup(m)));
    return Array.from(set);
  }
  return [modelGroup(name)];
}

/** 도면 분류 탭 순서 */
export const DIAGRAM_CATEGORIES = ["이앙기", "콤바인", "트랙터", "부속장치"] as const;
export type DiagramCategory = (typeof DIAGRAM_CATEGORIES)[number];

/**
 * 기종명 앞글자로 분류: YH·AW 콤바인, YT·EG 트랙터, VP·YR 이앙기.
 * 앞글자로 모르면 등록된 기계 종류를 따르고, 그 외(로타리·방제기 등)는 부속장치.
 */
export function categoryOf(modelName?: string | null, machineType?: string | null): DiagramCategory {
  const m = (modelName ?? "").trim().toUpperCase();
  if (/^(YH|AW)/.test(m)) return "콤바인";
  if (/^(YT|EG)/.test(m)) return "트랙터";
  if (/^(VP|YR)/.test(m)) return "이앙기";
  const t = machineType ?? "";
  if (t.includes("이앙기")) return "이앙기";
  if (t.includes("콤바인")) return "콤바인";
  if (t.includes("트랙터")) return "트랙터";
  return "부속장치";
}
