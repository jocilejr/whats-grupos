import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Process max 5 groups per invocation (~50s with 10s delay, well within timeout)
const BATCH_SIZE = 5;
const DELAY_BETWEEN_MESSAGES_MS = 10_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ATOMIC claim: prevents race condition
    const { data: messages, error: fetchError } = await supabase.rpc("claim_due_messages");

    if (fetchError) {
      console.error("Claim error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let errors = 0;
    let isFirstSend = true;

    for (const msg of messages) {
      try {
        await processMessage(supabase, msg, isFirstSend, (p, e, first) => {
          processed += p;
          errors += e;
          isFirstSend = first;
        });
        // After first message's first group, isFirstSend is false
        isFirstSend = false;
      } catch (msgError) {
        console.error(`Error processing message ${msg.id}:`, msgError);
        await releaseLock(supabase, msg.id);
        errors++;
      }
    }

    return new Response(JSON.stringify({ processed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processMessage(
  supabase: any,
  msg: any,
  isFirstSend: boolean,
  onProgress: (processed: number, errors: number, isFirstSend: boolean) => void
) {
  // Fetch campaign
  let campaign: any = null;
  if (msg.campaign_id) {
    const { data: c } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", msg.campaign_id)
      .maybeSingle();
    campaign = c;
    if (campaign && !campaign.is_active) {
      await releaseLock(supabase, msg.id);
      return;
    }
  }

  const allGroupIds: string[] = campaign?.group_ids?.length ? campaign.group_ids : msg.group_ids;
  if (!allGroupIds?.length) {
    await releaseLock(supabase, msg.id);
    return;
  }

  // Get API config
  const { data: config } = await supabase
    .from("api_configs")
    .select("*")
    .eq("id", msg.api_config_id)
    .maybeSingle();

  if (!config) {
    console.error(`No API config for message ${msg.id}`);
    await releaseLock(supabase, msg.id);
    return;
  }

  // Rate limit check
  const maxPerHour = config.max_messages_per_hour || 100;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: sentLastHour } = await supabase
    .from("message_logs")
    .select("*", { count: "exact", head: true })
    .eq("api_config_id", msg.api_config_id)
    .eq("status", "sent")
    .gte("created_at", oneHourAgo);

  if ((sentLastHour || 0) >= maxPerHour) {
    console.log(`Rate limit reached for ${config.instance_name}: ${sentLastHour}/${maxPerHour}/h. Skipping.`);
    await releaseLock(supabase, msg.id);
    return;
  }

  const remainingQuota = maxPerHour - (sentLastHour || 0);

  // Determine the batch of groups to process
  const startIndex = msg.sent_group_index || 0;
  const batchGroups = allGroupIds.slice(startIndex, startIndex + BATCH_SIZE);
  const nextIndex = startIndex + batchGroups.length;
  const isLastBatch = nextIndex >= allGroupIds.length;

  console.log(`Message ${msg.id}: processing groups ${startIndex}-${nextIndex - 1} of ${allGroupIds.length} (batch ${Math.floor(startIndex / BATCH_SIZE) + 1})`);

  const apiUrl = config.api_url.replace(/\/$/, "");
  const apiKey = config.api_key;
  const instanceName = msg.instance_name || campaign?.instance_name || config.instance_name;
  const content = msg.content as any;

  let batchProcessed = 0;
  let batchErrors = 0;
  let sentInThisRun = 0;

  for (const groupId of batchGroups) {
    if (sentInThisRun >= remainingQuota) {
      console.log(`Rate limit reached mid-batch for ${config.instance_name}. Stopping.`);
      break;
    }
    try {
      if (!isFirstSend) {
        await delay(DELAY_BETWEEN_MESSAGES_MS);
      }
      isFirstSend = false;

      // For AI messages, generate text first
      let aiGeneratedText: string | undefined;
      if (msg.message_type === "ai") {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const aiResp = await fetch(`${supabaseUrl}/functions/v1/generate-ai-message`, {
          method: "POST",
          headers: { 
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt: content.prompt || content.text || "" }),
        });
        const aiResult = await aiResp.json();
        if (!aiResp.ok || aiResult.error) {
          throw new Error(`AI generation failed: ${aiResult.error || "unknown"}`);
        }
        aiGeneratedText = aiResult.text;
      }

      const effectiveType = msg.message_type === "ai" ? "text" : msg.message_type;
      const effectiveContent = msg.message_type === "ai" 
        ? { ...content, text: aiGeneratedText } 
        : content;

      const { endpoint, body } = buildMessagePayload(effectiveType, apiUrl, instanceName, groupId, effectiveContent);
      if (content.mentionsEveryOne) body.mentionsEveryOne = true;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await resp.json();
      const success = resp.ok;

      await supabase.from("message_logs").insert({
        user_id: msg.user_id,
        api_config_id: msg.api_config_id,
        scheduled_message_id: msg.id,
        group_id: groupId,
        message_type: msg.message_type,
        content: content,
        status: success ? "sent" : "error",
        error_message: success ? null : JSON.stringify(result),
        instance_name: instanceName,
      });

      if (success) { batchProcessed++; sentInThisRun++; }
      else batchErrors++;
    } catch (e) {
      console.error(`Send error for group ${groupId}:`, e);
      batchErrors++;
      await supabase.from("message_logs").insert({
        user_id: msg.user_id,
        api_config_id: msg.api_config_id,
        scheduled_message_id: msg.id,
        group_id: groupId,
        message_type: msg.message_type,
        content: content,
        status: "error",
        error_message: e.message,
        instance_name: instanceName,
      });
    }
  }

  onProgress(batchProcessed, batchErrors, isFirstSend);

  if (isLastBatch) {
    // All groups processed — update next_run_at and reset index
    const now = new Date();
    if (msg.schedule_type === "once") {
      await supabase.from("scheduled_messages").update({
        is_active: false,
        last_run_at: now.toISOString(),
        next_run_at: null,
        sent_group_index: 0,
        processing_started_at: null,
        last_completed_at: now.toISOString(),
      }).eq("id", msg.id);
    } else {
      const nextRunAt = calculateNextRunAt(msg, now);
      await supabase.from("scheduled_messages").update({
        last_run_at: now.toISOString(),
        next_run_at: nextRunAt,
        sent_group_index: 0,
        processing_started_at: null,
        last_completed_at: now.toISOString(),
      }).eq("id", msg.id);
    }
    console.log(`Message ${msg.id}: ALL ${allGroupIds.length} groups completed.`);
  } else {
    // More groups remain — save progress and release lock for next invocation
    await supabase.from("scheduled_messages").update({
      sent_group_index: nextIndex,
      processing_started_at: null, // Release lock so next cron picks it up
    }).eq("id", msg.id);
    console.log(`Message ${msg.id}: batch done. ${allGroupIds.length - nextIndex} groups remaining (resuming at index ${nextIndex}).`);
  }
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
    // Find next valid day in current or next month
    for (const day of customDays) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), day, h_, m_, 0, 0);
      if (candidate > now) return candidate.toISOString();
    }
    // No more days this month, go to first valid day next month
    const next = new Date(now.getFullYear(), now.getMonth() + 1, customDays[0], h_, m_, 0, 0);
    return next.toISOString();
  }

  return null;
}

async function releaseLock(supabase: any, msgId: string) {
  await supabase.from("scheduled_messages").update({
    processing_started_at: null,
  }).eq("id", msgId);
}

function buildMessagePayload(messageType: string, apiUrl: string, instanceName: string, groupId: string, content: any) {
  let endpoint: string;
  let body: any;

  if (messageType === "text") {
    endpoint = `${apiUrl}/message/sendText/${instanceName}`;
    body = { number: groupId, text: content.text, linkPreview: content.linkPreview !== false };
  } else if (messageType === "image" || messageType === "video" || messageType === "document") {
    endpoint = `${apiUrl}/message/sendMedia/${instanceName}`;
    body = { number: groupId, mediatype: messageType, media: content.mediaUrl, caption: content.caption || "", fileName: content.fileName || "" };
  } else if (messageType === "audio") {
    endpoint = `${apiUrl}/message/sendWhatsAppAudio/${instanceName}`;
    body = { number: groupId, audio: content.audio };
  } else if (messageType === "sticker") {
    endpoint = `${apiUrl}/message/sendSticker/${instanceName}`;
    body = { number: groupId, sticker: content.sticker };
  } else if (messageType === "location") {
    endpoint = `${apiUrl}/message/sendLocation/${instanceName}`;
    body = { number: groupId, name: content.name || "", address: content.address || "", latitude: content.latitude, longitude: content.longitude };
  } else if (messageType === "contact") {
    endpoint = `${apiUrl}/message/sendContact/${instanceName}`;
    body = { number: groupId, contact: [{ fullName: content.contactName, wuid: content.contactPhone, phoneNumber: content.contactPhone }] };
  } else if (messageType === "poll") {
    endpoint = `${apiUrl}/message/sendPoll/${instanceName}`;
    body = { number: groupId, name: content.pollName, selectableCount: content.pollSelectable || 1, values: content.pollOptions || [] };
  } else if (messageType === "list") {
    endpoint = `${apiUrl}/message/sendList/${instanceName}`;
    const sections = (content.listSections || []).map((s: any) => ({ title: s.title, rows: s.rows.map((r: any, i: number) => ({ title: r.title, description: r.description || "", rowId: `row_${i}` })) }));
    body = { number: groupId, title: content.listTitle, description: content.listDescription, buttonText: content.listButtonText || "Ver opções", footerText: content.listFooter || "", sections };
  } else {
    endpoint = `${apiUrl}/message/sendText/${instanceName}`;
    body = { number: groupId, text: content.text || "" };
  }

  return { endpoint, body };
}
