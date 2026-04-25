import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, FileWarning } from "lucide-react";

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
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  entries: Entry[];
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

export default function RealtimeRlsReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/realtime-rls-report.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Report;
      setReport(json);
    } catch (e: any) {
      setFetchError(e?.message ?? String(e));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> 리포트 로드 중…
      </div>
    );
  }

  if (fetchError || !report) {
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
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />다시 시도</Button>
      </div>
    );
  }

  const failed = report.entries.filter((e) => !e.passed);
  const passed = report.entries.filter((e) => e.passed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Realtime RLS 테스트 리포트</h1>
          <p className="text-sm text-muted-foreground mt-1">
            생성: {new Date(report.generatedAt).toLocaleString("ko-KR")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />새로고침
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">전체</div>
            <div className="text-3xl font-bold mt-1">{report.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />통과</div>
            <div className="text-3xl font-bold mt-1 text-emerald-300">{report.passed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-rose-400 flex items-center gap-1"><XCircle className="h-4 w-4" />실패</div>
            <div className="text-3xl font-bold mt-1 text-rose-300">{report.failed}</div>
          </CardContent>
        </Card>
      </div>

      {/* 실패 항목 */}
      {failed.length > 0 && (
        <Card className="border-rose-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-300">
              <AlertTriangle className="h-5 w-5" /> 실패 항목 ({failed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {failed.map((e, i) => (
              <div key={i} className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="font-medium">{e.testName}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={ROLE_TONE[e.role]}>{e.role}</Badge>
                    {e.cause && (
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
                </div>
                {e.detail && (
                  <div className="text-sm text-rose-200/90">
                    <span className="text-rose-400/80">원인:</span> {e.detail}
                  </div>
                )}
                {e.nextAction && (
                  <div className="text-sm rounded-md bg-background/40 p-2 border border-border/50">
                    <span className="text-emerald-400 font-semibold">다음 액션 →</span> {e.nextAction}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 통과 항목 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="h-5 w-5" /> 통과 항목 ({passed.length})
          </CardTitle>
        </CardHeader>
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
