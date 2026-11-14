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
  const yt = name.match(/YT\d{3,4}/g);
  if (yt && yt.length > 1) {
    const set = new Set<string>();
    yt.forEach((m) => set.add(modelGroup(m)));
    return Array.from(set);
  }
  return [modelGroup(name)];
}
