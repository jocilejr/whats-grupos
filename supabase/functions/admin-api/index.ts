import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminApiKey = Deno.env.get("ADMIN_API_KEY");

    // Auth: accept either ADMIN_API_KEY or a logged-in admin user
    const authHeader = req.headers.get("Authorization") ?? "";
    let isAuthorized = false;

    if (adminApiKey && authHeader === `Bearer ${adminApiKey}`) {
      isAuthorized = true;
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    if (!isAuthorized) {
      // Try JWT-based admin auth
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (roleData) isAuthorized = true;
      }
    }

    if (!isAuthorized) return json({ error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    switch (action) {
      case "createUser": {
        const body = await req.json();
        const { email, password, display_name, max_instances, max_messages_per_hour, max_campaigns, max_ai_requests_per_month } = body;

        if (!email || !password) return json({ error: "email and password required" }, 400);

        const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: display_name || email.split("@")[0] },
        });
        if (createErr) return json({ error: createErr.message }, 400);

        const userId = newUser.user.id;

        // Insert role
        await supabase.from("user_roles").insert({ user_id: userId, role: "user" });

        // Insert plan
        await supabase.from("user_plans").insert({
          user_id: userId,
          max_instances: max_instances ?? 1,
          max_messages_per_hour: max_messages_per_hour ?? 100,
          max_campaigns: max_campaigns ?? 5,
          max_ai_requests_per_month: max_ai_requests_per_month ?? 50,
        });

        return json({ success: true, user_id: userId, email });
      }

      case "updatePlan": {
        const body = await req.json();
        const { user_id, max_instances, max_messages_per_hour, max_campaigns, max_ai_requests_per_month, is_active } = body;
        if (!user_id) return json({ error: "user_id required" }, 400);

        const updates: Record<string, unknown> = {};
        if (max_instances !== undefined) updates.max_instances = max_instances;
        if (max_messages_per_hour !== undefined) updates.max_messages_per_hour = max_messages_per_hour;
        if (max_campaigns !== undefined) updates.max_campaigns = max_campaigns;
        if (max_ai_requests_per_month !== undefined) updates.max_ai_requests_per_month = max_ai_requests_per_month;
        if (is_active !== undefined) updates.is_active = is_active;

        const { error } = await supabase.from("user_plans").update(updates).eq("user_id", user_id);
        if (error) return json({ error: error.message }, 400);

        return json({ success: true });
      }

      case "listUsers": {
        const { data: plans } = await supabase.from("user_plans").select("*");
        const { data: profiles } = await supabase.from("profiles").select("*");
        const { data: roles } = await supabase.from("user_roles").select("*");

        const users = (profiles ?? []).map((p: any) => ({
          ...p,
          plan: (plans ?? []).find((pl: any) => pl.user_id === p.user_id),
          role: (roles ?? []).find((r: any) => r.user_id === p.user_id)?.role ?? "user",
        }));

        return json(users);
      }

      case "deleteUser": {
        const body = await req.json();
        const { user_id } = body;
        if (!user_id) return json({ error: "user_id required" }, 400);

        // Deactivate plan
        await supabase.from("user_plans").update({ is_active: false }).eq("user_id", user_id);

        return json({ success: true });
      }

      default:
        return json({ error: "Invalid action" }, 400);
    }
  } catch (error: any) {
    return json({ error: error.message }, 500);
  }
});
