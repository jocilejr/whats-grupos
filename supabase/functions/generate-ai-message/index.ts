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
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch OpenAI key from global_config using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Call OpenAI
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
