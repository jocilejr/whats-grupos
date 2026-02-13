import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getGlobalConfig(supabase: any) {
  const { data, error } = await supabase
    .from("global_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !data || !data.evolution_api_url) {
    return null;
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User-scoped client for auth
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    // Service client for global config access
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const configId = url.searchParams.get("configId");

    if (!configId) return json({ error: "configId is required" }, 400);

    // Verify user owns this config
    const { data: config, error: configError } = await supabase
      .from("api_configs")
      .select("*")
      .eq("id", configId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (configError || !config) return json({ error: "API config not found" }, 404);

    // Get global Evolution API config
    const globalConfig = await getGlobalConfig(supabase);
    if (!globalConfig) return json({ error: "Evolution API not configured. Contact admin." }, 500);

    const apiUrl = globalConfig.evolution_api_url.replace(/\/$/, "");
    const apiKey = globalConfig.evolution_api_key;
    const instanceName = url.searchParams.get("instanceName") || config.instance_name;
    const headers = { apikey: apiKey };

    let result: any;

    switch (action) {
      case "createInstance": {
        const resp = await fetch(`${apiUrl}/instance/create`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceName: config.instance_name,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
          }),
        });
        result = await resp.json();
        break;
      }

      case "fetchInstances": {
        const resp = await fetch(`${apiUrl}/instance/fetchInstances`, { headers });
        result = await resp.json();
        break;
      }

      case "connectInstance": {
        const resp = await fetch(`${apiUrl}/instance/connect/${instanceName}`, { headers });
        result = await resp.json();
        break;
      }

      case "connectionState": {
        const resp = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, { headers });
        result = await resp.json();
        break;
      }

      case "fetchGroups": {
        const resp = await fetch(
          `${apiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
          { headers }
        );
        result = await resp.json();
        break;
      }

      case "testConnection": {
        try {
          const resp = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, { headers });
          result = await resp.json();
        } catch (e: any) {
          result = { error: "Cannot connect to API", details: e.message };
        }
        break;
      }

      case "sendText": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendMedia": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendAudio": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendWhatsAppAudio/${instanceName}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendSticker": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendSticker/${instanceName}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendLocation": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendLocation/${instanceName}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendContact": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendContact/${instanceName}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendPoll": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendPoll/${instanceName}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendList": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendList/${instanceName}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "deleteInstance": {
        const resp = await fetch(`${apiUrl}/instance/delete/${instanceName}`, {
          method: "DELETE",
          headers,
        });
        result = await resp.json();
        break;
      }

      default:
        return json({ error: "Invalid action" }, 400);
    }

    return json(result);
  } catch (error: any) {
    return json({ error: error.message }, 500);
  }
});
