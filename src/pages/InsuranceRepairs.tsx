import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  BOARD_STATUSES,
  INSURANCE_STATUSES,
  useDeleteInsuranceRepair,
  useInsuranceRepairs,
  useUpdateInsuranceStatus,
  type InsuranceRepair,
  type InsuranceStatus,
} from "@/hooks/useInsurance";
import InsuranceRepairModal from "@/components/insurance/InsuranceRepairModal";
import InsuranceCompanyDialog from "@/components/insurance/InsuranceCompanyDialog";
import {
  Building2, ChevronRight, Pencil, Plus, Trash2, Camera, CheckCircle2, MoreHorizontal,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, SearchField } from "@/components/page/PageParts";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const won = (n?: number | null) => (n == null ? "-" : `${n.toLocaleString()}원`);

const STATUS_DOT: Record<InsuranceStatus, string> = {
  수리대기: "#64748b", 수리중: "#3b82f6", 수리완료: "#10b981", 청구완료: "#f59e0b", 입금완료: "#8b5cf6", 완료: "#9ca3af",
};

export default function InsuranceRepairs() {
  const { toast } = useToast();
  const { data: repairs = [], isLoading } = useInsuranceRepairs();
  const updateStatus = useUpdateInsuranceStatus();
  const del = useDeleteInsuranceRepair();

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InsuranceRepair | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  // 휴대폰: 칸반 대신 단계를 하나 골라 그 단계만 보여 준다
  const [phoneStatus, setPhoneStatus] = useState<InsuranceStatus | "전체">("전체");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repairs;
    return repairs.filter((r) =>
      [
        r.customers?.name,
        r.customers?.phone,
        r.machines?.model_name,
        r.machines?.serial_number,
        r.insurance_companies?.name,
        r.claim_number,
        r.technician,
        r.description,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [repairs, search]);

  const active = filtered.filter((r) => r.status !== "완료");
  const done = filtered.filter((r) => r.status === "완료");

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: InsuranceRepair) => { setEditing(r); setModalOpen(true); };

  const changeStatus = async (r: InsuranceRepair, status: InsuranceStatus) => {
    try {
      await updateStatus.mutateAsync({ id: r.id, status });
      toast({ title: `상태를 '${status}'(으)로 변경했습니다.` });
    } catch (e: any) {
      toast({ title: "변경 실패", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (r: InsuranceRepair) => {
    if (!confirm("이 보험수리 건을 삭제할까요? 첨부한 사진 정보도 함께 삭제됩니다.")) return;
    try {
      await del.mutateAsync(r.id);
      toast({ title: "삭제했습니다." });
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e.message, variant: "destructive" });
    }
  };

  const nextStatus = (s: InsuranceStatus): InsuranceStatus | null => {
    const i = INSURANCE_STATUSES.indexOf(s);
    return i >= 0 && i < INSURANCE_STATUSES.length - 1 ? INSURANCE_STATUSES[i + 1] : null;
  };

  const ItemCard = ({ r }: { r: InsuranceRepair }) => {
    const next = nextStatus(r.status);
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2" style={{ boxShadow: `inset 3px 0 0 ${STATUS_DOT[r.status]}` }}>
        <div className="flex items-start gap-1">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold truncate">{r.customers?.name || "고객 미지정"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {r.machines ? `${r.machines.model_name} · ${r.machines.serial_number}` : "기계 미지정"}
            </p>
          </div>
          <button
            onClick={() => openEdit(r)}
            className="h-8 w-8 -mr-1 -mt-1 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="열기" title="열기"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        {r.insurance_companies?.name && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge variant="outline" className="text-[11px] rounded-full shrink-0">{r.insurance_companies.name}</Badge>
            {r.insurance_companies.phone && (
              <a href={`tel:${r.insurance_companies.phone}`} className="text-[11px] text-muted-foreground hover:text-primary truncate">
                {r.insurance_companies.contact_person ? `${r.insurance_companies.contact_person} · ` : ""}{r.insurance_companies.phone}
              </a>
            )}
          </div>
        )}
        {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {r.claim_number && <span className="font-mono truncate">{r.claim_number}</span>}
          {r.technician && <span className="truncate">{r.technician}</span>}
          {r.claim_amount != null && <span className="ml-auto font-bold text-foreground tabular-nums whitespace-nowrap">{won(r.claim_amount)}</span>}
        </div>
        {next && (
          <Button
            size="sm" variant="secondary" className="w-full h-9 rounded-full text-xs font-semibold"
            onClick={() => changeStatus(r, next)} disabled={updateStatus.isPending}
          >
            {next === "완료" ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 mr-1" />}
            {next}로 이동
          </Button>
        )}
      </div>
    );
  };

  const phoneItems = phoneStatus === "전체" ? active : active.filter((r) => r.status === phoneStatus);
  const claimSum = active.reduce((s, r) => s + (r.claim_amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="보험수리 관리"
        sub={<>진행중 {active.length}건{claimSum > 0 && <> · 청구 예정 {won(claimSum)}</>}<span className="hidden lg:inline"> · 접수 → 수리 → 청구 → 입금 → 완료</span></>}
        actions={
          <>
            <Button variant="outline" className="h-11 rounded-full bg-card" onClick={() => setCompanyOpen(true)}>
              <Building2 className="h-4 w-4 mr-1.5" /> 보험사 주소록
            </Button>
            <Button className="h-11 rounded-full px-5" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> 보험수리 등록
            </Button>
          </>
        }
      />

      <SearchField value={search} onChange={setSearch} placeholder="고객, 기계, 보험사, 접수번호로 찾기" className="max-w-xl" />

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">진행중 {active.length}</TabsTrigger>
          <TabsTrigger value="done">완료된 항목 {done.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48 rounded-3xl" />)}</div>
          ) : (
            <>
              {/* 휴대폰: 단계 고르기 + 목록 */}
              <div className="md:hidden space-y-3">
                <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
                  {(["전체", ...BOARD_STATUSES] as const).map((st) => {
                    const n = st === "전체" ? active.length : active.filter((r) => r.status === st).length;
                    const on = phoneStatus === st;
                    return (
                      <button
                        key={st}
                        onClick={() => setPhoneStatus(st as InsuranceStatus | "전체")}
                        aria-pressed={on}
                        className={`shrink-0 h-10 px-3.5 rounded-full border text-sm font-medium flex items-center gap-1.5 transition-colors ${
                          on ? "bg-foreground text-background border-foreground" : "bg-card border-border/70 text-muted-foreground"
                        }`}
                      >
                        {st !== "전체" && <i className="w-2 h-2 rounded-full" style={{ background: STATUS_DOT[st as InsuranceStatus] }} />}
                        {st} <span className="tabular-nums opacity-70">{n}</span>
                      </button>
                    );
                  })}
                </div>
                {phoneItems.length === 0 ? (
                  <div className="rounded-3xl border border-border/70 bg-card py-12 text-center text-sm text-muted-foreground">이 단계의 건이 없어요.</div>
                ) : (
                  phoneItems.map((r) => <ItemCard key={r.id} r={r} />)
                )}
              </div>

              {/* 태블릿 · PC: 단계별 칸반 */}
              <div className="hidden md:grid gap-3 grid-flow-col auto-cols-[minmax(270px,1fr)] overflow-x-auto pb-2">
                {BOARD_STATUSES.map((st) => {
                  const items = active.filter((r) => r.status === st);
                  return (
                    <section key={st} className="rounded-3xl border border-border/70 bg-muted/40 p-2.5 flex flex-col gap-2 min-h-[160px]">
                      <h3 className="flex items-center justify-between px-1.5 pt-1 text-sm font-bold">
                        <span className="flex items-center gap-2">
                          <i className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_DOT[st] }} />
                          {st}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground tabular-nums bg-card rounded-full px-2 py-0.5">{items.length}</span>
                      </h3>
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">없음</p>
                      ) : (
                        items.map((r) => <ItemCard key={r.id} r={r} />)
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* 완료된 항목 */}
        <TabsContent value="done" className="mt-4">
          {done.length === 0 ? (
            <div className="rounded-3xl border border-border/70 bg-card py-12 text-center text-sm text-muted-foreground">완료된 항목이 없습니다.</div>
          ) : (
            <>
              <div className="hidden md:block rounded-3xl border border-border/70 bg-card card-shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[13px]">
                      <th className="text-left font-medium px-5 py-3">고객 · 기계</th>
                      <th className="text-left font-medium px-3 py-3">보험사 · 담당</th>
                      <th className="text-left font-medium px-3 py-3">접수번호</th>
                      <th className="text-right font-medium px-3 py-3">청구 · 입금</th>
                      <th className="text-left font-medium px-3 py-3">입금일</th>
                      <th className="px-3 py-3 w-[56px]"><span className="sr-only">메뉴</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {done.map((r) => (
                      <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-foreground/[0.03] cursor-pointer" onClick={() => openEdit(r)}>
                        <td className="px-5 py-3">
                          {r.customer_id ? (
                            <Link to={`/customers/${r.customer_id}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:text-primary">{r.customers?.name}</Link>
                          ) : <span className="font-semibold">-</span>}
                          <div className="text-xs text-muted-foreground">
                            {r.machine_id ? (
                              <Link to={`/machines/${r.machine_id}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary">{r.machines?.model_name}</Link>
                            ) : "기계 미지정"}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {r.insurance_companies?.name || "-"}
                          {(r.insurance_companies?.contact_person || r.insurance_companies?.phone) && (
                            <div className="text-xs text-muted-foreground">
                              {r.insurance_companies?.contact_person}
                              {r.insurance_companies?.phone && (
                                <> · <a href={`tel:${r.insurance_companies.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary">{r.insurance_companies.phone}</a></>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{r.claim_number || "-"}</td>
                        <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                          <span className="font-semibold">{won(r.claim_amount)}</span>
                          <span className="block text-xs text-muted-foreground">입금 {won(r.paid_amount)}</span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground tabular-nums">{r.paid_at || "-"}</td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <DoneMenu r={r} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden space-y-2">
                {done.map((r) => (
                  <li key={r.id} className="rounded-3xl border border-border/70 bg-card p-4" onClick={() => openEdit(r)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold truncate">{r.customers?.name || "고객 미지정"}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.machines?.model_name ?? "기계 미지정"} · {r.insurance_companies?.name ?? "보험사 없음"}</p>
                      </div>
                      <div className="-mr-2 -mt-1" onClick={(e) => e.stopPropagation()}><DoneMenu r={r} /></div>
                    </div>
                    <div className="flex items-center justify-between mt-3 text-sm">
                      <span className="text-muted-foreground">입금 {won(r.paid_amount)}{r.paid_at ? ` · ${r.paid_at}` : ""}</span>
                      <span className="font-bold tabular-nums">{won(r.claim_amount)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Camera className="h-3.5 w-3.5" /> 수리사진은 각 건을 열어 촬영·업로드할 수 있습니다.
      </p>

      <InsuranceRepairModal open={modalOpen} onOpenChange={setModalOpen} repair={editing} />
      <InsuranceCompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} />
    </div>
  );

  function DoneMenu({ r }: { r: InsuranceRepair }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground" aria-label="더 보기">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => openEdit(r)}><Pencil className="h-4 w-4 mr-2" /> 열기 · 수정</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => remove(r)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}
