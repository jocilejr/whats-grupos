import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DELAY_BETWEEN_MESSAGES_MS = 10_000;
const MAX_ITEMS_PER_EXECUTION = 25; // Safety limit per invocation

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < MAX_ITEMS_PER_EXECUTION; i++) {
      // Delay between sends (skip first)
      if (i > 0) {
        await delay(DELAY_BETWEEN_MESSAGES_MS);
      }

      // Atomically claim next item
      const { data: items, error: claimError } = await supabase.rpc("claim_next_queue_item");

      if (claimError) {
        console.error("Claim error:", claimError);
        break;
      }

      if (!items?.length) {
        console.log(`No more pending items. Processed ${processed}, errors ${errors}.`);
        break;
      }

      const item = items[0];

      try {
        const content = item.content as any;
        const { endpoint, body } = buildMessagePayload(
          item.message_type, item.api_url, item.instance_name, item.group_id, content
        );
        if (content.mentionsEveryOne) body.mentionsEveryOne = true;

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { apikey: item.api_key, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const result = await resp.json();
        const success = resp.ok;

        if (success) {
          // Mark as sent
          await supabase.from("message_queue").update({
            status: "sent", completed_at: new Date().toISOString(),
          }).eq("id", item.id);

          // Log to message_logs
          await supabase.from("message_logs").insert({
            user_id: item.user_id,
            api_config_id: item.api_config_id,
            scheduled_message_id: item.scheduled_message_id,
            group_id: item.group_id,
            message_type: item.message_type,
            content: item.content,
            status: "sent",
            instance_name: item.instance_name,
          });

          processed++;
          console.log(`Queue item ${item.id}: group ${item.group_id} → OK`);
        } else {
          // Mark as error, CONTINUE to next item
          await supabase.from("message_queue").update({
            status: "error",
            error_message: JSON.stringify(result),
            completed_at: new Date().toISOString(),
          }).eq("id", item.id);

          await supabase.from("message_logs").insert({
            user_id: item.user_id,
            api_config_id: item.api_config_id,
            scheduled_message_id: item.scheduled_message_id,
            group_id: item.group_id,
            message_type: item.message_type,
            content: item.content,
            status: "error",
            error_message: JSON.stringify(result),
            instance_name: item.instance_name,
          });

          errors++;
          console.error(`Queue item ${item.id}: group ${item.group_id} → ERROR. Continuing.`);
          // DO NOT break — continue to next item
        }
      } catch (e) {
        // Exception: mark error, CONTINUE
        await supabase.from("message_queue").update({
          status: "error",
          error_message: e.message,
          completed_at: new Date().toISOString(),
        }).eq("id", item.id);

        await supabase.from("message_logs").insert({
          user_id: item.user_id,
          api_config_id: item.api_config_id,
          scheduled_message_id: item.scheduled_message_id,
          group_id: item.group_id,
          message_type: item.message_type,
          content: item.content,
          status: "error",
          error_message: e.message,
          instance_name: item.instance_name,
        });

        errors++;
        console.error(`Queue item ${item.id}: exception for group ${item.group_id}: ${e.message}. Continuing.`);
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
