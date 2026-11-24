import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw, Send, Loader2, CheckCircle2, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type InboxRow = { id: string; received_at: string; result: string; raw_text: string | null; content_type: string | null; body_keys: string | null };

const RESULT: Record<string, { label: string; tone: string; hint?: string }> = {
  saved: { label: "저장됨", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  duplicate: { label: "이미 받음", tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300", hint: "같은 문자가 두 번 와서 한 번만 저장했어요" },
  not_deposit: { label: "입금 문자 아님", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", hint: "「입금」과 금액을 못 찾았어요. 내용이 문자 본문 그대로인지 확인하세요" },
  empty: { label: "내용 없음", tone: "bg-red-500/15 text-red-700 dark:text-red-300", hint: "본문이 비어 왔어요. 전달 앱의 「보낼 내용」에 문자 본문 변수를 넣어 주세요" },
  unauthorized: { label: "주소 틀림", tone: "bg-red-500/15 text-red-700 dark:text-red-300", hint: "예전 주소(키)로 왔어요. 휴대폰 앱에 지금 주소를 다시 넣어 주세요" },
  test: { label: "연결 시험", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  error: { label: "저장 실패", tone: "bg-red-500/15 text-red-700 dark:text-red-300" },
};
const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deposit-sms`;

export function DepositSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: token } = useQuery({
    queryKey: ["deposit-sms-token"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("deposit_sms_settings").select("token").eq("id", true).maybeSingle();
      if (error) throw error;
      return (data?.token as string) ?? null;
    },
  });
  const url = token ? `${BASE}?token=${token}` : "";
  const [testing, setTesting] = useState(false);

  // 서버가 받은 요청 기록 (휴대폰 앱은 「성공」이라는데 안 들어올 때 원인 확인용)
  const { data: inbox = [], isLoading: inboxLoading, refetch: refetchInbox } = useQuery<InboxRow[]>({
    queryKey: ["deposit-sms-inbox"],
    enabled: open,
    refetchInterval: open ? 10_000 : false,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("deposit_sms_inbox")
        .select("id, received_at, result, raw_text, content_type, body_keys").order("received_at", { ascending: false }).limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "[연결 시험] 관리 화면에서 보낸 시험 요청" }) });
      const j = await res.json().catch(() => ({}));
      toast(res.ok ? { title: "연결 정상", description: "서버가 받았어요. 아래 기록에 「연결 시험」이 떠요." } : { title: "연결 실패", description: j.error ?? `응답 ${res.status}`, variant: "destructive" });
      refetchInbox();
    } catch (e) {
      toast({ title: "연결 실패", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const regen = useMutation({
    mutationFn: async () => {
      const t = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { error } = await (supabase as any).from("deposit_sms_settings").update({ token: t, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposit-sms-token"] });
      toast({ title: "새 주소를 만들었어요", description: "휴대폰 앱에 새 주소를 다시 넣어야 해요. 예전 주소는 더 이상 받지 않아요." });
    },
  });

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast({ title: "주소를 복사했어요" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>입금 문자 자동 받기 설정</DialogTitle>
          <DialogDescription>입금 문자가 오는 휴대폰에서 한 번만 설정하면, 문자가 올 때마다 확인 대기 목록에 자동으로 떠요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <PhoneStatus inbox={inbox} loading={inboxLoading} />
          <div className="space-y-1.5">
            <p className="font-medium">1. 받는 주소 (남에게 알려주지 마세요)</p>
            <div className="flex gap-2">
              <Input readOnly value={url || "불러오는 중..."} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button size="icon" variant="outline" onClick={copy} disabled={!url} aria-label="주소 복사"><Copy className="h-4 w-4" /></Button>
            </div>
            {url && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="rounded-md bg-background p-2 shrink-0" aria-label="받는 주소 QR 코드">
                  <QRCodeSVG value={url} size={116} level="M" bgColor="transparent" fgColor="currentColor" className="text-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">컴퓨터에서 이 화면을 띄우고, 입금 문자가 오는 휴대폰 카메라로 찍으면 주소가 휴대폰으로 옮겨져요. 길게 눌러 복사한 뒤 전달 앱에 붙여넣으세요.</p>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="font-medium">2. 휴대폰 설정 (안드로이드, 한 번만)</p>
            <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
              <li>Play 스토어에서 <b className="text-foreground">「SMS to URL Forwarder」</b>를 설치하고 문자 읽기 권한을 허용해요.</li>
              <li>「+」로 규칙을 하나 만들어요. <b className="text-foreground">Sender(보내는 사람)</b>에 농협 문자 번호(보통 <code>15882100</code>)를 넣어요. 번호를 모르면 <code>*</code>로 두어도 돼요 — 입금 문자가 아니면 저장하지 않아요.</li>
              <li><b className="text-foreground">Webhook URL</b>에 위 주소를 붙여넣어요. 아래쪽 JSON 내용은 <b className="text-foreground">고치지 말고 그대로</b> 두고 저장해요.</li>
              <li><b className="text-foreground">배터리 최적화 끄기</b>: 설정 → 애플리케이션 → SMS to URL Forwarder → 배터리 → 「제한 없음」. 안 끄면 몇 시간 늦게 보내거나 안 보내요.</li>
              <li><b className="text-foreground">한글 「SMS Forwarder」(문자 자동 전달) 앱</b>을 쓰면: 받는 사람 URL 설정에서 요청 종류 <b className="text-foreground">POST</b>, Body는 <b className="text-foreground">JSON</b>을 고르고 내용을 <code>{'{"text":"{msg}"}'}</code> 한 줄로 바꿔요. GET이나 x-www-form-urlencoded로 두면 문자 내용 없이 주소만 와서 저장되지 않아요. 받는 사람 URL은 하나만 두세요.</li>
              <li>다른 전달 앱도 괜찮아요: 방법은 POST(웹훅), 보낼 내용에 문자 본문(<code>%text%</code>, <code>{"{msg}"}</code> 등)이 들어가면 돼요.</li>
            </ol>
            <p className="text-xs text-muted-foreground"><b className="text-foreground">아이폰</b>: 단축어 → 자동화 → 「메시지」(내용에 「입금」 포함) → 「URL의 콘텐츠 가져오기」 방법 POST, 주소 붙여넣기, 본문 JSON에 <code>text</code> = 메시지 내용.</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-medium">3. 확인</p>
            <p className="text-muted-foreground">다음 입금 문자가 오면 30초 안에 「입금 확인 대기」에 떠요. 맨 위 상태가 「휴대폰 연결됨」으로 바뀌면 끝이에요. 안 뜨면 아래 「최근 받은 기록」을 보세요.</p>
          </div>
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">최근 받은 기록</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={test} disabled={!url || testing}>
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} 연결 시험
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">휴대폰에서 보낸 문자가 서버에 왔는지, 왔다면 왜 저장이 안 됐는지 보여요. 여기 아무것도 없으면 휴대폰 앱이 실제로 보내지 못한 거예요.</p>
            {inboxLoading ? (
              <p className="text-xs text-muted-foreground">불러오는 중…</p>
            ) : inbox.length === 0 ? (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3">아직 받은 요청이 없어요.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {inbox.map((r) => {
                  const m = RESULT[r.result] ?? { label: r.result, tone: "bg-muted" };
                  return (
                    <li key={r.id} className="p-2.5 space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn("rounded-full px-2 py-0.5 font-medium", m.tone)}>{m.label}</span>
                        <span className="text-muted-foreground">{when(r.received_at)}</span>
                        {r.body_keys && r.body_keys !== "string" && <span className="ml-auto text-[10px] text-muted-foreground truncate">칸: {r.body_keys}</span>}
                      </div>
                      {r.raw_text && <p className="text-xs whitespace-pre-wrap break-all line-clamp-3">{r.raw_text}</p>}
                      {m.hint && r.result !== "saved" && <p className="text-[11px] text-muted-foreground">{m.hint}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">휴대폰을 잃어버렸거나 주소가 새어 나갔다면 새로 만들어 주세요.</p>
            <Button size="sm" variant="outline" onClick={() => regen.mutate()} disabled={regen.isPending}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> 새 주소
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 휴대폰에서 실제로 받은 적이 있는지 한눈에 (관리 화면의 「연결 시험」·틀린 주소는 제외) */
function PhoneStatus({ inbox, loading }: { inbox: InboxRow[]; loading: boolean }) {
  if (loading) return null;
  const last = inbox.find((r) => r.result === "saved" || r.result === "duplicate" || r.result === "not_deposit" || r.result === "empty");
  if (!last) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
        <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
        <p><b>아직 휴대폰에서 받은 문자가 없어요.</b> 아래 1~3번대로 입금 문자가 오는 휴대폰을 설정해 주세요.</p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
      <p><b>휴대폰 연결됨</b> · 마지막으로 받은 때 {when(last.received_at)} ({RESULT[last.result]?.label ?? last.result})</p>
    </div>
  );
}
