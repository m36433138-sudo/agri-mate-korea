import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page/PageParts";
import { useToast } from "@/hooks/use-toast";
import { useMe } from "@/hooks/useMyAttendance";
import { fmtDays, leaveBalance } from "@/lib/hr";
import { useCancelLeave, useHrEmployees, useLeaveAdjustments, useLeaveRequests } from "@/lib/hrApi";
import { kstDate } from "@/hooks/useMyAttendance";
import { LeaveBalanceCard, LeaveCalendar, LeaveRequestDialog, StatusBadge, periodText } from "@/components/hr/LeaveParts";
import { Plane, Plus } from "lucide-react";

/** 내 휴가: 연차 잔여, 신청·취소, 내 신청 기록, 팀 휴가 달력 */
export default function MyLeave() {
  const { toast } = useToast();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: emps = [] } = useHrEmployees();
  const mine = emps.find((e) => e.id === me?.id);
  const { data: reqs = [], isLoading } = useLeaveRequests(me?.id);
  const { data: adjs = [] } = useLeaveAdjustments(me?.id);
  const cancel = useCancelLeave();
  const [open, setOpen] = useState(false);
  const today = kstDate();

  if (meLoading) return <Skeleton className="h-40 rounded-3xl" />;
  if (!me) return <p className="text-sm text-muted-foreground">이 계정에 직원 정보가 연결돼 있지 않아요. 대시보드에서 연결하거나 관리자에게 부탁해 주세요.</p>;

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader title="내 휴가" sub={`${me.name} · 연차·반차·병가 신청과 기록`}
        actions={<Button className="h-11 rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> 휴가 신청</Button>} />

      <section className="rounded-3xl border border-border/70 bg-card card-shadow p-4 sm:p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Plane className="h-5 w-5 text-primary" /> 연차 현황</h2>
        <LeaveBalanceCard joinDate={mine?.join_date ?? null} requests={reqs} adjustments={adjs} />
      </section>

      <section className="rounded-3xl border border-border/70 bg-card card-shadow p-4 sm:p-5 space-y-3">
        <h2 className="font-bold">내 신청 기록</h2>
        {isLoading ? <Skeleton className="h-20 rounded-2xl" /> : reqs.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 신청한 휴가가 없어요.</p>
        ) : (
          <ul className="divide-y">
            {reqs.map((r) => {
              const cancellable = r.status === "신청" || (r.status === "승인" && r.start_date > today);
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{r.kind} · {fmtDays(r.days)} <span className="font-normal text-muted-foreground">{periodText(r.start_date, r.end_date)}</span></p>
                    {(r.reason || r.decision_note) && <p className="text-xs text-muted-foreground truncate">{r.reason}{r.decision_note ? ` · 관리자: ${r.decision_note}` : ""}</p>}
                  </div>
                  <StatusBadge s={r.status} />
                  {cancellable && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={cancel.isPending}
                      onClick={() => { if (confirm("이 휴가 신청을 취소할까요?")) cancel.mutate(r.id, {
                        onSuccess: () => toast({ title: "취소했어요" }),
                        onError: (e: Error) => toast({ title: "취소하지 못했어요", description: e.message, variant: "destructive" }),
                      }); }}>취소</Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <LeaveCalendar />
      <LeaveRequestDialog open={open} onOpenChange={setOpen} myName={me.name} />
    </div>
  );
}

/** 대시보드용 작은 카드: 남은 연차와 신청 버튼 */
export function MyLeaveCard() {
  const { data: me } = useMe();
  const { data: emps = [] } = useHrEmployees();
  const mine = emps.find((e) => e.id === me?.id);
  const { data: reqs = [] } = useLeaveRequests(me?.id);
  const { data: adjs = [] } = useLeaveAdjustments(me?.id);
  if (!me) return null;
  const b = mine?.join_date ? leaveBalance(mine.join_date, kstDate(), reqs, adjs) : null;
  const pending = reqs.filter((r) => r.status === "신청").length;
  return (
    <Link to="/leave" className="flex items-center gap-3 rounded-3xl bg-card border border-border/70 card-shadow px-5 py-4 hover:border-primary/50 transition-colors">
      <Plane className="h-6 w-6 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">내 휴가</p>
        <p className="font-bold">{b ? <>남은 연차 <span className="text-primary">{fmtDays(b.remaining)}</span></> : "입사일 미입력"}{pending ? <span className="text-xs font-medium text-amber-600"> · 승인 대기 {pending}건</span> : null}</p>
      </div>
      <span className="text-sm text-primary font-semibold shrink-0">신청 ›</span>
    </Link>
  );
}
