import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ClipboardList, FileText, ShieldCheck, Truck, Wallet, type LucideIcon } from "lucide-react";
import { useMe } from "@/hooks/useMyAttendance";
import { isMine } from "@/lib/assignments";
import { cn } from "@/lib/utils";

const db = supabase as any;

type Item = { id: string; kind: Kind; title: string; sub: string; badge?: string; to: string; date?: string | null; tone?: "late" | "normal" };
type Kind = "operations" | "onsite" | "insurance" | "quote" | "receivable";

const KIND: Record<Kind, { label: string; icon: LucideIcon; color: string }> = {
  operations: { label: "작업현황판", icon: ClipboardList, color: "text-sky-600 bg-sky-500/10" },
  onsite: { label: "방문수리", icon: Truck, color: "text-emerald-600 bg-emerald-500/10" },
  insurance: { label: "보험수리", icon: ShieldCheck, color: "text-violet-600 bg-violet-500/10" },
  quote: { label: "견적서", icon: FileText, color: "text-amber-600 bg-amber-500/10" },
  receivable: { label: "미수금", icon: Wallet, color: "text-rose-600 bg-rose-500/10" },
};
const ORDER: Kind[] = ["operations", "onsite", "insurance", "quote", "receivable"];
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** 권한이 없는 표는 조용히 비운다 (그 메뉴를 못 보는 직원) */
async function safe<T>(p: Promise<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try { const { data, error } = await p; return error ? [] : data ?? []; } catch { return []; }
}

/** 내가 담당(수리기사·출장기사·보험 담당·견적 담당·수금 담당)으로 지정된 일을 한곳에 모은다 */
export function useMyAssignedWork() {
  const { data: me } = useMe();
  return useQuery<Item[]>({
    queryKey: ["my-assigned-work", me?.name],
    enabled: !!me?.name,
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
    queryFn: async () => {
      const name = me!.name;
      const like = `%${name}%`;
      const [ops, onsite, ins, quotes, recv] = await Promise.all([
        safe<any>(db.from("operation_rows").select("branch, row_index, status_label, customer_name, machine, model, requirements, technician, is_completed")
          .ilike("technician", like).eq("is_completed", false).limit(200)),
        safe<any>(db.from("onsite_visits").select("id, status, customer_name, machine, model, detail, technician, scheduled_on, address")
          .ilike("technician", like).neq("status", "완료").limit(200)),
        safe<any>(db.from("insurance_repairs").select("id, status, technician, claim_number, description, customers(name), machines(model_name)")
          .ilike("technician", like).neq("status", "완료").limit(200)),
        safe<any>(db.from("quotes").select("id, quote_number, quote_date, customer_name, total_amount, assignee")
          .ilike("assignee", like).order("quote_date", { ascending: false }).limit(100)),
        safe<any>(db.from("finance_records").select("id, amount, paid_amount, due_date, assignee, is_paid, record_type, customers(name)")
          .ilike("assignee", like).eq("is_paid", false).eq("record_type", "receivable").limit(200)),
      ]);
      const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
      const out: Item[] = [];
      for (const r of ops) if (isMine(r.technician, name)) out.push({
        id: `op-${r.branch}-${r.row_index}`, kind: "operations", title: r.customer_name ?? "-", badge: r.status_label ?? undefined,
        sub: [r.branch, [r.machine, r.model].filter(Boolean).join(" "), r.requirements].filter(Boolean).join(" · "), to: "/dashboard/operations",
      });
      for (const r of onsite) if (isMine(r.technician, name)) out.push({
        id: `on-${r.id}`, kind: "onsite", title: r.customer_name, badge: r.status, date: r.scheduled_on,
        tone: r.scheduled_on && r.scheduled_on < today ? "late" : "normal",
        sub: [[r.machine, r.model].filter(Boolean).join(" "), r.detail, r.address].filter(Boolean).join(" · "), to: "/onsite-repairs",
      });
      for (const r of ins) if (isMine(r.technician, name)) out.push({
        id: `in-${r.id}`, kind: "insurance", title: r.customers?.name ?? "-", badge: r.status,
        sub: [r.machines?.model_name, r.claim_number, r.description].filter(Boolean).join(" · "), to: "/insurance-repairs",
      });
      for (const r of quotes) if (isMine(r.assignee, name)) out.push({
        id: `qt-${r.id}`, kind: "quote", title: r.customer_name ?? "-", badge: r.quote_number, date: r.quote_date,
        sub: won(Number(r.total_amount) || 0), to: `/quotes/${r.id}`,
      });
      for (const r of recv) if (isMine(r.assignee, name)) {
        const left = Number(r.amount) - Number(r.paid_amount || 0);
        out.push({
          id: `rv-${r.id}`, kind: "receivable", title: r.customers?.name ?? "-", badge: `${won(left)} 남음`, date: r.due_date,
          tone: r.due_date && r.due_date < today ? "late" : "normal", sub: r.due_date ? `만기 ${r.due_date}` : "만기 없음", to: "/receivables",
        });
      }
      return out;
    },
  });
}

export function MyAssignedWork() {
  const { data: me, isLoading: meLoading } = useMe();
  const { data: items = [], isLoading } = useMyAssignedWork();

  if (meLoading || isLoading) return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
  if (!me) return <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-6 text-center">이 계정에 직원 정보가 연결돼 있지 않아요. 대시보드 출퇴근 카드에서 연결하거나 관리자에게 부탁해 주세요.</p>;
  if (!items.length) return <p className="text-sm text-muted-foreground rounded-2xl border border-dashed p-6 text-center">지금 「{me.name}」 님이 담당으로 지정된 일이 없어요. 작업현황판·방문수리·보험수리의 기사, 견적서·미수금의 담당자로 지정되면 여기에 모여요.</p>;

  return (
    <div className="space-y-5">
      {ORDER.map((k) => {
        const list = items.filter((i) => i.kind === k);
        if (!list.length) return null;
        const K = KIND[k];
        return (
          <section key={k} className="space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center", K.color)}><K.icon className="h-4 w-4" /></span>
              {K.label} <span className="text-muted-foreground font-medium">{list.length}</span>
            </h3>
            <ul className="space-y-1.5">
              {list.map((i) => (
                <li key={i.id}>
                  <Link to={i.to} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 hover:border-foreground/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{i.title}
                        {i.badge && <span className="ml-2 text-xs font-medium rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{i.badge}</span>}
                        {i.tone === "late" && <span className="ml-1.5 text-xs font-semibold rounded-full bg-red-500/15 text-red-700 dark:text-red-300 px-2 py-0.5">기한 지남</span>}
                      </p>
                      {i.sub && <p className="text-xs text-muted-foreground truncate mt-0.5">{i.sub}</p>}
                    </div>
                    {i.date && <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{i.date.slice(5).replace("-", "/")}</span>}
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
