import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sheetId = Deno.env.get("GOOGLE_SHEETS_ID");
    const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");

    if (!sheetId) throw new Error("GOOGLE_SHEETS_ID is not configured");
    if (!apiKey) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");

    const { tab } = await req.json();
    if (!tab) throw new Error("Tab name is required");

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}!A:R?key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Sheets API error [${response.status}]: ${errorBody}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Google Sheets fetch error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
