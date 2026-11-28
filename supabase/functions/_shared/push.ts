// 직원 휴대폰 알림 보내기 (send-push 함수와 deposit-sms 함수가 같이 쓴다)
import { sendWebPush, type PushMessage, type VapidKeys } from "./webpush.ts";
import { parseServiceAccount, sendFcm } from "./fcm.ts";

/** 브라우저가 구독할 때 쓰는 공개키 (앱 화면도 이 값을 쓴다). 짝이 되는 비밀키는 DB 금고(vault)에만 있다. */
export const VAPID_PUBLIC_KEY = "BG4q_mIOljfWY8r6K-egq5Zh8iAtkNp2lYZBeEH1WKOk47l1-HuOhaVnJ3YXYPnHhFi_33JF4Ot3Jnvt03wiLpA";
export const PUSH_TOPICS = ["onsite", "chat", "deposit", "general", "repair"] as const;
export type PushTopic = (typeof PUSH_TOPICS)[number];

// 이 파일은 앱 화면 빌드에도 (공개키 때문에) 들어가므로 Deno 를 직접 부르지 않는다
const envVar = (k: string) => (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k);

let cachedVapid: VapidKeys | null = null;
// deno-lint-ignore no-explicit-any
async function vapid(admin: any): Promise<VapidKeys | null> {
  if (cachedVapid) return cachedVapid;
  const { data, error } = await admin.rpc("push_vapid_private");
  if (error || !data) { console.error("VAPID 비밀키 없음", error?.message); return null; }
  cachedVapid = { publicKey: VAPID_PUBLIC_KEY, privateJwk: JSON.parse(data), subject: "mailto:push@agrimate.app" };
  return cachedVapid;
}

/** 사람(로그인 계정)들에게 알림. 그 사람이 켜 둔 주제만 보내고, 없어진 구독은 지운다. */
// deno-lint-ignore no-explicit-any
export async function pushToUsers(admin: any, userIds: string[], topic: PushTopic, msg: PushMessage) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { sent: 0, failed: 0, devices: 0 };
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth, topics, kind").in("user_id", ids);
  const targets = (subs ?? []).filter((s: { topics: string[] | null }) => !s.topics || s.topics.includes(topic));
  // 웹 푸시(홈 화면 앱·브라우저)와 안드로이드 설치 앱(FCM)을 기기 종류대로 나눠 보낸다
  const keys = targets.some((s: { kind?: string }) => s.kind !== "fcm") ? await vapid(admin) : null;
  const sa = targets.some((s: { kind?: string }) => s.kind === "fcm") ? parseServiceAccount(envVar("FCM_SERVICE_ACCOUNT")) : null;
  if (!keys && !sa) return { sent: 0, failed: 0, devices: targets.length, error: "알림 키가 설정되지 않았어요" };
  let sent = 0, failed = 0;
  await Promise.all(targets.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string; kind?: string }) => {
    try {
      const r = s.kind === "fcm"
        ? (sa ? await sendFcm(sa, s.endpoint.replace(/^fcm:/, ""), msg) : { ok: false, status: 0, gone: false })
        : (keys ? await sendWebPush(s, msg, keys) : { ok: false, status: 0, gone: false });
      if (r.ok) { sent++; await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), fail_count: 0 }).eq("id", s.id); }
      else if (r.gone) { failed++; await admin.from("push_subscriptions").delete().eq("id", s.id); }
      else { failed++; console.error("push 실패", r.status); }
    } catch (e) {
      failed++;
      console.error("push 오류", e instanceof Error ? e.message : e);
    }
  }));
  return { sent, failed, devices: targets.length };
}
