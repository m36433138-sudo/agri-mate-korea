import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BookOpen, CheckCircle2, ExternalLink, Plus, User, Wrench } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import ErrorCodePhotos from "@/components/ErrorCodePhotos";
import type { CatalogEntry } from "@/lib/errorCodeCatalog";
import type { ErrorCodeLogRow } from "./types";

type Props = {
  entry: CatalogEntry | null;
  /** 같은 코드가 다른 기종 자료에도 있을 때 */
  siblings: CatalogEntry[];
  records: ErrorCodeLogRow[];
  onOpenChange: (open: boolean) => void;
  onPickSibling: (entry: CatalogEntry) => void;
  onAddRecord: (code: string) => void;
};

function Field({ label, value, tone }: { label: string; value: string | null; tone?: "remedy" }) {
  if (!value) return null;
  return (
    <div className={tone === "remedy" ? "rounded-xl border border-primary/30 bg-primary/5 p-3" : ""}>
      <p className={`text-xs mb-0.5 ${tone === "remedy" ? "text-primary font-medium" : "text-muted-foreground"}`}>{label}</p>
      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{value}</p>
    </div>
  );
}

export default function ErrorCodeDetailDialog({ entry, siblings, records, onOpenChange, onPickSibling, onAddRecord }: Props) {
  const sorted = [...records].sort((a, b) =>
    (b.repairs?.repair_date ?? b.created_at).localeCompare(a.repairs?.repair_date ?? a.created_at),
  );
  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-2xl max-h-[90dvh] overflow-y-auto">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                <span className="font-mono">{entry.code}</span>
              </DialogTitle>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {entry.machine_types.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                <Badge variant="outline">{entry.series}</Badge>
                {entry.controller && <Badge variant="outline" className="text-muted-foreground">{entry.controller}</Badge>}
              </div>
            </DialogHeader>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-primary" /> 매뉴얼 설명
              </h3>
              <Field label="고장 부위 · 에러 명칭" value={entry.part} />
              <Field label="원인 · 검출 조건" value={entry.cause} />
              <Field label="고장 현상 · 기계 동작" value={entry.symptom} />
              <Field label="점검 · 조치 방법" value={entry.remedy} tone="remedy" />
              <Field label="복귀 조건" value={entry.recovery} />
              <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                출처: {entry.source}
                {entry.source_url && (
                  <a href={entry.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary underline">
                    원본 자료 <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
              {siblings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">다른 기종 자료에도 같은 코드가 있습니다</p>
                  <div className="flex flex-wrap gap-1.5">
                    {siblings.map((s) => (
                      <Button key={s.id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => onPickSibling(s)}>
                        {s.series}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 flex-1">
                  <Wrench className="h-4 w-4 text-primary" /> 우리 수리 기록 {sorted.length}건
                </h3>
                <Button size="sm" className="gap-1" onClick={() => onAddRecord(entry.code)}>
                  <Plus className="h-4 w-4" /> 기록 추가
                </Button>
              </div>
              {sorted.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  아직 이 코드로 수리한 기록이 없습니다. 수리하면 「기록 추가」로 남겨 주세요.
                </p>
              ) : (
                <div className="space-y-2">
                  {sorted.map((r) => {
                    const m = r.repairs?.machines;
                    return (
                      <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="font-semibold tabular-nums">{r.repairs ? formatDate(r.repairs.repair_date) : formatDate(r.created_at)}</span>
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <User className="h-3.5 w-3.5" /> {r.repairs?.technician || "담당 미지정"}
                          </span>
                          <span className="flex-1" />
                          {r.is_resolved ? (
                            <Badge variant="outline" className="gap-1 text-emerald-400 border-emerald-400/40">
                              <CheckCircle2 className="h-3 w-3" /> 해결
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-400 border-amber-400/40">미해결</Badge>
                          )}
                        </div>
                        <div className="text-sm">
                          {m ? (
                            <Link to={`/machines/${m.id}`} className="font-medium hover:text-primary">
                              {m.model_name}
                              {m.serial_number && <span className="ml-1 font-mono text-xs text-muted-foreground">{m.serial_number}</span>}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">기계 미지정</span>
                          )}
                          {m?.customers?.name && (
                            <>
                              <span className="text-muted-foreground mx-1">·</span>
                              <Link to={`/customers/${m.customer_id}`} className="text-muted-foreground hover:text-primary">{m.customers.name}</Link>
                            </>
                          )}
                          {r.error_code && <span className="ml-2 font-mono text-xs text-muted-foreground">({r.error_code})</span>}
                        </div>
                        {r.symptom && <p className="text-sm break-words"><span className="text-muted-foreground">증상 </span>{r.symptom}</p>}
                        {r.action_taken ? (
                          <p className="text-sm whitespace-pre-wrap break-words rounded-lg bg-emerald-950/40 border border-emerald-400/20 px-2.5 py-1.5">
                            <span className="text-emerald-400 font-medium">해결 방법 </span>{r.action_taken}
                          </p>
                        ) : r.repairs?.repair_content ? (
                          <p className="text-sm break-words"><span className="text-muted-foreground">수리 내용 </span>{r.repairs.repair_content}</p>
                        ) : null}
                        {r.notes && <p className="text-xs text-muted-foreground break-words">{r.notes}</p>}
                        <ErrorCodePhotos paths={r.photo_paths ?? []} />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
