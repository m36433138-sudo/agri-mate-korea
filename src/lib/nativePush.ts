import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeApp } from "@/lib/nativeLocation";

/**
 * 안드로이드 설치 앱의 알림(FCM). 웹뷰 안에서는 웹 푸시가 안 되므로 앱은 이 길로 알림을 받는다.
 * 토큰은 이 기기에 기억해 두고(설정 화면의 켜짐 표시·주제 바꾸기용), 서버에는 register_fcm_token 으로 등록한다.
 */
const TOKEN_KEY = "fcm.token";

export function savedFcmToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function saveToken(t: string | null) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* 기억 못 해도 등록은 된다 */ }
}

/** 권한을 묻고 FCM 토큰을 받는다 */
export async function registerNativePush(): Promise<string> {
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive !== "granted") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") throw new Error("알림 권한이 꺼져 있어요. 휴대폰 설정 → 애플리케이션 → 광문농기 → 알림에서 허용해 주세요.");
  await PushNotifications.createChannel({ id: "default", name: "업무 알림", importance: 5, visibility: 1, vibration: true }).catch(() => undefined);
  const token = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("알림 등록이 늦어지고 있어요. 인터넷 연결을 확인하고 다시 켜 주세요.")), 20_000);
    void PushNotifications.addListener("registration", (t) => { clearTimeout(timer); resolve(t.value); });
    void PushNotifications.addListener("registrationError", (e) => { clearTimeout(timer); reject(new Error(`알림 등록 실패: ${e.error}`)); });
    void PushNotifications.register();
  }).finally(() => { void PushNotifications.removeAllListeners().then(listenNativeTaps); });
  saveToken(token);
  return token;
}

export async function unregisterNativePush() {
  saveToken(null);
  await PushNotifications.unregister().catch(() => undefined);
}

/** 알림을 누르면 그 알림의 주소(url)로 연다. 앱 시작 때(Layout) 한 번, 토큰을 새로 받은 뒤 다시 건다. */
export function listenNativeTaps() {
  if (!isNativeApp()) return;
  void PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
    const url = (a.notification.data as { url?: string } | undefined)?.url;
    if (url && url.startsWith("/")) window.location.assign(url);
  });
}
