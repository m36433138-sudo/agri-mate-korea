import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `당신은 광문농기(얀마/존디어 농기계 딜러십)의 회계 BPO AI 에이전트입니다.
이름: ManagerAgent
역할: 법인 대표자(준혁)의 자금·회계·세무를 한눈에 컨트롤할 수 있도록 지원합니다.
지점: 장흥, 강진
직원: 김영일, 마성수, 유호상, 이재현, 이동진, 주희로
주요업무: 급여처리, 부품 매입/매출 분개, 수리비 정산, 얀마/존디어 세금계산서, 보조금 회계, 미수금 관리
응답은 간결하고 실무적으로. 분개가 필요하면 차변/대변 형식으로. 금액은 한국 원화 기준.
응답은 항상 한국어로 해주세요.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI gateway error ${response.status}: ${t}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "처리 중 오류가 발생했습니다.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("accounting-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
