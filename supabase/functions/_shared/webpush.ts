/**
 * Web Push 보내기 (RFC 8291 aes128gcm 암호화 + RFC 8292 VAPID 서명). WebCrypto만 써서 Deno·브라우저·Node에서 같이 돈다.
 * 외부 라이브러리 없이 휴대폰 알림을 보낼 수 있게 한다.
 */

export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };
export type VapidKeys = { publicKey: string; privateJwk: JsonWebKey; subject: string };

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** payload를 받는 기기의 키로 암호화한 본문 (aes128gcm, 한 덩어리) */
export async function encryptPayload(
  payload: Uint8Array,
  sub: { p256dh: string; auth: string },
  opts: { salt?: Uint8Array; serverKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);
  const serverKeys = opts.serverKeys ?? await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, serverKeys.privateKey, 256));

  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/** VAPID 서명 헤더 (받는 서버 주소 기준, 12시간 유효) */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject })));
  const key = await crypto.subtle.importKey("jwk", vapid.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64urlEncode(sig)}, k=${vapid.publicKey}`;
}

export type PushMessage = { title: string; body?: string; url?: string; tag?: string };

/** 한 기기로 보내기. 410/404면 그 구독은 없어진 것 → gone=true (지워도 된다) */
export async function sendWebPush(sub: PushSubscriptionKeys, msg: PushMessage, vapid: VapidKeys): Promise<{ ok: boolean; status: number; gone: boolean }> {
  const body = await encryptPayload(enc.encode(JSON.stringify(msg)), sub);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
      Authorization: await vapidAuthorization(sub.endpoint, vapid),
    },
    body,
  });
  await res.body?.cancel().catch(() => {});
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
}
