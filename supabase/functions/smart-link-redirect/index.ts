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
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // Fetch the smart link by slug
    const { data: smartLink, error: slError } = await supabase
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

    // Get latest member counts from group_stats using service role
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const groupIds = groupLinks.map((g) => g.group_id);

    // Get the most recent snapshot for each group
    const { data: stats } = await serviceSupabase
      .from("group_stats")
      .select("group_id, member_count, snapshot_date")
      .in("group_id", groupIds)
      .order("snapshot_date", { ascending: false });

    // Build a map of group_id -> latest member_count
    const memberCounts: Record<string, number> = {};
    if (stats) {
      for (const s of stats) {
        if (!(s.group_id in memberCounts)) {
          memberCounts[s.group_id] = s.member_count;
        }
      }
    }

    // Find first group with available space
    const maxMembers = smartLink.max_members_per_group;
    let redirectUrl: string | null = null;

    for (const gl of groupLinks) {
      const count = memberCounts[gl.group_id] ?? 0;
      if (count < maxMembers) {
        redirectUrl = gl.invite_url;
        break;
      }
    }

    // Fallback to last group if all are full
    if (!redirectUrl) {
      redirectUrl = groupLinks[groupLinks.length - 1].invite_url;
    }

    return new Response(JSON.stringify({ redirect_url: redirectUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
