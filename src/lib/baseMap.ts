import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * 앱 지도 한 벌: 카카오맵 키(VITE_KAKAO_MAP_KEY)가 있으면 카카오맵, 없거나 못 불러오면 OpenStreetMap(Leaflet).
 * 화면(방문수리 지도·기사 위치·위치 기록)은 이 모양만 쓰고, 어느 지도인지 몰라도 된다.
 * 확대 정도(zoom)는 Leaflet 기준 숫자로 받는다 (카카오 레벨 ≈ 20 - zoom).
 */
export type LatLng = { lat: number; lng: number };
export type MarkerOptions = {
  /** 핀 모양 HTML */
  html: string;
  size: [number, number];
  /** 핀에서 실제 좌표가 닿는 점 (왼쪽 위 기준 px) */
  anchor: [number, number];
  /** 누르면 뜨는 말풍선 HTML */
  popup?: string;
  /** 짧은 이름표 (말풍선이 없으면 누를 때 이걸 보여 준다) */
  tooltip?: string;
  z?: number;
  /** 말풍선이 열렸을 때 (안의 버튼에 동작 걸기) */
  onPopupOpen?: (el: HTMLElement) => void;
};
export type LineOptions = { color: string; weight?: number; opacity?: number; dashed?: boolean };

export interface BaseMap {
  kind: "kakao" | "leaflet";
  clear(): void;
  marker(at: LatLng, o: MarkerOptions): void;
  line(points: LatLng[], o: LineOptions): void;
  fit(points: LatLng[], maxZoom?: number): void;
  onClick(cb: (at: LatLng) => void): void;
  closePopup(): void;
  destroy(): void;
  /** 지도 구석에 작은 안내 글 */
  note?(text: string): void;
}

export const KAKAO_MAP_KEY: string = (import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined) ?? "";

/** Leaflet 확대 숫자 → 카카오 레벨 (1 가장 가까움 ~ 14 가장 멂) */
export const kakaoLevel = (zoom: number) => Math.min(14, Math.max(1, Math.round(20 - zoom)));

// ---------- 카카오맵 SDK 불러오기 (한 번만) ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 카카오 SDK에는 타입이 없다
type Kakao = any;
let kakaoReady: Promise<Kakao | null> | null = null;

export function loadKakao(): Promise<Kakao | null> {
  if (!KAKAO_MAP_KEY || typeof window === "undefined") return Promise.resolve(null);
  if (kakaoReady) return kakaoReady;
  kakaoReady = new Promise((resolve) => {
    const w = window as unknown as { kakao?: Kakao };
    const done = () => w.kakao?.maps?.load ? w.kakao.maps.load(() => resolve(w.kakao)) : resolve(null);
    if (w.kakao?.maps) { done(); return; }
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_MAP_KEY)}&autoload=false&libraries=services`;
    s.async = true;
    s.onload = done;
    s.onerror = () => { kakaoReady = null; resolve(null); };
    document.head.appendChild(s);
    setTimeout(() => resolve(w.kakao?.maps ? w.kakao : null), 10_000);
  });
  return kakaoReady;
}

export async function createBaseMap(el: HTMLElement, center: LatLng, zoom: number): Promise<BaseMap> {
  const kakao = await loadKakao();
  if (kakao) return kakaoMap(kakao, el, center, zoom);
  const m = leafletMap(el, center, zoom);
  // 키는 있는데 카카오가 거절한 경우(등록 안 된 도메인, 카카오맵 사용 꺼짐 등) 지도 아래에 작게 알린다
  if (KAKAO_MAP_KEY) m.note?.("카카오맵 연결 안 됨 — 카카오 개발자 사이트에서 도메인·카카오맵 사용 설정을 확인하세요");
  return m;
}

// ---------- OpenStreetMap (Leaflet) ----------
function leafletMap(el: HTMLElement, center: LatLng, zoom: number): BaseMap {
  const m = L.map(el, { zoomControl: true }).setView([center.lat, center.lng], zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 18 }).addTo(m);
  const g = L.layerGroup().addTo(m);
  return {
    kind: "leaflet",
    clear: () => g.clearLayers(),
    marker(at, o) {
      const mk = L.marker([at.lat, at.lng], {
        zIndexOffset: o.z ?? 0,
        icon: L.divIcon({ className: "", html: o.html, iconSize: o.size, iconAnchor: o.anchor, popupAnchor: [0, -o.anchor[1]] }),
      }).addTo(g);
      if (o.popup) {
        mk.bindPopup(o.popup);
        if (o.onPopupOpen) mk.on("popupopen", (e) => { const p = e.popup.getElement(); if (p) o.onPopupOpen!(p as HTMLElement); });
      }
      if (o.tooltip) mk.bindTooltip(o.tooltip, { direction: "top" });
    },
    line(points, o) {
      L.polyline(points.map((p) => [p.lat, p.lng] as [number, number]), { color: o.color, weight: o.weight ?? 3, opacity: o.opacity ?? 0.6, dashArray: o.dashed ? "6 6" : undefined }).addTo(g);
    },
    fit(points, maxZoom = 14) {
      if (!points.length) return;
      m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])).pad(0.15), { maxZoom });
    },
    onClick: (cb) => { m.on("click", (e: L.LeafletMouseEvent) => cb({ lat: e.latlng.lat, lng: e.latlng.lng })); },
    closePopup: () => { m.closePopup(); },
    destroy: () => { m.remove(); },
    note: (text) => { m.attributionControl.setPrefix(`<span style="color:#b45309">${text}</span>`); },
  };
}

// ---------- 카카오맵 ----------
function kakaoMap(kakao: Kakao, el: HTMLElement, center: LatLng, zoom: number): BaseMap {
  const km = kakao.maps;
  const map = new km.Map(el, { center: new km.LatLng(center.lat, center.lng), level: kakaoLevel(zoom) });
  map.addControl(new km.ZoomControl(), km.ControlPosition.RIGHT);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 카카오 SDK에는 타입이 없다
  let items: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 카카오 SDK에는 타입이 없다
  let popup: any = null;
  const closePopup = () => { popup?.setMap(null); popup = null; };

  const openPopup = (at: LatLng, html: string, lift: number, onOpen?: (el: HTMLElement) => void) => {
    closePopup();
    const box = document.createElement("div");
    box.style.cssText = `transform:translateY(-${lift + 8}px);background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.22);padding:12px 14px;font:13px/1.5 system-ui,sans-serif;max-width:260px;position:relative`;
    box.innerHTML = `${html}<button type="button" aria-label="닫기" style="position:absolute;top:4px;right:6px;border:0;background:none;font-size:18px;line-height:1;color:#64748b;cursor:pointer">×</button>`;
    box.querySelector<HTMLButtonElement>("button[aria-label='닫기']")!.onclick = (e) => { e.stopPropagation(); closePopup(); };
    box.addEventListener("click", (e) => e.stopPropagation());
    popup = new km.CustomOverlay({ position: new km.LatLng(at.lat, at.lng), content: box, xAnchor: 0.5, yAnchor: 1, zIndex: 9999, clickable: true });
    popup.setMap(map);
    onOpen?.(box);
  };

  return {
    kind: "kakao",
    clear() { items.forEach((i) => i.setMap(null)); items = []; closePopup(); },
    marker(at, o) {
      const pin = document.createElement("div");
      pin.style.cssText = `width:${o.size[0]}px;height:${o.size[1]}px;transform:translate(${o.size[0] / 2 - o.anchor[0]}px,${o.size[1] - o.anchor[1]}px);cursor:pointer`;
      pin.innerHTML = o.html;
      if (o.tooltip) pin.title = o.tooltip.replace(/<[^>]+>/g, "");
      const body = o.popup ?? (o.tooltip ? `<b>${o.tooltip}</b>` : null);
      if (body) pin.onclick = (e) => { e.stopPropagation(); openPopup(at, body, o.anchor[1], o.onPopupOpen); };
      const ov = new km.CustomOverlay({ position: new km.LatLng(at.lat, at.lng), content: pin, xAnchor: 0.5, yAnchor: 1, zIndex: o.z ?? 1, clickable: true });
      ov.setMap(map);
      items.push(ov);
    },
    line(points, o) {
      const pl = new km.Polyline({
        path: points.map((p) => new km.LatLng(p.lat, p.lng)),
        strokeWeight: o.weight ?? 3, strokeColor: o.color, strokeOpacity: o.opacity ?? 0.6, strokeStyle: o.dashed ? "shortdash" : "solid",
      });
      pl.setMap(map);
      items.push(pl);
    },
    fit(points, maxZoom = 14) {
      if (!points.length) return;
      if (points.length === 1) { map.setCenter(new km.LatLng(points[0].lat, points[0].lng)); map.setLevel(kakaoLevel(maxZoom)); return; }
      const b = new km.LatLngBounds();
      points.forEach((p) => b.extend(new km.LatLng(p.lat, p.lng)));
      map.setBounds(b, 40, 40, 40, 40);
      if (map.getLevel() < kakaoLevel(maxZoom)) map.setLevel(kakaoLevel(maxZoom));
    },
    onClick(cb) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 카카오 SDK에는 타입이 없다
      km.event.addListener(map, "click", (e: any) => { closePopup(); cb({ lat: e.latLng.getLat(), lng: e.latLng.getLng() }); });
    },
    closePopup,
    destroy() { items.forEach((i) => i.setMap(null)); items = []; closePopup(); el.innerHTML = ""; },
  };
}

/** 카카오 주소 검색 (키가 있을 때만). 지번·도로명 모두 잘 찾는다. */
export async function kakaoGeocode(address: string): Promise<LatLng | null> {
  const kakao = await loadKakao();
  if (!kakao?.maps?.services) return null;
  const geocoder = new kakao.maps.services.Geocoder();
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 카카오 SDK에는 타입이 없다
    geocoder.addressSearch(address, (res: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK && res[0]) resolve({ lat: Number(res[0].y), lng: Number(res[0].x) });
      else resolve(null);
    });
  });
}
