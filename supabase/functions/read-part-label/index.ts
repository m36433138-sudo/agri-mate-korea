import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createResponsesCall } from "../_shared/responses.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const norm = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "로그인이 필요합니다." }, 401);
    const { data: staff } = await userClient.rpc("is_staff", { _user_id: u.user.id });
    if (!staff) return json({ error: "권한이 없습니다." }, 403);

    const body = await req.json().catch(() => ({}));
    const image = typeof body.image === "string" ? body.image : "";
    if (!image.startsWith("data:image/") || image.length > 8_000_000) return json({ error: "사진이 올바르지 않습니다." }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI 설정이 없습니다." }, 500);

    const { result } = createResponsesCall(
      req,
      { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
      [
        {
          role: "system",
          content:
            "You read part-number labels on agricultural machinery parts (Yanmar/John Deere). Read every part number printed on stickers, tags, packaging or stamped on the part. Yanmar numbers look like 1A8060-00600, 129107-44590, 26106-060162, 198268-74011 (optionally with suffix like -YNK). Reply ONLY with JSON: {\"codes\":[\"...\"]}. If none is readable, reply {\"codes\":[]}. Never guess.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "이 사진의 라벨에서 부품번호를 읽어 주세요." },
            { type: "image", image: new URL(image) },
          ],
        },
      ],
    );
    const text = await result.text;
    const m = text.match(/\{[\s\S]*\}/);
    let codes: string[] = [];
    try { codes = (JSON.parse(m?.[0] ?? "{}").codes ?? []).filter((c: unknown) => typeof c === "string"); } catch { /* empty */ }
    codes = Array.from(new Set(codes.map((c) => c.trim().toUpperCase()).filter((c) => c.length >= 5))).slice(0, 5);

    // 실제 부품번호(도면·재고)와 대조
    const matches: { read: string; part_code: string; part_name: string | null; source: string }[] = [];
    for (const code of codes) {
      const base = code.replace(/-(YNK|W|\d{1,3})$/, "");
      const cands = Array.from(new Set([code, base]));
      const orInv = cands.flatMap((c) => [`part_code.eq."${c}"`, `alt_part_code.eq."${c}"`, `part_code.like."${c}-*"`]).join(",");
      const [{ data: inv }, { data: hs }] = await Promise.all([
        userClient.from("inventory").select("part_code, part_name").or(orInv).limit(5),
        userClient.from("diagram_hotspots").select("part_code, part_name").in("part_code", cands).limit(5),
      ]);
      const seen = new Set<string>();
      for (const r of [...(hs ?? []).map((r) => ({ ...r, source: "도면" })), ...(inv ?? []).map((r) => ({ ...r, source: "재고" }))]) {
        if (seen.has(norm(r.part_code))) continue;
        seen.add(norm(r.part_code));
        matches.push({ read: code, part_code: r.part_code, part_name: r.part_name, source: r.source });
      }
    }
    return json({ codes, matches });
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    return json({ error: e instanceof Error ? e.message : "판독 실패" }, status && status >= 400 ? status : 500);
  }
});
