import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get OAuth2 access token from service account
async function getAccessToken(): Promise<string> {
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");

  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT header and claim
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const headerB64 = encode(header);
  const claimB64 = encode(claim);
  const signInput = `${headerB64}.${claimB64}`;

  // Import the private key and sign
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
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signInput}.${sigB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`OAuth token error: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawId = Deno.env.get("GOOGLE_SHEETS_ID") || "";
    const sheetId = rawId.replace(/^\/d\//, "").replace(/\/$/, "").trim();
    const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");

    if (!sheetId) throw new Error("GOOGLE_SHEETS_ID is not configured");

    const body = await req.json();
    const { tab, action, rowIndex, sheetName } = body;

    // WRITE operation — mark row as complete
    if (action === "markComplete") {
      if (!rowIndex || !sheetName) throw new Error("rowIndex and sheetName are required for markComplete");
      const col = body.col || "P";
      const accessToken = await getAccessToken();
      const range = encodeURIComponent(`'${sheetName}'!${col}${rowIndex}`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;

      const writeRes = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [["TRUE"]] }),
      });

      if (!writeRes.ok) {
        const errBody = await writeRes.text();
        throw new Error(`Google Sheets write error [${writeRes.status}]: ${errBody}`);
      }

      const result = await writeRes.json();
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // WRITE operation — clock in (출근)
    if (action === "clockIn") {
      const techName = body.techName;
      if (!techName) throw new Error("techName is required for clockIn");
      const accessToken = await getAccessToken();

      // First, read column A to find the next empty row
      const readRange = encodeURIComponent(`'${techName}'!A:A`);
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${readRange}?key=${Deno.env.get("GOOGLE_SHEETS_API_KEY")}`;
      const readRes = await fetch(readUrl);
      if (!readRes.ok) throw new Error(`Failed to read sheet: ${await readRes.text()}`);
      const readData = await readRes.json();
      const lastRow = (readData.values?.length || 0) + 1;

      const dateStr = body.date; // e.g. "2026-03-21"
      const timeStr = body.time; // e.g. "08:30"

      // Write date to A and time to B
      const writeRange = encodeURIComponent(`'${techName}'!A${lastRow}:B${lastRow}`);
      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`;
      const writeRes = await fetch(writeUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[dateStr, timeStr]] }),
      });

      if (!writeRes.ok) throw new Error(`Clock-in write error: ${await writeRes.text()}`);
      const result = await writeRes.json();
      return new Response(JSON.stringify({ success: true, row: lastRow, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // WRITE operation — clock out (퇴근)
    if (action === "clockOut") {
      const techName = body.techName;
      if (!techName) throw new Error("techName is required for clockOut");
      const accessToken = await getAccessToken();

      // Read column A to find the last row with today's date
      const readRange = encodeURIComponent(`'${techName}'!A:C`);
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${readRange}?key=${Deno.env.get("GOOGLE_SHEETS_API_KEY")}`;
      const readRes = await fetch(readUrl);
      if (!readRes.ok) throw new Error(`Failed to read sheet: ${await readRes.text()}`);
      const readData = await readRes.json();
      const rows = readData.values || [];

      const todayDate = body.date; // e.g. "3-21" or "2026-03-21"
      // Find the last row matching today's date
      let targetRow = -1;
      for (let i = rows.length - 1; i >= 0; i--) {
        const cellA = (rows[i][0] || "").trim();
        if (cellA === todayDate) { targetRow = i + 1; break; }
      }

      if (targetRow === -1) throw new Error(`오늘(${todayDate}) 출근 기록을 찾을 수 없습니다. 먼저 출근을 눌러주세요.`);

      const timeStr = body.time;
      const writeRange = encodeURIComponent(`'${techName}'!C${targetRow}`);
      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`;
      const writeRes = await fetch(writeUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[timeStr]] }),
      });

      if (!writeRes.ok) throw new Error(`Clock-out write error: ${await writeRes.text()}`);
      const result = await writeRes.json();
      return new Response(JSON.stringify({ success: true, row: targetRow, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IMPORT operation — sync customers & machines from sheets to Supabase
    if (action === "importCustomersAndMachines") {
      const accessToken = await getAccessToken();
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase config missing");

      // 1. Read 고객목록
      const custRange = encodeURIComponent("'고객목록'") + "!A:D";
      const custUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${custRange}?key=${apiKey}`;
      const custRes = await fetch(custUrl);
      if (!custRes.ok) throw new Error(`Failed to read 고객목록: ${await custRes.text()}`);
      const custData = await custRes.json();
      const custRows = (custData.values || []).slice(1); // skip header

      // 2. Read 보유기계
      const machRange = encodeURIComponent("'보유기계'") + "!A:I";
      const machUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${machRange}?key=${apiKey}`;
      const machRes = await fetch(machUrl);
      if (!machRes.ok) throw new Error(`Failed to read 보유기계: ${await machRes.text()}`);
      const machData = await machRes.json();
      const machRows = (machData.values || []).slice(1); // skip header

      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      };

      // Helper: paginated fetch from Supabase REST API
      async function fetchAll(endpoint: string): Promise<any[]> {
        const all: any[] = [];
        let offset = 0;
        const limit = 1000;
        while (true) {
          const res = await fetch(`${supabaseUrl}/rest/v1/${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}&offset=${offset}`, { headers });
          const data = await res.json();
          if (!Array.isArray(data)) break;
          all.push(...data);
          if (data.length < limit) break;
          offset += limit;
        }
        return all;
      }

      // 3. Upsert customers — use name+phone as unique key
      const existingCustomers = await fetchAll("customers?select=id,name,phone");
      const custMap = new Map<string, string>(); // "name|phone" -> id
      for (const c of existingCustomers) {
        custMap.set(`${c.name}|${c.phone}`, c.id);
      }

      // Sheet 고객ID -> Supabase UUID mapping
      const sheetIdToUuid = new Map<string, string>();

      let custInserted = 0;
      let custSkipped = 0;
      const batchSize = 200;

      for (let i = 0; i < custRows.length; i += batchSize) {
        const batch = custRows.slice(i, i + batchSize);
        const toInsert: { name: string; phone: string; address: string | null }[] = [];
        
        for (const row of batch) {
          const sheetCustId = String(row[0] || "").trim();
          const name = String(row[1] || "").trim();
          const phone = String(row[2] || "").trim();
          const address = row[3] ? String(row[3]).trim() : null;
          if (!name || !phone) { custSkipped++; continue; }

          const key = `${name}|${phone}`;
          if (custMap.has(key)) {
            sheetIdToUuid.set(sheetCustId, custMap.get(key)!);
            custSkipped++;
          } else {
            toInsert.push({ name, phone, address });
          }
        }

        if (toInsert.length > 0) {
          const insRes = await fetch(`${supabaseUrl}/rest/v1/customers`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=representation" },
            body: JSON.stringify(toInsert),
          });
          if (!insRes.ok) {
            const errText = await insRes.text();
            console.error("Customer insert error:", errText);
          } else {
            const inserted: { id: string; name: string; phone: string }[] = await insRes.json();
            for (const c of inserted) {
              custMap.set(`${c.name}|${c.phone}`, c.id);
            }
            custInserted += inserted.length;
          }
        }
      }

      // Re-map sheet IDs for all customers
      for (const row of custRows) {
        const sheetCustId = String(row[0] || "").trim();
        const name = String(row[1] || "").trim();
        const phone = String(row[2] || "").trim();
        const key = `${name}|${phone}`;
        if (custMap.has(key)) {
          sheetIdToUuid.set(sheetCustId, custMap.get(key)!);
        }
      }

      // 4. Insert machines — skip duplicates by serial_number
      const existMachRes = await fetch(`${supabaseUrl}/rest/v1/machines?select=serial_number`, { headers });
      const existingMachines: { serial_number: string }[] = await existMachRes.json();
      const existSerials = new Set(existingMachines.map(m => m.serial_number));

      let machInserted = 0;
      let machSkipped = 0;

      for (let i = 0; i < machRows.length; i += batchSize) {
        const batch = machRows.slice(i, i + batchSize);
        const toInsert: any[] = [];

        for (const row of batch) {
          const sheetCustId = String(row[0] || "").trim();
          const machineType = String(row[3] || "").trim();
          const modelName = String(row[4] || "").trim();
          const engineNumber = String(row[5] || "").trim() || null;
          const serialNumber = String(row[6] || "").trim();
          const saleDate = String(row[7] || "").trim() || null;
          const classification = String(row[8] || "").trim() || null;

          if (!serialNumber || !modelName) { machSkipped++; continue; }
          if (existSerials.has(serialNumber)) { machSkipped++; continue; }

          const customerId = sheetIdToUuid.get(sheetCustId) || null;

          toInsert.push({
            customer_id: customerId,
            model_name: modelName,
            serial_number: serialNumber,
            machine_type: machineType || "기타",
            entry_date: saleDate || new Date().toISOString().split("T")[0],
            purchase_price: 0,
            sale_date: saleDate || null,
            sale_price: null,
            status: "판매완료",
            engine_number: engineNumber,
            classification: classification,
          });
          existSerials.add(serialNumber);
        }

        if (toInsert.length > 0) {
          const insRes = await fetch(`${supabaseUrl}/rest/v1/machines`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify(toInsert),
          });
          if (!insRes.ok) {
            const errText = await insRes.text();
            console.error("Machine insert error:", errText);
          } else {
            machInserted += toInsert.length;
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        customers: { inserted: custInserted, skipped: custSkipped, total: custRows.length },
        machines: { inserted: machInserted, skipped: machSkipped, total: machRows.length },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // READ operation
    if (!tab) throw new Error("Tab name is required");
    if (!apiKey) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");

    const range = encodeURIComponent(`'${tab}'`) + "!A:R";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
    console.log("Fetching URL:", url.replace(apiKey, "REDACTED"));

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
    console.error("Google Sheets error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
