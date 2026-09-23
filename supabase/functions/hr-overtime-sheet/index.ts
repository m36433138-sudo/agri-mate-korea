import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && now < _tokenExpiresAt - 300) return _cachedToken;

  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  const sa = JSON.parse(saJson);

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const headerB64 = encode({ alg: "RS256", typ: "JWT" });
  const claimB64 = encode({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  });
  const signInput = `${headerB64}.${claimB64}`;

  const pemContent = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const jwt = `${signInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) throw new Error(`OAuth token error: ${await tokenRes.text()}`);
  const tokenData = await tokenRes.json();
  _cachedToken = tokenData.access_token;
  _tokenExpiresAt = now + (tokenData.expires_in ?? 3600);
  return _cachedToken!;
}

function hrSheetId(): string {
  const raw = Deno.env.get("HR_GOOGLE_SHEETS_ID") || "";
  const cleaned = raw
    .replace(/^https?:\/\/docs\.google\.com\/spreadsheets\/d\//, "")
    .replace(/\/.*$/, "")
    .trim();
  if (!cleaned) throw new Error("HR_GOOGLE_SHEETS_ID is not configured");
  return cleaned;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sheetId = hrSheetId();
    const body = await req.json();
    const action = String(body.action || "");
    const accessToken = await getAccessToken();

    // List tab names
    if (action === "listTabs") {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Sheets metadata error [${res.status}]: ${await res.text()}`);
      const data = await res.json();
      const tabs = (data.sheets || []).map((s: { properties?: { title?: string } }) => s.properties?.title).filter(Boolean);
      return new Response(JSON.stringify({ tabs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read overtime rows of a tab (A:I, header on row 2)
    if (action === "readRows") {
      const tab = String(body.tab || "");
      if (!tab) throw new Error("tab is required");
      const range = `'${tab}'!A1:I200`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Sheets read error [${res.status}]: ${await res.text()}`);
      const data = await res.json();
      return new Response(JSON.stringify({ values: data.values || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tick the 지급 여부 (H) / 사인 여부 (I) checkboxes for a row
    if (action === "markPaidAndSigned") {
      const tab = String(body.tab || "");
      const rowIndex = Number(body.rowIndex);
      if (!tab || !rowIndex) throw new Error("tab and rowIndex are required");
      const paid = body.paid !== false;
      const signed = body.signed !== false;
      const range = `'${tab}'!H${rowIndex}:I${rowIndex}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[paid ? "TRUE" : "FALSE", signed ? "TRUE" : "FALSE"]] }),
      });
      if (!res.ok) throw new Error(`Sheets write error [${res.status}]: ${await res.text()}`);
      const result = await res.json();
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("hr-overtime-sheet error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
