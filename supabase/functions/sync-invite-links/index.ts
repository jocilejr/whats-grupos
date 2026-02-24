import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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

    // Collect all group_ids from all smart links
    const allGroupIds = new Set<string>();
    for (const sl of smartLinks) {
      const links = (sl.group_links as any[]) || [];
      links.forEach((g) => allGroupIds.add(g.group_id));
    }

    // For each user, call batch endpoint
    const inviteMap: Record<string, string | null> = {};
    let totalSynced = 0;
    const errors: string[] = [];

    for (const userId of userIds) {
      const userConfigs = configsByUser[userId] || [];
      if (!userConfigs.length) continue;

      // Get group_ids for this user's smart links
      const userSmartLinks = smartLinks.filter((sl) => sl.user_id === userId);
      const userGroupIds = new Set<string>();
      for (const sl of userSmartLinks) {
        const links = (sl.group_links as any[]) || [];
        links.forEach((g) => userGroupIds.add(g.group_id));
      }

      const jids = [...userGroupIds];
      if (!jids.length) continue;

      // Use first active config
      const config = userConfigs[0];
      try {
        const batchRes = await fetch(
          `${baileysUrl}/group/inviteCodeBatch/${config.instance_name}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jids }),
          }
        );

        if (!batchRes.ok) {
          errors.push(`${config.instance_name}: HTTP ${batchRes.status}`);
          continue;
        }

        const batchData = await batchRes.json();
        console.log(`[sync-invite-links] ${config.instance_name} raw response:`, JSON.stringify(batchData));
        
        const failedJids: string[] = [];
        for (const [jid, url] of Object.entries(batchData)) {
          inviteMap[jid] = url as string | null;
          if (!url) failedJids.push(jid);
        }
        
        if (failedJids.length > 0) {
          console.log(`[sync-invite-links] ${config.instance_name} groups without URL:`, failedJids);
        }

        totalSynced += jids.length;
      } catch (err: any) {
        errors.push(`${config.instance_name}: ${err.message}`);
      }
    }

    // Update group_stats with invite_url (latest snapshot per group)
    const today = new Date().toISOString().split("T")[0];
    for (const [groupId, inviteUrl] of Object.entries(inviteMap)) {
      await supabase
        .from("group_stats")
        .update({ invite_url: inviteUrl } as any)
        .eq("group_id", groupId)
        .eq("snapshot_date", today);
    }

    // Update campaign_smart_links.group_links with new URLs
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
