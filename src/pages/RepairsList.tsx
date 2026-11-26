import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useListFilter } from "@/hooks/useListFilter";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Search, Plus, Trash2, Check, ChevronDown, RotateCcw, Pencil, FileUp, AlertTriangle, Map as MapIcon, MoreHorizontal, Printer, Gift } from "lucide-react";
import { RepairStatementDialog } from "@/components/print/RepairStatementDialog";
import RepairDiagramDialog from "@/components/diagrams/RepairDiagramDialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import RepairInputModal from "@/components/RepairInputModal";
import RepairEditDialog from "@/components/RepairEditDialog";
import RepairErrorCodeDialog from "@/components/RepairErrorCodeDialog";
import BillingPdfImportDialog from "@/components/BillingPdfImportDialog";

import MechanicRepairForm from "@/components/MechanicRepairForm";
import RepairLogHistory from "@/components/RepairLogHistory";
import type { RepairWithMachine } from "@/types/database";

const PAGE = 100;

/** 전산 기표 상태 배지. 눌러서 바로 바꿀 수 있다. */
function AccountingBadge({ posted, disabled, onToggle }: { posted: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      disabled={disabled}
      aria-pressed={posted}
      title={posted ? "눌러서 미기표로 바꾸기" : "눌러서 기표완료로 바꾸기"}
      className={cn(
        "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50",
        posted
          ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
          : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400",
      )}
    >
      {posted && <Check className="h-3 w-3" strokeWidth={3} />}
      {posted ? "기표완료" : "미기표"}
    </button>
  );
}

function FreeBadge({ waived }: { waived?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
      <Gift className="h-3 w-3" /> 무상{waived ? ` ${formatPrice(waived)}` : ""}
    </span>
  );
}

function RowMenu({ onDiagram, onErrorCode, onEdit, onDelete, onStatement }: {
  onDiagram: () => void; onErrorCode: () => void; onEdit: () => void; onDelete: () => void; onStatement: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          aria-label="더 보기"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onEdit}><Pencil className="h-4 w-4 mr-2" /> 수정</DropdownMenuItem>
        <DropdownMenuItem onSelect={onStatement}><Printer className="h-4 w-4 mr-2" /> 거래명세서</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDiagram}><MapIcon className="h-4 w-4 mr-2" /> 도면에서 부품 보기</DropdownMenuItem>
        <DropdownMenuItem onSelect={onErrorCode}><AlertTriangle className="h-4 w-4 mr-2" /> 에러코드 기록</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function RepairsList() {
  const [params, setParams] = useSearchParams();
  const [repairOpen, setRepairOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [editRepair, setEditRepair] = useState<any | null>(null);
  const [errorCodeRepair, setErrorCodeRepair] = useState<any | null>(null);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [diagramRepair, setDiagramRepair] = useState<any | null>(null);
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [accountingFilter, setAccountingFilter] = useState<"all" | "posted" | "unposted">(() => {
    const a = params.get("accounting");
    return a === "posted" || a === "unposted" ? a : "all";
  });
  const [shown, setShown] = useState(PAGE);

  // 대시보드의 「수리 등록」 바로가기 (?new=1)
  useEffect(() => {
    if (params.get("new") === "1") {
      setRepairOpen(true);
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [techOpen, setTechOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useRealtimeSync("repairs", [["all-repairs"]]);

  const { data: repairs, isLoading } = useQuery({
    queryKey: ["all-repairs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*, machines(id, model_name, serial_number, customer_id, customers(name))")
        .order("repair_date", { ascending: false });
      if (error) throw error;
      return data as RepairWithMachine[];
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { search, setSearch, filtered: searchFiltered } = useListFilter<RepairWithMachine>({
    data: repairs,
    searchFields: ["repair_content", "technician", "machines.serial_number", "machines.model_name", "machines.customers.name"],
  });

  const filtered = useMemo(() => {
    let result = searchFiltered;
    if (technicianFilter) {
      result = result.filter((r) => r.technician === technicianFilter);
    }
    if (accountingFilter === "posted") {
      result = result.filter((r) => r.accounting_posted === true);
    } else if (accountingFilter === "unposted") {
      result = result.filter((r) => r.accounting_posted !== true);
    }
    return result;
  }, [searchFiltered, technicianFilter, accountingFilter]);

  // 필터가 바뀌면 처음 100건부터 다시 보여 준다 (수천 건도 휴대폰에서 가볍게)
  useEffect(() => setShown(PAGE), [search, technicianFilter, accountingFilter]);
  const visible = filtered.slice(0, shown);
  const unpostedCount = useMemo(() => (repairs ?? []).filter((r) => r.accounting_posted !== true).length, [repairs]);
  const askDelete = (r: any) => {
    if (confirm("이 수리 이력을 삭제하시겠습니까?")) deleteMutation.mutate(r.id);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("repairs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-repairs"] });
      toast({ title: "수리 이력이 삭제되었습니다." });
    },
    onError: (e: any) => toast({ title: "삭제 실패", description: e.message, variant: "destructive" }),
  });

  const toggleAccountingMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("repairs").update({ accounting_posted: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-repairs"] }),
    onError: (e: any) => toast({ title: "변경 실패", description: e.message, variant: "destructive" }),
  });

  const activeFilters = technicianFilter || accountingFilter !== "all" || search;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight">수리이력</h1>
          {repairs && (
            <p className="text-sm text-muted-foreground mt-1">
              전체 {repairs.length.toLocaleString("ko-KR")}건
              {unpostedCount > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                    onClick={() => setAccountingFilter("unposted")}
                  >
                    미기표 {unpostedCount.toLocaleString("ko-KR")}건
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 rounded-xl flex-1 sm:flex-none" onClick={() => setImportOpen(true)}>
            <FileUp className="h-4 w-4 mr-1.5" /> 청구서 PDF
          </Button>
          <Button className="h-11 rounded-xl flex-1 sm:flex-none px-5" onClick={() => setRepairOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> 수리 등록
          </Button>
        </div>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="h-11 rounded-xl p-1 w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
          <TabsTrigger value="history" className="rounded-lg h-9">수리 이력</TabsTrigger>
          <TabsTrigger value="mechanic-input" className="rounded-lg h-9">정비 입력</TabsTrigger>
          <TabsTrigger value="mechanic-history" className="rounded-lg h-9">정비 이력</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-3">
          {/* 필터 막대 */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="기계, 제조번호, 고객, 수리내용, 담당기사"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-card"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
              <Popover open={techOpen} onOpenChange={setTechOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("h-11 rounded-xl justify-between min-w-[128px] shrink-0 bg-card", technicianFilter && "border-primary text-primary")}
                  >
                    {technicianFilter || "담당 기사"}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="기사 검색..." />
                    <CommandList>
                      <CommandEmpty>결과 없음</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setTechnicianFilter("");
                            setTechOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", technicianFilter === "" ? "opacity-100" : "opacity-0")} />
                          전체 기사
                        </CommandItem>
                        {employees?.map((emp: any) => (
                          <CommandItem
                            key={emp.id}
                            onSelect={() => {
                              setTechnicianFilter(emp.name);
                              setTechOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                technicianFilter === emp.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {emp.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="flex items-center h-11 shrink-0 rounded-xl bg-muted p-1" role="group" aria-label="기표 상태">
                {([["all", "전체"], ["unposted", "미기표"], ["posted", "기표완료"]] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={accountingFilter === v}
                    onClick={() => setAccountingFilter(v)}
                    className={cn(
                      "h-9 px-3.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                      accountingFilter === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeFilters && (
                <Button
                  variant="ghost"
                  className="h-11 rounded-xl shrink-0 text-muted-foreground"
                  onClick={() => {
                    setTechnicianFilter("");
                    setAccountingFilter("all");
                    setSearch("");
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> 초기화
                </Button>
              )}
            </div>
          </div>

          {activeFilters && !isLoading && (
            <p className="text-sm text-muted-foreground px-1">{filtered.length.toLocaleString("ko-KR")}건 찾았어요</p>
          )}

          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-card border border-border/70 py-16 text-center text-muted-foreground">
              {activeFilters ? "조건에 맞는 수리 이력이 없어요." : "수리 이력이 없습니다."}
            </div>
          ) : (
            <>
              {/* PC: 표 */}
              <div className="hidden md:block rounded-2xl bg-card border border-border/70 card-shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-[13px]">
                      <th className="text-left font-medium px-5 py-3 w-[110px]">수리일</th>
                      <th className="text-left font-medium px-3 py-3 w-[190px]">기계 · 고객</th>
                      <th className="text-left font-medium px-3 py-3">수리내용</th>
                      <th className="text-left font-medium px-3 py-3 w-[90px]">담당</th>
                      <th className="text-left font-medium px-3 py-3 w-[110px]">기표</th>
                      <th className="text-right font-medium px-3 py-3 w-[120px]">총비용</th>
                      <th className="px-3 py-3 w-[56px]"><span className="sr-only">메뉴</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r: any) => (
                      <tr
                        key={r.id}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => setEditRepair(r)}
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground tabular-nums">{formatDate(r.repair_date)}</td>
                        <td className="px-3 py-3.5">
                          <Link
                            to={`/machines/${r.machines?.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold hover:text-primary"
                          >
                            {r.machines?.model_name}
                          </Link>
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {r.machines?.customers?.name ? (
                              <Link
                                to={`/customers/${r.machines.customer_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-primary"
                              >
                                {r.machines.customers.name}
                              </Link>
                            ) : (
                              <span className="font-mono">{r.machines?.serial_number}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="line-clamp-2 leading-snug">{r.repair_content}</p>
                        </td>
                        <td className="px-3 py-3.5 text-muted-foreground whitespace-nowrap">{r.technician}</td>
                        <td className="px-3 py-3.5">
                          <AccountingBadge
                            posted={r.accounting_posted === true}
                            disabled={toggleAccountingMutation.isPending}
                            onToggle={() => toggleAccountingMutation.mutate({ id: r.id, value: r.accounting_posted !== true })}
                          />
                        </td>
                        <td className="px-3 py-3.5 text-right tabular-nums whitespace-nowrap">
                          {r.is_free_service && <FreeBadge waived={r.waived_amount} />}
                          {r.total_cost > 0 && <span className="font-bold">{formatPrice(r.total_cost)}</span>}
                          {r.labor_cost > 0 && (
                            <span className="block text-xs text-muted-foreground">공임 {formatPrice(r.labor_cost)}</span>
                          )}
                        </td>
                        <td className="px-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <RowMenu
                            onEdit={() => setEditRepair(r)}
                            onDiagram={() => setDiagramRepair(r)}
                            onErrorCode={() => setErrorCodeRepair(r)}
                            onStatement={() => setStatementId(r.id)}
                            onDelete={() => askDelete(r)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 휴대폰: 카드 목록 */}
              <ul className="md:hidden space-y-2">
                {visible.map((r: any) => (
                  <li
                    key={r.id}
                    className="rounded-2xl bg-card border border-border/70 p-4 active:bg-muted/40"
                    onClick={() => setEditRepair(r)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold truncate">
                          {r.machines?.model_name}
                          {r.machines?.customers?.name && (
                            <span className="font-normal text-muted-foreground"> · {r.machines.customers.name}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(r.repair_date)}
                          {r.technician && ` · ${r.technician}`}
                        </p>
                      </div>
                      <div className="-mr-2 -mt-1" onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          onEdit={() => setEditRepair(r)}
                          onDiagram={() => setDiagramRepair(r)}
                          onErrorCode={() => setErrorCodeRepair(r)}
                            onStatement={() => setStatementId(r.id)}
                          onDelete={() => askDelete(r)}
                        />
                      </div>
                    </div>
                    <p className="text-sm mt-2 line-clamp-2 leading-snug">{r.repair_content}</p>
                    <div className="flex items-center justify-between mt-3">
                      <AccountingBadge
                        posted={r.accounting_posted === true}
                        disabled={toggleAccountingMutation.isPending}
                        onToggle={() => toggleAccountingMutation.mutate({ id: r.id, value: r.accounting_posted !== true })}
                      />
                      {r.is_free_service ? <FreeBadge waived={r.waived_amount} /> : r.total_cost > 0 && <span className="text-base font-extrabold tabular-nums">{formatPrice(r.total_cost)}</span>}
                    </div>
                  </li>
                ))}
              </ul>

              {filtered.length > shown && (
                <Button variant="outline" className="w-full h-12 rounded-xl bg-card" onClick={() => setShown((n) => n + PAGE)}>
                  더 보기 ({shown.toLocaleString("ko-KR")} / {filtered.length.toLocaleString("ko-KR")}건)
                </Button>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="mechanic-input">
          <MechanicRepairForm />
        </TabsContent>

        <TabsContent value="mechanic-history">
          <RepairLogHistory />
        </TabsContent>
      </Tabs>

      <RepairInputModal open={repairOpen} onOpenChange={setRepairOpen} onSaved={(id) => setStatementId(id)} />
      <BillingPdfImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <RepairEditDialog
        open={!!editRepair}
        onOpenChange={(v) => !v && setEditRepair(null)}
        repair={editRepair}
      />

      <RepairDiagramDialog
        open={!!diagramRepair}
        onOpenChange={(v) => !v && setDiagramRepair(null)}
        repair={diagramRepair}
      />

      <RepairErrorCodeDialog
        open={!!errorCodeRepair}
        onOpenChange={(v) => !v && setErrorCodeRepair(null)}
        repair={errorCodeRepair}
      />

      <RepairStatementDialog repairId={statementId} onClose={() => setStatementId(null)} />
    </div>
  );
}
