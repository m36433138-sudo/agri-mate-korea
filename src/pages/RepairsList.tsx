import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatPrice, formatDate } from "@/lib/formatters";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RepairInputModal from "@/components/RepairInputModal";
import MechanicRepairForm from "@/components/MechanicRepairForm";
import RepairLogHistory from "@/components/RepairLogHistory";
import ExcelTable, { type ExcelColumn } from "@/components/ExcelTable";
import type { RepairWithMachine } from "@/types/database";

export default function RepairsList() {
  const [repairOpen, setRepairOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

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

  const columns = useMemo<ExcelColumn<RepairWithMachine>[]>(() => [
    { accessorKey: "repair_date", header: "수리일", size: 110, sticky: true,
      cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDate(getValue() as string)}</span>,
      exportValue: (r) => r.repair_date },
    { id: "machine_model", header: "기계", size: 180,
      accessorFn: (r: any) => r.machines?.model_name ?? "",
      cell: ({ row }) => {
        const r = row.original as any;
        return <span className="font-medium truncate">{r.machines?.model_name ?? "-"}</span>;
      } },
    { id: "machine_serial", header: "제조번호", size: 150,
      accessorFn: (r: any) => r.machines?.serial_number ?? "",
      cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{(getValue() as string) || "-"}</span> },
    { accessorKey: "repair_content", header: "수리내용", size: 320,
      cell: ({ getValue }) => <span className="truncate">{getValue() as string}</span> },
    { accessorKey: "technician", header: "담당", size: 100,
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || "-"}</span> },
    { accessorKey: "labor_cost", header: "공임비", size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className="text-right tabular-nums w-full">{v > 0 ? formatPrice(v) : "-"}</span>;
      },
      exportValue: (r) => r.labor_cost ?? 0 },
    { accessorKey: "total_cost", header: "총비용", size: 130,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return <span className="text-right tabular-nums font-medium w-full">{v > 0 ? formatPrice(v) : "-"}</span>;
      },
      exportValue: (r) => r.total_cost ?? 0 },
    { id: "_actions", header: "", size: 56, disableSort: true,
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); if (confirm("이 수리 이력을 삭제하시겠습니까?")) deleteMutation.mutate((row.original as any).id); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) },
  ], [deleteMutation]);

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
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <ExcelTable
              data={repairs ?? []}
              columns={columns}
              searchPlaceholder="제조번호·수리내용·담당기사 검색..."
              exportFileName="수리이력"
              emptyMessage="수리 이력이 없습니다."
              onRowClick={(r) => {
                const mid = (r as any).machines?.id;
                if (mid) navigate(`/machines/${mid}`);
              }}
            />
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

