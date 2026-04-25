import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, FileWarning, ArrowRight, Minus } from "lucide-react";

type Outcome = "subscribed" | "blocked" | "error";
type Cause =
  | "LOGIN_FAILED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED"
  | "UNEXPECTED_SUBSCRIBE"
  | "UNEXPECTED_BLOCK"
  | "MISSING_CREDENTIALS"
  | "UNKNOWN";

interface Entry {
  testName: string;
  role: "admin" | "employee" | "customer";
  topic: string;
  expected: "subscribed" | "blocked";
  actual: Outcome;
  passed: boolean;
  cause?: Cause;
  detail?: string;
  nextAction?: string;
  durationMs: number;
  timestamp: string;
}

interface Report {
  id?: string;
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  entries: Entry[];
}

interface IndexItem {
  id: string;
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
}

const ROLE_TONE: Record<Entry["role"], string> = {
  admin: "bg-violet-950/60 text-violet-300 border-violet-800/40",
  employee: "bg-emerald-950/60 text-emerald-300 border-emerald-800/40",
  customer: "bg-sky-950/60 text-sky-300 border-sky-800/40",
};

const CAUSE_LABEL: Record<Cause, string> = {
  LOGIN_FAILED: "로그인 실패",
  CHANNEL_ERROR: "채널 거부 (RLS)",
  TIMED_OUT: "응답 시간 초과",
  CLOSED: "WebSocket 종료",
  UNEXPECTED_SUBSCRIBE: "예상치 못한 허용 (보안)",
  UNEXPECTED_BLOCK: "예상치 못한 차단",
  MISSING_CREDENTIALS: "테스트 자격증명 누락",
  UNKNOWN: "원인 불명",
};

const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR");

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function EntryCard({ e }: { e: Entry }) {
  const tone = e.passed ? "border-border/50 bg-card" : "border-rose-900/40 bg-rose-950/20";
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${tone}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="font-medium flex items-center gap-2">
          {e.passed
            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            : <XCircle className="h-4 w-4 text-rose-400" />}
          {e.testName}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={ROLE_TONE[e.role]}>{e.role}</Badge>
          {!e.passed && e.cause && (
            <Badge variant="outline" className="bg-rose-950/60 text-rose-300 border-rose-800/40">
              {CAUSE_LABEL[e.cause]}
            </Badge>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground font-mono">
        topic: <span className="text-foreground">{e.topic}</span>
        {"  ·  "}expected: <span className="text-foreground">{e.expected}</span>
        {"  ·  "}actual: <span className="text-foreground">{e.actual}</span>
        {"  ·  "}{e.durationMs}ms
      </div>
      {!e.passed && e.detail && (
        <div className="text-sm text-rose-200/90"><span className="text-rose-400/80">원인:</span> {e.detail}</div>
      )}
      {!e.passed && e.nextAction && (
        <div className="text-sm rounded-md bg-background/40 p-2 border border-border/50">
          <span className="text-emerald-400 font-semibold">다음 액션 →</span> {e.nextAction}
        </div>
      )}
    </div>
  );
}

function SingleReport({ report }: { report: Report }) {
  const failed = report.entries.filter((e) => !e.passed);
  const passed = report.entries.filter((e) => e.passed);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">전체</div><div className="text-3xl font-bold mt-1">{report.total}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />통과</div><div className="text-3xl font-bold mt-1 text-emerald-300">{report.passed}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-rose-400 flex items-center gap-1"><XCircle className="h-4 w-4" />실패</div><div className="text-3xl font-bold mt-1 text-rose-300">{report.failed}</div></CardContent></Card>
      </div>

      {failed.length > 0 && (
        <Card className="border-rose-900/50">
          <CardHeader><CardTitle className="flex items-center gap-2 text-rose-300"><AlertTriangle className="h-5 w-5" /> 실패 항목 ({failed.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">{failed.map((e, i) => <EntryCard key={i} e={e} />)}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-5 w-5" /> 통과 항목 ({passed.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-border/50">
            {passed.map((e, i) => (
              <div key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{e.testName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={ROLE_TONE[e.role]}>{e.role}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">{e.durationMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface DiffRow {
  testName: string;
  role: Entry["role"];
  topic: string;
  a?: Entry;
  b?: Entry;
  status: "same-pass" | "same-fail" | "regressed" | "fixed" | "only-a" | "only-b" | "changed";
}

function buildDiff(a: Report, b: Report): DiffRow[] {
  const key = (e: Entry) => `${e.role}|${e.testName}`;
  const ma = new Map(a.entries.map((e) => [key(e), e]));
  const mb = new Map(b.entries.map((e) => [key(e), e]));
  const keys = new Set([...ma.keys(), ...mb.keys()]);
  const rows: DiffRow[] = [];
  for (const k of keys) {
    const ea = ma.get(k);
    const eb = mb.get(k);
    const base = ea ?? eb!;
    let status: DiffRow["status"];
    if (ea && !eb) status = "only-a";
    else if (!ea && eb) status = "only-b";
    else if (ea!.passed && eb!.passed) status = "same-pass";
    else if (!ea!.passed && !eb!.passed) status = ea!.cause === eb!.cause ? "same-fail" : "changed";
    else if (ea!.passed && !eb!.passed) status = "regressed";
    else status = "fixed";
    rows.push({ testName: base.testName, role: base.role, topic: base.topic, a: ea, b: eb, status });
  }
  // 우선순위: regressed → fixed → changed → only-* → same-fail → same-pass
  const order: Record<DiffRow["status"], number> = {
    regressed: 0, fixed: 1, changed: 2, "only-a": 3, "only-b": 4, "same-fail": 5, "same-pass": 6,
  };
  rows.sort((x, y) => order[x.status] - order[y.status] || x.testName.localeCompare(y.testName));
  return rows;
}

const STATUS_BADGE: Record<DiffRow["status"], { label: string; cls: string }> = {
  regressed: { label: "회귀 (통과→실패)", cls: "bg-rose-950/60 text-rose-300 border-rose-800/40" },
  fixed: { label: "수정됨 (실패→통과)", cls: "bg-emerald-950/60 text-emerald-300 border-emerald-800/40" },
  changed: { label: "원인 변경", cls: "bg-amber-950/60 text-amber-300 border-amber-800/40" },
  "only-a": { label: "A에만 존재", cls: "bg-slate-800/60 text-slate-300 border-slate-700/40" },
  "only-b": { label: "B에만 존재", cls: "bg-slate-800/60 text-slate-300 border-slate-700/40" },
  "same-fail": { label: "동일 실패", cls: "bg-rose-950/40 text-rose-400/80 border-rose-900/30" },
  "same-pass": { label: "동일 통과", cls: "bg-emerald-950/30 text-emerald-400/70 border-emerald-900/30" },
};

function CompareView({ a, b }: { a: Report; b: Report }) {
  const rows = useMemo(() => buildDiff(a, b), [a, b]);
  const summary = useMemo(() => {
    const c = { regressed: 0, fixed: 0, changed: 0, "only-a": 0, "only-b": 0, "same-fail": 0, "same-pass": 0 };
    rows.forEach((r) => { c[r.status]++; });
    return c;
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">회귀</div><div className="text-2xl font-bold text-rose-300">{summary.regressed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">수정됨</div><div className="text-2xl font-bold text-emerald-300">{summary.fixed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">원인 변경</div><div className="text-2xl font-bold text-amber-300">{summary.changed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">A/B 단독</div><div className="text-2xl font-bold">{summary["only-a"] + summary["only-b"]}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <span className="text-muted-foreground">A:</span> {fmt(a.generatedAt)}
            <ArrowRight className="inline h-4 w-4 mx-2 text-muted-foreground" />
            <span className="text-muted-foreground">B:</span> {fmt(b.generatedAt)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="rounded-lg border border-border/50 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="font-medium text-sm">{r.testName}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={ROLE_TONE[r.role]}>{r.role}</Badge>
                    <Badge variant="outline" className={STATUS_BADGE[r.status].cls}>{STATUS_BADGE[r.status].label}</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono truncate">topic: <span className="text-foreground">{r.topic}</span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border/40 bg-background/30 p-2">
                    <div className="text-muted-foreground mb-1">A · {fmt(a.generatedAt)}</div>
                    {r.a ? (
                      <div className="space-y-1">
                        <div>actual: <span className="font-mono">{r.a.actual}</span> {r.a.passed ? "✓" : "✗"}</div>
                        {!r.a.passed && r.a.cause && <div>원인: {CAUSE_LABEL[r.a.cause]}</div>}
                        {!r.a.passed && r.a.detail && <div className="text-muted-foreground">{r.a.detail}</div>}
                      </div>
                    ) : <div className="text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" /> 없음</div>}
                  </div>
                  <div className="rounded-md border border-border/40 bg-background/30 p-2">
                    <div className="text-muted-foreground mb-1">B · {fmt(b.generatedAt)}</div>
                    {r.b ? (
                      <div className="space-y-1">
                        <div>actual: <span className="font-mono">{r.b.actual}</span> {r.b.passed ? "✓" : "✗"}</div>
                        {!r.b.passed && r.b.cause && <div>원인: {CAUSE_LABEL[r.b.cause]}</div>}
                        {!r.b.passed && r.b.detail && <div className="text-muted-foreground">{r.b.detail}</div>}
                      </div>
                    ) : <div className="text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" /> 없음</div>}
                  </div>
                </div>
                {r.status === "regressed" && r.b?.nextAction && (
                  <div className="text-xs rounded-md bg-background/40 p-2 border border-border/50">
                    <span className="text-emerald-400 font-semibold">다음 액션 →</span> {r.b.nextAction}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RealtimeRlsReport() {
  const [index, setIndex] = useState<IndexItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedA, setSelectedA] = useState<string>("");
  const [selectedB, setSelectedB] = useState<string>("");
  const [reportA, setReportA] = useState<Report | null>(null);
  const [reportB, setReportB] = useState<Report | null>(null);
  const [tab, setTab] = useState<"single" | "compare">("single");

  const loadIndex = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // 1) 인덱스 시도, 2) fallback: 최신 단일 파일
      let idx: IndexItem[] = [];
      try {
        idx = await fetchJson<IndexItem[]>("/realtime-rls-reports/index.json");
      } catch {
        const latest = await fetchJson<Report>("/realtime-rls-report.json");
        idx = [{
          id: latest.id ?? "latest",
          generatedAt: latest.generatedAt,
          total: latest.total, passed: latest.passed, failed: latest.failed,
        }];
      }
      setIndex(idx);
      if (idx.length > 0) {
        setSelectedA(idx[0].id);
        setSelectedB(idx[1]?.id ?? idx[0].id);
      }
    } catch (e: any) {
      setFetchError(e?.message ?? String(e));
      setIndex(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadIndex(); }, []);

  // selectedA 로드
  useEffect(() => {
    if (!selectedA || !index) return;
    const item = index.find((r) => r.id === selectedA);
    if (!item) return;
    const url = item.id === "latest" ? "/realtime-rls-report.json" : `/realtime-rls-reports/${item.id}.json`;
    fetchJson<Report>(url).then(setReportA).catch((e) => setFetchError(e.message));
  }, [selectedA, index]);

  useEffect(() => {
    if (!selectedB || !index) return;
    const item = index.find((r) => r.id === selectedB);
    if (!item) return;
    const url = item.id === "latest" ? "/realtime-rls-report.json" : `/realtime-rls-reports/${item.id}.json`;
    fetchJson<Report>(url).then(setReportB).catch((e) => setFetchError(e.message));
  }, [selectedB, index]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mr-2" /> 리포트 로드 중…</div>;
  }

  if (fetchError && !index) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Realtime RLS 테스트 리포트</h1>
        <Alert variant="destructive">
          <FileWarning className="h-4 w-4" />
          <AlertTitle>리포트를 불러올 수 없습니다</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>아직 e2e 테스트가 한 번도 실행되지 않았거나 리포트 파일이 누락되었습니다.</p>
            <p className="font-mono text-xs opacity-80">{fetchError}</p>
            <div className="mt-3 rounded-md bg-background/40 p-3 text-sm">
              <p className="font-semibold mb-1">다음 액션:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li><code className="text-foreground">bun scripts/seed-e2e-users.mjs &lt;password&gt;</code> 로 테스트 계정 시드</li>
                <li><code className="text-foreground">bunx vitest run src/test/realtime-rls.e2e.test.ts --no-file-parallelism</code> 실행</li>
                <li>완료 후 본 페이지를 새로고침</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={loadIndex}><RefreshCw className="h-4 w-4 mr-2" />다시 시도</Button>
      </div>
    );
  }

  const renderOption = (r: IndexItem) => (
    <SelectItem key={r.id} value={r.id}>
      {fmt(r.generatedAt)}  ·  {r.passed}/{r.total} 통과{r.failed ? ` · ${r.failed} 실패` : ""}
    </SelectItem>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Realtime RLS 테스트 리포트</h1>
          <p className="text-sm text-muted-foreground mt-1">{index?.length ?? 0}개 실행 기록 보관 중</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadIndex}><RefreshCw className="h-4 w-4 mr-2" />새로고침</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "single" | "compare")}>
        <TabsList>
          <TabsTrigger value="single">단일 리포트</TabsTrigger>
          <TabsTrigger value="compare" disabled={(index?.length ?? 0) < 2}>두 리포트 비교</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">실행 시각:</span>
            <Select value={selectedA} onValueChange={setSelectedA}>
              <SelectTrigger className="w-[360px]"><SelectValue /></SelectTrigger>
              <SelectContent>{index?.map(renderOption)}</SelectContent>
            </Select>
          </div>
          {reportA ? <SingleReport report={reportA} /> : <div className="text-muted-foreground">선택된 리포트 로드 중…</div>}
        </TabsContent>

        <TabsContent value="compare" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">A (이전):</span>
            <Select value={selectedB} onValueChange={setSelectedB}>
              <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>{index?.map(renderOption)}</SelectContent>
            </Select>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">B (이후):</span>
            <Select value={selectedA} onValueChange={setSelectedA}>
              <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>{index?.map(renderOption)}</SelectContent>
            </Select>
          </div>
          {reportA && reportB
            ? <CompareView a={reportB} b={reportA} />
            : <div className="text-muted-foreground">두 리포트를 선택하세요.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
