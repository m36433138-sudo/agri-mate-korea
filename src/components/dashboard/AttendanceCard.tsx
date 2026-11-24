import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { LogIn, LogOut, MapPin, MapPinOff, Radio, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLinkMyself, useLiveSharing, useMyAttendance } from "@/hooks/useMyAttendance";
import { useUserRole } from "@/hooks/useUserRole";

const hm = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";

function worked(fromIso: string, toIso?: string | null) {
  const min = Math.max(0, Math.floor(((toIso ? Date.parse(toIso) : Date.now()) - Date.parse(fromIso)) / 60_000));
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}

/** 대시보드 출퇴근: 누르면 그 자리 위치와 함께 기록하고, 출근해 있는 동안 내 위치를 동료에게 공유한다 */
export function AttendanceCard() {
  const { toast } = useToast();
  const { me, meLoading, record, isLoading, clockIn, clockOut, working } = useMyAttendance();
  const { off, setOff, status } = useLiveSharing();
  const { isAdmin, isEmployee, profile } = useUserRole();
  const link = useLinkMyself();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);

  if (meLoading) return <Skeleton className="h-[148px] rounded-3xl" />;
  if (!me) {
    // 고객 계정에는 보이지 않는다. 직원·관리자인데 직원 정보가 연결 안 됐으면 연결부터.
    if (!isAdmin && !isEmployee) return null;
    return (
      <section className="rounded-3xl bg-card border border-border/70 card-shadow p-5 space-y-3">
        <p className="text-sm text-muted-foreground">오늘 출퇴근</p>
        <p className="text-lg font-bold">이 계정에 직원 정보가 연결돼 있지 않아요</p>
        {isAdmin ? (
          <>
            <p className="text-xs text-muted-foreground">연결하면 출근·퇴근과 위치 공유를 쓸 수 있어요. 같은 이름의 직원이 있으면 그 직원에, 없으면 새로 등록해 연결해요.</p>
            <Button className="h-12 rounded-2xl w-full gap-2" disabled={link.isPending}
              onClick={() => link.mutate(profile?.display_name ?? "", {
                onSuccess: (r) => toast({ title: `「${r.name}」 직원으로 ${r.created ? "새로 등록해 " : ""}연결했어요`, description: "이제 출근을 누를 수 있어요." }),
                onError: (e: Error) => toast({ title: "연결 실패", description: e.message, variant: "destructive" }),
              })}>
              <UserCheck className="h-5 w-5" /> {link.isPending ? "연결 중…" : "내 직원 정보 연결"}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">관리자에게 「사용자 관리」에서 내 계정을 직원 정보에 연결해 달라고 부탁해 주세요.</p>
        )}
      </section>
    );
  }

  const done = !!record?.clock_out;
  const run = (m: typeof clockIn, label: string) => m.mutate(undefined, {
    onSuccess: (pos) => toast({ title: `${label} 기록했어요 (${hm(new Date().toISOString())})`, description: pos ? "위치도 함께 남겼어요." : "위치는 못 받았어요. 휴대폰 위치 권한을 확인해 주세요." }),
    onError: (e: Error) => toast({ title: `${label} 실패`, description: e.message, variant: "destructive" }),
  });

  return (
    <section className="rounded-3xl bg-card border border-border/70 card-shadow p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">오늘 출퇴근 · {me.name}</p>
          {isLoading ? <Skeleton className="h-8 w-40 mt-1" /> : (
            <p className="text-[22px] font-extrabold tracking-tight mt-0.5">
              {!record?.clock_in ? "아직 출근 전" : done ? `퇴근 ${hm(record.clock_out)}` : `근무 중 · ${worked(record.clock_in)}`}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            출근 {hm(record?.clock_in)} · 퇴근 {hm(record?.clock_out)}{done && record?.clock_in ? ` · ${worked(record.clock_in, record.clock_out)}` : ""}
          </p>
        </div>
        <span className={cn("shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full",
          working ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
          <span className={cn("w-2 h-2 rounded-full", working ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50")} />
          {working ? "근무 중" : done ? "퇴근" : "출근 전"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button className="h-12 rounded-2xl text-base gap-2" disabled={!!record?.clock_in || clockIn.isPending} onClick={() => run(clockIn, "출근")}>
          <LogIn className="h-5 w-5" /> {clockIn.isPending ? "위치 확인 중…" : "출근"}
        </Button>
        <Button variant="outline" className="h-12 rounded-2xl text-base gap-2" disabled={!working || clockOut.isPending}
          onClick={() => { if (confirm("퇴근을 기록할까요? 위치 공유도 멈춰요.")) run(clockOut, "퇴근"); }}>
          <LogOut className="h-5 w-5" /> {clockOut.isPending ? "위치 확인 중…" : "퇴근"}
        </Button>
      </div>

      {working && (
        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2.5">
          {off ? <MapPinOff className="h-4 w-4 text-muted-foreground shrink-0" />
            : status === "sharing" ? <Radio className="h-4 w-4 text-emerald-600 shrink-0 animate-pulse" />
            : <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />}
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-semibold text-sm">{off ? "위치 공유 꺼짐" : status === "sharing" ? "내 위치 공유 중" : status === "denied" ? "위치 권한이 막혀 있어요" : "위치 확인 중…"}</p>
            <p className="text-muted-foreground">
              {status === "denied" ? "휴대폰 설정 → 앱/브라우저 → 위치를 「허용」으로 바꿔 주세요." : "앱이 열려 있는 동안 동료 지도(방문수리·근무 현황)에 보여요."}
            </p>
          </div>
          <Switch checked={!off} onCheckedChange={(v) => setOff(!v)} aria-label="위치 공유" />
        </div>
      )}
      {!working && !done && <p className="text-xs text-muted-foreground -mt-1">출근하면 그 자리 위치가 기록되고, 출장 중 내 위치가 동료 지도에 공유돼요. <Link to="/onsite-repairs" className="text-primary underline">방문수리 지도</Link></p>}
    </section>
  );
}
