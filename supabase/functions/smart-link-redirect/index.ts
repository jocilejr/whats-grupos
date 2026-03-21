import { createClient } from "npm:@supabase/supabase-js@2";

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
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the smart link by slug
    const { data: smartLink, error: slError } = await serviceSupabase
      .from("campaign_smart_links")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (slError || !smartLink) {
      return new Response(
        JSON.stringify({ error: "Link not found or inactive" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const groupLinks = (smartLink.group_links as any[]).sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );

    if (!groupLinks.length) {
      return new Response(
        JSON.stringify({ error: "No groups configured" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const groupIds = groupLinks.map((g) => g.group_id);

    // Get latest member counts AND invite_url from group_stats
    const { data: stats } = await serviceSupabase
      .from("group_stats")
      .select("group_id, member_count, snapshot_date, invite_url")
      .in("group_id", groupIds)
      .order("snapshot_date", { ascending: false });

    // Build maps: group_id -> latest member_count, group_id -> latest non-null invite_url
    const memberCounts: Record<string, number> = {};
    const inviteUrls: Record<string, string | null> = {};
    if (stats) {
      for (const s of stats) {
        // Always take the first (latest) member count
        if (!(s.group_id in memberCounts)) {
          memberCounts[s.group_id] = s.member_count;
        }
        // Take the first (latest) non-null invite_url
        if (!(s.group_id in inviteUrls) && (s as any).invite_url) {
          inviteUrls[s.group_id] = (s as any).invite_url;
        }
      }
    }

    // Find first group with available space AND a valid invite_url
    const maxMembers = smartLink.max_members_per_group;
    let redirectUrl: string | null = null;
    let selectedGroupId: string | null = null;

    for (const gl of groupLinks) {
      const url = inviteUrls[gl.group_id];
      if (!url) continue; // Skip groups without invite URL (bot not admin)
      
      const count = memberCounts[gl.group_id] ?? 0;
      if (count < maxMembers) {
        redirectUrl = url;
        selectedGroupId = gl.group_id;
        break;
      }
    }

    // Fallback: last group with a valid URL
    if (!redirectUrl) {
      for (let i = groupLinks.length - 1; i >= 0; i--) {
        const url = inviteUrls[groupLinks[i].group_id];
        if (url) {
          redirectUrl = url;
          selectedGroupId = groupLinks[i].group_id;
          break;
        }
      }
    }

    if (!redirectUrl || !selectedGroupId) {
      return new Response(
        JSON.stringify({ error: "No available groups with invite links" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Record the click
    await serviceSupabase
      .from("smart_link_clicks")
      .insert({
        smart_link_id: smartLink.id,
        group_id: selectedGroupId,
      });

    return new Response(JSON.stringify({ redirect_url: redirectUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
