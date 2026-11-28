import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { BellRing, CheckCircle2, Download, Loader2, MapPin, Send, Share, Smartphone, SquarePlus } from "lucide-react";
import { PageHeader } from "@/components/page/PageParts";
import { useInstallPrompt } from "@/lib/installPrompt";
import {
  TOPIC_LABELS, currentSubscription, disablePush, enablePush, getPushTopics, isIos, isStandalone, pushSupported, sendPush, setPushTopics, type PushTopic,
} from "@/lib/appPush";
import { useLiveSharing, useMe } from "@/hooks/useMyAttendance";
import { ANDROID_APK_URL, isNativeApp } from "@/lib/nativeLocation";

const native = isNativeApp();
import { useUserRole } from "@/hooks/useUserRole";

const ALL: PushTopic[] = ["onsite", "chat", "deposit", "general"];

function Section({ icon: Icon, title, children }: { icon: typeof BellRing; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-card border border-border/70 card-shadow p-5 space-y-4">
      <h2 className="text-[17px] font-bold flex items-center gap-2"><Icon className="h-5 w-5 text-primary" />{title}</h2>
      {children}
    </section>
  );
}

export default function AppSettings() {
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const { data: me } = useMe();
  const { canPrompt, prompt, justInstalled } = useInstallPrompt();
  const standalone = isStandalone() || justInstalled;
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [topics, setTopics] = useState<PushTopic[]>(ALL);
  const [busy, setBusy] = useState(false);
  const { off, setOff } = useLiveSharing();
  const perm = typeof Notification !== "undefined" ? Notification.permission : "default";

  useEffect(() => {
    void (async () => {
      const sub = await currentSubscription();
      setSubscribed(!!sub);
      const t = await getPushTopics();
      if (t) setTopics(t);
    })();
  }, []);

  const err = (e: unknown) => toast({ title: "알림 설정 실패", description: e instanceof Error ? e.message : String(e), variant: "destructive" });

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) { await enablePush(topics); setSubscribed(true); toast({ title: "이 휴대폰에서 알림을 받아요" }); }
      else { await disablePush(); setSubscribed(false); toast({ title: "이 휴대폰 알림을 껐어요" }); }
    } catch (e) { err(e); } finally { setBusy(false); }
  };

  const toggleTopic = async (t: PushTopic, on: boolean) => {
    const next = on ? [...new Set([...topics, t])] : topics.filter((x) => x !== t);
    setTopics(next);
    try { await setPushTopics(next); } catch (e) { err(e); }
  };

  const test = async () => {
    setBusy(true);
    const r = await sendPush("general", { self: true }, { title: "알림 시험", body: "이 휴대폰으로 알림이 잘 와요 👍", url: "/app-settings", tag: "test" });
    setBusy(false);
    if (!r.ok) return err(new Error(r.error));
    toast(r.sent > 0 ? { title: `알림을 보냈어요 (${r.sent}대)`, description: "몇 초 안에 휴대폰 알림창에 떠요." }
      : { title: "보낼 기기가 없어요", description: "「이 휴대폰에서 알림 받기」를 먼저 켜 주세요.", variant: "destructive" });
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="앱·알림 설정" sub="휴대폰 홈 화면에 앱으로 설치하고, 방문수리·메신저·입금 알림을 받아요" />

      <Section icon={Smartphone} title="휴대폰에 앱 설치">
        {standalone ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 font-medium"><CheckCircle2 className="h-5 w-5" />설치한 앱으로 열려 있어요</p>
        ) : canPrompt ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">홈 화면에 아이콘이 생기고, 주소창 없이 앱처럼 열려요.</p>
            <Button className="h-12 rounded-2xl gap-2 text-base w-full sm:w-auto" onClick={async () => { if (await prompt()) toast({ title: "설치했어요. 홈 화면의 「CSGM」으로 여세요." }); }}>
              <Download className="h-5 w-5" /> 앱 설치하기
            </Button>
          </div>
        ) : isIos() ? (
          <ol className="space-y-2 text-sm">
            <li className="flex gap-2"><span className="font-bold text-primary">1</span><span><b>Safari</b>로 이 주소를 열어요 (카카오톡 안 브라우저 말고)</span></li>
            <li className="flex gap-2"><span className="font-bold text-primary">2</span><span>아래쪽 <Share className="inline h-4 w-4 -mt-0.5" /> <b>공유</b> 버튼 → <SquarePlus className="inline h-4 w-4 -mt-0.5" /> <b>홈 화면에 추가</b></span></li>
            <li className="flex gap-2"><span className="font-bold text-primary">3</span><span>홈 화면의 「CSGM」 아이콘으로 열고, 이 화면에서 알림을 켜요</span></li>
          </ol>
        ) : (
          <ol className="space-y-2 text-sm">
            <li className="flex gap-2"><span className="font-bold text-primary">1</span><span><b>크롬</b>으로 이 주소를 열어요</span></li>
            <li className="flex gap-2"><span className="font-bold text-primary">2</span><span>오른쪽 위 <b>⋮</b> → <b>홈 화면에 추가</b> (또는 「앱 설치」)</span></li>
          </ol>
        )}
      </Section>

      <Section icon={BellRing} title="알림">
        {!pushSupported() ? (
          <p className="text-sm text-muted-foreground">
            {isIos() && !standalone ? "아이폰은 위 방법으로 앱을 설치한 뒤, 설치한 앱에서 알림을 켤 수 있어요 (iOS 16.4 이상)." : "이 브라우저에서는 알림을 받을 수 없어요. 크롬이나 설치한 앱으로 열어 주세요."}
          </p>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 rounded-2xl border p-4">
              <span>
                <span className="block font-semibold">이 휴대폰에서 알림 받기</span>
                <span className="block text-xs text-muted-foreground">{perm === "denied" ? "알림이 차단돼 있어요. 휴대폰 설정 → 알림에서 허용해 주세요." : "앱을 닫아 두어도 알림창에 떠요"}</span>
              </span>
              {busy || subscribed === null ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                : <Switch checked={subscribed} disabled={perm === "denied"} onCheckedChange={toggle} aria-label="알림 받기" />}
            </label>
            {subscribed && (
              <div className="divide-y rounded-2xl border">
                {ALL.filter((t) => t !== "deposit" || isAdmin).map((t) => (
                  <label key={t} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span><span className="block text-sm font-medium">{TOPIC_LABELS[t].label}</span><span className="block text-xs text-muted-foreground">{TOPIC_LABELS[t].desc}</span></span>
                    <Switch checked={topics.includes(t)} onCheckedChange={(v) => toggleTopic(t, v)} aria-label={TOPIC_LABELS[t].label} />
                  </label>
                ))}
              </div>
            )}
            {subscribed && <Button variant="outline" className="gap-1.5" onClick={test} disabled={busy}><Send className="h-4 w-4" />나에게 시험 알림 보내기</Button>}
          </>
        )}
      </Section>

      {me && (
        <Section icon={MapPin} title="출장 위치 공유">
          <label className="flex items-center justify-between gap-3 rounded-2xl border p-4">
            <span>
              <span className="block font-semibold">출근해 있는 동안 내 위치 공유</span>
              <span className="block text-xs text-muted-foreground">대시보드·방문수리 지도에 동료가 볼 수 있게 보여요. 퇴근하면 자동으로 멈춰요.</span>
            </span>
            <Switch checked={!off} onCheckedChange={(v) => setOff(!v)} aria-label="위치 공유" />
          </label>
          {native ? (
            <p className="text-xs text-muted-foreground">안드로이드 앱이라 화면이 꺼지거나 다른 앱을 써도 퇴근할 때까지 계속 보내요. 알림줄의 「광문농기 위치 공유 중」이 그 표시예요. 삼성 폰은 설정 → 애플리케이션 → 광문농기 → 배터리를 「제한 없음」으로 해 두면 끊기지 않아요.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">휴대폰 화면이 꺼지거나 앱을 완전히 닫으면 위치가 갱신되지 않아요. 지도에는 마지막으로 보낸 위치와 「몇 분 전」이 함께 보여요.</p>
              <a href={ANDROID_APK_URL} className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 hover:bg-primary/10">
                <Download className="h-5 w-5 text-primary shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold">안드로이드 앱 받기 (화면 꺼져도 위치 공유)</span>
                  <span className="block text-xs text-muted-foreground">받은 파일을 열어 설치하세요. 「출처를 알 수 없는 앱」 허용을 물으면 허용하면 돼요.</span>
                </span>
              </a>
            </>
          )}
        </Section>
      )}
    </div>
  );
}
