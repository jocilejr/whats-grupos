import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response("slug is required", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: smartLink, error: slError } = await supabase
      .from("campaign_smart_links")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (slError || !smartLink) {
      return new Response("Link not found or inactive", { status: 404, headers: corsHeaders });
    }

    const groupLinks = (smartLink.group_links as any[]).sort(
      (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)
    );

    if (!groupLinks.length) {
      return new Response("No groups configured", { status: 404, headers: corsHeaders });
    }

    const groupIds = groupLinks.map((g: any) => g.group_id);

    const { data: stats } = await supabase
      .from("group_stats")
      .select("group_id, member_count, snapshot_date, invite_url")
      .in("group_id", groupIds)
      .order("snapshot_date", { ascending: false });

    const memberCounts: Record<string, number> = {};
    const inviteUrls: Record<string, string | null> = {};
    if (stats) {
      for (const s of stats) {
        if (!(s.group_id in memberCounts)) {
          memberCounts[s.group_id] = s.member_count;
        }
        if (!(s.group_id in inviteUrls) && (s as any).invite_url) {
          inviteUrls[s.group_id] = (s as any).invite_url;
        }
      }
    }

    const maxMembers = smartLink.max_members_per_group;
    const currentGroupId = smartLink.current_group_id;
    let redirectUrl: string | null = null;
    let selectedGroupId: string | null = null;

    // Stick with current group if still below max
    if (currentGroupId) {
      const currentUrl = inviteUrls[currentGroupId];
      const currentCount = memberCounts[currentGroupId] ?? 0;
      if (currentUrl && currentCount < maxMembers) {
        redirectUrl = currentUrl;
        selectedGroupId = currentGroupId;
      }
    }

    // Current group full or invalid — find next with fewest members
    if (!redirectUrl) {
      let lowestCount = Infinity;
      for (const gl of groupLinks) {
        const u = inviteUrls[gl.group_id];
        if (!u) continue;
        const count = memberCounts[gl.group_id] ?? 0;
        if (count < maxMembers && count < lowestCount) {
          redirectUrl = u;
          selectedGroupId = gl.group_id;
          lowestCount = count;
        }
      }
    }

    // Fallback
    if (!redirectUrl) {
      for (let i = groupLinks.length - 1; i >= 0; i--) {
        const u = inviteUrls[groupLinks[i].group_id];
        if (u) {
          redirectUrl = u;
          selectedGroupId = groupLinks[i].group_id;
          break;
        }
      }
    }

    if (!redirectUrl) {
      return new Response("No available groups with invite links", { status: 404, headers: corsHeaders });
    }

    // Update current_group_id if changed
    if (selectedGroupId && selectedGroupId !== currentGroupId) {
      await supabase
        .from("campaign_smart_links")
        .update({ current_group_id: selectedGroupId })
        .eq("id", smartLink.id);
    }

    return new Response(redirectUrl, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});
