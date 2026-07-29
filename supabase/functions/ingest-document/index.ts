import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + CHUNK_SIZE));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

function toBase64(buf: Uint8Array): string {
  let binary = "";
  const chunkBytes = 0x8000;
  for (let i = 0; i < buf.length; i += chunkBytes) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunkBytes));
  }
  return btoa(binary);
}

async function extractTextViaGemini(
  apiKey: string,
  mime: string,
  base64: string,
): Promise<string> {
  const isImage = mime.startsWith("image/");
  const contentBlock = isImage
    ? { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
    : {
        type: "file",
        file: {
          filename: "document.pdf",
          file_data: `data:${mime};base64,${base64}`,
        },
      };

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      messages: [
        {
          role: "system",
          content:
            "당신은 문서 텍스트 추출기입니다. 첨부 파일에 있는 모든 텍스트를 원본 순서대로, 표/목록/헤더를 자연스러운 마크다운으로 유지하며 추출하세요. 절대 요약하거나 설명을 덧붙이지 마세요. 텍스트가 없으면 빈 문자열만 반환하세요.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "이 파일의 모든 텍스트를 추출해 주세요." },
            contentBlock,
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Text extraction failed: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function embedBatch(apiKey: string, inputs: string[]): Promise<number[][]> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: inputs,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Embedding failed: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  return (data.data as Array<{ embedding: number[]; index: number }>)
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

async function processDocument(
  admin: any,
  apiKey: string,
  documentId: string,
): Promise<void> {
  try {
    const { data: doc, error: docErr } = await admin
      .from("knowledge_documents")
      .select("id, file_path, mime_type")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) throw new Error(docErr?.message || "Document not found");

    const { data: fileBlob, error: dlErr } = await admin.storage
      .from("knowledge-docs")
      .download(doc.file_path);
    if (dlErr || !fileBlob) throw new Error(dlErr?.message || "Download failed");

    const buf = new Uint8Array(await fileBlob.arrayBuffer());
    const mime = doc.mime_type || "application/pdf";
    const base64 = toBase64(buf);

    // Clear old chunks
    await admin.from("knowledge_chunks").delete().eq("document_id", documentId);

    const text = await extractTextViaGemini(apiKey, mime, base64);
    const chunks = chunkText(text);
    let totalChunks = 0;

    if (chunks.length > 0) {
      const rows: any[] = [];
      for (let i = 0; i < chunks.length; i += 50) {
        const batch = chunks.slice(i, i + 50);
        const embeddings = await embedBatch(apiKey, batch);
        batch.forEach((content, idx) => {
          rows.push({
            document_id: documentId,
            chunk_index: rows.length,
            content,
            embedding: embeddings[idx],
            segment_index: 0,
            page_start: null,
            page_end: null,
          });
        });
      }
      const { error: insErr } = await admin
        .from("knowledge_chunks")
        .insert(rows);
      if (insErr) throw new Error(insErr.message);
      totalChunks = rows.length;
    }

    await admin
      .from("knowledge_documents")
      .update({
        status: "ready",
        chunk_count: totalChunks,
        processed_segments: 1,
        error_message: totalChunks === 0 ? "추출된 텍스트가 없습니다" : null,
      } as any)
      .eq("id", documentId);
  } catch (e) {
    console.error("ingest-document error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    await admin
      .from("knowledge_documents")
      .update({ status: "error", error_message: message })
      .eq("id", documentId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    const { document_id } = await req.json();
    if (!document_id) throw new Error("document_id required");

    await admin
      .from("knowledge_documents")
      .update({
        status: "processing",
        total_segments: 1,
        processed_segments: 0,
        error_message: null,
      } as any)
      .eq("id", document_id);

    // Run the heavy work in the background so the request never idles out (150s cap)
    // @ts-ignore EdgeRuntime is provided by the Supabase edge runtime
    EdgeRuntime.waitUntil(processDocument(admin, apiKey, document_id));

    return new Response(
      JSON.stringify({ ok: true, status: "processing" }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

