import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createResponsesCall } from "../_shared/responses.ts";

// 부품 사진 + 모델 → ① 그 모델 도면 제목 중 어느 부분인지 후보 3장 ② 후보 도면 그림·부품표와 대조해 부품번호 후보
// AI는 후보만 고른다. 돌려주는 부품번호는 반드시 그 도면에 실제 있는 번호만 남긴다 (데이터는 바꾸지 않음).

const MODEL = "openai/gpt-6.1-sol";
const BASE = "https://ai.gateway.lovable.dev/v1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const parseJson = (text: string) => {
  const m = text.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m?.[0] ?? "{}"); } catch { return {}; }
};

const toBase64 = (buf: Uint8Array) => {
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};

const norm = (c: unknown) => String(c ?? "").toUpperCase().replace(/\s+/g, "");

/** 라벨에서 읽은 번호의 표기 변형 (하이픈 유무) */
const variantsOf = (c: string) => {
  const v = new Set([c, c.replace(/-/g, "")]);
  const bare = c.replace(/-/g, "");
  if (/^[0-9A-Z]{11,12}$/.test(bare)) v.add(`${bare.slice(0, 6)}-${bare.slice(6)}`);
  return [...v].filter(Boolean);
};

/**
 * 사진 속 부품 상자·라벨에서 읽은 번호를 실제 데이터와 맞춘다.
 * 그 기종 도면에 있는 번호 먼저, 없으면 재고에 있는 번호. 어디에도 없는 번호는 버린다.
 */
async function matchLabelCodes(db: any, codes: string[], diagrams: { id: string; title: string }[]) {
  const variants = [...new Set(codes.flatMap(variantsOf))];
  const byId = new Map(diagrams.map((d) => [d.id, d]));
  const found = new Map<string, any>();
  for (let i = 0; i < diagrams.length && found.size < codes.length; i += 300) {
    const { data } = await db.from("diagram_hotspots").select("diagram_id,part_code,part_name,callout_no")
      .in("diagram_id", diagrams.slice(i, i + 300).map((d) => d.id)).in("part_code", variants).limit(200);
    for (const h of data ?? []) {
      const key = norm(h.part_code).replace(/-/g, "");
      if (found.has(key)) continue;
      const d = byId.get(h.diagram_id);
      found.set(key, { diagram_id: h.diagram_id, title: d?.title ?? null, part_code: h.part_code, part_name: h.part_name, callout_no: h.callout_no ?? null });
    }
  }
  const missing = variants.filter((v) => !found.has(v.replace(/-/g, "")));
  if (missing.length) {
    const { data } = await db.from("inventory").select("part_code,part_name").in("part_code", missing).limit(20);
    for (const r of data ?? []) {
      const key = norm(r.part_code).replace(/-/g, "");
      if (!found.has(key)) found.set(key, { diagram_id: null, title: null, part_code: r.part_code, part_name: r.part_name, callout_no: null });
    }
  }
  return [...found.values()].slice(0, 5).map((m) => ({ ...m, confidence: "높음", reason: "사진 속 부품번호(라벨)를 읽었어요", source: "label" }));
}

async function ask(req: Request, apiKey: string, system: string, content: any[]) {
  const { result } = createResponsesCall(req, { baseURL: BASE, apiKey, model: MODEL }, [
    { role: "system", content: system },
    { role: "user", content },
  ]);
  return parseJson(await result.text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await db.auth.getUser();
    if (!u?.user) return json({ error: "로그인이 필요합니다." }, 401);
    const { data: staff } = await db.rpc("is_staff", { _user_id: u.user.id });
    if (!staff) return json({ error: "권한이 없습니다." }, 403);

    const body = await req.json().catch(() => ({}));
    const image = typeof body.image === "string" ? body.image : "";
    const model = typeof body.model === "string" ? body.model.slice(0, 80) : "";
    const ids: string[] = Array.isArray(body.diagram_ids) ? body.diagram_ids.filter((x: unknown) => typeof x === "string").slice(0, 1500) : [];
    if (!image.startsWith("data:image/") || image.length > 8_000_000) return json({ error: "사진이 올바르지 않습니다." }, 400);
    if (!model || ids.length === 0) return json({ error: "모델을 골라 주세요." }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI 설정이 없습니다." }, 500);

    // 도면 제목 목록 (RLS로 직원만)
    const diagrams: { id: string; title: string; image_path: string }[] = [];
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await db.from("diagrams").select("id,title,image_path").in("id", ids.slice(i, i + 300));
      if (error) throw error;
      diagrams.push(...(data ?? []));
    }
    if (diagrams.length === 0) return json({ error: "이 모델의 도면이 없습니다." }, 404);
    diagrams.sort((a, b) => a.title.localeCompare(b.title, "ko", { numeric: true }));
    const photo = { type: "image", image: new URL(image) };

    // ① 어느 부분(도면)인지
    const list = diagrams.map((d, i) => `${i + 1}. ${d.title}`).join("\n");
    const step1 = await ask(
      req, apiKey,
      "You are a parts expert for agricultural machinery (combines, tractors, rice transplanters, implements). Given a photo of a part (possibly mounted on the machine) and the list of parts-book figure titles for one model, pick the figures most likely to contain the photographed part. Also, if a part number is printed on a part, box, bag or tag in the photo, copy it exactly into label_codes (otherwise leave it empty; never guess). Reply ONLY with JSON: {\"description\":\"short Korean description of what the photo shows\",\"label_codes\":[\"part number as printed\"],\"picks\":[{\"n\":<figure number from list>,\"reason\":\"short Korean reason\"}]} with 1-3 picks, best first.",
      [{ type: "text", text: `모델: ${model}\n도면 목록:\n${list}` }, photo],
    );
    const picks = (Array.isArray(step1.picks) ? step1.picks : [])
      .map((p: any) => ({ d: diagrams[Number(p?.n) - 1], reason: String(p?.reason ?? "").slice(0, 200) }))
      .filter((p: any) => p.d)
      .filter((p: any, i: number, a: any[]) => a.findIndex((x) => x.d.id === p.d.id) === i)
      .slice(0, 3);
    const areas = picks.map((p: any) => ({ diagram_id: p.d.id, title: p.d.title, reason: p.reason }));
    const description = String(step1.description ?? "").slice(0, 300);

    // 라벨 번호가 실제 데이터와 맞으면 그걸로 끝 (두 번째 AI 호출 생략)
    const labelCodes = (Array.isArray(step1.label_codes) ? step1.label_codes : [])
      .map(norm).filter((c: string) => /^[0-9A-Z][0-9A-Z-]{4,29}$/.test(c)).slice(0, 5);
    if (labelCodes.length) {
      const labelMatches = await matchLabelCodes(db, labelCodes, diagrams);
      if (labelMatches.length) return json({ description, areas, matches: labelMatches });
    }
    if (picks.length === 0) return json({ description, areas: [], matches: [] });

    // ② 후보 도면 그림 + 부품표와 대조
    const figs = await Promise.all(picks.map(async (p: any) => {
      const { data: hs } = await db.from("diagram_hotspots").select("part_code,part_name,callout_no").eq("diagram_id", p.d.id).limit(2000);
      const parts = new Map<string, { part_code: string; part_name: string | null; callouts: Set<string> }>();
      for (const h of hs ?? []) {
        if (!h.part_code) continue;
        const e = parts.get(h.part_code) ?? { part_code: h.part_code, part_name: h.part_name, callouts: new Set<string>() };
        if (h.callout_no) e.callouts.add(String(h.callout_no));
        if (!e.part_name && h.part_name) e.part_name = h.part_name;
        parts.set(h.part_code, e);
      }
      const { data: file } = await db.storage.from("diagram-images").download(p.d.image_path);
      const img = file ? `data:image/jpeg;base64,${toBase64(new Uint8Array(await file.arrayBuffer()))}` : null;
      return { ...p, parts, img };
    }));

    const content: any[] = [{ type: "text", text: `모델: ${model}. 첫 번째 사진이 찾는 부품 사진입니다. 그 다음은 후보 도면입니다.` }, photo];
    figs.forEach((f: any, i: number) => {
      const rows = [...f.parts.values()].slice(0, 400)
        .map((p) => `${[...p.callouts].join("/") || "-"} | ${p.part_code} | ${p.part_name ?? ""}`).join("\n");
      content.push({ type: "text", text: `[도면 ${i + 1}] ${f.d.title}\n번호 | 부품번호 | 부품명\n${rows}` });
      if (f.img) content.push({ type: "image", image: new URL(f.img) });
    });
    const step2 = await ask(
      req, apiKey,
      "Compare the part photo with the candidate exploded diagrams and their parts lists. Identify which listed parts the photo most likely shows (the main part in focus). Use ONLY part numbers that appear in the given lists. Reply ONLY with JSON: {\"matches\":[{\"fig\":<diagram number>,\"part_code\":\"exact code from list\",\"confidence\":\"높음|보통|낮음\",\"reason\":\"short Korean reason\"}]} with up to 5 matches, best first. If unsure, give lower confidence instead of inventing.",
      content,
    );
    const matches = (Array.isArray(step2.matches) ? step2.matches : []).map((m: any) => {
      const f = figs[Number(m?.fig) - 1];
      const p = f?.parts.get(String(m?.part_code ?? "").trim());
      if (!f || !p) return null; // 도면에 없는 번호는 버린다
      return {
        diagram_id: f.d.id, title: f.d.title, part_code: p.part_code, part_name: p.part_name,
        callout_no: [...p.callouts][0] ?? null,
        confidence: ["높음", "보통", "낮음"].includes(m?.confidence) ? m.confidence : "낮음",
        reason: String(m?.reason ?? "").slice(0, 200),
        source: "diagram",
      };
    }).filter(Boolean).filter((m: any, i: number, a: any[]) => a.findIndex((x) => x.diagram_id === m.diagram_id && x.part_code === m.part_code) === i).slice(0, 5);

    return json({ description, areas, matches });
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    const msg = e instanceof Error ? e.message : "인식 실패";
    return json({ error: status === 402 ? "AI 크레딧이 부족합니다. 충전 후 다시 시도해 주세요." : status === 429 ? "요청이 많아요. 잠시 후 다시 시도해 주세요." : msg }, status && status >= 400 ? status : 500);
  }
});
