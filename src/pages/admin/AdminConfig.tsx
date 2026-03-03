import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Brain, Cog, Server } from "lucide-react";

export default function AdminConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["global-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_config")
        .select("id, vps_api_url, baileys_api_key, openai_api_key, queue_delay_seconds")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [openaiKey, setOpenaiKey] = useState("");
  const [vpsApiUrl, setVpsApiUrl] = useState("");
  const [baileysApiKey, setBaileysApiKey] = useState("");
  
  const [testingBaileys, setTestingBaileys] = useState(false);
  const [testingOpenai, setTestingOpenai] = useState(false);
  const [synced, setSynced] = useState(false);

  if (config && !synced) {
    setSynced(true);
    setOpenaiKey(config.openai_api_key || "");
    setVpsApiUrl(config.vps_api_url || "");
    setBaileysApiKey(config.baileys_api_key || "");
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        openai_api_key: openaiKey,
        vps_api_url: vpsApiUrl.replace(/\/$/, ""),
        baileys_api_key: baileysApiKey,
      };
      if (!config?.id) {
        const { error } = await supabase.from("global_config").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("global_config").update(payload).eq("id", config.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-config"] });
      toast({ title: "Configuração salva!" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const testBaileys = async () => {
    setTestingBaileys(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Não autenticado");

      const resp = await fetch(`${supabaseUrl}/functions/v1/evolution-api?action=healthCheck`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });
      const result = await resp.json();
      if (!resp.ok || result.status === "error") {
        throw new Error(result.error || "Servidor Baileys não respondeu");
      }
      toast({ title: "Baileys OK!", description: `Servidor ativo. ${result.sessions || 0} sessão(ões) ativa(s).` });
    } catch (e: any) {
      toast({ title: "Erro de conexão", description: e.message, variant: "destructive" });
    } finally {
      setTestingBaileys(false);
    }
  };

  const testOpenai = async () => {
    setTestingOpenai(true);
    try {
      const resp = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${openaiKey}` },
      });
      if (!resp.ok) throw new Error("Chave inválida ou sem permissão");
      toast({ title: "OpenAI OK!", description: "Chave validada com sucesso." });
    } catch (e: any) {
      toast({ title: "Erro OpenAI", description: e.message, variant: "destructive" });
    } finally {
      setTestingOpenai(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-80" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(210_75%_52%/0.15)]">
            <Cog className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Configuração Global</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Configure as integrações centrais do sistema</p>
          </div>
        </div>
      </div>

      {/* Baileys Connection Card */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Conexão WhatsApp (Baileys)
          </CardTitle>
          <CardDescription>O Baileys roda diretamente na VPS como container Docker. A conexão interna é automática.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground mb-4">
            A aplicação se conecta internamente ao Baileys sem necessidade de configuração. Use o botão abaixo para verificar se o servidor está ativo.
          </div>
          <Button type="button" variant="outline" onClick={testBaileys} disabled={testingBaileys}>
            {testingBaileys ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Server className="h-4 w-4 mr-2" />}
            Testar Conexão
          </Button>
        </CardContent>
      </Card>

      {/* VPS API URL Card */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            API Externa
          </CardTitle>
          <CardDescription>Configuração para acesso externo à API (integrações de terceiros)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>URL da API da VPS</Label>
              <Input value={vpsApiUrl} onChange={(e) => setVpsApiUrl(e.target.value)} placeholder="https://api.app.simplificandogrupos.com" />
            </div>
            <div className="space-y-2">
              <Label>API Key para requisições externas</Label>
              <Input type="password" value={baileysApiKey} onChange={(e) => setBaileysApiKey(e.target.value)} placeholder="Chave secreta para autenticar requisições externas" />
              <p className="text-xs text-muted-foreground">Essa chave será exigida no header <code className="bg-muted px-1 rounded">apikey</code> apenas para requisições externas à API. Internamente a aplicação conecta diretamente.</p>
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-[hsl(262,60%,60%)]" /> OpenAI / Inteligência Artificial</CardTitle>
          <CardDescription>Chave usada para gerar mensagens por I.A. — apenas acessível pelo backend</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>API Key da OpenAI</Label>
              <Input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-..." />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={testOpenai} disabled={testingOpenai || !openaiKey}>
                {testingOpenai ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                Testar Conexão
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
