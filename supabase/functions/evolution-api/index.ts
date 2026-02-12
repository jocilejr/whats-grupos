import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Server config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const configId = url.searchParams.get("configId");

    if (!configId) {
      return new Response(JSON.stringify({ error: "configId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the API config
    const { data: config, error: configError } = await supabase
      .from("api_configs")
      .select("*")
      .eq("id", configId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "API config not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = config.api_url.replace(/\/$/, "");
    const apiKey = config.api_key;
    const instanceName = url.searchParams.get("instanceName") || config.instance_name;
    const headers = { apikey: apiKey };

    let result: any;

    switch (action) {
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
        } catch (e) {
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

      case "sendButtons": {
        const body = await req.json();
        const resp = await fetch(`${apiUrl}/message/sendButtons/${instanceName}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        result = await resp.json();
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
