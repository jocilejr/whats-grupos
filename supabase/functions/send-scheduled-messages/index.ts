import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Manual sends: no duplicate check, fail-fast on first error, full restart on retry
// Cron sends: per-group duplicate check using processing_started_at to prevent re-sends on timeout
// All timestamps are in UTC (Deno/Supabase runs in UTC)
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

    // Check if this is a manual trigger for a specific message
    let manualMessageId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        manualMessageId = body?.messageId || null;
      } catch { /* ignore parse errors */ }
    }

    if (manualMessageId) {
      // Manual trigger: send to ALL groups individually with per-group verification
      const { data: manualMsg } = await supabase
        .from("scheduled_messages")
        .select("*")
        .eq("id", manualMessageId)
        .eq("is_active", true)
        .maybeSingle();

      if (!manualMsg) {
        return new Response(JSON.stringify({ error: "Message not found or inactive" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Lock the message
      await supabase
        .from("scheduled_messages")
        .update({ processing_started_at: new Date().toISOString() })
        .eq("id", manualMessageId);

      let processed = 0, errors = 0;
      try {
        const result = await processManualMessage(supabase, manualMsg);
        processed = result.processed;
        errors = result.errors;
      } catch (err) {
        console.error(`Manual send error for ${manualMessageId}:`, err);
        errors++;
      }

      // Bug 3: Only mark completed if NO errors; otherwise just release lock
      if (errors === 0) {
        const now = new Date().toISOString();
        if (manualMsg.schedule_type === "once") {
          await supabase.from("scheduled_messages").update({
            is_active: false, last_run_at: now, next_run_at: null,
            processing_started_at: null, last_completed_at: now,
          }).eq("id", manualMessageId);
        } else {
          const nextRunAt = calculateNextRunAt(manualMsg, new Date());
          await supabase.from("scheduled_messages").update({
            last_run_at: now, next_run_at: nextRunAt,
            processing_started_at: null, last_completed_at: now,
          }).eq("id", manualMessageId);
        }
      } else {
        // Errors occurred: just release lock so it can be retried
        await releaseLock(supabase, manualMessageId);
      }

      return new Response(JSON.stringify({ processed, errors, manual: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        const result = await processMessage(supabase, msg, isFirstSend);
        processed += result.processed;
        errors += result.errors;
        if (result.processed > 0) isFirstSend = false;
        
        // If any error occurred, stop this execution entirely
        if (result.errors > 0 || result.stopped) {
          console.log(`Message ${msg.id}: execution stopped due to error. Will retry on next activation or manual trigger.`);
          break;
        }
      } catch (msgError) {
        console.error(`Error processing message ${msg.id}:`, msgError);
        await releaseLock(supabase, msg.id);
        errors++;
        break; // Stop on error
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

// Manual send: processes ALL groups one-by-one with individual verification
async function processManualMessage(supabase: any, msg: any) {
  // Fetch campaign
  let campaign: any = null;
  if (msg.campaign_id) {
    const { data: c } = await supabase.from("campaigns").select("*").eq("id", msg.campaign_id).maybeSingle();
    campaign = c;
    if (campaign && !campaign.is_active) return { processed: 0, errors: 0 };
  }

  const allGroupIds: string[] = campaign?.group_ids?.length ? campaign.group_ids : msg.group_ids;
  if (!allGroupIds?.length) return { processed: 0, errors: 0 };

  // Get API config
  const effectiveApiConfigId = msg.api_config_id || campaign?.api_config_id;
  if (!effectiveApiConfigId) {
    console.error(`No API config ID for manual message ${msg.id}`);
    return { processed: 0, errors: 0 };
  }

  const { data: config } = await supabase.from("api_configs").select("*").eq("id", effectiveApiConfigId).maybeSingle();
  if (!config) {
    console.error(`No API config for manual message ${msg.id}`);
    return { processed: 0, errors: 0 };
  }

  // Resolve API URL/key from global_config if needed
  let apiUrl = config.api_url;
  let apiKey = config.api_key;
  if (!apiUrl || apiUrl === "global" || !apiKey || apiKey === "global") {
    const { data: globalCfg } = await supabase.from("global_config").select("evolution_api_url, evolution_api_key").limit(1).maybeSingle();
    if (!globalCfg?.evolution_api_url) {
      console.error(`No global Evolution API config for manual message ${msg.id}`);
      return { processed: 0, errors: 0 };
    }
    apiUrl = globalCfg.evolution_api_url;
    apiKey = globalCfg.evolution_api_key;
  }
  apiUrl = apiUrl.replace(/\/$/, "");
  const instanceName = msg.instance_name || campaign?.instance_name || config.instance_name;
  const content = msg.content as any;

  // Bug 2: No duplicate check for manual — always send to ALL groups from scratch
  let processed = 0, errors = 0;

  console.log(`Manual send ${msg.id}: sending to ${allGroupIds.length} groups individually`);

  for (let i = 0; i < allGroupIds.length; i++) {
    const groupId = allGroupIds[i];

    // Delay between sends (skip first)
    if (i > 0) {
      await delay(DELAY_BETWEEN_MESSAGES_MS);
    }

    try {
      // AI message generation
      let aiGeneratedText: string | undefined;
      if (msg.message_type === "ai") {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const aiResp = await fetch(`${supabaseUrl}/functions/v1/generate-ai-message`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: content.prompt || content.text || "", user_id: msg.user_id }),
        });
        const aiResult = await aiResp.json();
        if (!aiResp.ok || aiResult.error) throw new Error(`AI generation failed: ${aiResult.error || "unknown"}`);
        aiGeneratedText = aiResult.text;
      }

      const effectiveType = msg.message_type === "ai" ? "text" : msg.message_type;
      const effectiveContent = msg.message_type === "ai" ? { ...content, text: aiGeneratedText } : content;

      const { endpoint, body } = buildMessagePayload(effectiveType, apiUrl, instanceName, groupId, effectiveContent);
      if (content.mentionsEveryOne) body.mentionsEveryOne = true;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await resp.json();
      const success = resp.ok;

      // Log the result
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

      if (success) {
        processed++;
        console.log(`Manual send ${msg.id}: group ${i + 1}/${allGroupIds.length} (${groupId}) → OK`);
      } else {
        errors++;
        console.error(`Manual send ${msg.id}: group ${i + 1}/${allGroupIds.length} (${groupId}) → ERROR. Stopping.`);
        break; // Bug 1: stop on first error
      }
    } catch (e) {
      console.error(`Manual send error for group ${groupId}:`, e);
      errors++;
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
      break; // Bug 1: stop on first error
    }
  }

  console.log(`Manual send ${msg.id}: DONE. ${processed} sent, ${errors} errors out of ${allGroupIds.length} groups`);
  return { processed, errors };
}

async function processMessage(
  supabase: any,
  msg: any,
  isFirstSend: boolean,
): Promise<{ processed: number; errors: number; stopped: boolean }> {
  // Fetch campaign
  let campaign: any = null;
  if (msg.campaign_id) {
    const { data: c } = await supabase.from("campaigns").select("*").eq("id", msg.campaign_id).maybeSingle();
    campaign = c;
    if (campaign && !campaign.is_active) {
      await releaseLock(supabase, msg.id);
      return { processed: 0, errors: 0, stopped: false };
    }
  }

  const allGroupIds: string[] = campaign?.group_ids?.length ? campaign.group_ids : msg.group_ids;
  if (!allGroupIds?.length) {
    await releaseLock(supabase, msg.id);
    return { processed: 0, errors: 0, stopped: false };
  }

  const effectiveApiConfigId = msg.api_config_id || campaign?.api_config_id;
  if (!effectiveApiConfigId) {
    console.error(`No API config ID for message ${msg.id}`);
    await releaseLock(supabase, msg.id);
    return { processed: 0, errors: 0, stopped: true };
  }

  const { data: config } = await supabase.from("api_configs").select("*").eq("id", effectiveApiConfigId).maybeSingle();
  if (!config) {
    console.error(`No API config for message ${msg.id}`);
    await releaseLock(supabase, msg.id);
    return { processed: 0, errors: 0, stopped: true };
  }

  // Resolve API URL/key from global_config if needed
  let apiUrl = config.api_url;
  let apiKey = config.api_key;
  if (!apiUrl || apiUrl === "global" || !apiKey || apiKey === "global") {
    const { data: globalCfg } = await supabase.from("global_config").select("evolution_api_url, evolution_api_key").limit(1).maybeSingle();
    if (!globalCfg?.evolution_api_url) {
      console.error(`No global Evolution API config for message ${msg.id}`);
      await releaseLock(supabase, msg.id);
      return { processed: 0, errors: 0, stopped: true };
    }
    apiUrl = globalCfg.evolution_api_url;
    apiKey = globalCfg.evolution_api_key;
  }
  apiUrl = apiUrl.replace(/\/$/, "");
  const instanceName = msg.instance_name || campaign?.instance_name || config.instance_name;
  const content = msg.content as any;

  // Bug 6: capture processing_started_at for duplicate check on cron retries
  const processingStartedAt = msg.processing_started_at;
  console.log(`Message ${msg.id}: processing ${allGroupIds.length} groups (started at ${processingStartedAt})`);

  let totalProcessed = 0;

  for (let i = 0; i < allGroupIds.length; i++) {
    const groupId = allGroupIds[i];

    // Bug 6: Per-group duplicate check — skip if already sent in this execution window
    const { count: alreadySent } = await supabase
      .from("message_logs")
      .select("*", { count: "exact", head: true })
      .eq("scheduled_message_id", msg.id)
      .eq("group_id", groupId)
      .eq("status", "sent")
      .gte("created_at", processingStartedAt);

    if ((alreadySent || 0) > 0) {
      console.log(`Message ${msg.id}: group ${groupId} already sent in this execution, skipping`);
      totalProcessed++;
      continue;
    }

    // Delay between sends (skip first)
    if (!isFirstSend || totalProcessed > 0) {
      await delay(DELAY_BETWEEN_MESSAGES_MS);
    }

    try {
      // AI message generation
      let aiGeneratedText: string | undefined;
      if (msg.message_type === "ai") {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const aiResp = await fetch(`${supabaseUrl}/functions/v1/generate-ai-message`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: content.prompt || content.text || "", user_id: msg.user_id }),
        });
        const aiResult = await aiResp.json();
        if (!aiResp.ok || aiResult.error) throw new Error(`AI generation failed: ${aiResult.error || "unknown"}`);
        aiGeneratedText = aiResult.text;
      }

      const effectiveType = msg.message_type === "ai" ? "text" : msg.message_type;
      const effectiveContent = msg.message_type === "ai" ? { ...content, text: aiGeneratedText } : content;

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

      if (success) {
        totalProcessed++;
        console.log(`Message ${msg.id}: group ${i + 1}/${allGroupIds.length} (${groupId}) → OK`);
      } else {
        // ERROR: stop execution, don't continue to other groups
        console.error(`Message ${msg.id}: group ${i + 1}/${allGroupIds.length} (${groupId}) → ERROR. Stopping execution.`);
        await releaseLock(supabase, msg.id);
        return { processed: totalProcessed, errors: 1, stopped: true };
      }
    } catch (e) {
      console.error(`Send error for group ${groupId}:`, e);
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
      // ERROR: stop execution
      await releaseLock(supabase, msg.id);
      return { processed: totalProcessed, errors: 1, stopped: true };
    }
  }

  // All groups processed successfully — finalize
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
  console.log(`Message ${msg.id}: ALL done. ${totalProcessed} sent out of ${allGroupIds.length} groups`);
  return { processed: totalProcessed, errors: 0, stopped: false };
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
