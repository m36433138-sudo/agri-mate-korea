import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Crosshair, X } from "lucide-react";
import type { OnsiteVisit } from "@/lib/onsiteVisits";
import { navLinks, type LatLng } from "@/lib/onsiteRoute";
import { STATUS_STYLE } from "./VisitCard";

const COLOR: Record<string, string> = { 대기: "#64748b", 진행중: "#2563eb", 보류: "#d97706", 완료: "#16a34a" };

function pin(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:30px;height:40px">
      <svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 25 15 25s15-13.8 15-25C30 6.7 23.3 0 15 0z" fill="${color}" stroke="white" stroke-width="2"/></svg>
      <span style="position:absolute;top:6px;left:0;width:30px;text-align:center;color:white;font:700 12px/18px system-ui">${label}</span></div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -38],
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Props = {
  visits: OnsiteVisit[];
  orderOf: Map<string, number>;
  origin: LatLng | null;
  canManage: boolean;
  onMove: (v: OnsiteVisit, at: LatLng) => void;
};

/** 갈 곳 지도: 번호는 동선 순서, 색은 상태. 「위치 옮기기」 후 지도를 누르면 그 자리로 핀을 옮긴다. */
export default function OnsiteMap({ visits, orderOf, origin, canManage, onMove }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [moving, setMoving] = useState<OnsiteVisit | null>(null);
  const movingRef = useRef<OnsiteVisit | null>(null);
  movingRef.current = moving;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: true }).setView([34.66, 126.84], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 18 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      const v = movingRef.current;
      if (!v) return;
      onMoveRef.current(v, { lat: e.latlng.lat, lng: e.latlng.lng });
      setMoving(null);
    });
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    if (origin) {
      L.circleMarker([origin.lat, origin.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#ef4444", fillOpacity: 1 }).bindTooltip("출발").addTo(g);
      pts.push([origin.lat, origin.lng]);
    }
    const route: L.LatLngExpression[] = origin ? [[origin.lat, origin.lng]] : [];
    const ordered = [...visits].filter((v) => v.lat != null && v.lng != null)
      .sort((a, b) => (orderOf.get(a.id) ?? 999) - (orderOf.get(b.id) ?? 999));
    for (const v of ordered) {
      const no = orderOf.get(v.id);
      const links = navLinks(v);
      const html = `<div style="min-width:180px">
        <b style="font-size:15px">${esc(v.customer_name)}</b> <span style="color:#64748b">${esc(v.status)}</span><br/>
        ${v.machine || v.model ? `<span>${esc([v.machine, v.model].filter(Boolean).join(" "))}</span><br/>` : ""}
        ${v.detail ? `<span style="color:#475569">${esc(v.detail.slice(0, 60))}</span><br/>` : ""}
        <span style="color:#64748b;font-size:12px">${esc(v.address ?? "")}</span>
        <div style="display:flex;gap:6px;margin-top:8px">
          <a href="${links.kakao}" target="_blank" rel="noreferrer" style="flex:1;text-align:center;background:#2563eb;color:#fff;border-radius:999px;padding:6px 10px;font-weight:600;text-decoration:none">길찾기</a>
          ${v.phone ? `<a href="tel:${esc(v.phone)}" style="text-align:center;border:1px solid #cbd5e1;border-radius:999px;padding:6px 10px;text-decoration:none">전화</a>` : ""}
          ${canManage ? `<button data-move="${v.id}" style="border:1px solid #cbd5e1;border-radius:999px;padding:6px 10px">위치 옮기기</button>` : ""}
        </div></div>`;
      const mk = L.marker([v.lat!, v.lng!], { icon: pin(COLOR[v.status] ?? "#64748b", no ? String(no) : "") }).bindPopup(html).addTo(g);
      mk.on("popupopen", (e) => {
        const btn = (e.popup.getElement() as HTMLElement | undefined)?.querySelector<HTMLButtonElement>(`[data-move="${v.id}"]`);
        if (btn) btn.onclick = () => { m.closePopup(); setMoving(v); };
      });
      pts.push([v.lat!, v.lng!]);
      if (no) route.push([v.lat!, v.lng!]);
    }
    if (route.length > 1) L.polyline(route, { color: "#2563eb", weight: 3, opacity: 0.5, dashArray: "6 6" }).addTo(g);
    if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 14 });
  }, [visits, orderOf, origin, canManage]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-border/70 bg-card">
      <div ref={box} className="h-[60vh] min-h-[320px] w-full z-0" />
      {moving && (
        <div className="absolute top-3 inset-x-3 z-[500] flex items-center gap-2 rounded-2xl bg-foreground text-background px-4 py-3 shadow-lg">
          <Crosshair className="h-4 w-4 shrink-0" />
          <span className="text-sm flex-1 min-w-0"><b>{moving.customer_name}</b> 집 자리를 지도에서 눌러 주세요</span>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-background hover:bg-background/10" onClick={() => setMoving(null)} aria-label="취소"><X className="h-4 w-4" /></Button>
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-[500] flex flex-wrap gap-1.5 rounded-xl bg-card/90 backdrop-blur px-2.5 py-1.5 text-[11px]">
        {(["대기", "진행중", "보류", "완료"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1"><i className={`w-2 h-2 rounded-full ${STATUS_STYLE[s].dot}`} />{s}</span>
        ))}
      </div>
    </div>
  );
}
