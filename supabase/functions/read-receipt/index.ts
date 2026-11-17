import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAI } from "npm:@ai-sdk/openai@2";
import { streamText, Output, jsonSchema } from "npm:ai@5";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "../_shared/run-id.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const EXPENSE_CATEGORIES = [
  "부품 매입", "유류비", "차량 유지", "공구·장비", "소모품", "식대", "운송·택배",
  "통신비", "전기·수도·가스", "임대료", "보험료", "세금·수수료", "광고·인쇄", "기타",
];

const nullable = (type: string) => ({ type: [type, "null"] });
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["vendor", "business_number", "date", "payment_method", "total", "vat", "items"],
  properties: {
    vendor: nullable("string"),
    business_number: nullable("string"),
    date: { ...nullable("string"), description: "YYYY-MM-DD" },
    payment_method: { ...nullable("string"), description: "카드, 현금, 계좌이체 등" },
    total: nullable("number"),
    vat: nullable("number"),
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "unit_price", "amount", "category"],
        properties: {
          description: { type: "string" },
          quantity: nullable("number"),
          unit_price: nullable("number"),
          amount: { type: "number" },
          category: { type: "string", enum: EXPENSE_CATEGORIES },
        },
      },
    },
  },
} as const;

const INSTRUCTIONS = `당신은 한국 농기계 대리점(광문농기)의 경리 담당입니다. 첨부된 영수증·청구서·세금계산서를 읽어 지출 항목을 뽑습니다.
- 품목(줄)마다 하나씩 items에 넣고, 금액은 원 단위 숫자(쉼표 없이). 줄 구분이 없으면 전체를 한 항목으로.
- category는 목록 중 가장 알맞은 것: 농기계 부품·오일·필터는 「부품 매입」, 주유소 경유·휘발유는 「유류비」, 차량 정비·세차·통행료는 「차량 유지」, 식당·카페는 「식대」.
- 날짜는 YYYY-MM-DD. 상호(vendor), 사업자번호, 결제수단, 합계(total), 부가세(vat)를 읽을 수 없으면 null.
- 보이지 않는 값은 지어내지 말 것.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "로그인이 필요합니다." }, 401);
    const [{ data: admin }, { data: perm }] = await Promise.all([
      userClient.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      userClient.rpc("has_permission", { _user_id: u.user.id, _permission: "manage_expenses" }),
    ]);
    if (!admin && !perm) return json({ error: "지출 등록 권한이 없습니다." }, 403);

    const body = await req.json().catch(() => ({}));
    const file = typeof body.file === "string" ? body.file : "";
    const filename = typeof body.filename === "string" && body.filename ? body.filename.slice(0, 120) : "receipt.pdf";
    const isImage = file.startsWith("data:image/");
    const isPdf = file.startsWith("data:application/pdf;base64,");
    if ((!isImage && !isPdf) || file.length > 14_000_000) return json({ error: "사진(JPG·PNG) 또는 PDF만 올릴 수 있습니다. (10MB 이하)" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI 설정이 없습니다." }, 500);

    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const media = isImage
      ? { type: "image" as const, image: new URL(file) }
      : { type: "file" as const, data: file.slice("data:application/pdf;base64,".length), mediaType: "application/pdf", filename };
    const result = streamText({
      model: provider.responses("openai/gpt-6.1-sol"),
      system: INSTRUCTIONS,
      messages: [{ role: "user", content: [{ type: "text", text: "이 영수증/청구서의 지출 항목을 JSON으로 정리해 주세요." }, media] }],
      experimental_output: Output.object({ schema: jsonSchema(SCHEMA as any) }),
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          store: false,
          strictJsonSchema: true,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    let text = "";
    try {
      text = await result.text;
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode ?? 502;
      const msg = status === 402 ? "AI 크레딧이 부족합니다. 설정 → 요금제에서 충전 후 다시 시도해 주세요."
        : status === 429 ? "AI 요청이 많아 잠시 후 다시 시도해 주세요."
        : status === 403 ? "AI 사용이 막혀 있습니다. 관리자에게 문의해 주세요."
        : "영수증을 읽지 못했습니다.";
      return json({ error: msg }, status);
    }
    if (!text.trim()) return json({ error: "영수증 내용을 읽지 못했습니다. 더 밝고 반듯하게 찍어 주세요." }, 422);
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return json({ error: "AI 응답을 해석하지 못했습니다." }, 502); }
    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .filter((i: any) => i && typeof i.amount === "number")
      .map((i: any) => ({ ...i, category: EXPENSE_CATEGORIES.includes(i.category) ? i.category : "기타" }));
    return json({ ...parsed, items });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "판독 실패" }, 500);
  }
});
