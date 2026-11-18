import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Wrench } from "lucide-react";
import { MACHINE_TYPES, catalogHaystack, matchesCatalogQuery, type CatalogEntry } from "@/lib/errorCodeCatalog";

type Props = {
  entries: CatalogEntry[];
  loading: boolean;
  recordCount: (entry: CatalogEntry) => number;
  onOpen: (entry: CatalogEntry) => void;
};

const STEP = 80;

export default function ErrorCodeCatalogList({ entries, loading, recordCount, onOpen }: Props) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("전체");
  const [series, setSeries] = useState<string>("전체");
  const [onlyRecorded, setOnlyRecorded] = useState(false);
  const [limit, setLimit] = useState(STEP);
  const sentinel = useRef<HTMLDivElement>(null);

  const indexed = useMemo(() => entries.map((e) => ({ e, hay: catalogHaystack(e), n: recordCount(e) })), [entries, recordCount]);
  const seriesOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => { if (type === "전체" || e.machine_types.includes(type)) set.add(e.series); });
    return [...set];
  }, [entries, type]);

  const filtered = useMemo(() => {
    const list = indexed.filter(({ e, hay, n }) => {
      if (type !== "전체" && !e.machine_types.includes(type)) return false;
      if (series !== "전체" && e.series !== series) return false;
      if (onlyRecorded && n === 0) return false;
      return matchesCatalogQuery(hay, q);
    });
    // 우리 수리 기록이 있는 코드를 먼저
    return onlyRecorded ? [...list].sort((a, b) => b.n - a.n) : list;
  }, [indexed, type, series, onlyRecorded, q]);

  useEffect(() => setLimit(STEP), [q, type, series, onlyRecorded]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((items) => {
      if (items.some((i) => i.isIntersecting)) setLimit((l) => l + STEP);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const recordedCodes = indexed.filter((i) => i.n > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {["전체", ...MACHINE_TYPES].map((t) => (
          <Button
            key={t}
            size="sm"
            variant={type === t ? "default" : "outline"}
            className="h-8"
            onClick={() => { setType(t); setSeries("전체"); }}
          >
            {t}
          </Button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="코드·부위·증상 (예: 04610, C1-220)"
            className="pl-9"
            inputMode="search"
          />
        </div>
        <Select value={series} onValueChange={setSeries}>
          <SelectTrigger className="sm:w-72"><SelectValue placeholder="기종 자료" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="전체">모든 기종 자료</SelectItem>
            {seriesOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        <span>{loading ? "불러오는 중…" : `${filtered.length.toLocaleString()}개 코드`}</span>
        <label className="flex items-center gap-1.5 cursor-pointer text-sm text-foreground">
          <Checkbox checked={onlyRecorded} onCheckedChange={(v) => setOnlyRecorded(!!v)} />
          우리가 수리한 코드만 ({recordedCodes})
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-card border-0">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            찾는 코드가 없습니다. 코드 뒷자리만 넣어 보거나 기종을 「전체」로 바꿔 보세요.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-1.5">
          {filtered.slice(0, limit).map(({ e, n }) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e)}
              className="w-full text-left rounded-xl border border-border bg-card hover:border-primary/60 px-3 py-2.5 min-h-[56px] transition-colors"
            >
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-mono font-semibold text-sm">{e.code}</span>
                <span className="text-xs text-muted-foreground truncate">{e.series}</span>
                <span className="flex-1" />
                {n > 0 && (
                  <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-400/40 shrink-0">
                    <Wrench className="h-3 w-3" /> 수리 {n}건
                  </Badge>
                )}
              </div>
              <p className="text-sm mt-0.5 line-clamp-1">{e.part || e.cause || e.symptom}</p>
              {e.symptom && e.part && <p className="text-xs text-muted-foreground line-clamp-1">{e.symptom}</p>}
            </button>
          ))}
          <div ref={sentinel} className="h-1" />
        </div>
      )}
    </div>
  );
}
