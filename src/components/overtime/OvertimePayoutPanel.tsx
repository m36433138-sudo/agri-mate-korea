import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PenLine, RefreshCw, CheckCircle2, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type SheetRow = {
  rowIndex: number;
  name: string;
  periodStart: string;
  periodEnd: string;
  hours: number | null;
  amount: number | null;
  bonus: number | null;
  total: number | null;
  paidChecked: boolean;
  signedChecked: boolean;
};

type SignatureRecord = {
  id: string;
  sheet_tab: string;
  row_index: number;
  employee_name: string;
  signature_data: string | null;
  signed_at: string | null;
  is_paid: boolean;
  paid_at: string | null;
};

const won = (v: number | null) =>
  v == null || Number.isNaN(v) ? "-" : `${Math.round(v).toLocaleString("ko-KR")}원`;

const cellText = (v: unknown) => {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  return String(v).trim();
};

const cellNumber = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const isTruthyCheck = (v: unknown) => {
  const s = cellText(v).toUpperCase();
  return s === "TRUE" || s === "Y" || s === "1" || v === true;
};

// Normalize sheet date cells ("2026. 6. 27", "9-18", "20260919") to "2026.06.27"
const formatSheetDate = (raw: string, refYear?: number): string => {
  const s = raw.trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (m) return `${m[1]}.${m[2].padStart(2, "0")}.${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  m = s.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
  if (m) {
    const y = refYear ?? new Date().getFullYear();
    return `${y}.${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}`;
  }
  return s;
};

// ── Signature canvas ──
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
    onChange(canvasRef.current?.toDataURL("image/png") ?? null);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-40 w-full touch-none rounded-lg border bg-muted"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>손가락이나 펜으로 서명해 주세요.</span>
        <Button type="button" size="sm" variant="ghost" onClick={clear}>
          다시 서명
        </Button>
      </div>
    </div>
  );
}

const PAYOUT_PASSCODE = "828256";
const UNLOCK_KEY = "overtime-payout-unlocked";

export default function OvertimePayoutPanel({
  isAdmin,
  myName,
}: {
  isAdmin: boolean;
  myName?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("");
  const [signTarget, setSignTarget] = useState<SheetRow | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [unlocked, setUnlocked] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(UNLOCK_KEY) === "1",
  );
  const [passcode, setPasscode] = useState("");
  const [passError, setPassError] = useState(false);

  const tryUnlock = () => {
    if (passcode.trim() === PAYOUT_PASSCODE) {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      setUnlocked(true);
      setPasscode("");
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  const tabsQuery = useQuery({
    queryKey: ["hr-overtime-tabs"],
    enabled: unlocked,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("hr-overtime-sheet", {
        body: { action: "listTabs" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.tabs ?? []) as string[];
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    const tabs = tabsQuery.data;
    if (tabs && tabs.length > 0 && !tab) setTab(tabs[tabs.length - 1]);
  }, [tabsQuery.data, tab]);

  const rowsQuery = useQuery({
    queryKey: ["hr-overtime-rows", tab],
    enabled: !!tab && unlocked,
    staleTime: 2 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("hr-overtime-sheet", {
        body: { action: "readRows", tab },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const values = (data?.values ?? []) as unknown[][];
      const rows: SheetRow[] = [];
      values.forEach((raw, idx) => {
        const name = cellText(raw?.[0]);
        if (!name || name === "기사 이름" || name.includes("총합")) return;
        const startRaw = cellText(raw?.[1]);
        const endRaw = cellText(raw?.[2]);
        const refYear = Number(startRaw.match(/^\d{4}/)?.[0]) || undefined;
        rows.push({
          rowIndex: idx + 1,
          name,
          periodStart: formatSheetDate(startRaw),
          periodEnd: formatSheetDate(endRaw, refYear),
          hours: cellNumber(raw?.[3]),
          amount: cellNumber(raw?.[4]),
          bonus: cellNumber(raw?.[5]),
          total: cellNumber(raw?.[6]),
          paidChecked: isTruthyCheck(raw?.[7]),
          signedChecked: isTruthyCheck(raw?.[8]),
        });
      });
      return rows;
    },
  });

  const sigQuery = useQuery({
    queryKey: ["hr-overtime-signatures", tab],
    enabled: !!tab && unlocked,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("overtime_payout_signatures")
        .select("id, sheet_tab, row_index, employee_name, signature_data, signed_at, is_paid, paid_at")
        .eq("sheet_tab", tab);
      if (error) throw error;
      return (data ?? []) as SignatureRecord[];
    },
  });

  const sigByRow = useMemo(() => {
    const map = new Map<number, SignatureRecord>();
    (sigQuery.data ?? []).forEach((s) => map.set(s.row_index, s));
    return map;
  }, [sigQuery.data]);

  const visibleRows = useMemo(() => {
    const rows = rowsQuery.data ?? [];
    if (isAdmin) return rows;
    if (!myName) return [];
    return rows.filter((r) => r.name === myName);
  }, [rowsQuery.data, isAdmin, myName]);

  const canSign = (row: SheetRow) => isAdmin || row.name === myName;

  const handleSave = async () => {
    if (!signTarget || !signature) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const nowIso = new Date().toISOString();

      const { error: dbError } = await (supabase as any)
        .from("overtime_payout_signatures")
        .upsert(
          {
            sheet_tab: tab,
            row_index: signTarget.rowIndex,
            employee_name: signTarget.name,
            period_start: signTarget.periodStart || null,
            period_end: signTarget.periodEnd || null,
            hours: signTarget.hours,
            overtime_amount: signTarget.amount,
            bonus_amount: signTarget.bonus,
            total_amount: signTarget.total,
            signature_data: signature,
            signed_by: auth?.user?.id ?? null,
            signed_at: nowIso,
            is_paid: true,
            paid_at: nowIso,
          },
          { onConflict: "sheet_tab,row_index" },
        );
      if (dbError) throw dbError;

      const { data: sheetRes, error: sheetError } = await supabase.functions.invoke("hr-overtime-sheet", {
        body: { action: "markPaidAndSigned", tab, rowIndex: signTarget.rowIndex, paid: true, signed: true },
      });
      if (sheetError || sheetRes?.error) {
        toast({
          title: "서명은 저장됐지만 구글시트 반영 실패",
          description: sheetRes?.error || sheetError?.message || "시트 접근 권한을 확인해 주세요.",
          variant: "destructive",
        });
      } else {
        await (supabase as any)
          .from("overtime_payout_signatures")
          .update({ sheet_synced_at: new Date().toISOString() })
          .eq("sheet_tab", tab)
          .eq("row_index", signTarget.rowIndex);
        toast({ title: "서명 완료", description: `${signTarget.name} 지급·사인 칸이 체크되었습니다.` });
      }

      setSignTarget(null);
      setSignature(null);
      queryClient.invalidateQueries({ queryKey: ["hr-overtime-rows", tab] });
      queryClient.invalidateQueries({ queryKey: ["hr-overtime-signatures", tab] });
    } catch (err: unknown) {
      toast({
        title: "저장 실패",
        description: err instanceof Error ? err.message : "알 수 없는 오류",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const errorMessage =
    (tabsQuery.error instanceof Error && tabsQuery.error.message) ||
    (rowsQuery.error instanceof Error && rowsQuery.error.message) ||
    null;

  if (!unlocked) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5" /> 초과수당 지급·서명
          </CardTitle>
        </CardHeader>
        <CardContent className="max-w-sm space-y-3">
          <p className="text-sm text-muted-foreground">
            민감한 금액 정보입니다. 비밀번호를 입력하면 내역이 표시됩니다.
          </p>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="비밀번호"
            value={passcode}
            onChange={(e) => { setPasscode(e.target.value); setPassError(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") tryUnlock(); }}
          />
          {passError && <p className="text-xs text-destructive">비밀번호가 올바르지 않습니다.</p>}
          <Button onClick={tryUnlock} disabled={!passcode.trim()}>확인</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSignature className="h-5 w-5" /> 초과수당 지급·서명
          </CardTitle>
          <div className="flex items-center gap-2">
            {(tabsQuery.data?.length ?? 0) > 0 && (
              <Select value={tab} onValueChange={setTab}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="기간 선택" />
                </SelectTrigger>
                <SelectContent>
                  {(tabsQuery.data ?? []).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["hr-overtime-rows", tab] });
                queryClient.invalidateQueries({ queryKey: ["hr-overtime-signatures", tab] });
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" /> 새로고침
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {errorMessage ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            인사관리 시트를 읽을 수 없습니다. 시트 연결 설정을 확인해 주세요.
            <span className="mt-1 block text-xs">{errorMessage}</span>
          </p>
        ) : tabsQuery.isLoading || rowsQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : visibleRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">표시할 초과수당 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">기사</th>
                  <th className="py-2 pr-3">기간</th>
                  <th className="py-2 pr-3 text-right">시간</th>
                  <th className="py-2 pr-3 text-right">추가수당</th>
                  <th className="py-2 pr-3 text-right">보너스</th>
                  <th className="py-2 pr-3 text-right">총 금액</th>
                  <th className="py-2 pr-3">상태</th>
                  <th className="py-2 pr-3">서명</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const sig = sigByRow.get(row.rowIndex);
                  const done = row.signedChecked || !!sig?.signed_at;
                  return (
                    <tr key={row.rowIndex} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 pr-3 font-semibold">{row.name}</td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {row.periodStart || "-"} ~ {row.periodEnd || "-"}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{row.hours ?? "-"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{won(row.amount)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{won(row.bonus)}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{won(row.total)}</td>
                      <td className="py-2.5 pr-3">
                        {done ? (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> 지급완료
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/30 text-amber-400">미지급</Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {sig?.signature_data ? (
                          <img
                            src={sig.signature_data}
                            alt={`${row.name} 서명`}
                            className="h-10 rounded border bg-muted p-1"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">미서명</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {canSign(row) && (
                          <Button
                            size="sm"
                            variant={done ? "outline" : "default"}
                            onClick={() => { setSignTarget(row); setSignature(null); }}
                          >
                            <PenLine className="mr-1 h-4 w-4" />
                            {done ? "다시 서명" : "서명받기"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!signTarget} onOpenChange={(open) => { if (!open) { setSignTarget(null); setSignature(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{signTarget?.name} 초과수당 수령 확인</DialogTitle>
            <DialogDescription>
              {signTarget?.periodStart} ~ {signTarget?.periodEnd} · 총 {won(signTarget?.total ?? null)}
            </DialogDescription>
          </DialogHeader>
          <SignaturePad onChange={setSignature} />
          <p className="text-xs text-muted-foreground">
            서명을 저장하면 인사관리 시트의 지급 여부·사인 여부 칸이 자동으로 체크됩니다.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSignTarget(null); setSignature(null); }} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={!signature || saving}>
              {saving ? "저장 중..." : "서명 저장 및 지급 처리"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
