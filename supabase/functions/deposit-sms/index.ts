// 휴대폰 문자 전달 앱 → 입금 문자 수신 → 미수금 매칭 대기 목록에 저장.
// 로그인 없이 호출되므로 관리자 화면에서 만든 비밀 키(token)가 맞아야만 저장한다.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { parseDepositSms, pickSmsText } from "../_shared/depositSms.ts";
import { pushToUsers } from "../_shared/push.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const keysOf = (body: unknown) =>
  body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body as object).slice(0, 20).join(",") : typeof body;

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "POST or GET only" }, 405);

  // 전달 앱이 GET(주소 뒤 ?text=...)으로 보내도 받는다
  const url = new URL(req.url);
  const raw = req.method === "POST" ? await req.text() : "";
  let body: unknown = req.method === "GET" ? Object.fromEntries(url.searchParams) : raw;
  const ctype = req.headers.get("content-type") ?? (req.method === "GET" ? "GET" : "");
  if (req.method === "POST") try {
    if (ctype.includes("application/json") || raw.trim().startsWith("{")) body = JSON.parse(raw);
    else if (ctype.includes("application/x-www-form-urlencoded")) body = Object.fromEntries(new URLSearchParams(raw));
  } catch { /* 평문으로 처리 */ }

  const token =
    url.searchParams.get("token") ??
    req.headers.get("x-deposit-token") ??
    ((body && typeof body === "object" && typeof (body as any).token === "string") ? (body as any).token : "");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  // 받은 요청은 결과와 함께 모두 남긴다 (설정 화면 「최근 받은 기록」). 실패해도 응답은 그대로.
  const log = async (result: string, text: string | null, depositId: string | null = null) => {
    const { error } = await admin.from("deposit_sms_inbox").insert({
      result, raw_text: text?.slice(0, 2000) ?? null, content_type: ctype.slice(0, 100) || null, body_keys: keysOf(body), deposit_id: depositId,
    });
    if (error) console.error("inbox log failed", error.message);
    if (Math.random() < 0.05) await admin.from("deposit_sms_inbox").delete().lt("received_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
  };

  const { data: settings, error: sErr } = await admin.from("deposit_sms_settings").select("token").eq("id", true).maybeSingle();
  if (sErr || !settings?.token) return json({ error: "not configured" }, 503);
  if (!token || !safeEqual(String(token), settings.token)) {
    // 키가 틀린 요청은 내용을 남기지 않는다 (아무나 보낼 수 있으므로)
    await log("unauthorized", null);
    return json({ error: "unauthorized" }, 401);
  }

  const text = pickSmsText(body, raw).slice(0, 2000);
  if (!text.trim()) {
    await log("empty", raw.slice(0, 500) || null);
    // 전달 앱 기록에 「실패」로 보이도록 400 — 200이면 앱은 「성공」으로 표시해 원인을 숨긴다
    return json({ ok: false, saved: false, error: "본문이 비어 있음 — 전달 앱의 보낼 내용에 문자 본문을 넣어 주세요" }, 400);
  }
  if (text.startsWith("[연결 시험]")) {
    await log("test", text);
    return json({ ok: true, saved: false, reason: "연결 시험 성공" });
  }
  const parsed = parseDepositSms(text);
  if (!parsed) {
    // 입금 문자가 아닌 개인 문자일 수 있어 앞부분만 남긴다
    await log("not_deposit", text.length > 60 ? text.slice(0, 60) + "…" : text);
    return json({ ok: true, saved: false, reason: "입금 문자가 아님" });
  }

  const { data: saved, error } = await admin.from("bank_deposits").upsert({
    source: "sms",
    bank: parsed.bank,
    depositor_name: parsed.depositorName,
    amount: parsed.amount,
    deposited_at: parsed.depositedAt,
    balance: parsed.balance,
    raw_text: text,
    dedupe_key: parsed.dedupeKey,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
  if (error) {
    console.error("deposit insert failed", error.message);
    await log("error", text);
    return json({ error: "save failed" }, 500);
  }
  if (!saved || saved.length === 0) {
    await log("duplicate", text);
    return json({ ok: true, saved: false, reason: "이미 받은 문자" });
  }
  await log("saved", text, saved[0].id);
  // 관리자 휴대폰에 「입금 확인 대기」 알림 (실패해도 저장은 끝났다)
  try {
    const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    await pushToUsers(admin, (admins ?? []).map((r: { user_id: string }) => r.user_id), "deposit", {
      title: `입금 ${parsed.amount.toLocaleString("ko-KR")}원`,
      body: `${parsed.depositorName ?? "입금자 미상"} · ${parsed.bank} — 미수금과 맞춰 승인해 주세요`,
      url: "/receivables",
      tag: `deposit-${saved[0].id}`,
    });
  } catch (e) { console.error("입금 알림 실패", e); }
  return json({ ok: true, saved: true, amount: parsed.amount, depositor: parsed.depositorName });
});
