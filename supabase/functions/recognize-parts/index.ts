import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image, branch } = await req.json();
    if (!image) throw new Error("image is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get inventory for the mechanic's branch to constrain the model to real part codes
    const { data: inventory } = await supabase
      .from("inventory")
      .select("part_code, part_name, alt_part_code")
      .eq("branch", branch || "장흥")
      .gt("quantity", 0)
      .limit(2000);

    const catalog = (inventory || [])
      .map((p: any) => `- ${p.part_code} | ${p.part_name}${p.alt_part_code ? ` (대체: ${p.alt_part_code})` : ""}`)
      .join("\n");

    const imageUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;

    const systemPrompt = `당신은 얀마/존디어 농기계 부품을 사진으로 식별하는 전문가입니다.
사진 속에 보이는 부품을 분석하고, 아래 재고 카탈로그에서 가장 일치하는 항목을 골라 JSON 배열로만 응답하세요.
카탈로그에 없는 부품은 절대 포함하지 마세요. 확신이 없으면 빈 배열을 반환하세요.

[재고 카탈로그 - ${branch || "장흥"}지점]
${catalog || "(재고 없음)"}

응답 형식(JSON만, 다른 텍스트 금지):
{"parts":[{"part_code":"...","part_name":"...","quantity":1,"confidence":0.0}]}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "이 사진에 있는 부품을 식별해서 카탈로그의 part_code로 매칭해 주세요." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return new Response(
        JSON.stringify({ error: `AI 호출 실패 (${aiRes.status}): ${errText}` }),
        { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { parts: [] };
    }

    // Validate against inventory
    const validCodes = new Set((inventory || []).map((p: any) => p.part_code));
    const codeToName = new Map((inventory || []).map((p: any) => [p.part_code, p.part_name]));
    const validated = (parsed.parts || [])
      .filter((p: any) => p && validCodes.has(p.part_code))
      .map((p: any) => ({
        part_code: p.part_code,
        part_name: codeToName.get(p.part_code) || p.part_name,
        quantity: Math.max(1, parseInt(p.quantity) || 1),
        confidence: p.confidence ?? null,
      }));

    return new Response(
      JSON.stringify({ parts: validated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
