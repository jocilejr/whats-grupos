import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if a single group_id was requested
    let singleGroupId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        singleGroupId = body.group_id || null;
      } catch {
        // no body or invalid JSON, proceed with all groups
      }
    }

    // Fetch all active smart links
    const { data: smartLinks, error: slError } = await supabase
      .from("campaign_smart_links")
      .select("*")
      .eq("is_active", true);

    if (slError) throw slError;
    if (!smartLinks || smartLinks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active smart links" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Collect unique user_ids
    const userIds = [...new Set(smartLinks.map((sl) => sl.user_id))];

    // Fetch active api_configs for these users
    const { data: configs, error: cfgError } = await supabase
      .from("api_configs")
      .select("*")
      .in("user_id", userIds)
      .eq("is_active", true);

    if (cfgError) throw cfgError;

    // Get global config for baileys URL
    const { data: globalConfig } = await supabase
      .from("global_config")
      .select("baileys_api_url, whatsapp_provider")
      .limit(1)
      .single();

    const baileysUrl = globalConfig?.baileys_api_url && globalConfig.baileys_api_url !== "http://baileys-server:3100"
      ? globalConfig.baileys_api_url
      : "http://baileys-server:3100";

    // Build config map: user_id -> configs[]
    const configsByUser: Record<string, any[]> = {};
    for (const cfg of (configs || [])) {
      if (!configsByUser[cfg.user_id]) configsByUser[cfg.user_id] = [];
      configsByUser[cfg.user_id].push(cfg);
    }

    // ── SINGLE GROUP MODE ──
    if (singleGroupId) {
      // Find the user/config that owns this group
      let config: any = null;
      for (const sl of smartLinks) {
        const links = (sl.group_links as any[]) || [];
        if (links.some((g) => g.group_id === singleGroupId)) {
          const userConfigs = configsByUser[sl.user_id] || [];
          if (userConfigs.length) config = userConfigs[0];
          break;
        }
      }

      if (!config) {
        return new Response(
          JSON.stringify({ success: false, group_id: singleGroupId, error: "No config found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let inviteUrl: string | null = null;
      let error: string | null = null;
      const maxAttempts = 3;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const res = await fetch(`${baileysUrl}/group/inviteCode/${config.instance_name}/${singleGroupId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          inviteUrl = data.invite_url || null;

          if (inviteUrl) {
            console.log(`[sync-invite-links] ✅ single ${singleGroupId} attempt ${attempt + 1} -> ${inviteUrl}`);
            break;
          }

          // invite_url is null — treat as failure
          console.log(`[sync-invite-links] ⚠️ single ${singleGroupId} attempt ${attempt + 1}/${maxAttempts} got null invite_url`);
          if (attempt < maxAttempts - 1) {
            const delay = 2000 * Math.pow(2, attempt);
            await sleep(delay);
          }
        } catch (err: any) {
          const delay = 2000 * Math.pow(2, attempt);
          console.log(`[sync-invite-links] ❌ single ${singleGroupId} attempt ${attempt + 1}/${maxAttempts} failed: ${err.message}, waiting ${delay}ms...`);
          if (attempt < maxAttempts - 1) {
            await sleep(delay);
          } else {
            error = err.message;
          }
        }
      }

      // Update group_stats
      const today = new Date().toISOString().split("T")[0];
      if (inviteUrl) {
        await supabase
          .from("group_stats")
          .update({ invite_url: inviteUrl } as any)
          .eq("group_id", singleGroupId)
          .eq("snapshot_date", today);
      }

      // Update smart link group_links
      for (const sl of smartLinks) {
        const links = (sl.group_links as any[]) || [];
        const idx = links.findIndex((g: any) => g.group_id === singleGroupId);
        if (idx >= 0 && inviteUrl) {
          links[idx].invite_url = inviteUrl;
          await supabase
            .from("campaign_smart_links")
            .update({ group_links: links as any })
            .eq("id", sl.id);
        }
      }

      return new Response(
        JSON.stringify({ success: !error, group_id: singleGroupId, invite_url: inviteUrl, error }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ALL GROUPS MODE (existing behavior) ──
    const inviteMap: Record<string, string | null> = {};
    let totalSynced = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      const userConfigs = configsByUser[userId] || [];
      if (!userConfigs.length) continue;

      const userSmartLinks = smartLinks.filter((sl) => sl.user_id === userId);
      const userGroupIds = new Set<string>();
      for (const sl of userSmartLinks) {
        const links = (sl.group_links as any[]) || [];
        links.forEach((g) => userGroupIds.add(g.group_id));
      }

      const jids = [...userGroupIds];
      if (!jids.length) continue;

      const config = userConfigs[0];

      for (const jid of jids) {
        const maxAttempts = 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const res = await fetch(`${baileysUrl}/group/inviteCode/${config.instance_name}/${jid}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            inviteMap[jid] = data.invite_url || null;

            if (inviteMap[jid]) {
              console.log(`[sync-invite-links] ✅ ${jid} attempt ${attempt + 1} -> ${data.invite_url}`);
              break;
            }

            console.log(`[sync-invite-links] ⚠️ ${jid} attempt ${attempt + 1}/${maxAttempts} got null invite_url`);
            if (attempt < maxAttempts - 1) {
              const delay = 2000 * Math.pow(2, attempt);
              await sleep(delay);
            }
          } catch (err: any) {
            console.log(`[sync-invite-links] ❌ ${jid} attempt ${attempt + 1}/${maxAttempts} failed: ${err.message}`);
            inviteMap[jid] = null;
            if (attempt < maxAttempts - 1) {
              const delay = 2000 * Math.pow(2, attempt);
              await sleep(delay);
            } else {
              errors.push(`${jid}: ${err.message}`);
            }
          }
        }
        totalSynced++;
        await sleep(1500);
      }
    }

    // Update group_stats
    const today = new Date().toISOString().split("T")[0];
    for (const [groupId, inviteUrl] of Object.entries(inviteMap)) {
      await supabase
        .from("group_stats")
        .update({ invite_url: inviteUrl } as any)
        .eq("group_id", groupId)
        .eq("snapshot_date", today);
    }

    // Update campaign_smart_links
    for (const sl of smartLinks) {
      const links = (sl.group_links as any[]) || [];
      let changed = false;
      const updatedLinks = links.map((g: any) => {
        const newUrl = inviteMap[g.group_id];
        if (newUrl !== undefined && newUrl !== g.invite_url) {
          changed = true;
          return { ...g, invite_url: newUrl || "" };
        }
        return g;
      });
      if (changed) {
        await supabase
          .from("campaign_smart_links")
          .update({ group_links: updatedLinks as any })
          .eq("id", sl.id);
      }
    }

    const failedGroups = Object.entries(inviteMap)
      .filter(([, url]) => !url)
      .map(([jid]) => jid);

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        failed_groups: failedGroups.length > 0 ? failedGroups : undefined,
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
