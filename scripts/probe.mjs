import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import fs from "fs";
globalThis.WebSocket = WebSocket;

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const creds = JSON.parse(fs.readFileSync("/dev-server/.test-credentials.json","utf8"));

const c = createClient(URL, KEY, { auth: { persistSession: false }});
const { error } = await c.auth.signInWithPassword({ email: creds.users.customer.email, password: creds.password });
if (error) { console.error("login fail", error); process.exit(1); }
console.log("logged in as customer");

const ch = c.channel("operations:장흥", { config: { private: true }});
ch.on("system", {}, p => console.log("[system]", JSON.stringify(p)));
ch.on("broadcast", { event: "*" }, p => console.log("[bcast]", p));
ch.subscribe((status, err) => console.log("[status]", status, err?.message || ""));

await new Promise(r => setTimeout(r, 6000));
console.log("done"); process.exit(0);
