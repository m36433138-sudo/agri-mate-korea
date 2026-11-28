import { useEffect, useState } from "react";
import { createBaseMap, type BaseMap, type LatLng } from "@/lib/baseMap";

/** 지도 한 장 만들기: 반환한 ref 함수를 지도 상자에 걸면, 준비된 지도를 돌려준다 (상자가 사라지면 정리). */
export function useBaseMap(center: LatLng, zoom: number) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [map, setMap] = useState<BaseMap | null>(null);
  useEffect(() => {
    if (!el) return;
    let alive = true, made: BaseMap | null = null;
    void createBaseMap(el, center, zoom).then((m) => { if (alive) { made = m; setMap(m); } else m.destroy(); });
    return () => { alive = false; made?.destroy(); setMap(null); };
    // 처음 위치·확대는 만들 때 한 번만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el]);
  return [setEl, map] as const;
}
