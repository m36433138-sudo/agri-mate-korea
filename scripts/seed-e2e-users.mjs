import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.argv[2];
if (!URL || !SERVICE || !PASSWORD) {
  console.error("Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env, and password arg");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const accounts = [
  { email: "e2e-admin@ym.local", role: "admin" },
  { email: "e2e-employee@ym.local", role: "employee" },
  { email: "e2e-customer@ym.local", role: "customer" },
];

const result = { password: PASSWORD, users: {} };

for (const acc of accounts) {
  // find existing
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = list.users.find(u => u.email === acc.email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: acc.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log("created", acc.email, user.id);
  } else {
    // ensure password & confirmed
    await admin.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    console.log("updated", acc.email, user.id);
  }

  // upsert role
  await admin.from("user_roles").delete().eq("user_id", user.id);
  const { error: rErr } = await admin.from("user_roles").insert({ user_id: user.id, role: acc.role });
  if (rErr) throw rErr;

  // employee: link to an employees row (create dedicated test employee)
  if (acc.role === "employee") {
    const { data: existing } = await admin.from("employees").select("id").eq("name", "E2E 테스트 기사").maybeSingle();
    let empId = existing?.id;
    if (!empId) {
      const { data: ins, error: eErr } = await admin.from("employees")
        .insert({ name: "E2E 테스트 기사", user_id: user.id, is_active: true, team: "기사" })
        .select("id").single();
      if (eErr) throw eErr;
      empId = ins.id;
    } else {
      await admin.from("employees").update({ user_id: user.id, is_active: true }).eq("id", empId);
    }
    result.users[acc.role] = { email: acc.email, authUid: user.id, employeeId: empId };
  } else {
    result.users[acc.role] = { email: acc.email, authUid: user.id };
  }
}

fs.writeFileSync("/dev-server/.test-credentials.json", JSON.stringify(result, null, 2));
console.log("\nWrote /dev-server/.test-credentials.json");
console.log(JSON.stringify(result, null, 2));
