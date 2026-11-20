// 휴대폰 문자 전달 앱 → 입금 문자 수신 → 미수금 매칭 대기 목록에 저장.
// 로그인 없이 호출되므로 관리자 화면에서 만든 비밀 키(token)가 맞아야만 저장한다.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { parseDepositSms } from "../_shared/depositSms.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function pickText(body: unknown): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const k of ["text", "message", "msg", "body", "content", "sms", "Text", "Message", "Body"]) {
      if (typeof b[k] === "string" && b[k]) return b[k] as string;
    }
  }
  return "";
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = new URL(req.url);
  const raw = await req.text();
  let body: unknown = raw;
  const ctype = req.headers.get("content-type") ?? "";
  try {
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
  const { data: settings, error: sErr } = await admin.from("deposit_sms_settings").select("token").eq("id", true).maybeSingle();
  if (sErr || !settings?.token) return json({ error: "not configured" }, 503);
  if (!token || !safeEqual(String(token), settings.token)) return json({ error: "unauthorized" }, 401);

  const text = pickText(body).slice(0, 2000);
  const parsed = parseDepositSms(text);
  if (!parsed) return json({ ok: true, saved: false, reason: "입금 문자가 아님" });

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
    return json({ error: "save failed" }, 500);
  }
  if (!saved || saved.length === 0) return json({ ok: true, saved: false, reason: "이미 받은 문자" });
  return json({ ok: true, saved: true, amount: parsed.amount, depositor: parsed.depositorName });
});
