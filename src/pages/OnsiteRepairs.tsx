import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useLiveStaff } from "@/hooks/useMyAttendance";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DownloadCloud, List, LocateFixed, Map as MapIcon, Plus, RefreshCw, UserRound } from "lucide-react";
import { PageHeader, SearchField, Segmented, ShowMore } from "@/components/page/PageParts";
import { OnsiteRowFormModal } from "@/components/onsite/OnsiteRowFormModal";
import { VisitCard, isUrgent, kstToday } from "@/components/onsite/VisitCard";
import { useOnsiteVisits, useGeocodeQueue } from "@/hooks/useOnsiteVisits";
import { useUserRole } from "@/hooks/useUserRole";
import { BRANCH_ORIGIN, nearestOrder, type LatLng } from "@/lib/onsiteRoute";
import type { OnsiteVisit } from "@/lib/onsiteVisits";
import { cn } from "@/lib/utils";

const OnsiteMap = lazy(() => import("@/components/onsite/OnsiteMap"));

type Tab = "todo" | "today" | "hold" | "done" | "all";
const TABS: { value: Tab; label: string }[] = [
  { value: "todo", label: "할 일" },
  { value: "today", label: "오늘" },
  { value: "hold", label: "보류" },
  { value: "done", label: "완료" },
];

const priorityRank = (p: string | null) => (isUrgent(p) ? 0 : p && /이번|주중/.test(p) ? 1 : p && /한가|천천|겨울|내년/.test(p) ? 3 : 2);

/** 할 일 정렬: 날짜 지난·오늘 일정 → 급한 것 → 오래 기다린 것 */
function sortTodo(a: OnsiteVisit, b: OnsiteVisit) {
  const sa = a.scheduled_on ?? "9999", sb = b.scheduled_on ?? "9999";
  if (sa !== sb) return sa < sb ? -1 : 1;
  const pa = priorityRank(a.priority), pb = priorityRank(b.priority);
  if (pa !== pb) return pa - pb;
  return a.created_at < b.created_at ? -1 : 1;
}

export default function OnsiteRepairs() {
  const { hasPermission, isAdmin, userId, profile } = useUserRole();
  const canManage = hasPermission("manage_onsite");
  const { visits, isLoading, error, refetch, isFetching, save, patch, remove, importSheet } = useOnsiteVisits(canManage);
  useGeocodeQueue(visits, canManage);

  const [tab, setTab] = useState<Tab>("todo");
  const [params] = useSearchParams();
  const [view, setView] = useState<"list" | "map">(params.get("view") === "map" ? "map" : "list");
  const { data: liveStaff = [] } = useLiveStaff(view === "map");
  const [branch, setBranch] = useState<"전체" | "장흥" | "강진">("전체");
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);
  const [modal, setModal] = useState<{ open: boolean; visit: OnsiteVisit | null }>({ open: false, visit: null });
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  // 「내 출장만」: 로그인한 직원 이름 (직원 정보 → 프로필 이름)
  const { data: myName } = useQuery({
    queryKey: ["my-employee-name", userId],
    enabled: !!userId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("name").eq("user_id", userId!).maybeSingle();
      return (data?.name as string | undefined) ?? profile?.display_name ?? null;
    },
  });

  const today = kstToday();
  const base = useMemo(() => visits.filter((v) => {
    if (branch !== "전체" && v.branch !== branch) return false;
    if (mine && myName && !(v.technician ?? "").includes(myName)) return false;
    if (search) {
      const q = search.toLowerCase().replace(/-/g, "");
      const hay = [v.customer_name, v.machine, v.model, v.detail, v.address, v.technician, v.category, (v.phone ?? "").replace(/-/g, "")].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [visits, branch, mine, myName, search]);

  const counts = useMemo(() => ({
    todo: base.filter((v) => v.status === "대기" || v.status === "진행중").length,
    today: base.filter((v) => v.status !== "완료" && v.scheduled_on && v.scheduled_on <= today).length,
    hold: base.filter((v) => v.status === "보류").length,
    done: base.filter((v) => v.status === "완료").length,
    all: base.length,
  }), [base, today]);

  const shown = useMemo(() => {
    const list = base.filter((v) =>
      tab === "todo" ? v.status === "대기" || v.status === "진행중"
      : tab === "today" ? v.status !== "완료" && !!v.scheduled_on && v.scheduled_on <= today
      : tab === "hold" ? v.status === "보류"
      : tab === "done" ? v.status === "완료"
      : true);
    if (tab === "done") return list.sort((a, b) => (b.completed_on ?? b.updated_at).localeCompare(a.completed_on ?? a.updated_at));
    return list.sort(sortTodo);
  }, [base, tab, today]);

  // 동선: 「내 위치」(또는 지점 사무실)에서 가까운 순. 오늘 탭과 지도에서 번호로 보여 준다.
  const homeBranch = branch !== "전체" ? branch : profile?.branch === "강진" ? "강진" : "장흥";
  const start = origin ?? BRANCH_ORIGIN[homeBranch];
  const route = useMemo(() => {
    if (!start || (tab !== "today" && view !== "map")) return new Map<string, { no: number; km: number }>();
    const order = nearestOrder(start, shown.filter((v) => v.status !== "완료"));
    return new Map(order.map((o, i) => [o.stop.id, { no: i + 1, km: o.km }]));
  }, [start, shown, tab, view]);
  const routed = useMemo(() => (route.size ? [...shown].sort((a, b) => (route.get(a.id)?.no ?? 999) - (route.get(b.id)?.no ?? 999)) : shown), [shown, route]);
  const noCoords = shown.filter((v) => v.address && v.lat == null && v.geocoded_address === v.address).length;

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="방문수리"
        sub={<>할 일 {counts.todo}건 · 오늘 {counts.today}건<span className="hidden sm:inline"> · 구글시트 「출장」 탭에 백업</span></>}
        actions={
          <>
            {canManage && (
              <Button onClick={() => setModal({ open: true, visit: null })} className="h-11 rounded-full px-5">
                <Plus className="h-4 w-4 mr-1" /> 방문수리 추가
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" className="h-11 rounded-full bg-card gap-1.5" disabled={importSheet.isPending}
                onClick={() => { if (confirm("구글 시트 「출장」 탭 내용으로 앱 기록을 맞출까요? 시트에서 고친 내용이 앱에 덮어써져요. (일정·지도 위치는 그대로)")) importSheet.mutate(); }}>
                <DownloadCloud className="h-4 w-4" /><span className="hidden sm:inline">시트 가져오기</span>
              </Button>
            )}
            <Button onClick={() => refetch()} variant="outline" disabled={isFetching} className="h-11 w-11 p-0 rounded-full bg-card" aria-label="새로고침" title="새로고침">
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button key={t.value} onClick={() => { setTab(t.value); setLimit(100); }} aria-pressed={active}
              className={cn("text-left rounded-3xl border bg-card card-shadow px-3 sm:px-4 py-3 transition-all", active ? "border-transparent ring-2 ring-primary" : "border-border/70 hover:border-foreground/20")}>
              <span className="text-[12px] sm:text-[13px] font-medium text-muted-foreground">{t.label}</span>
              <span className="block mt-1 text-[22px] sm:text-[26px] leading-none font-extrabold tabular-nums">{counts[t.value]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={setSearch} placeholder="이름, 기계, 주소, 전화, 내역" className="flex-1 min-w-[200px] max-w-xl" />
        <div className="flex items-center gap-2 overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Segmented<"전체" | "장흥" | "강진"> label="지점" value={branch} onChange={setBranch} options={[{ value: "전체", label: "전체" }, { value: "장흥", label: "장흥" }, { value: "강진", label: "강진" }]} />
        {myName && (
          <Button variant={mine ? "default" : "outline"} className={cn("h-11 rounded-xl gap-1.5 shrink-0 px-3", !mine && "bg-card")} aria-pressed={mine} onClick={() => setMine((m) => !m)}>
            <UserRound className="h-4 w-4" /> 내 출장<span className="hidden sm:inline">만</span>
          </Button>
        )}
        <Segmented<"list" | "map"> label="보기" value={view} onChange={setView} options={[
          { value: "list", label: <span className="flex items-center gap-1"><List className="h-4 w-4" />목록</span> },
          { value: "map", label: <span className="flex items-center gap-1"><MapIcon className="h-4 w-4" />지도</span> },
        ]} />
        </div>
      </div>

      {(tab === "today" || view === "map") && shown.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed px-3 py-2 text-sm">
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={locate} disabled={locating}>
            <LocateFixed className={cn("h-4 w-4", locating && "animate-pulse")} /> {origin ? "내 위치 다시" : "내 위치에서 가까운 순"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {`${origin ? "내 위치" : `${homeBranch} 사무실`}에서 가까운 순으로 번호를 붙였어요.`}
            {noCoords > 0 && ` 위치를 못 찾은 ${noCoords}곳은 지도에서 빠져요 (지도에서 「위치 옮기기」로 지정).`}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48 rounded-3xl" />)}</div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-destructive font-medium">불러오지 못했어요</p>
          <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
        </div>
      ) : view === "map" ? (
        <Suspense fallback={<Skeleton className="h-[60vh] rounded-3xl" />}>
          <OnsiteMap
            visits={shown}
            orderOf={new Map([...route].map(([id, r]) => [id, r.no]))}
            origin={start}
            canManage={canManage}
            staff={liveStaff}
            onMove={(v, at) => patch.mutate({ visit: v, change: { lat: at.lat, lng: at.lng, geocoded_address: v.address } })}
          />
        </Suspense>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl border border-border/70 bg-card py-16 text-center text-muted-foreground text-sm">
          {tab === "today" ? "오늘 가기로 한 곳이 없어요. 카드의 「오늘 가기」를 눌러 담아 보세요." : search || branch !== "전체" || mine ? "조건에 맞는 방문수리가 없어요." : "방문수리 항목이 없어요."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {routed.slice(0, limit).map((v) => (
              <VisitCard key={v.id} visit={v} canManage={canManage} order={route.get(v.id)}
                onEdit={(x) => setModal({ open: true, visit: x })}
                onPatch={(x, change) => patch.mutate({ visit: x, change })} />
            ))}
          </div>
          <ShowMore shown={Math.min(limit, routed.length)} total={routed.length} onMore={() => setLimit((l) => l + 100)} />
        </>
      )}

      <OnsiteRowFormModal
        open={modal.open}
        visit={modal.visit}
        defaults={{ branch: branch !== "전체" ? branch : "", technician: mine && myName ? myName : "" }}
        canDelete={canManage}
        onClose={() => setModal({ open: false, visit: null })}
        onSave={async (input, prev) => { await save.mutateAsync({ input, prev }); }}
        onDelete={async (v) => { await remove.mutateAsync(v); }}
      />
    </div>
  );
}
