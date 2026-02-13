import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PRODUCER: This function only inserts items into message_queue.
// The actual sending is done by process-queue.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this is a manual trigger
    let manualMessageId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        manualMessageId = body?.messageId || null;
      } catch { /* ignore */ }
    }

    if (manualMessageId) {
      return await handleManualTrigger(supabase, manualMessageId);
    }

    return await handleCronTrigger(supabase);
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleManualTrigger(supabase: any, messageId: string) {
  const { data: msg } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("id", messageId)
    .eq("is_active", true)
    .maybeSingle();

  if (!msg) {
    return new Response(JSON.stringify({ error: "Message not found or inactive" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const queued = await enqueueMessage(supabase, msg);

  return new Response(JSON.stringify({ queued, manual: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCronTrigger(supabase: any) {
  const { data: messages, error: fetchError } = await supabase.rpc("claim_due_messages");

  if (fetchError) {
    console.error("Claim error:", fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!messages?.length) {
    return new Response(JSON.stringify({ queued: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let totalQueued = 0;
  for (const msg of messages) {
    try {
      const queued = await enqueueMessage(supabase, msg);
      totalQueued += queued;

      // Finalize the scheduled message (update next_run_at, etc.)
      const now = new Date();
      if (msg.schedule_type === "once") {
        await supabase.from("scheduled_messages").update({
          is_active: false, last_run_at: now.toISOString(), next_run_at: null,
          processing_started_at: null, last_completed_at: now.toISOString(),
        }).eq("id", msg.id);
      } else {
        const nextRunAt = calculateNextRunAt(msg, now);
        await supabase.from("scheduled_messages").update({
          last_run_at: now.toISOString(), next_run_at: nextRunAt,
          processing_started_at: null, last_completed_at: now.toISOString(),
        }).eq("id", msg.id);
      }
    } catch (err) {
      console.error(`Error enqueuing message ${msg.id}:`, err);
      await supabase.from("scheduled_messages").update({
        processing_started_at: null,
      }).eq("id", msg.id);
    }
  }

  return new Response(JSON.stringify({ queued: totalQueued }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function enqueueMessage(supabase: any, msg: any): Promise<number> {
  // Fetch campaign
  let campaign: any = null;
  if (msg.campaign_id) {
    const { data: c } = await supabase.from("campaigns").select("*").eq("id", msg.campaign_id).maybeSingle();
    campaign = c;
    if (campaign && !campaign.is_active) return 0;
  }

  const allGroupIds: string[] = campaign?.group_ids?.length ? campaign.group_ids : msg.group_ids;
  if (!allGroupIds?.length) return 0;

  // Get API config
  const effectiveApiConfigId = msg.api_config_id || campaign?.api_config_id;
  if (!effectiveApiConfigId) {
    console.error(`No API config ID for message ${msg.id}`);
    return 0;
  }

  const { data: config } = await supabase.from("api_configs").select("*").eq("id", effectiveApiConfigId).maybeSingle();
  if (!config) {
    console.error(`No API config for message ${msg.id}`);
    return 0;
  }

  // Resolve API URL/key
  let apiUrl = config.api_url;
  let apiKey = config.api_key;
  if (!apiUrl || apiUrl === "global" || !apiKey || apiKey === "global") {
    const { data: globalCfg } = await supabase.from("global_config").select("evolution_api_url, evolution_api_key").limit(1).maybeSingle();
    if (!globalCfg?.evolution_api_url) {
      console.error(`No global Evolution API config for message ${msg.id}`);
      return 0;
    }
    apiUrl = globalCfg.evolution_api_url;
    apiKey = globalCfg.evolution_api_key;
  }
  apiUrl = apiUrl.replace(/\/$/, "");

  const instanceName = msg.instance_name || campaign?.instance_name || config.instance_name;
  const executionBatch = crypto.randomUUID();

  // For AI messages, generate the text before enqueuing
  let content = msg.content as any;
  let messageType = msg.message_type;
  if (msg.message_type === "ai") {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const aiResp = await fetch(`${supabaseUrl}/functions/v1/generate-ai-message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: content.prompt || content.text || "", user_id: msg.user_id }),
      });
      const aiResult = await aiResp.json();
      if (!aiResp.ok || aiResult.error) throw new Error(`AI generation failed: ${aiResult.error || "unknown"}`);
      content = { ...content, text: aiResult.text };
      messageType = "text";
    } catch (e) {
      console.error(`AI generation failed for message ${msg.id}:`, e);
      return 0;
    }
  }

  // Insert queue items
  const queueItems = allGroupIds.map((groupId: string, index: number) => ({
    user_id: msg.user_id,
    scheduled_message_id: msg.id,
    campaign_id: msg.campaign_id,
    group_id: groupId,
    instance_name: instanceName,
    message_type: messageType,
    content: content,
    api_config_id: effectiveApiConfigId,
    api_url: "resolved-at-runtime",
    api_key: "resolved-at-runtime",
    status: "pending",
    priority: index,
    execution_batch: executionBatch,
  }));

  const { error } = await supabase.from("message_queue").insert(queueItems);
  if (error) {
    console.error(`Error inserting queue items for message ${msg.id}:`, error);
    return 0;
  }

  console.log(`Message ${msg.id}: enqueued ${allGroupIds.length} items (batch ${executionBatch})`);
  return allGroupIds.length;
}

function calculateNextRunAt(msg: any, now: Date): string | null {
  const content_ = msg.content as any;
  const [h_, m_] = (content_.runTime || "08:00").split(":").map(Number);

  if (msg.schedule_type === "daily") {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(h_, m_, 0, 0);
    return next.toISOString();
  } else if (msg.schedule_type === "weekly") {
    const weekDays: number[] = content_.weekDays || [1];
    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + i);
      candidate.setHours(h_, m_, 0, 0);
      if (weekDays.includes(candidate.getDay())) {
        return candidate.toISOString();
      }
    }
  } else if (msg.schedule_type === "monthly") {
    const monthDay = content_.monthDay || 1;
    const next = new Date(now.getFullYear(), now.getMonth() + 1, monthDay, h_, m_, 0);
    return next.toISOString();
  } else if (msg.schedule_type === "custom") {
    const customDays: number[] = (content_.customDays || []).sort((a: number, b: number) => a - b);
    if (!customDays.length) return null;
    for (const day of customDays) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), day, h_, m_, 0, 0);
      if (candidate > now) return candidate.toISOString();
    }
    const next = new Date(now.getFullYear(), now.getMonth() + 1, customDays[0], h_, m_, 0, 0);
    return next.toISOString();
  }

  return null;
}
