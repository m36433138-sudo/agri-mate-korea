import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PartTipsDialog from "@/components/parts/PartTipsDialog";
import { Lightbulb, MapPin, Wrench, Package } from "lucide-react";
import { useState } from "react";

const db = supabase as any;

type Props = {
  partCode: string | null;
  partName: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type InvRow = {
  branch: string;
  quantity: number | null;
  location_main: string | null;
  location_sub: string | null;
  purchase_price: number | null;
  sales_price: number | null;
};

type UsageRow = {
  date: string | null;
  machine: string;
  serial: string;
  customer: string | null;
  technician: string | null;
  qty: number;
  source: "수리이력" | "수리일지";
};

const won = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("ko-KR")}원`);

export default function PartDetailSheet({ partCode, partName, open, onOpenChange }: Props) {
  const [tipsOpen, setTipsOpen] = useState(false);

  const { data: inventory = [], isLoading: invLoading } = useQuery<InvRow[]>({
    queryKey: ["diagram-part-inventory", partCode],
    enabled: open && !!partCode,
    queryFn: async () => {
      const { data, error } = await db
        .from("inventory")
        .select("branch, quantity, location_main, location_sub, purchase_price, sales_price")
        .eq("part_code", partCode)
        .order("branch");
      if (error) throw error;
      return data as InvRow[];
    },
  });

  const { data: usage = [], isLoading: usageLoading } = useQuery<UsageRow[]>({
    queryKey: ["diagram-part-usage", partCode],
    enabled: open && !!partCode,
    queryFn: async () => {
      const rows: UsageRow[] = [];

      // 수리일지 (repair_logs) 기반
      const { data: logs, error: e1 } = await db
        .from("repair_log_parts")
        .select("quantity_used, created_at, repair_logs(repair_date, machines(model_name, serial_number), customers(name))")
        .eq("part_code", partCode)
        .order("created_at", { ascending: false })
        .limit(30);
      if (e1) throw e1;
      (logs || []).forEach((r: any) => {
        const rl = r.repair_logs || {};
        rows.push({
          date: rl.repair_date || r.created_at?.slice(0, 10) || null,
          machine: rl.machines?.model_name || "—",
          serial: rl.machines?.serial_number || "",
          customer: rl.customers?.name || null,
          technician: null,
          qty: r.quantity_used ?? 0,
          source: "수리일지",
        });
      });

      // 수리이력 (repairs + repair_parts → parts.part_number) 기반
      const { data: rps, error: e2 } = await db
        .from("repair_parts")
        .select("quantity, repairs(repair_date, technician, machines(model_name, serial_number)), parts!inner(part_number, part_name)")
        .eq("parts.part_number", partCode)
        .limit(30);
      if (e2) throw e2;
      (rps || []).forEach((r: any) => {
        const rep = r.repairs || {};
        rows.push({
          date: rep.repair_date || null,
          machine: rep.machines?.model_name || "—",
          serial: rep.machines?.serial_number || "",
          customer: null,
          technician: rep.technician || null,
          qty: r.quantity ?? 0,
          source: "수리이력",
        });
      });

      rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return rows.slice(0, 30);
    },
  });

  const totalUsed = usage.reduce((s, u) => s + (u.qty || 0), 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="space-y-1">
            <SheetTitle className="font-mono text-base flex items-center gap-2 flex-wrap">
              <Package className="h-4 w-4 text-primary shrink-0" />
              {partCode}
            </SheetTitle>
            {partName && <p className="text-sm text-muted-foreground">{partName}</p>}
            <Button
              variant="outline"
              size="sm"
              className="w-fit gap-1.5 mt-1"
              onClick={() => setTipsOpen(true)}
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-400" /> 부품 팁 · 사진 보기
            </Button>
          </SheetHeader>

          {/* 재고 정보 */}
          <section className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-400" /> 재고 · 위치 · 가격
            </h3>
            {invLoading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : inventory.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-lg p-3">
                재고 목록에 이 부품번호가 없습니다.
              </p>
            ) : (
              inventory.map((inv) => (
                <div key={inv.branch} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{inv.branch}</Badge>
                    <span className={`text-sm font-bold ${(inv.quantity ?? 0) > 0 ? "" : "text-destructive"}`}>
                      재고 {inv.quantity ?? 0}개
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>위치: {inv.location_main || "—"}{inv.location_sub ? ` / ${inv.location_sub}` : ""}</span>
                    <span>매입가: {won(inv.purchase_price)}</span>
                    <span className="col-span-2">매출가: {won(inv.sales_price)}</span>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* 수리 사용 이력 */}
          <section className="mt-5 space-y-2 pb-6">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-sky-400" /> 수리 사용 이력
              {totalUsed > 0 && (
                <span className="text-xs font-normal text-muted-foreground">(누적 {totalUsed}개)</span>
              )}
            </h3>
            {usageLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
            ) : usage.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-lg p-3">
                이 부품이 사용된 수리 기록이 아직 없습니다.
              </p>
            ) : (
              usage.map((u, i) => (
                <div key={i} className="border rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{u.date || "날짜 미상"}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">{u.source}</Badge>
                      <span className="text-xs font-semibold">×{u.qty}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium truncate">
                    {u.machine}{u.serial ? ` (${u.serial})` : ""}
                  </p>
                  {(u.customer || u.technician) && (
                    <p className="text-xs text-muted-foreground">
                      {u.customer ? `고객: ${u.customer}` : ""}
                      {u.customer && u.technician ? " · " : ""}
                      {u.technician ? `기사: ${u.technician}` : ""}
                    </p>
                  )}
                </div>
              ))
            )}
          </section>
        </SheetContent>
      </Sheet>

      {partCode && (
        <PartTipsDialog
          partCode={partCode}
          partName={partName || partCode}
          open={tipsOpen}
          onOpenChange={setTipsOpen}
        />
      )}
    </>
  );
}
