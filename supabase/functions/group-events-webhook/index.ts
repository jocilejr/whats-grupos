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

    console.log("[webhook] Received request:", req.method, req.url);

    // Validate auth - must be service role key from Baileys server
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
      console.error("[webhook] Auth failed. Header present:", !!authHeader);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    console.log("[webhook] Body received:", JSON.stringify({
      groupId: body.groupId,
      action: body.action,
      instanceName: body.instanceName,
      participantCount: body.participants?.length ?? 0,
    }));

    const { groupId, groupName, participants, action, instanceName } = body;

    if (!groupId || !participants || !action || !instanceName) {
      console.error("[webhook] Missing fields:", { groupId: !!groupId, participants: !!participants, action: !!action, instanceName: !!instanceName });
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

    console.log("[webhook] Inserting", events.length, "events for action:", action);

    const { data: insertedData, error: insertError } = await supabase
      .from("group_participant_events")
      .insert(events)
      .select("id");

    if (insertError) {
      console.error("[webhook] Insert error:", JSON.stringify(insertError));
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[webhook] Inserted successfully:", insertedData?.length, "rows");

    // Update member_count in group_stats if action is add/remove
    if (action === "add" || action === "remove") {
      const delta = action === "add" ? participants.length : -participants.length;
      const today = new Date().toISOString().split("T")[0];

      const { data: existing } = await supabase
        .from("group_stats")
        .select("id, member_count, joined_today, left_today")
        .eq("group_id", groupId)
        .eq("snapshot_date", today)
        .limit(1)
        .single();

      if (existing) {
        const updateData: any = {
          member_count: Math.max(0, existing.member_count + delta),
        };
        if (action === "add") {
          updateData.joined_today = existing.joined_today + participants.length;
        } else {
          updateData.left_today = existing.left_today + participants.length;
        }

        await supabase
          .from("group_stats")
          .update(updateData)
          .eq("id", existing.id);

        console.log("[webhook] Updated group_stats:", groupId, "delta:", delta);
      } else {
        console.log("[webhook] No group_stats row found for today, skipping update");
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted: events.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[webhook] Unhandled error:", err.message, err.stack);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
