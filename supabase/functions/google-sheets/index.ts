import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OAuth 토큰 캐시 (Edge Function warm 상태 동안 재사용 - 최대 1시간 유효)
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0; // unix timestamp (seconds)

// Get OAuth2 access token from service account
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // 만료 5분 전까지 캐시 재사용
  if (_cachedToken && now < _tokenExpiresAt - 300) {
    return _cachedToken;
  }
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");

  const sa = JSON.parse(saJson);

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
  // 캐시에 저장 (expires_in은 보통 3600초)
  _cachedToken = tokenData.access_token;
  _tokenExpiresAt = now + (tokenData.expires_in ?? 3600);
  return _cachedToken!;
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

    // Utility: copy formulas from one row to another
    if (action === "copyFormulas") {
      const { fromRow, toRow, cols } = body;
      if (!sheetName || !fromRow || !toRow || !cols) throw new Error("sheetName, fromRow, toRow, cols required");
      const accessToken = await getAccessToken();
      const colRange = `${cols[0]}${fromRow}:${cols[cols.length-1]}${fromRow}`;
      const fmtRange = encodeURIComponent(`'${sheetName}'!${colRange}`);
      const fmtUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${fmtRange}?valueRenderOption=FORMULA`;
      const fmtRes = await fetch(fmtUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!fmtRes.ok) throw new Error(`Failed to read formulas: ${await fmtRes.text()}`);
      const fmtData = await fmtRes.json();
      const formulas = fmtData.values?.[0] || [];
      const adjusted = formulas.map((f: unknown) => {
        const s = String(f ?? "");
        if (!s || !s.startsWith("=")) return s;
        return s.replace(new RegExp(String(fromRow), "g"), String(toRow));
      });
      const writeRange = encodeURIComponent(`'${sheetName}'!${cols[0]}${toRow}:${cols[cols.length-1]}${toRow}`);
      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`;
      const writeRes = await fetch(writeUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [adjusted] }),
      });
      if (!writeRes.ok) throw new Error(`Formula copy error: ${await writeRes.text()}`);
      const result = await writeRes.json();
      return new Response(JSON.stringify({ success: true, formulas: adjusted, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "updateCell") {
      const { col, value } = body;
      if (!sheetName || !rowIndex || !col) throw new Error("sheetName, rowIndex, and col are required for updateCell");
      const accessToken = await getAccessToken();
      const range = encodeURIComponent(`'${sheetName}'!${col}${rowIndex}`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;

      const writeRes = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[value ?? ""]] }),
      });

      if (!writeRes.ok) {
        const errBody = await writeRes.text();
        throw new Error(`Google Sheets updateCell error [${writeRes.status}]: ${errBody}`);
      }

      const result = await writeRes.json();
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // WRITE operation — add a new row to sheet
    if (action === "addRow") {
      if (!sheetName || !body.values) throw new Error("sheetName and values are required for addRow");
      const accessToken = await getAccessToken();
      const range = encodeURIComponent(`'${sheetName}'!A:R`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

      const writeRes = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [body.values] }),
      });

      if (!writeRes.ok) {
        const errBody = await writeRes.text();
        throw new Error(`Google Sheets append error [${writeRes.status}]: ${errBody}`);
      }

      const result = await writeRes.json();
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // WRITE operation — update specific cells in a row
    if (action === "updateRow") {
      if (!sheetName || !rowIndex || !body.values) throw new Error("sheetName, rowIndex, and values are required for updateRow");
      const accessToken = await getAccessToken();
      const range = encodeURIComponent(`'${sheetName}'!A${rowIndex}:R${rowIndex}`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;

      const writeRes = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [body.values] }),
      });

      if (!writeRes.ok) {
        const errBody = await writeRes.text();
        throw new Error(`Google Sheets update error [${writeRes.status}]: ${errBody}`);
      }

      const result = await writeRes.json();
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // WRITE operation — clear a row (행 내용 비우기 = 삭제)
    if (action === "clearRow") {
      if (!sheetName || !rowIndex) throw new Error("sheetName and rowIndex are required for clearRow");
      const accessToken = await getAccessToken();
      const range = encodeURIComponent(`'${sheetName}'!A${rowIndex}:R${rowIndex}`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:clear`;

      const clearRes = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      });

      if (!clearRes.ok) {
        const errBody = await clearRes.text();
        throw new Error(`Google Sheets clear error [${clearRes.status}]: ${errBody}`);
      }

      const result = await clearRes.json();
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

      const dateStr = body.date;
      const timeStr = body.time;

      // Write date to A and time to B
      const writeRange = encodeURIComponent(`'${techName}'!A${lastRow}:B${lastRow}`);
      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`;
      const writeRes = await fetch(writeUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[dateStr, timeStr]] }),
      });

      if (!writeRes.ok) throw new Error(`Clock-in write error: ${await writeRes.text()}`);

      // Write overtime formulas to D, E, F for the new row
      // D = morning OT: IF weekday AND B<08:30, 08:30-B, else 0
      // E = afternoon OT: IF weekday AND C>18:00, C-18:00, else 0
      // F = daily total: IF weekday, D+E, else C-B (total hours on weekends)
      try {
        const r = lastRow;
        const formulaD = `=IF(AND(B${r}<>"",C${r}<>""),IF(WEEKDAY(A${r},2)<=5,MAX(TIMEVALUE("08:30")-B${r},0),0),"")`;
        const formulaE = `=IF(AND(B${r}<>"",C${r}<>""),IF(WEEKDAY(A${r},2)<=5,MAX(C${r}-TIMEVALUE("18:00"),0),0),"")`;
        const formulaF = `=IF(AND(B${r}<>"",C${r}<>""),IF(WEEKDAY(A${r},2)<=5,D${r}+E${r},C${r}-B${r}),"")`;
        const fmlaRange = encodeURIComponent(`'${techName}'!D${r}:F${r}`);
        const fmlaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${fmlaRange}?valueInputOption=USER_ENTERED`;
        await fetch(fmlaUrl, {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [[formulaD, formulaE, formulaF]] }),
        });
      } catch (e) {
        console.error("Formula write failed (non-fatal):", e);
      }

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

      const todayDate = body.date; // e.g. "3-27"
      // Build multiple possible date representations for matching
      const parts = todayDate.split("-");
      const month = parts[0];
      const day = parts[1];
      const possibleFormats = [
        todayDate,                    // "3-27"
        `${month}/${day}`,            // "3/27"
        `${month}.${day}`,            // "3.27"
        `${month}-${day.padStart(2, "0")}`,  // "3-27" padded
        `${month.padStart(2, "0")}-${day.padStart(2, "0")}`, // "03-27"
        `${month}월 ${day}일`,        // "3월 27일"
      ];
      // Find the last row matching today's date in any format
      let targetRow = -1;
      for (let i = rows.length - 1; i >= 0; i--) {
        const cellA = (rows[i][0] || "").trim();
        // Also extract month/day from cell for numeric comparison
        const cellParts = cellA.split(/[-/.]/);
        const cellMatch = cellParts.length >= 2 && 
          parseInt(cellParts[cellParts.length === 3 ? 1 : 0]) === parseInt(month) &&
          parseInt(cellParts[cellParts.length === 3 ? 2 : 1]) === parseInt(day);
        if (possibleFormats.includes(cellA) || cellMatch) { targetRow = i + 1; break; }
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
      const existingMachines = await fetchAll("machines?select=serial_number");
      const existSerials = new Set(existingMachines.map((m: any) => m.serial_number));

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

    // SYNC operation — sync inventory from Google Sheets tabs
    if (action === "syncInventory") {
      const targetBranch = body.branch; // "장흥" or "강진"
      if (!targetBranch) throw new Error("branch is required for syncInventory");
      const tabName = targetBranch === "장흥" ? "재고창고(장흥)" : "재고창고(강진)";
      const accessToken = await getAccessToken();

      const readRange = encodeURIComponent(`'${tabName}'!A:S`);
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${readRange}?key=${apiKey}`;
      const readRes = await fetch(readUrl);
      if (!readRes.ok) throw new Error(`Failed to read ${tabName}: ${await readRes.text()}`);
      const readData = await readRes.json();
      const rows = (readData.values || []).slice(1); // skip header

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase config missing");

      const sbHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Prefer": "resolution=merge-duplicates",
      };

      // Map sheet columns to inventory fields
      // A=Parts Code, B=Parts Name (fallback C), D=Design Change Code, E=Sales Price, F=Stock Qty, H=Location main, I=Location sub
      const items: any[] = [];
      for (const row of rows) {
        const partCode = String(row[0] || "").trim(); // A column (index 0)
        const partName = String(row[1] || "").trim() || String(row[2] || "").trim(); // B column, fallback C
        if (!partCode || !partName) continue;
        items.push({
          branch: targetBranch,
          part_code: partCode,
          part_name: partName,
          alt_part_code: String(row[3] || "").trim() || null, // D column - design change code
          purchase_price: null,
          sales_price: parseInt(String(row[4] || "")) || null, // E
          quantity: parseInt(String(row[5] || "0")) || 0, // F
          location_main: String(row[7] || "").trim() || null, // H
          location_sub: String(row[8] || "").trim() || null, // I
        });
      }

      // Deduplicate by branch+part_code (keep last occurrence)
      const uniqueItems = Array.from(
        new Map(items.map(item => [`${item.branch}-${item.part_code}`, item])).values()
      );

      // Upsert in batches
      let synced = 0;
      const batchSize = 200;
      for (let i = 0; i < uniqueItems.length; i += batchSize) {
        const batch = uniqueItems.slice(i, i + batchSize);
        const res = await fetch(`${supabaseUrl}/rest/v1/inventory?on_conflict=branch,part_code`, {
          method: "POST",
          headers: sbHeaders,
          body: JSON.stringify(batch),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Inventory upsert error: ${errText}`);
        }
        synced += batch.length;
      }

      return new Response(JSON.stringify({ success: true, synced, total: rows.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // WRITE operation — clear a row (delete content)
    if (action === "clearRow") {
      if (!sheetName || !rowIndex) throw new Error("sheetName and rowIndex are required for clearRow");
      const accessToken = await getAccessToken();
      const range = encodeURIComponent(`'${sheetName}'!A${rowIndex}:R${rowIndex}`);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;

      const writeRes = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]] }),
      });

      if (!writeRes.ok) {
        const errBody = await writeRes.text();
        throw new Error(`Google Sheets clearRow error [${writeRes.status}]: ${errBody}`);
      }

      const result = await writeRes.json();
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // READ operation — use service account OAuth for restricted sheets
    if (!tab) throw new Error("Tab name is required");

    const accessToken = await getAccessToken();
    const range = encodeURIComponent(`'${tab}'!A:R`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;
    console.log("Fetching URL (OAuth):", url);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
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
