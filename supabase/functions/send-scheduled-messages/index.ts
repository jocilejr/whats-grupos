import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active scheduled messages that are due
    const { data: messages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*, campaigns!scheduled_messages_campaign_id_fkey(*)")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString());

    if (fetchError) {
      console.error("Fetch error:", fetchError);
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

    for (const msg of messages) {
      const campaign = msg.campaigns;
      if (campaign && !campaign.is_active) continue;

      // Determine groups: use campaign groups if available, otherwise message's own
      const groupIds: string[] = campaign?.group_ids?.length ? campaign.group_ids : msg.group_ids;
      if (!groupIds?.length) continue;

      // Get API config
      const { data: config } = await supabase
        .from("api_configs")
        .select("*")
        .eq("id", msg.api_config_id)
        .maybeSingle();

      if (!config) {
        console.error(`No API config for message ${msg.id}`);
        continue;
      }

      const apiUrl = config.api_url.replace(/\/$/, "");
      const apiKey = config.api_key;
      const instanceName = msg.instance_name || campaign?.instance_name || config.instance_name;
      const content = msg.content as any;

      for (const groupId of groupIds) {
        try {
          let endpoint: string;
          let body: any;

          if (msg.message_type === "text") {
            endpoint = `${apiUrl}/message/sendText/${instanceName}`;
            body = { number: groupId, text: content.text, linkPreview: content.linkPreview !== false };
          } else if (msg.message_type === "image" || msg.message_type === "video" || msg.message_type === "document") {
            endpoint = `${apiUrl}/message/sendMedia/${instanceName}`;
            body = { number: groupId, mediatype: msg.message_type, media: content.mediaUrl, caption: content.caption || "", fileName: content.fileName || "" };
          } else if (msg.message_type === "audio") {
            endpoint = `${apiUrl}/message/sendWhatsAppAudio/${instanceName}`;
            body = { number: groupId, audio: content.audio };
          } else if (msg.message_type === "sticker") {
            endpoint = `${apiUrl}/message/sendSticker/${instanceName}`;
            body = { number: groupId, sticker: content.sticker };
          } else if (msg.message_type === "location") {
            endpoint = `${apiUrl}/message/sendLocation/${instanceName}`;
            body = { number: groupId, name: content.name || "", address: content.address || "", latitude: content.latitude, longitude: content.longitude };
          } else if (msg.message_type === "contact") {
            endpoint = `${apiUrl}/message/sendContact/${instanceName}`;
            body = { number: groupId, contact: [{ fullName: content.contactName, wuid: content.contactPhone, phoneNumber: content.contactPhone }] };
          } else if (msg.message_type === "poll") {
            endpoint = `${apiUrl}/message/sendPoll/${instanceName}`;
            body = { number: groupId, name: content.pollName, selectableCount: content.pollSelectable || 1, values: content.pollOptions || [] };
          } else if (msg.message_type === "list") {
            endpoint = `${apiUrl}/message/sendList/${instanceName}`;
            const sections = (content.listSections || []).map((s: any) => ({ title: s.title, rows: s.rows.map((r: any, i: number) => ({ title: r.title, description: r.description || "", rowId: `row_${i}` })) }));
            body = { number: groupId, title: content.listTitle, description: content.listDescription, buttonText: content.listButtonText || "Ver opções", footerText: content.listFooter || "", sections };
          } else {
            endpoint = `${apiUrl}/message/sendText/${instanceName}`;
            body = { number: groupId, text: content.text || "" };
          }

          // Apply mentionsEveryOne to all message types
          if (content.mentionsEveryOne) body.mentionsEveryOne = true;

          const resp = await fetch(endpoint, {
            method: "POST",
            headers: { apikey: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const result = await resp.json();
          const success = resp.ok;

          // Log
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

          if (success) processed++;
          else errors++;
        } catch (e) {
          console.error(`Send error for group ${groupId}:`, e);
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
        }
      }

      // Update next_run_at
      const now = new Date();
      let nextRunAt: string | null = null;

      if (msg.schedule_type === "once") {
        // Disable after single run
        await supabase.from("scheduled_messages").update({
          is_active: false,
          last_run_at: now.toISOString(),
          next_run_at: null,
        }).eq("id", msg.id);
      } else {
        const [h, m] = (content.runTime || "08:00").split(":").map(Number);

        if (msg.schedule_type === "daily") {
          const next = new Date(now);
          next.setDate(next.getDate() + 1);
          next.setHours(h, m, 0, 0);
          nextRunAt = next.toISOString();
        } else if (msg.schedule_type === "weekly") {
          const weekDays: number[] = content.weekDays || [1];
          const next = new Date(now);
          for (let i = 1; i <= 7; i++) {
            const candidate = new Date(now);
            candidate.setDate(candidate.getDate() + i);
            candidate.setHours(h, m, 0, 0);
            if (weekDays.includes(candidate.getDay())) {
              next.setTime(candidate.getTime());
              break;
            }
          }
          nextRunAt = next.toISOString();
        } else if (msg.schedule_type === "monthly") {
          const monthDay = content.monthDay || 1;
          const next = new Date(now.getFullYear(), now.getMonth() + 1, monthDay, h, m, 0);
          nextRunAt = next.toISOString();
        }

        await supabase.from("scheduled_messages").update({
          last_run_at: now.toISOString(),
          next_run_at: nextRunAt,
        }).eq("id", msg.id);
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
