import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardList, Loader2, Plus, Search, Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchAllRows } from "@/lib/pagination";
import { buildRecordIndex, type CatalogEntry } from "@/lib/errorCodeCatalog";
import { errorCodeMatches } from "@/lib/errorCodes";
import ErrorCodeCatalogList from "@/components/errorCodes/ErrorCodeCatalogList";
import ErrorCodeDetailDialog from "@/components/errorCodes/ErrorCodeDetailDialog";
import type { ErrorCodeLogRow } from "@/components/errorCodes/types";
import { formatDate } from "@/lib/formatters";
import ErrorCodePhotos from "@/components/ErrorCodePhotos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RepairErrorCodeDialog from "@/components/RepairErrorCodeDialog";

type RepairPick = {
  id: string;
  repair_date: string;
  technician: string | null;
  repair_content: string | null;
  machines: any;
};

type Row = ErrorCodeLogRow;

export default function ErrorCodeLog() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedRepair, setPickedRepair] = useState<RepairPick | null>(null);
  const [repairSearch, setRepairSearch] = useState("");
  const [tab, setTab] = useState("catalog");
  const [detail, setDetail] = useState<CatalogEntry | null>(null);
  const [pendingCode, setPendingCode] = useState("");

  const { data: catalog = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["error-code-catalog"],
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: () =>
      fetchAllRows<CatalogEntry>((from, to) =>
        supabase
          .from("error_code_catalog" as any)
          .select("id, code, machine_types, series, controller, part, symptom, cause, remedy, recovery, source, source_url, sort_order")
          .order("sort_order")
          .range(from, to) as any,
      ),
  });

  const { data: repairOptions = [], isLoading: repairsLoading } = useQuery({
    queryKey: ["error-code-repair-picker"],
    enabled: pickerOpen,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repairs")
        .select("id, repair_date, technician, repair_content, machines(id, model_name, serial_number, customer_id, customers(name))")
        .order("repair_date", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as RepairPick[];
    },
  });

  const repairMatches = useMemo(() => {
    const kw = repairSearch.trim().toLowerCase();
    const list = kw
      ? repairOptions.filter((r) =>
          [
            r.machines?.customers?.name,
            r.machines?.model_name,
            r.machines?.serial_number,
            r.technician,
            r.repair_content,
            r.repair_date,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(kw),
        )
      : repairOptions;
    return list.slice(0, 50);
  }, [repairOptions, repairSearch]);


  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["error-code-log"],
    queryFn: () =>
      fetchAllRows<Row>((from, to) =>
        supabase
          .from("repair_error_codes" as any)
          .select(
            "*, repairs(id, repair_date, technician, repair_content, machines(id, model_name, serial_number, customer_id, customers(name)))",
          )
          .order("created_at", { ascending: false })
          .range(from, to) as any,
      ),
  });

  const lookup = useMemo(() => buildRecordIndex(rows), [rows]);
  const recordCount = useCallback((e: CatalogEntry) => lookup(e.code).length, [lookup]);
  const detailRecords = useMemo(() => (detail ? lookup(detail.code) : []), [detail, lookup]);
  const siblings = useMemo(
    () => (detail ? catalog.filter((c) => c.id !== detail.id && errorCodeMatches(c.code, detail.code)) : []),
    [catalog, detail],
  );
  const openRecordCode = (code: string) => {
    const hit = catalog.find((c) => errorCodeMatches(c.code, code));
    if (hit) setDetail(hit);
    else toast({ title: "매뉴얼에 없는 코드입니다", description: `${code} — 코드를 다시 확인해 보세요.` });
  };
  const startAdd = (code: string) => {
    setPendingCode(code);
    setDetail(null);
    setRepairSearch("");
    setPickerOpen(true);
  };

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            에러코드
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            얀마 TTS 2025·QR 자료의 전체 에러코드 {catalog.length.toLocaleString()}개. 코드를 누르면 매뉴얼 조치와 우리 수리 기록(누가·언제·어떤 기계·어떻게)을 함께 봅니다.
          </p>
        </div>
        <Button className="shrink-0 gap-1.5 w-full sm:w-auto" onClick={() => startAdd("")}>
          <Plus className="h-4 w-4" /> 에러코드 등록
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-full sm:w-auto sm:inline-grid">
          <TabsTrigger value="catalog" className="gap-1.5"><BookOpen className="h-4 w-4" /> 전체 에러코드</TabsTrigger>
          <TabsTrigger value="records" className="gap-1.5"><ClipboardList className="h-4 w-4" /> 수리 기록 {rows.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <ErrorCodeCatalogList entries={catalog} loading={catalogLoading} recordCount={recordCount} onOpen={setDetail} />
        </TabsContent>

        <TabsContent value="records" className="mt-4 space-y-5">
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
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground text-sm">기록된 에러코드가 없습니다.</p>
            <Button className="gap-1.5" onClick={() => startAdd("")}>
              <Plus className="h-4 w-4" /> 에러코드 등록
            </Button>
          </CardContent>
        </Card>

      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => (
            <Card key={r.id} className="shadow-card border-0">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => openRecordCode(r.error_code)} title="매뉴얼 설명 보기">
                    <Badge variant="outline" className="font-mono hover:border-primary hover:text-primary cursor-pointer">{r.error_code}</Badge>
                  </button>
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

                {r.symptom && <p className="text-sm whitespace-pre-wrap break-words"><span className="text-muted-foreground">증상 </span>{r.symptom}</p>}
                {r.action_taken && <p className="text-sm whitespace-pre-wrap break-words"><span className="text-muted-foreground">조치 방법 </span>{r.action_taken}</p>}
                {r.notes && <p className="text-xs text-muted-foreground break-words">{r.notes}</p>}
                <ErrorCodePhotos paths={r.photo_paths ?? []} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

        </TabsContent>
      </Tabs>

      <ErrorCodeDetailDialog
        entry={detail}
        siblings={siblings}
        records={detailRecords}
        onOpenChange={(v) => { if (!v) setDetail(null); }}
        onPickSibling={setDetail}
        onAddRecord={startAdd}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              수리 이력 선택
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            {pendingCode ? <><span className="font-mono text-foreground">{pendingCode}</span> 코드를 </> : "에러코드는 "}수리 이력에 연결해 저장합니다. 해당 작업을 찾아 선택해 주세요.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={repairSearch}
              onChange={(e) => setRepairSearch(e.target.value)}
              placeholder="고객 · 기계 · 제조번호 · 담당 검색"
              className="pl-9"
            />
          </div>
          {repairsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : repairMatches.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {repairOptions.length === 0
                ? "아직 수리 이력이 없습니다."
                : "검색 결과가 없습니다. 다른 단어로 찾아 보세요."}
              <Link to="/repairs" className="block mt-2 text-primary underline">
                수리이력에서 먼저 등록
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {repairMatches.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left rounded-lg border border-border bg-card hover:border-primary/60 px-3 py-2.5 min-h-[52px]"
                  onClick={() => {
                    setPickedRepair(r);
                    setPickerOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-medium text-sm truncate">
                      {r.machines?.model_name || "기계 미지정"}
                    </span>
                    {r.machines?.serial_number && (
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        {r.machines.serial_number}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {formatDate(r.repair_date)} · {r.machines?.customers?.name || "고객 미지정"} ·{" "}
                    {r.technician || "담당 미지정"}
                  </p>
                  {r.repair_content && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.repair_content}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RepairErrorCodeDialog
        open={!!pickedRepair}
        onOpenChange={(v) => {
          if (!v) setPickedRepair(null);
        }}
        repair={pickedRepair}
        initialCode={pendingCode}
      />
    </div>
  );

}
