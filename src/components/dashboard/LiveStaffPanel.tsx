import { Link } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { minutesAgo, useLiveStaff, type LiveStaff } from "@/hooks/useMyAttendance";
import { useEffect } from "react";
import { useBaseMap } from "@/hooks/useBaseMap";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** 위치 공유 중인 직원을 한 지도에 (카카오맵 키가 있으면 카카오맵) */
function LiveStaffMap({ staff }: { staff: LiveStaff[] }) {
  const [ref, map] = useBaseMap({ lat: 34.66, lng: 126.84 }, 10);
  useEffect(() => {
    if (!map) return;
    map.clear();
    for (const p of staff) {
      const ago = minutesAgo(p.updated_at);
      map.marker({ lat: p.lat, lng: p.lng }, {
        z: 10,
        html: `<div style="width:30px;height:30px;border-radius:999px;background:${ago <= 15 ? "#10b981" : "#f59e0b"};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fff;font:800 12px/24px system-ui;text-align:center">${esc(p.name.slice(-2))}</div>`,
        size: [30, 30], anchor: [15, 15],
        popup: `<b style="font-size:14px">${esc(p.name)}</b><br/><span style="color:#64748b">${ago <= 1 ? "방금" : ago < 60 ? `${ago}분 전` : `${Math.floor(ago / 60)}시간 전`} 위치</span>
          <div style="margin-top:8px"><a href="https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}" target="_blank" rel="noreferrer" style="display:inline-block;background:#2563eb;color:#fff;border-radius:999px;padding:5px 12px;font-weight:600;text-decoration:none">길찾기</a></div>`,
      });
    }
    map.fit(staff.map((p) => ({ lat: p.lat, lng: p.lng })), 13);
  }, [map, staff]);
  return <div ref={ref} className="h-56 sm:h-64 w-full rounded-2xl overflow-hidden border border-border/70 z-0" />;
}

/** 지금 위치를 공유 중인 직원 (출장 중 누가 어디 있는지) */
export function LiveStaffPanel() {
  const { data: staff = [], isLoading } = useLiveStaff();
  return (
    <section className="rounded-3xl bg-card border border-border/70 card-shadow p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold tracking-tight">지금 근무 중 <span className="text-muted-foreground font-medium text-sm">{staff.length}명 위치 공유</span></h2>
        <Link to="/onsite-repairs?view=map" className="text-sm text-primary font-medium">지도로 보기</Link>
      </div>
      {isLoading ? <Skeleton className="h-20 rounded-2xl" /> : staff.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-4">아직 위치를 공유 중인 사람이 없어요. 출근을 누르면 여기에 떠요.</p>
      ) : (
        <>
        <LiveStaffMap staff={staff} />
        <ul className="grid sm:grid-cols-2 gap-2">
          {staff.sort((a, b) => a.name.localeCompare(b.name, "ko")).map((s) => {
            const ago = minutesAgo(s.updated_at);
            return (
              <li key={s.employee_id} className="flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2.5 min-w-0">
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", ago <= 15 ? "bg-emerald-500" : "bg-amber-500")} />
                <span className="font-semibold">{s.name}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{ago <= 1 ? "방금" : ago < 60 ? `${ago}분 전` : `${Math.floor(ago / 60)}시간 전`}</span>
                <a href={`https://map.kakao.com/link/map/${encodeURIComponent(s.name)},${s.lat},${s.lng}`} target="_blank" rel="noreferrer"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10" aria-label={`${s.name} 위치 지도에서 보기`}>
                  <MapPin className="h-4 w-4" />
                </a>
                <a href={`https://map.kakao.com/link/to/${encodeURIComponent(s.name)},${s.lat},${s.lng}`} target="_blank" rel="noreferrer"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-primary hover:bg-primary/10" aria-label={`${s.name}에게 길찾기`}>
                  <Navigation className="h-4 w-4" />
                </a>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </section>
  );
}
