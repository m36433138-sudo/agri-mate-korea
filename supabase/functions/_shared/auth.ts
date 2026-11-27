import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

export type Caller = { userId: string; isStaff: boolean; userClient: SupabaseClient };

/** Verifies the caller's sign-in. Returns a Response (401/403) to send back when not allowed. */
export async function requireCaller(
  req: Request,
  corsHeaders: Record<string, string>,
  opts: { staff?: boolean; permission?: string } = {},
): Promise<Caller | Response> {
  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return deny(401, "로그인이 필요합니다.");
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return deny(401, "로그인이 필요합니다.");
  const userId = data.user.id;
  const { data: staff } = await userClient.rpc("is_staff", { _user_id: userId });
  const isStaff = staff === true;
  if (opts.staff && !isStaff) return deny(403, "직원만 사용할 수 있습니다.");
  if (opts.permission) {
    const { data: ok } = await userClient.rpc("has_permission", { _user_id: userId, _permission: opts.permission });
    const { data: admin } = await userClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (ok !== true && admin !== true) return deny(403, "권한이 없습니다.");
  }
  return { userId, isStaff, userClient };
}
