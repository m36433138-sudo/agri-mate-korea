import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw, Send, Loader2 } from "lucide-react";
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
          <div className="space-y-1.5">
            <p className="font-medium">받는 주소 (남에게 알려주지 마세요)</p>
            <div className="flex gap-2">
              <Input readOnly value={url || "불러오는 중..."} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button size="icon" variant="outline" onClick={copy} disabled={!url} aria-label="주소 복사"><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
          <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
            <li><b className="text-foreground">안드로이드</b>: Play 스토어에서 「SMS Forwarder」(문자 자동 전달) 같은 앱을 설치해요.</li>
            <li>전달 규칙을 하나 만들고, 보내는 사람을 은행 번호(농협 1588-2100 / 1661-3000, 수협 1588-1515 등) 또는 내용에 「입금」이 들어간 문자로 정해요.</li>
            <li>전달 방법은 <b className="text-foreground">웹훅(Webhook) · POST</b>, 주소에 위 주소를 붙여넣어요. 보낼 내용에는 문자 본문(예: <code>%text%</code> 또는 <code>{"{msg}"}</code>)만 넣으면 돼요.</li>
            <li><b className="text-foreground">아이폰</b>: 단축어 앱 → 자동화 → 「메시지」(내용에 입금 포함) → 「URL의 콘텐츠 가져오기」에서 방법 POST, 주소 붙여넣기, 본문에 메시지 내용을 넣어요.</li>
            <li><b className="text-foreground">배터리 최적화 끄기</b>: 설정 → 애플리케이션 → 전달 앱 → 배터리 → 「제한 없음」. 안 끄면 앱이 잠들어 몇 시간 늦게 보내거나 안 보내요.</li>
            <li>설정 후 시험 입금 문자가 오면 30초 안에 이 화면 「입금 확인 대기」에 떠요. 안 뜨면 아래 「최근 받은 기록」을 보세요.</li>
          </ol>
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
