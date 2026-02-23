import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get optional configId from body
    let configId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        configId = body?.configId || null;
      } catch { /* ignore */ }
    }

    // Fetch user's active api_configs
    let configQuery = supabase
      .from("api_configs")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (configId) {
      configQuery = configQuery.eq("id", configId);
    }

    const { data: configs, error: configError } = await configQuery;
    if (configError) throw configError;
    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma instância ativa encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get global config for baileys URL (same logic as process-queue)
    const { data: globalConfig } = await supabase
      .from("global_config")
      .select("whatsapp_provider, baileys_api_url")
      .limit(1)
      .single();

    const provider = globalConfig?.whatsapp_provider || "baileys";
    const baileysUrl = provider === "baileys"
      ? (globalConfig?.baileys_api_url || "http://baileys-server:3100")
      : (globalConfig?.baileys_api_url || "http://baileys-server:3100");
    
    console.log(`[sync-group-stats] provider=${provider}, baileysUrl=${baileysUrl}`);
    const today = new Date().toISOString().split("T")[0];

    let totalSynced = 0;
    let totalJoined = 0;
    let totalLeft = 0;
    const errors: string[] = [];

    for (const config of configs) {
      try {
        // Fetch groups from Baileys
        const groupsRes = await fetch(
          `${baileysUrl}/group/fetchAllGroups/${config.instance_name}`,
          { headers: { "Content-Type": "application/json" } }
        );

        if (!groupsRes.ok) {
          errors.push(`${config.instance_name}: HTTP ${groupsRes.status}`);
          continue;
        }

        const groupsData = await groupsRes.json();
        const groups = Array.isArray(groupsData) ? groupsData : (groupsData?.groups || []);

        if (groups.length === 0) continue;

        // Get event-based joined/left counts for today from group_participant_events
        const groupIds = groups.map((g: any) => g.id || g.jid);
        
        const { data: eventCounts } = await supabase
          .from("group_participant_events")
          .select("group_id, action")
          .eq("instance_name", config.instance_name)
          .in("group_id", groupIds)
          .gte("created_at", `${today}T00:00:00`)
          .lt("created_at", `${today}T23:59:59.999`);

        // Build event count map
        const eventMap: Record<string, { joined: number; left: number }> = {};
        for (const ev of (eventCounts || []) as any[]) {
          if (!eventMap[ev.group_id]) eventMap[ev.group_id] = { joined: 0, left: 0 };
          if (ev.action === "add") eventMap[ev.group_id].joined++;
          else if (ev.action === "remove") eventMap[ev.group_id].left++;
        }

        // Upsert today's stats
        const upsertRows = groups.map((g: any) => {
          const groupId = g.id || g.jid;
          const memberCount = g.size || g.participants?.length || 0;
          const events = eventMap[groupId] || { joined: 0, left: 0 };

          totalJoined += events.joined;
          totalLeft += events.left;

          return {
            user_id: user.id,
            instance_name: config.instance_name,
            group_id: groupId,
            group_name: g.subject || g.name || groupId,
            member_count: memberCount,
            joined_today: events.joined,
            left_today: events.left,
            snapshot_date: today,
          };
        });

        const { error: upsertError } = await supabase
          .from("group_stats")
          .upsert(upsertRows, {
            onConflict: "user_id,group_id,snapshot_date",
          });

        if (upsertError) {
          errors.push(`${config.instance_name}: ${upsertError.message}`);
        } else {
          totalSynced += upsertRows.length;
        }
      } catch (err: any) {
        errors.push(`${config.instance_name}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        joined: totalJoined,
        left: totalLeft,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
