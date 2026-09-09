import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `당신은 한국 농기계 대리점(광문농기)의 "청구서" PDF를 수리이력 데이터로 변환하는 파서입니다.

청구서 표 컬럼: 월일 / 품명 / 수량 / 단위 / 단가 / 합계액 / 입금액 / 잔액
- 월일이 " 인 행은 바로 위 행과 같은 날짜입니다.
- 헤더의 기간(예: 2026-01-01 ~ 2026-12-31)에서 연도를 구해 날짜를 YYYY-MM-DD 로 만듭니다.

한 건(그룹)으로 묶는 규칙:
- "콤바인수리-YH1150(H3099)", "YH1150/", "YT470/1213H" 처럼 기계/모델이 적힌 줄이 나오면 그 지점부터 새 그룹을 시작합니다.
- 기계 줄이 없는 상태에서 부품이 나오면 그 날짜로 그룹을 만듭니다(machine_label 은 빈 값).
- 이후 나오는 부품/공임/메모 줄은 현재 그룹에 속합니다.

행 분류:
- 품명이 "부품명(부품코드)" 형태이고 단위가 EA 인 경우 → 부품(parts). part_code 는 괄호 안의 코드(대문자로 정리), part_name 은 괄호 앞 이름, quantity 는 수량, unit_price 는 단가.
- 품명에 "공임" 이 포함되면 → labor_cost 에 합계액을 더하고, 괄호 안 이름은 technician 으로.
- "[이월]", "[합계]", "[입금]" 행은 무시합니다.
- 그 밖에 금액이 0인 설명 줄(예: "-본인꺼에서장착", "보험사 연락처 - 010-...")은 notes 에 한 줄씩 모읍니다.
- 금액이 있지만 부품 코드가 없는 작업 항목(예: "하부용접", "탈곡통교체(본인꺼이설)비", "탈곡통에대해세금발생")은 labor_cost 에 합계액을 더하고 description 에 그 이름을 적습니다.

기계 줄 해석:
- "콤바인수리-YH1150(H3099)" → machine_type "콤바인", model "YH1150", serial "H3099"
- "YT470/1213H" → model "YT470", operating_hours 1213
- "YH1150/" → model "YH1150"

반드시 아래 JSON 만 출력하세요(설명·마크다운 금지):
{
  "customer_name": "고객명",
  "period": "2026",
  "groups": [
    {
      "date": "2026-01-22",
      "machine_type": "콤바인",
      "model": "YH1150",
      "serial": "H3099",
      "operating_hours": null,
      "technician": "마성수",
      "labor_cost": 1500000,
      "description": "수리 요약",
      "notes": "메모 줄들",
      "parts": [{ "part_code": "1E9110-32153", "part_name": "플레이트,인렛피", "quantity": 1, "unit_price": 1375000 }]
    }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { file, mime, filename } = await req.json();
    if (!file || typeof file !== "string") throw new Error("file (data URL) required");

    const base64 = file.includes(",") ? file.split(",")[1] : file;
    const fileMime = mime || "application/pdf";
    const isImage = fileMime.startsWith("image/");

    const contentBlock = isImage
      ? { type: "image_url", image_url: { url: `data:${fileMime};base64,${base64}` } }
      : {
          type: "file",
          file: {
            filename: filename || "billing.pdf",
            file_data: `data:${fileMime};base64,${base64}`,
          },
        };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "이 청구서를 규칙에 따라 JSON 으로 변환해 주세요." },
              contentBlock,
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      const status = resp.status === 429 || resp.status === 402 ? resp.status : 500;
      return new Response(
        JSON.stringify({
          error:
            resp.status === 429
              ? "요청이 많습니다. 잠시 후 다시 시도해 주세요."
              : resp.status === 402
                ? "AI 사용 크레딧이 부족합니다."
                : `분석 실패: ${resp.status} ${t}`,
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      const m = jsonText.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI 응답을 해석할 수 없습니다.");
      parsed = JSON.parse(m[0]);
    }

    const groups = Array.isArray(parsed.groups) ? parsed.groups : [];
    const normalized = groups.map((g: any) => ({
      date: typeof g.date === "string" ? g.date : "",
      machine_type: g.machine_type || "",
      model: g.model || "",
      serial: g.serial || "",
      operating_hours: Number(g.operating_hours) || null,
      technician: g.technician || "",
      labor_cost: Number(g.labor_cost) || 0,
      description: g.description || "",
      notes: g.notes || "",
      parts: (Array.isArray(g.parts) ? g.parts : []).map((p: any) => ({
        part_code: String(p.part_code || "").toUpperCase().trim(),
        part_name: String(p.part_name || "").trim(),
        quantity: Number(p.quantity) || 1,
        unit_price: Number(p.unit_price) || 0,
      })),
    }));

    return new Response(
      JSON.stringify({
        customer_name: parsed.customer_name || "",
        period: parsed.period || "",
        groups: normalized,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("parse-billing-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
