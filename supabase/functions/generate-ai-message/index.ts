import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map(s => s.trim());

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const { prompt, user_id } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let resolvedUserId = user_id;
    if (!resolvedUserId) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader.startsWith("Bearer ")) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        resolvedUserId = user?.id;
      }
    }

    if (resolvedUserId) {
      const { data: plan } = await supabase
        .from("user_plans")
        .select("max_ai_requests_per_month")
        .eq("user_id", resolvedUserId)
        .maybeSingle();

      const maxRequests = plan?.max_ai_requests_per_month ?? 50;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("message_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", resolvedUserId)
        .eq("message_type", "ai")
        .gte("created_at", startOfMonth.toISOString());

      if ((count || 0) >= maxRequests) {
        return new Response(
          JSON.stringify({ error: `Limite de ${maxRequests} requisições de I.A. por mês atingido.` }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: config, error: configError } = await supabase
      .from("global_config")
      .select("openai_api_key")
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error("Config error:", configError);
      return new Response(
        JSON.stringify({ error: "Failed to load config" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = config?.openai_api_key;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente que gera mensagens para WhatsApp. " +
              "Gere apenas o texto da mensagem, sem markdown, sem formatação especial. " +
              "Use linguagem natural e adequada para grupos de WhatsApp. " +
              "Responda sempre em português do Brasil.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.8,
      }),
    });

    if (!openaiResp.ok) {
      const err = await openaiResp.text();
      console.error("OpenAI error:", err);
      return new Response(
        JSON.stringify({ error: "OpenAI request failed", details: err }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await openaiResp.json();
    const text = result.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
