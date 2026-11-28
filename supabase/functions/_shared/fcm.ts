// 안드로이드 설치 앱(FCM)으로 알림 보내기. 구글 서비스 계정(JSON)은 함수 비밀값 FCM_SERVICE_ACCOUNT 에만 둔다.
import { b64urlEncode, type PushMessage } from "./webpush.ts";

export type ServiceAccount = { project_id: string; client_email: string; private_key: string };

const enc = new TextEncoder();

function pemToPkcs8(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

/** 구글 OAuth 토큰을 받기 위한 서명된 JWT (RS256) */
export async function serviceAccountJwt(sa: ServiceAccount, now = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000);
  const header = b64urlEncode(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64urlEncode(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  })));
  const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claims}`)));
  return `${header}.${claims}.${b64urlEncode(sig)}`;
}

/** FCM 한 건의 본문. data 값은 모두 문자열이어야 한다. */
export function fcmMessage(token: string, msg: PushMessage) {
  return {
    message: {
      token,
      notification: { title: msg.title, body: msg.body ?? "" },
      data: { url: msg.url ?? "/", tag: msg.tag ?? "" },
      android: { priority: "HIGH", notification: { tag: msg.tag || undefined, default_sound: true, channel_id: "default" } },
    },
  };
}

/** 토큰이 없어진(앱 삭제 등) 경우인지 */
export function fcmTokenGone(status: number, body: string): boolean {
  return status === 404 || (status === 400 && /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT.*token/i.test(body));
}

let cached: { sa: ServiceAccount; token: string; exp: number } | null = null;

/** 함수 비밀값(JSON 글자)을 서비스 계정으로 읽는다. 모자라면 null */
export function parseServiceAccount(raw: string | undefined | null): ServiceAccount | null {
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    return sa?.project_id && sa?.client_email && sa?.private_key ? sa : null;
  } catch {
    return null;
  }
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.sa.client_email === sa.client_email && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await serviceAccountJwt(sa) }),
  });
  if (!res.ok) throw new Error(`FCM 인증 실패 ${res.status}`);
  const j = await res.json();
  cached = { sa, token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export async function sendFcm(sa: ServiceAccount, token: string, msg: PushMessage): Promise<{ ok: boolean; status: number; gone: boolean }> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(sa)}`, "Content-Type": "application/json" },
    body: JSON.stringify(fcmMessage(token, msg)),
  });
  const body = res.ok ? "" : await res.text();
  return { ok: res.ok, status: res.status, gone: !res.ok && fcmTokenGone(res.status, body) };
}
