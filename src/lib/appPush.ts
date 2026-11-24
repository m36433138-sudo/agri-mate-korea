import { supabase } from "@/integrations/supabase/client";
import { VAPID_PUBLIC_KEY } from "../../supabase/functions/_shared/push";

/** 홈 화면 앱·휴대폰 알림. 서비스 워커는 /sw.js 하나 (미리보기 창(iframe) 안에서는 등록하지 않는다). */

export type PushTopic = "onsite" | "chat" | "deposit" | "general";
export const TOPIC_LABELS: Record<PushTopic, { label: string; desc: string }> = {
  onsite: { label: "방문수리 배정", desc: "내 이름으로 방문수리가 잡히거나 바뀌면" },
  chat: { label: "사내 메신저", desc: "내가 있는 대화방에 새 메시지가 오면" },
  deposit: { label: "입금 문자", desc: "입금 문자가 들어오면 (관리자)" },
  general: { label: "공지·기타", desc: "회사 공지와 시험 알림" },
};

const inIframe = () => { try { return window.self !== window.top; } catch { return true; } };

export function swSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && !inIframe();
}
export function pushSupported() {
  return swSupported() && "PushManager" in window && "Notification" in window;
}
/** 홈 화면에 설치한 앱으로 열렸는지 */
export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
export const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!swSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("서비스 워커 등록 실패", e);
    return null;
  }
}

function keyBytes(b64url: string) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const bin = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** 이 기기에서 알림 켜기: 권한 묻기 → 구독 → 서버에 이 기기 등록 */
export async function enablePush(topics?: PushTopic[]): Promise<void> {
  if (!pushSupported()) {
    throw new Error(isIos() && !isStandalone()
      ? "아이폰은 먼저 Safari 공유 버튼 → 「홈 화면에 추가」로 앱을 설치한 뒤, 설치한 앱에서 알림을 켜 주세요."
      : "이 브라우저는 알림을 지원하지 않아요. 크롬이나 설치한 앱에서 열어 주세요.");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("알림 권한이 꺼져 있어요. 휴대폰 설정 → 앱(또는 브라우저) → 알림에서 허용해 주세요.");
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
  if (!reg) throw new Error("앱 준비(서비스 워커)에 실패했어요. 새로고침 후 다시 시도해 주세요.");
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  const { error } = await supabase.rpc("register_push_subscription" as never, {
    _endpoint: j.endpoint, _p256dh: j.keys?.p256dh, _auth: j.keys?.auth, _user_agent: navigator.userAgent, _topics: topics ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function setPushTopics(topics: PushTopic[]): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const { error } = await (supabase as any).from("push_subscriptions").update({ topics }).eq("endpoint", sub.endpoint);
  if (error) throw new Error(error.message);
}

export async function getPushTopics(): Promise<PushTopic[] | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const { data } = await (supabase as any).from("push_subscriptions").select("topics").eq("endpoint", sub.endpoint).maybeSingle();
  return (data?.topics as PushTopic[] | undefined) ?? null;
}

export type PushTarget = { employee_names?: string[]; room_id?: string; admins?: boolean; self?: boolean };

/** 다른 직원 휴대폰에 알림 보내기. 실패해도 하던 일은 막지 않는다. */
export async function sendPush(topic: PushTopic, to: PushTarget, msg: { title: string; body?: string; url?: string; tag?: string }) {
  try {
    const { data, error } = await supabase.functions.invoke("send-push", { body: { topic, to, ...msg } });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, ...(data as { sent: number; failed: number; devices: number }) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}
