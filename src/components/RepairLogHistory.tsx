import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, ClipboardList, Check, ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

export default function RepairLogHistory() {
  const [search, setSearch] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [accountingFilter, setAccountingFilter] = useState<"all" | "posted" | "unposted">("all");
  const [techOpen, setTechOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["repair-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_logs")
        .select("*, customers(name), machines(model_name, serial_number, machine_type)")
        .order("repair_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
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

  const { data: allParts } = useQuery({
    queryKey: ["repair-log-parts-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("repair_log_parts").select("*");
      if (error) throw error;
      return data;
    },
  });

  const toggleAccountingMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("repair_logs").update({ accounting_posted: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repair-logs"] }),
    onError: (e: any) => toast({ title: "변경 실패", description: e.message, variant: "destructive" }),
  });

  const partsMap = new Map<string, typeof allParts>();
  allParts?.forEach((p: any) => {
    const list = partsMap.get(p.repair_log_id) || [];
    list.push(p);
    partsMap.set(p.repair_log_id, list);
  });

  const filtered = logs?.filter((log: any) => {
    if (technicianFilter && log.mechanic_name !== technicianFilter) return false;
    if (accountingFilter === "posted" && log.accounting_posted !== true) return false;
    if (accountingFilter === "unposted" && log.accounting_posted === true) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.mechanic_name?.toLowerCase().includes(q) ||
      log.description?.toLowerCase().includes(q) ||
      log.customers?.name?.toLowerCase().includes(q) ||
      log.machines?.model_name?.toLowerCase().includes(q)
    );
  });

  const activeFilters = technicianFilter || accountingFilter !== "all" || search;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="고객, 기사, 내용 검색..."
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

      {!filtered?.length ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            정비 기록이 없습니다.
          </CardContent>
        </Card>
      ) : (
        filtered.map((log: any) => {
          const parts = partsMap.get(log.id) || [];
          return (
            <Card key={log.id} className="shadow-card border-0">
              <CardHeader className="bg-muted/30 border-b pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">
                    {log.machines
                      ? `${log.machines.machine_type} ${log.machines.model_name}`
                      : "기계 미지정"}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={log.accounting_posted ? "default" : "secondary"}
                      className="text-xs cursor-pointer select-none"
                      onClick={() =>
                        toggleAccountingMutation.mutate({ id: log.id, value: !log.accounting_posted })
                      }
                    >
                      {log.accounting_posted ? "기표완료" : "미기표"}
                    </Badge>
                    <Badge variant="secondary">{formatDate(log.repair_date)}</Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {log.customers?.name && <span>고객: {log.customers.name}</span>}
                  <span>담당: {log.mechanic_name}</span>
                  {log.operating_hours && <span>사용시간: {log.operating_hours}시간</span>}
                  {log.branch && <Badge variant="outline" className="text-xs">{log.branch}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <p className="text-sm mb-2">{log.description}</p>
                {parts.length > 0 && (
                  <div className="bg-primary/5 p-3 rounded-md">
                    <h4 className="text-xs font-bold text-primary mb-2">교체 부품</h4>
                    <ul className="text-sm space-y-1">
                      {parts.map((p: any, idx: number) => (
                        <li key={idx} className="flex justify-between border-b border-primary/10 pb-1 last:border-0">
                          <span className="font-mono text-xs">{p.part_code}</span>
                          <span className="font-medium">{p.quantity_used}개</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
