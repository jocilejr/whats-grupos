import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings, Wifi, Loader2 } from "lucide-react";

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
  const [testing, setTesting] = useState(false);

  // Sync form with loaded config
  const isReady = config && apiUrl === "" && apiKey === "";
  if (isReady) {
    setApiUrl(config.evolution_api_url || "");
    setApiKey(config.evolution_api_key || "");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!config?.id) {
        const { error } = await supabase.from("global_config").insert({
          evolution_api_url: apiUrl.replace(/\/$/, ""),
          evolution_api_key: apiKey,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("global_config").update({
          evolution_api_url: apiUrl.replace(/\/$/, ""),
          evolution_api_key: apiKey,
        }).eq("id", config.id);
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

  if (isLoading) return <p className="text-muted-foreground p-6">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuração Global</h1>
        <p className="text-muted-foreground">Configure a Evolution API central do sistema</p>
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
    </div>
  );
}
