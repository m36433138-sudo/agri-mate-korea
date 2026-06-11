import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useListFilter } from "@/hooks/useListFilter";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Search, Plus, Trash2, Check, ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import RepairInputModal from "@/components/RepairInputModal";
import MechanicRepairForm from "@/components/MechanicRepairForm";
import RepairLogHistory from "@/components/RepairLogHistory";
import type { RepairWithMachine } from "@/types/database";

export default function RepairsList() {
  const [repairOpen, setRepairOpen] = useState(false);
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [accountingFilter, setAccountingFilter] = useState<"all" | "posted" | "unposted">("all");
  const [techOpen, setTechOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useRealtimeSync("repairs", [["all-repairs"]]);

  const { data: repairs, isLoading } = useQuery({
    queryKey: ["all-repairs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("*, machines(id, model_name, serial_number)")
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
    searchFields: ["repair_content", "technician", "machines.serial_number", "machines.model_name"],
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">수리이력</h1>
        <Button onClick={() => setRepairOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> 수리 등록
        </Button>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">수리 이력</TabsTrigger>
          <TabsTrigger value="mechanic-input">정비 입력 (기사)</TabsTrigger>
          <TabsTrigger value="mechanic-history">정비 이력</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative max-w-xs flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="제조번호, 수리내용, 담당기사 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Popover open={techOpen} onOpenChange={setTechOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 justify-between min-w-[140px]">
                  {technicianFilter || "전체 기사"}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-0">
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

            <div className="flex items-center gap-1 bg-muted rounded-md p-1">
              <Button
                variant={accountingFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAccountingFilter("all")}
              >
                전체
              </Button>
              <Button
                variant={accountingFilter === "unposted" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAccountingFilter("unposted")}
              >
                미기표
              </Button>
              <Button
                variant={accountingFilter === "posted" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setAccountingFilter("posted")}
              >
                기표완료
              </Button>
            </div>

            {activeFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTechnicianFilter("");
                  setAccountingFilter("all");
                  setSearch("");
                }}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> 초기화
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered?.length === 0 ? (
            <Card className="shadow-card border-0">
              <CardContent className="py-12 text-center text-muted-foreground">수리 이력이 없습니다.</CardContent>
            </Card>
          ) : (
            <Card className="shadow-card border-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">수리일</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">기계</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">수리내용</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">담당</th>
                      <th className="text-center p-3 font-medium text-muted-foreground w-[80px]">기표</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">공임비</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">총비용</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered?.map((r: any) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-3 whitespace-nowrap">{formatDate(r.repair_date)}</td>
                        <td className="p-3">
                          <Link to={`/machines/${r.machines?.id}`} className="hover:text-primary">
                            <span className="font-medium">{r.machines?.model_name}</span>
                            <span className="block text-xs text-muted-foreground font-mono">{r.machines?.serial_number}</span>
                          </Link>
                        </td>
                        <td className="p-3">{r.repair_content}</td>
                        <td className="p-3 text-muted-foreground">{r.technician || "-"}</td>
                        <td className="p-3 text-center">
                          <Checkbox
                            checked={r.accounting_posted === true}
                            onCheckedChange={(checked) =>
                              toggleAccountingMutation.mutate({ id: r.id, value: !!checked })
                            }
                            disabled={toggleAccountingMutation.isPending}
                            aria-label="전산 기표 여부"
                          />
                        </td>
                        <td className="p-3 text-right tabular-nums">{r.labor_cost > 0 ? formatPrice(r.labor_cost) : "-"}</td>
                        <td className="p-3 text-right tabular-nums font-medium">{r.total_cost > 0 ? formatPrice(r.total_cost) : "-"}</td>
                        <td className="p-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm("이 수리 이력을 삭제하시겠습니까?")) deleteMutation.mutate(r.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mechanic-input">
          <MechanicRepairForm />
        </TabsContent>

        <TabsContent value="mechanic-history">
          <RepairLogHistory />
        </TabsContent>
      </Tabs>

      <RepairInputModal open={repairOpen} onOpenChange={setRepairOpen} />
    </div>
  );
}
