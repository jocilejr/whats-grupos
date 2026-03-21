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
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );

    if (!groupLinks.length) {
      return new Response("No groups configured", { status: 404, headers: corsHeaders });
    }

    const groupIds = groupLinks.map((g) => g.group_id);

    const { data: stats } = await supabase
      .from("group_stats")
      .select("group_id, member_count, snapshot_date, invite_url")
      .in("group_id", groupIds)
      .order("snapshot_date", { ascending: false });

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

    const maxMembers = smartLink.max_members_per_group;
    let redirectUrl: string | null = null;

    for (const gl of groupLinks) {
      const u = inviteUrls[gl.group_id];
      if (!u) continue;
      const count = memberCounts[gl.group_id] ?? 0;
      if (count < maxMembers) {
        redirectUrl = u;
        break;
      }
    }

    if (!redirectUrl) {
      for (let i = groupLinks.length - 1; i >= 0; i--) {
        const u = inviteUrls[groupLinks[i].group_id];
        if (u) {
          redirectUrl = u;
          break;
        }
      }
    }

    if (!redirectUrl) {
      return new Response("No available groups with invite links", { status: 404, headers: corsHeaders });
    }

    return new Response(redirectUrl, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});
