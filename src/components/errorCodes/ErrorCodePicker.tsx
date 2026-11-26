import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAllRows } from "@/lib/pagination";
import { parseErrorCodes, errorCodeMatches } from "@/lib/errorCodes";
import { searchCatalogForMachine, type CatalogEntry } from "@/lib/errorCodeCatalog";

/** 고장 매뉴얼(error_code_catalog) 전체. 에러코드 화면과 같은 캐시를 쓴다. */
export function useErrorCodeCatalog(enabled = true) {
  return useQuery<CatalogEntry[]>({
    queryKey: ["error-code-catalog"],
    enabled,
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
}

export type PickedErrorCode = { code: string; entry?: CatalogEntry | null };

/**
 * 수리 등록 때 에러코드 고르기: 코드 조각(03B00)·부품·증상(DPF)으로 매뉴얼을 찾아 누르면 담기고,
 * 매뉴얼에 없는 코드는 그대로 적어 Enter(또는 「추가」). 고른 기계 모델의 코드가 먼저 나온다.
 */
export function ErrorCodePicker({ value, onChange, machineModel, machineType }: {
  value: PickedErrorCode[];
  onChange: (v: PickedErrorCode[]) => void;
  machineModel?: string | null;
  machineType?: string | null;
}) {
  const [q, setQ] = useState("");
  const { data: catalog = [], isLoading } = useErrorCodeCatalog();
  const results = useMemo(() => searchCatalogForMachine(catalog, q, machineModel, machineType, 10), [catalog, q, machineModel, machineType]);
  const has = (code: string) => value.some((v) => v.code === code);

  const add = (items: PickedErrorCode[]) => {
    const next = [...value];
    for (const it of items) if (!next.some((v) => v.code === it.code)) next.push(it);
    onChange(next);
    setQ("");
  };
  /** 직접 적은 코드: 매뉴얼에 같은 코드가 있으면 그 설명을 붙인다 */
  const addTyped = () => {
    const codes = parseErrorCodes(q);
    if (!codes.length) return;
    add(codes.map((code) => ({ code, entry: catalog.find((e) => errorCodeMatches(e.code, code)) ?? null })));
  };

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9"
            placeholder={isLoading ? "매뉴얼 불러오는 중…" : "코드나 증상으로 검색 (예: 03B00, DPF)"}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (results.length === 1) add([{ code: results[0].entry.code, entry: results[0].entry }]); else addTyped(); } }} />
        </div>
        <Button type="button" variant="outline" className="shrink-0 gap-1" disabled={!q.trim()} onClick={addTyped}><Plus className="h-4 w-4" />직접 추가</Button>
      </div>

      {q.trim() && (
        <div className="rounded-xl border max-h-64 overflow-y-auto divide-y">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">매뉴얼에 없는 코드예요. 「직접 추가」로 그대로 넣을 수 있어요.</p>
          ) : results.map(({ entry, fit }) => {
            const on = has(entry.code);
            return (
              <button key={entry.id} type="button" disabled={on} onClick={() => add([{ code: entry.code, entry }])}
                className={cn("w-full text-left px-3 py-2 hover:bg-muted/60 disabled:opacity-50", fit >= 2 && "bg-primary/[0.04]")}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{entry.code}</span>
                  {fit >= 2 && <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5">이 기계</span>}
                  {on && <span className="text-[10px] text-muted-foreground">담음</span>}
                  <span className="ml-auto text-[11px] text-muted-foreground truncate max-w-[45%]">{entry.series}</span>
                </div>
                {(entry.part || entry.symptom) && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{entry.part || entry.symptom}</p>}
              </button>
            );
          })}
        </div>
      )}

      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((v) => (
            <li key={v.code} className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-semibold">{v.code}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {v.entry ? [v.entry.part, v.entry.series].filter(Boolean).join(" · ") : "매뉴얼에 없는 코드 (직접 입력)"}
                </p>
              </div>
              <button type="button" onClick={() => onChange(value.filter((x) => x.code !== v.code))} className="h-7 w-7 -mr-1 rounded-full flex items-center justify-center hover:bg-background/60" aria-label={`${v.code} 빼기`}>
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
