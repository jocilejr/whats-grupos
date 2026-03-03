import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

async function getInternalApiUrl(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("global_config")
    .select("baileys_api_url")
    .limit(1)
    .maybeSingle();
  return (data?.baileys_api_url || "http://baileys-server:3100").replace(/\/$/, "");
}

const SEND_ACTIONS = new Set([
  "sendText", "sendMedia", "sendAudio", "sendSticker",
  "sendLocation", "sendContact", "sendPoll", "sendList",
]);

async function checkRateLimit(supabase: any, userId: string): Promise<{ limited: boolean; max: number }> {
  const { data: plan } = await supabase
    .from("user_plans")
    .select("max_messages_per_hour")
    .eq("user_id", userId)
    .maybeSingle();

  const max = plan?.max_messages_per_hour ?? 100;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("message_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  return { limited: (count || 0) >= max, max };
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

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const configId = url.searchParams.get("configId");

    // Internal headers — no apikey needed for Baileys internal connection
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    // Health check doesn't require configId
    if (action === "healthCheck") {
      const apiUrl = await getInternalApiUrl(supabase);
      try {
        const resp = await fetch(`${apiUrl}/health`);
        const data = await resp.json();
        return json({ status: "ok", ...data });
      } catch (e: any) {
        return json({ status: "error", error: e.message }, 500);
      }
    }

    if (!configId) return json({ error: "configId is required" }, 400);

    const { data: config, error: configError } = await supabase
      .from("api_configs")
      .select("*")
      .eq("id", configId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (configError || !config) return json({ error: "API config not found" }, 404);

    // Rate limiting for send actions
    if (action && SEND_ACTIONS.has(action)) {
      const { limited, max } = await checkRateLimit(supabase, user.id);
      if (limited) {
        return json({ error: `Limite de ${max} mensagens por hora atingido. Aguarde antes de enviar mais.` }, 429);
      }
    }

    const apiUrl = await getInternalApiUrl(supabase);
    const instanceName = url.searchParams.get("instanceName") || config.instance_name;

    let result: any;

    switch (action) {
      case "createInstance": {
        const resp = await fetch(`${apiUrl}/instance/create`, {
          method: "POST",
          headers,
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
        const rawText = await resp.text();
        console.log(`[fetchInstances] Status: ${resp.status}, Response: ${rawText.substring(0, 500)}`);
        try { result = JSON.parse(rawText); } catch { result = { raw: rawText }; }
        break;
      }

      case "connectInstance": {
        const connectUrl = `${apiUrl}/instance/connect/${instanceName}`;
        console.log(`[connectInstance] URL: ${connectUrl}`);
        const resp = await fetch(connectUrl, { headers });
        
        if (resp.status === 429) {
          result = await resp.json();
          break;
        }
        
        const rawText = await resp.text();
        console.log(`[connectInstance] Status: ${resp.status}, Response: ${rawText.substring(0, 500)}`);
        try { result = JSON.parse(rawText); } catch { result = { raw: rawText }; }
        // No retries — single attempt only
        break;
      }

      case "reconnectInstance": {
        // Step 1: Delete existing instance
        console.log(`[reconnectInstance] Deleting instance: ${instanceName}`);
        const delResp = await fetch(`${apiUrl}/instance/delete/${instanceName}`, {
          method: "DELETE", headers,
        });
        console.log(`[reconnectInstance] Delete status: ${delResp.status}`);
        
        // Step 2: Wait 5s before reconnecting
        await new Promise(r => setTimeout(r, 5000));
        
        // Step 3: Connect directly (no create — connect auto-creates session)
        console.log(`[reconnectInstance] Connecting instance: ${instanceName}`);
        const connectResp = await fetch(`${apiUrl}/instance/connect/${instanceName}`, { headers });
        
        if (connectResp.status === 429) {
          result = await connectResp.json();
          break;
        }
        
        const connectText = await connectResp.text();
        console.log(`[reconnectInstance] Connect response: ${connectText.substring(0, 500)}`);
        try { result = JSON.parse(connectText); } catch { result = { raw: connectText }; }
        break;
      }

      case "connectionState": {
        const stateUrl = `${apiUrl}/instance/connectionState/${instanceName}`;
        const resp = await fetch(stateUrl, { headers });
        const rawText = await resp.text();
        console.log(`[connectionState] Status: ${resp.status}, Response: ${rawText}`);
        try { result = JSON.parse(rawText); } catch { result = { raw: rawText }; }
        break;
      }

      case "fetchGroups": {
        const groupsUrl = `${apiUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`;
        let resp = await fetch(groupsUrl, { headers });
        
        if (resp.status === 500) {
          console.log(`[fetchGroups] Got 500, retrying after 2s...`);
          await new Promise(r => setTimeout(r, 2000));
          resp = await fetch(groupsUrl, { headers });
        }
        
        const rawText = await resp.text();
        console.log(`[fetchGroups] Status: ${resp.status}, Response length: ${rawText.length}`);
        
        if (resp.status === 500) {
          console.log(`[fetchGroups] Still 500, trying instance restart...`);
          await fetch(`${apiUrl}/instance/restart/${instanceName}`, { method: "PUT", headers });
          await new Promise(r => setTimeout(r, 3000));
          const retryResp = await fetch(groupsUrl, { headers });
          const retryText = await retryResp.text();
          try { result = JSON.parse(retryText); } catch { result = []; }
        } else {
          try { result = JSON.parse(rawText); } catch { result = { raw: rawText }; }
        }
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
          method: "POST", headers, body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendMedia": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
          method: "POST", headers, body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendAudio": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendWhatsAppAudio/${instanceName}`, {
          method: "POST", headers, body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendSticker": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendSticker/${instanceName}`, {
          method: "POST", headers, body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendLocation": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendLocation/${instanceName}`, {
          method: "POST", headers, body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendContact": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendContact/${instanceName}`, {
          method: "POST", headers, body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendPoll": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendPoll/${instanceName}`, {
          method: "POST", headers, body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "sendList": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendList/${instanceName}`, {
          method: "POST", headers, body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      case "deleteInstance": {
        const resp = await fetch(`${apiUrl}/instance/delete/${instanceName}`, {
          method: "DELETE", headers,
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
