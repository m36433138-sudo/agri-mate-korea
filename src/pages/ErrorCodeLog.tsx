import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Loader2, Search } from "lucide-react";
import { formatDate } from "@/lib/formatters";

type Row = {
  id: string;
  repair_id: string;
  error_code: string;
  symptom: string | null;
  action_taken: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  repairs: {
    id: string;
    repair_date: string;
    technician: string | null;
    repair_content: string | null;
    machines: {
      id: string;
      model_name: string;
      serial_number: string;
      customer_id: string | null;
      customers: { name: string } | null;
    } | null;
  } | null;
};

export default function ErrorCodeLog() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["error-code-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repair_error_codes" as any)
        .select(
          "*, repairs(id, repair_date, technician, repair_content, machines(id, model_name, serial_number, customer_id, customers(name)))",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from("repair_error_codes" as any)
        .update({ is_resolved: value, resolved_at: value ? new Date().toISOString().slice(0, 10) : null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["error-code-log"] }),
    onError: (e: any) => toast({ title: "변경 실패", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyUnresolved && r.is_resolved) return false;
      if (!kw) return true;
      const hay = [
        r.error_code,
        r.symptom,
        r.action_taken,
        r.notes,
        r.repairs?.technician,
        r.repairs?.machines?.model_name,
        r.repairs?.machines?.serial_number,
        r.repairs?.machines?.customers?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [rows, q, onlyUnresolved]);

  const topCodes = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.error_code, (map.get(r.error_code) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  const unresolved = rows.filter((r) => !r.is_resolved).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
          에러코드 기록
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          수리이력에 기록된 에러코드·증상·조치 내용을 한 곳에서 검색합니다.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">전체 기록</p>
            <p className="text-xl font-bold tabular-nums">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">미조치</p>
            <p className="text-xl font-bold tabular-nums text-amber-400">{unresolved}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">조치완료</p>
            <p className="text-xl font-bold tabular-nums text-emerald-400">{rows.length - unresolved}</p>
          </CardContent>
        </Card>
      </div>

      {topCodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">자주 발생:</span>
          {topCodes.map(([c, n]) => (
            <Button key={c} variant="outline" size="sm" className="h-7 text-xs font-mono" onClick={() => setQ(c)}>
              {c} <span className="ml-1 text-muted-foreground">{n}</span>
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="에러코드 · 증상 · 조치 · 기계 · 고객 · 담당 검색"
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer px-2">
          <Checkbox checked={onlyUnresolved} onCheckedChange={(v) => setOnlyUnresolved(!!v)} />
          미조치만 보기
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            기록된 에러코드가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => (
            <Card key={r.id} className="shadow-card border-0">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono">{r.error_code}</Badge>
                  {r.is_resolved ? (
                    <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-400/40">
                      <CheckCircle2 className="h-3 w-3" /> 조치완료
                      {r.resolved_at && <span className="ml-1">{formatDate(r.resolved_at)}</span>}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-amber-400 border-amber-400/40">
                      <AlertTriangle className="h-3 w-3" /> 미조치
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {r.repairs ? formatDate(r.repairs.repair_date) : ""}
                    {r.repairs?.technician ? ` · ${r.repairs.technician}` : ""}
                  </span>
                  <div className="flex-1" />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={r.is_resolved}
                      onCheckedChange={(v) => toggle.mutate({ id: r.id, value: !!v })}
                    />
                    완료
                  </label>
                </div>

                <div className="text-sm">
                  {r.repairs?.machines && (
                    <Link to={`/machines/${r.repairs.machines.id}`} className="hover:text-primary font-medium">
                      {r.repairs.machines.model_name}
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {r.repairs.machines.serial_number}
                      </span>
                    </Link>
                  )}
                  {r.repairs?.machines?.customers?.name && (
                    <>
                      <span className="text-muted-foreground mx-1">·</span>
                      <Link
                        to={`/customers/${r.repairs.machines.customer_id}`}
                        className="hover:text-primary text-muted-foreground"
                      >
                        {r.repairs.machines.customers.name}
                      </Link>
                    </>
                  )}
                </div>

                {r.symptom && <p className="text-sm"><span className="text-muted-foreground">증상 </span>{r.symptom}</p>}
                {r.action_taken && <p className="text-sm"><span className="text-muted-foreground">조치 </span>{r.action_taken}</p>}
                {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
