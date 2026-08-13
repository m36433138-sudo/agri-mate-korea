import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Building2, ChevronRight, Pencil, Plus, Search, ShieldCheck, Trash2, Camera, CheckCircle2,
} from "lucide-react";

const won = (n?: number | null) => (n == null ? "-" : `${n.toLocaleString()}원`);

const STATUS_STYLE: Record<InsuranceStatus, string> = {
  수리대기: "bg-slate-900/60 text-slate-300 border-slate-700",
  수리중: "bg-blue-950/60 text-blue-400 border-blue-800",
  수리완료: "bg-emerald-950/60 text-emerald-400 border-emerald-800",
  청구완료: "bg-amber-950/60 text-amber-400 border-amber-800",
  입금완료: "bg-violet-950/60 text-violet-400 border-violet-800",
  완료: "bg-muted text-muted-foreground border-border",
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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> 보험수리 관리
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            고객·기계 선택 → 보험사 접수 → 진행상황 관리 → 견적서·수리사진 → 청구/입금 → 완료
          </p>
        </div>
        <Button variant="outline" onClick={() => setCompanyOpen(true)}>
          <Building2 className="h-4 w-4 mr-1" /> 보험사 주소록
        </Button>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> 보험수리 등록
        </Button>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="고객·기계·보험사·접수번호 검색"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">진행중 ({active.length})</TabsTrigger>
          <TabsTrigger value="done">완료된 항목 ({done.length})</TabsTrigger>
        </TabsList>

        {/* 칸반 */}
        <TabsContent value="board" className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              {BOARD_STATUSES.map((s) => {
                const items = active.filter((r) => r.status === s);
                return (
                  <Card key={s} className="border-border/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{s}</span>
                        <Badge variant="secondary">{items.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">없음</p>
                      ) : (
                        items.map((r) => {
                          const next = nextStatus(r.status);
                          return (
                            <div key={r.id} className="rounded-lg border p-2.5 space-y-1.5 bg-card">
                              <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {r.customers?.name || "고객 미지정"}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {r.machines ? `${r.machines.model_name} (${r.machines.serial_number})` : "기계 미지정"}
                                  </p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openEdit(r)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                              {r.insurance_companies?.name && (
                                <Badge variant="outline" className="text-[10px]">{r.insurance_companies.name}</Badge>
                              )}
                              {r.claim_number && (
                                <p className="text-[11px] text-muted-foreground font-mono truncate">{r.claim_number}</p>
                              )}
                              {r.description && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2">{r.description}</p>
                              )}
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                {r.technician && <span>{r.technician}</span>}
                                {r.claim_amount != null && <span className="ml-auto">{won(r.claim_amount)}</span>}
                              </div>
                              {next && (
                                <Button size="sm" variant="secondary" className="w-full h-7 text-xs"
                                  onClick={() => changeStatus(r, next)} disabled={updateStatus.isPending}>
                                  {next === "완료" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                                  {next}로 이동
                                </Button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 완료된 항목 */}
        <TabsContent value="done" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">고객</th>
                    <th className="text-left p-3">기계</th>
                    <th className="text-left p-3">보험사</th>
                    <th className="text-left p-3">접수번호</th>
                    <th className="text-right p-3">청구금액</th>
                    <th className="text-right p-3">입금액</th>
                    <th className="text-left p-3">입금일</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {done.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">완료된 항목이 없습니다.</td></tr>
                  ) : (
                    done.map((r) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="p-3">
                          {r.customer_id ? (
                            <Link to={`/customers/${r.customer_id}`} className="hover:underline">{r.customers?.name}</Link>
                          ) : "-"}
                        </td>
                        <td className="p-3">
                          {r.machine_id ? (
                            <Link to={`/machines/${r.machine_id}`} className="hover:underline">
                              {r.machines?.model_name}
                            </Link>
                          ) : "-"}
                        </td>
                        <td className="p-3">{r.insurance_companies?.name || "-"}</td>
                        <td className="p-3 font-mono text-xs">{r.claim_number || "-"}</td>
                        <td className="p-3 text-right">{won(r.claim_amount)}</td>
                        <td className="p-3 text-right">{won(r.paid_amount)}</td>
                        <td className="p-3">{r.paid_at || "-"}</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(r)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Camera className="h-3 w-3" /> 수리사진은 각 건을 열어 촬영·업로드할 수 있습니다.
        <span className="ml-2">상태 배지: {INSURANCE_STATUSES.map((s) => (
          <span key={s} className={`ml-1 px-1.5 py-0.5 rounded border ${STATUS_STYLE[s]}`}>{s}</span>
        ))}</span>
      </p>

      <InsuranceRepairModal open={modalOpen} onOpenChange={setModalOpen} repair={editing} />
      <InsuranceCompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} />
    </div>
  );
}
