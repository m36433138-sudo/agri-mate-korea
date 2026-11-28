// @ts-nocheck -- Uint8Array<ArrayBufferLike> vs BufferSource lib typing mismatch; runtime is correct
import { describe, expect, it } from "vitest";
import { b64urlDecode } from "../../supabase/functions/_shared/webpush";
import { fcmMessage, fcmTokenGone, serviceAccountJwt } from "../../supabase/functions/_shared/fcm";

async function testAccount() {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const b64 = btoa(String.fromCharCode(...pkcs8)).replace(/(.{64})/g, "$1\n");
  return { kp, sa: { project_id: "p", client_email: "bot@p.iam.gserviceaccount.com", private_key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n` } };
}

describe("FCM 보내기", () => {
  it("서비스 계정 키로 서명한 JWT가 공개키로 검증된다", async () => {
    const { kp, sa } = await testAccount();
    const jwt = await serviceAccountJwt(sa, 1_700_000_000_000);
    const [h, c, s] = jwt.split(".");
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)));
    expect(claims).toMatchObject({ iss: sa.client_email, aud: "https://oauth2.googleapis.com/token", iat: 1_700_000_000, exp: 1_700_003_600 });
    expect(claims.scope).toContain("firebase.messaging");
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", kp.publicKey, b64urlDecode(s), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });
  it("알림 본문: 제목·내용, 누르면 열 주소는 data 문자열로", () => {
    const m = fcmMessage("tok", { title: "수리 완료", body: "김영수 YT5113A", url: "/repairs", tag: "r1" });
    expect(m.message.token).toBe("tok");
    expect(m.message.notification).toEqual({ title: "수리 완료", body: "김영수 YT5113A" });
    expect(m.message.data).toEqual({ url: "/repairs", tag: "r1" });
    expect(m.message.android.priority).toBe("HIGH");
  });
  it("앱이 지워진 토큰이면 지운다", () => {
    expect(fcmTokenGone(404, "")).toBe(true);
    expect(fcmTokenGone(400, '{"error":{"status":"INVALID_ARGUMENT","details":[{"errorCode":"UNREGISTERED"}]}}')).toBe(true);
    expect(fcmTokenGone(500, "")).toBe(false);
  });
});

describe("FCM 서비스 계정 읽기", () => {
  it("필요한 값이 다 있어야 쓴다", async () => {
    const { parseServiceAccount } = await import("../../supabase/functions/_shared/fcm");
    expect(parseServiceAccount(JSON.stringify({ project_id: "p", client_email: "e", private_key: "k", type: "service_account" }))?.project_id).toBe("p");
    expect(parseServiceAccount(JSON.stringify({ project_id: "p" }))).toBeNull();
    expect(parseServiceAccount("not json")).toBeNull();
    expect(parseServiceAccount(undefined)).toBeNull();
  });
});
