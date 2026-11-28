import { KAKAO_MAP_KEY, kakaoGeocode } from "@/lib/baseMap";
/**
 * 방문수리 길찾기·지도: 주소 → 좌표(무료 OpenStreetMap 검색, 기록에 저장해 한 번만), 가까운 순 동선, 지도 앱 링크.
 * 시골 주소는 정확히 안 잡힐 때가 많아 「전체 주소 → 번지 뺀 주소 → 읍·면」 순으로 넓혀 찾고,
 * 지도에서 손으로 핀을 옮기면 그 위치를 쓴다.
 */

export type LatLng = { lat: number; lng: number };

/** 지점 사무실 근처 (현재 위치를 못 받을 때 동선 출발점) */
export const BRANCH_ORIGIN: Record<string, LatLng> = {
  장흥: { lat: 34.6817, lng: 126.907 },
  강진: { lat: 34.642, lng: 126.7672 },
};
const BRANCH_REGION: Record<string, string> = { 장흥: "전라남도 장흥군", 강진: "전라남도 강진군" };
const SIDO_RE = /(서울|부산|대구광역|인천|광주광역|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)/;
const SIGUNGU_RE = /\S+(시|군|구)(\s|$)/;

/** 찾아볼 주소 순서: 시·군이 없으면 지점의 군을 붙이고, 점점 넓게 */
export function geocodeQueries(address: string, branch?: string | null): string[] {
  const a = address.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!a) return [];
  const region = !SIGUNGU_RE.test(a) && branch && BRANCH_REGION[branch] ? `${BRANCH_REGION[branch]} ` : !SIDO_RE.test(a) && !SIGUNGU_RE.test(a) ? "전라남도 " : "";
  const full = `${region}${a}`.trim();
  const out = [full];
  // 번지·건물번호 빼기 (「백사1길 72」 → 「백사1길」, 「대구면 사당리 123-4」 → 「대구면 사당리」)
  const noNumber = full.replace(/\s+(산\s*)?\d+(-\d+)?(번지)?\s*$/, "").trim();
  if (noNumber !== full) out.push(noNumber);
  // 읍·면·동까지만
  const town = full.match(/^(.*?\S+(읍|면|동))(\s|$)/)?.[1];
  if (town && !out.includes(town)) out.push(town);
  return out;
}

export type GeocodeResult = LatLng & { approx: boolean };

/** 주소 → 좌표. 카카오(키가 있을 때) 다음 OpenStreetMap(Nominatim). Nominatim 은 초당 1번 규칙을 지키려고 질의 사이를 띄운다. */
export async function geocodeAddress(address: string, branch?: string | null, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const qs = geocodeQueries(address, branch);
  // 카카오맵 키가 있으면 카카오 주소 검색을 먼저 (지번·도로명을 훨씬 잘 찾는다)
  if (KAKAO_MAP_KEY) {
    for (let i = 0; i < qs.length; i++) {
      if (signal?.aborted) return null;
      const hit = await kakaoGeocode(qs[i]).catch(() => null);
      if (hit) return { ...hit, approx: i > 0 };
    }
  }
  for (let i = 0; i < qs.length; i++) {
    if (signal?.aborted) return null;
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&accept-language=ko&q=${encodeURIComponent(qs[i])}`;
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) continue;
    const hit = (await res.json())?.[0];
    if (hit?.lat && hit?.lon) return { lat: Number(hit.lat), lng: Number(hit.lon), approx: i > 0 };
  }
  return null;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 출발점에서 가장 가까운 곳부터 차례로 (갈 곳이 수십 곳이라 이 정도면 충분) */
export function nearestOrder<T extends Partial<LatLng>>(from: LatLng, stops: T[]): { stop: T; km: number }[] {
  const left = stops.filter((s): s is T & LatLng => typeof s.lat === "number" && typeof s.lng === "number");
  const out: { stop: T; km: number }[] = [];
  let cur = from;
  while (left.length) {
    let best = 0, bestKm = Infinity;
    left.forEach((s, i) => { const d = distanceKm(cur, s); if (d < bestKm) { bestKm = d; best = i; } });
    const [s] = left.splice(best, 1);
    out.push({ stop: s, km: bestKm });
    cur = s;
  }
  return out;
}

/** 지도 앱 길찾기 링크. 좌표가 있으면 그 자리로, 없으면 주소 검색으로. */
export function navLinks(v: { customer_name: string; address: string | null; lat: number | null; lng: number | null }) {
  const name = encodeURIComponent(v.customer_name || "목적지");
  const addr = encodeURIComponent(v.address || v.customer_name);
  const has = typeof v.lat === "number" && typeof v.lng === "number";
  return {
    kakao: has ? `https://map.kakao.com/link/to/${name},${v.lat},${v.lng}` : `https://map.kakao.com/link/search/${addr}`,
    tmap: has ? `tmap://route?goalname=${name}&goalx=${v.lng}&goaly=${v.lat}` : `tmap://search?name=${addr}`,
    naver: has
      ? `nmap://route/car?dlat=${v.lat}&dlng=${v.lng}&dname=${name}&appname=agrimate`
      : `https://map.naver.com/p/search/${addr}`,
  };
}
