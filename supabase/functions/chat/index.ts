import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!roleData || !["admin", "employee"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "접근 권한이 없습니다." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length > 30 || messages.some((m: any) => !["user", "assistant"].includes(m?.role) || typeof m?.content !== "string" || m.content.length > 4000)) {
      return new Response(JSON.stringify({ error: "요청 형식이 올바르지 않습니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current data context
    const [machinesRes, customersRes, repairsRes] = await Promise.all([
      supabase.from("machines").select("id, model_name, serial_number, machine_type, status, entry_date, purchase_price, sale_price, sale_date, customer_id, notes"),
      supabase.from("customers").select("id, name, phone, address"),
      supabase.from("repair_history").select("id, machine_id, repair_date, repair_content, parts_used, cost, technician"),
    ]);

    const machines = machinesRes.data || [];
    const customers = customersRes.data || [];
    const repairs = repairsRes.data || [];

    // Build context summary
    const stockMachines = machines.filter((m) => m.status === "재고중");
    const soldMachines = machines.filter((m) => m.status === "판매완료");
    const newMachines = machines.filter((m) => m.machine_type === "새기계");
    const usedMachines = machines.filter((m) => m.machine_type === "중고기계");

    const contextSummary = `
## 현재 데이터베이스 현황

### 기계 현황 (총 ${machines.length}대)
- 재고중: ${stockMachines.length}대 (새기계: ${stockMachines.filter(m => m.machine_type === "새기계").length}, 중고: ${stockMachines.filter(m => m.machine_type === "중고기계").length})
- 판매완료: ${soldMachines.length}대
- 새기계: ${newMachines.length}대 / 중고기계: ${usedMachines.length}대

### 기계 목록
${machines.map((m) => {
  const customer = m.customer_id ? customers.find((c) => c.id === m.customer_id) : null;
  return `- ${m.model_name} (${m.serial_number}) | ${m.machine_type} | ${m.status} | 입고일: ${m.entry_date} | 매입가: ${m.purchase_price?.toLocaleString()}원${m.sale_price ? ` | 판매가: ${m.sale_price.toLocaleString()}원` : ""}${m.sale_date ? ` | 판매일: ${m.sale_date}` : ""}${customer ? ` | 고객: ${customer.name}` : ""}${m.notes ? ` | 메모: ${m.notes}` : ""}`;
}).join("\n")}

### 고객 목록 (총 ${customers.length}명)
${customers.map((c) => `- ${c.name} | ${c.phone}${c.address ? ` | ${c.address}` : ""}`).join("\n")}

### 수리 이력 (총 ${repairs.length}건)
${repairs.map((r) => {
  const machine = machines.find((m) => m.id === r.machine_id);
  return `- ${r.repair_date} | ${machine?.model_name || "알 수 없음"} (${machine?.serial_number || ""}) | ${r.repair_content}${r.parts_used ? ` | 부품: ${r.parts_used}` : ""}${r.cost ? ` | 비용: ${r.cost.toLocaleString()}원` : ""}${r.technician ? ` | 기사: ${r.technician}` : ""}`;
}).join("\n")}
`;

    const systemPrompt = `당신은 농기계 관리 시스템 "AgriManager"의 AI 어시스턴트입니다.
사용자가 재고 현황, 수리 이력, 고객 정보, 매출 분석 등에 대해 질문하면 아래 데이터를 기반으로 정확하고 친절하게 답변해 주세요.
답변은 항상 한국어로 해주세요. 숫자는 천 단위 구분자를 사용하세요.
분석이나 요약을 요청받으면 표나 목록 형태로 깔끔하게 정리해 주세요.

${contextSummary}`;

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
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI 크레딧이 부족합니다." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI 서비스 오류가 발생했습니다." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: "AI 응답 중 오류가 발생했습니다." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
