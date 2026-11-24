// 앱 화면에서 「이 사람(들)에게 알림」을 부탁하는 함수. 로그인한 직원만 부를 수 있다.
// 받는 사람: 직원 이름(방문수리 출장기사), 대화방(보낸 사람 빼고), 관리자 전체, 또는 나 자신(시험).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { pushToUsers, PUSH_TOPICS, type PushTopic } from "../_shared/push.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "로그인이 필요합니다." }, 401);
    const me = u.user.id;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", me);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "employee")) return json({ error: "직원만 알림을 보낼 수 있어요." }, 403);

    const b = await req.json().catch(() => ({}));
    const topic: PushTopic = PUSH_TOPICS.includes(b.topic) ? b.topic : "general";
    const title = clip(b.title, 80);
    if (!title) return json({ error: "제목이 없어요" }, 400);
    const msg = { title, body: clip(b.body, 240), url: clip(b.url, 200).startsWith("/") ? clip(b.url, 200) : "/", tag: clip(b.tag, 60) || undefined };
    const to = b.to ?? {};
    const ids = new Set<string>();

    if (to.self) ids.add(me);
    if (Array.isArray(to.employee_names) && to.employee_names.length) {
      const names = to.employee_names.map((n: unknown) => clip(n, 30)).filter(Boolean).slice(0, 20);
      const { data } = await admin.from("employees").select("user_id, name").in("name", names).not("user_id", "is", null);
      (data ?? []).forEach((e: { user_id: string }) => ids.add(e.user_id));
    }
    if (typeof to.room_id === "string") {
      const { data } = await admin.from("chat_room_members").select("user_id").eq("room_id", to.room_id);
      const members = (data ?? []).map((m: { user_id: string }) => m.user_id);
      if (!members.includes(me)) return json({ error: "그 대화방 사람이 아니에요" }, 403);
      members.forEach((m: string) => ids.add(m));
    }
    if (to.admins) {
      const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin");
      (data ?? []).forEach((r: { user_id: string }) => ids.add(r.user_id));
    }
    if (!to.self) ids.delete(me); // 내가 한 일은 나에게 알리지 않는다

    // 메신저 알림은 제목을 보낸 사람 이름으로
    if (topic === "chat") {
      const { data: prof } = await admin.from("profiles").select("display_name").eq("id", me).maybeSingle();
      if (prof?.display_name) msg.title = `${prof.display_name}`;
    }
    const result = await pushToUsers(admin, [...ids], topic, msg);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
