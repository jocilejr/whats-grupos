import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-instance-name",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate auth - must be service role key from Baileys server
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { groupId, groupName, participants, action, instanceName } = body;

    if (!groupId || !participants || !action || !instanceName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert one event per participant
    const events = (participants as string[]).map((jid: string) => ({
      instance_name: instanceName,
      group_id: groupId,
      group_name: groupName || groupId,
      participant_jid: jid,
      action,
      triggered_by: body.triggeredBy || null,
    }));

    const { error: insertError } = await supabase
      .from("group_participant_events")
      .insert(events);

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update member_count in group_stats if action is add/remove
    if (action === "add" || action === "remove") {
      const delta = action === "add" ? participants.length : -participants.length;

      // Get today's date
      const today = new Date().toISOString().split("T")[0];

      // Find the group_stats row for today to update member_count
      const { data: existing } = await supabase
        .from("group_stats")
        .select("id, member_count")
        .eq("group_id", groupId)
        .eq("snapshot_date", today)
        .limit(1)
        .single();

      if (existing) {
        await supabase
          .from("group_stats")
          .update({ member_count: Math.max(0, existing.member_count + delta) })
          .eq("id", existing.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted: events.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
