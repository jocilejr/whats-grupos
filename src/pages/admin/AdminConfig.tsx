import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Wifi, Loader2, Brain } from "lucide-react";

export default function AdminConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["global-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testingOpenai, setTestingOpenai] = useState(false);
  const [synced, setSynced] = useState(false);

  if (config && !synced) {
    setSynced(true);
    setApiUrl(config.evolution_api_url || "");
    setApiKey(config.evolution_api_key || "");
    setOpenaiKey((config as any).openai_api_key || "");
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        evolution_api_url: apiUrl.replace(/\/$/, ""),
        evolution_api_key: apiKey,
        openai_api_key: openaiKey,
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

  const testConnection = async () => {
    setTesting(true);
    try {
      const resp = await fetch(`${apiUrl}/instance/fetchInstances`, {
        headers: { apikey: apiKey },
      });
      if (!resp.ok) throw new Error("Falha na conexão");
      const data = await resp.json();
      const count = Array.isArray(data) ? data.length : (data?.data?.length ?? 0);
      toast({ title: "Conexão OK!", description: `${count} instância(s) encontrada(s).` });
    } catch (e: any) {
      toast({ title: "Erro de conexão", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
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

  if (isLoading) return <p className="text-muted-foreground p-6">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuração Global</h1>
        <p className="text-muted-foreground">Configure as integrações centrais do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Evolution API</CardTitle>
          <CardDescription>Estas credenciais são usadas internamente para todas as instâncias dos usuários</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://sua-evolution-api.com" required />
            </div>
            <div className="space-y-2">
              <Label>API Key Global</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Chave de API" required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar Configuração"}
              </Button>
              <Button type="button" variant="outline" onClick={testConnection} disabled={testing || !apiUrl || !apiKey}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                Testar Conexão
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> OpenAI / Inteligência Artificial</CardTitle>
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
