import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Crosshair, X } from "lucide-react";
import type { OnsiteVisit } from "@/lib/onsiteVisits";
import { navLinks, type LatLng } from "@/lib/onsiteRoute";
import { STATUS_STYLE } from "./VisitCard";
import { minutesAgo, type LiveStaff } from "@/hooks/useMyAttendance";
import { createBaseMap, type BaseMap } from "@/lib/baseMap";

const COLOR: Record<string, string> = { 대기: "#64748b", 진행중: "#2563eb", 보류: "#d97706", 완료: "#16a34a" };

const pin = (color: string, label: string) => `<div style="position:relative;width:30px;height:40px">
      <svg width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 25 15 25s15-13.8 15-25C30 6.7 23.3 0 15 0z" fill="${color}" stroke="white" stroke-width="2"/></svg>
      <span style="position:absolute;top:6px;left:0;width:30px;text-align:center;color:white;font:700 12px/18px system-ui">${label}</span></div>`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Props = {
  visits: OnsiteVisit[];
  orderOf: Map<string, number>;
  origin: LatLng | null;
  canManage: boolean;
  /** 위치 공유 중인 직원 */
  staff?: LiveStaff[];
  onMove: (v: OnsiteVisit, at: LatLng) => void;
};

/** 갈 곳 지도: 번호는 동선 순서, 색은 상태. 「위치 옮기기」 후 지도를 누르면 그 자리로 핀을 옮긴다. */
export default function OnsiteMap({ visits, orderOf, origin, canManage, staff = [], onMove }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<BaseMap | null>(null);
  const [moving, setMoving] = useState<OnsiteVisit | null>(null);
  const movingRef = useRef<OnsiteVisit | null>(null);
  movingRef.current = moving;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (!box.current) return;
    let alive = true, made: BaseMap | null = null;
    void createBaseMap(box.current, { lat: 34.66, lng: 126.84 }, 10).then((m) => {
      if (!alive) { m.destroy(); return; }
      made = m;
      m.onClick((at) => {
        const v = movingRef.current;
        if (!v) return;
        onMoveRef.current(v, at);
        setMoving(null);
      });
      setMap(m);
    });
    return () => { alive = false; made?.destroy(); };
  }, []);

  useEffect(() => {
    if (!map) return;
    map.clear();
    const pts: LatLng[] = [];
    if (origin) {
      map.marker(origin, {
        html: `<div style="width:18px;height:18px;border-radius:999px;background:#ef4444;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
        size: [18, 18], anchor: [9, 9], tooltip: "출발",
      });
      pts.push(origin);
    }
    const route: LatLng[] = origin ? [origin] : [];
    const ordered = [...visits].filter((v) => v.lat != null && v.lng != null)
      .sort((a, b) => (orderOf.get(a.id) ?? 999) - (orderOf.get(b.id) ?? 999));
    for (const v of ordered) {
      const no = orderOf.get(v.id);
      const links = navLinks(v);
      const at = { lat: v.lat!, lng: v.lng! };
      const html = `<div style="min-width:180px">
        <b style="font-size:15px">${esc(v.customer_name)}</b> <span style="color:#64748b">${esc(v.status)}</span><br/>
        ${v.machine || v.model ? `<span>${esc([v.machine, v.model].filter(Boolean).join(" "))}</span><br/>` : ""}
        ${v.detail ? `<span style="color:#475569">${esc(v.detail.slice(0, 60))}</span><br/>` : ""}
        <span style="color:#64748b;font-size:12px">${esc(v.address ?? "")}</span>
        <div style="display:flex;gap:6px;margin-top:8px">
          <a href="${links.kakao}" target="_blank" rel="noreferrer" style="flex:1;text-align:center;background:#2563eb;color:#fff;border-radius:999px;padding:6px 10px;font-weight:600;text-decoration:none">길찾기</a>
          ${v.phone ? `<a href="tel:${esc(v.phone)}" style="text-align:center;border:1px solid #cbd5e1;border-radius:999px;padding:6px 10px;text-decoration:none;color:#0f172a">전화</a>` : ""}
          ${canManage ? `<button data-move="${v.id}" style="border:1px solid #cbd5e1;border-radius:999px;padding:6px 10px;background:#fff;color:#0f172a">위치 옮기기</button>` : ""}
        </div></div>`;
      map.marker(at, {
        html: pin(COLOR[v.status] ?? "#64748b", no ? String(no) : ""), size: [30, 40], anchor: [15, 40], popup: html,
        onPopupOpen: (el) => {
          const btn = el.querySelector<HTMLButtonElement>(`[data-move="${v.id}"]`);
          if (btn) btn.onclick = (e) => { e.stopPropagation(); map.closePopup(); setMoving(v); };
        },
      });
      pts.push(at);
      if (no) route.push(at);
    }
    for (const p of staff) {
      const ago = minutesAgo(p.updated_at);
      const fresh = ago <= 15;
      map.marker({ lat: p.lat, lng: p.lng }, {
        z: 1000,
        html: `<div style="width:28px;height:28px;border-radius:999px;background:${fresh ? "#10b981" : "#f59e0b"};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fff;font:800 12px/22px system-ui;text-align:center">${esc(p.name.slice(-2))}</div>`,
        size: [28, 28], anchor: [14, 14],
        tooltip: `${esc(p.name)} · ${ago <= 1 ? "방금" : `${ago}분 전`}`,
      });
      pts.push({ lat: p.lat, lng: p.lng });
    }
    if (route.length > 1) map.line(route, { color: "#2563eb", weight: 3, opacity: 0.5, dashed: true });
    if (pts.length) map.fit(pts, 14);
  }, [map, visits, orderOf, origin, canManage, staff]);

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
