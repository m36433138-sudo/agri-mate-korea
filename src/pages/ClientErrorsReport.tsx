import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Network,
  Terminal,
  Trash2,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  subscribeDiag,
  clearDiagEntries,
  type DiagEntry,
  type DiagEntryType,
} from "@/lib/clientDiagnostics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TYPE_META: Record<DiagEntryType, { label: string; icon: typeof AlertCircle; color: string }> = {
  error: { label: "JS 오류", icon: AlertCircle, color: "text-red-400" },
  promise: { label: "Promise 거부", icon: AlertTriangle, color: "text-orange-400" },
  console: { label: "console.error", icon: Terminal, color: "text-yellow-400" },
  network: { label: "네트워크", icon: Network, color: "text-blue-400" },
};

const FILTERS: Array<{ key: "all" | DiagEntryType; label: string }> = [
  { key: "all", label: "전체" },
  { key: "error", label: "JS 오류" },
  { key: "promise", label: "Promise" },
  { key: "console", label: "콘솔" },
  { key: "network", label: "네트워크" },
];

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", { hour12: false });
}

export default function ClientErrorsReport() {
  const [entries, setEntries] = useState<DiagEntry[]>([]);
  const [filter, setFilter] = useState<"all" | DiagEntryType>("all");
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeDiag(setEntries), []);

  const filtered = useMemo(() => {
    const list = filter === "all" ? entries : entries.filter((e) => e.type === filter);
    return list.slice().reverse(); // 최신 위로
  }, [entries, filter, tick]);

  const counts = useMemo(() => {
    const c = { all: entries.length, error: 0, promise: 0, console: 0, network: 0 };
    entries.forEach((e) => {
      c[e.type] += 1;
    });
    return c;
  }, [entries]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `client-diagnostics-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">클라이언트 진단</h1>
          <p className="text-sm text-muted-foreground mt-1">
            화면 로딩 중 발생한 JS 오류, Promise 거부, console.error, 네트워크 실패를 자동 수집합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> 새로고침
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> JSON 내보내기
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearDiagEntries}
            disabled={entries.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> 비우기
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border/60 hover:bg-accent/40"
            }`}
          >
            {f.label} <span className="ml-1 opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">수집된 항목이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const meta = TYPE_META[e.type];
            const Icon = meta.icon;
            return (
              <div
                key={e.id}
                className="rounded-xl border border-border/60 bg-card p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                    <Badge variant="outline" className="text-[10px]">
                      {meta.label}
                    </Badge>
                    {e.status ? (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        HTTP {e.status}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatTime(e.timestamp)}
                  </span>
                </div>
                <p className="text-sm font-mono break-all whitespace-pre-wrap">{e.message}</p>
                {e.url && (
                  <p className="text-xs text-muted-foreground font-mono break-all">{e.url}</p>
                )}
                {e.detail && (
                  <p className="text-xs text-muted-foreground font-mono break-all">{e.detail}</p>
                )}
                {e.stack && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      스택 보기
                    </summary>
                    <pre className="mt-2 p-3 rounded-lg bg-muted/30 overflow-x-auto text-[11px] leading-relaxed">
                      {e.stack}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
