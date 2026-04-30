import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin using their JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { email, password, display_name, phone, role, customer_id, employee_id, team } = await req.json();

    if (!email || !password || !display_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with auto-confirm (no email verification needed)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Update phone and team if provided
    const profileUpdates: Record<string, string> = {};
    if (phone) profileUpdates.phone = phone;
    if (team) profileUpdates.team = team;
    if (Object.keys(profileUpdates).length > 0) {
      await adminClient.from("profiles").update(profileUpdates).eq("id", userId);
    }

    // Update role if not customer (trigger already sets customer)
    if (role && role !== "customer") {
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("user_roles").insert({ user_id: userId, role });

      if (role === "employee") {
        await adminClient.from("employee_permissions").insert(
          ["view_customers", "edit_customers", "manage_repairs", "view_machines", "add_machines"].map((key) => ({
            employee_id: userId,
            permission_key: key,
            is_allowed: false,
          }))
        );
      }
    }

    // If employee role, link to employees table record
    if (role === "employee" && employee_id) {
      await adminClient.from("employees").update({ user_id: userId }).eq("id", employee_id);
    }

    // If customer role, link to existing customer record or create one
    if (role === "customer") {
      if (customer_id) {
        // Link existing customer record to this user account
        await adminClient.from("customers").update({ user_id: userId }).eq("id", customer_id);
      } else {
        // Create a new customer record linked to this user
        await adminClient.from("customers").insert({
          name: display_name,
          phone: phone || "미입력",
          user_id: userId,
        });
      }
    }

    return new Response(JSON.stringify({ user: { id: userId, email } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
