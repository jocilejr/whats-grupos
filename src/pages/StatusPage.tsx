import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, Loader2, WifiOff, Wifi, Plug } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type InstanceStatus = {
  configId: string;
  instanceName: string;
  state: "open" | "close" | "connecting" | "loading" | "error";
  error?: string;
};

export default function StatusPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<Record<string, InstanceStatus>>({});
  const [loadingAll, setLoadingAll] = useState(false);

  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: ["api-configs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_configs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const checkStatus = async (configId: string, instanceName: string) => {
    setStatuses((prev) => ({
      ...prev,
      [configId]: { configId, instanceName, state: "loading" },
    }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=connectionState&configId=${configId}`;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const result = await resp.json();
      const state = result?.instance?.state || result?.state || "close";
      setStatuses((prev) => ({
        ...prev,
        [configId]: { configId, instanceName, state },
      }));
    } catch (e: any) {
      setStatuses((prev) => ({
        ...prev,
        [configId]: { configId, instanceName, state: "error", error: e.message },
      }));
    }
  };

  const reconnect = async (configId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=connectInstance&configId=${configId}`;
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const result = await resp.json();
      toast({ title: "Reconexão solicitada", description: result?.qrcode ? "QR Code gerado. Escaneie no WhatsApp." : "Tentativa de reconexão enviada." });
      await checkStatus(configId, statuses[configId]?.instanceName || "");
    } catch {
      toast({ title: "Erro", description: "Falha ao reconectar.", variant: "destructive" });
    }
  };

  const checkAll = async () => {
    if (!configs) return;
    setLoadingAll(true);
    await Promise.all(configs.map((c) => checkStatus(c.id, c.instance_name)));
    setLoadingAll(false);
  };

  const getStateBadge = (state?: string) => {
    switch (state) {
      case "open":
        return <Badge className="bg-primary/20 text-primary border-primary/30"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>;
      case "loading":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Verificando...</Badge>;
      case "connecting":
        return <Badge className="bg-accent-foreground/20 text-accent-foreground border-accent-foreground/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Conectando...</Badge>;
      default:
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status</h1>
          <p className="text-muted-foreground">Monitore suas instâncias conectadas</p>
        </div>
        <Button onClick={checkAll} disabled={loadingAll || !configs?.length}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingAll ? "animate-spin" : ""}`} />
          Atualizar Tudo
        </Button>
      </div>

      {configsLoading ? (
        <Card><CardContent className="py-10 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></CardContent></Card>
      ) : !configs?.length ? (
        <Card><CardContent className="py-10 text-center">
          <WifiOff className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma instância configurada. Vá até <strong>Configurações</strong> para adicionar.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {configs.map((config) => {
            const status = statuses[config.id];
            return (
              <Card key={config.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    {config.instance_name}
                  </CardTitle>
                  {getStateBadge(status?.state)}
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3 truncate">{config.api_url}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => checkStatus(config.id, config.instance_name)} disabled={status?.state === "loading"}>
                      <RefreshCw className="h-3 w-3 mr-1" />Verificar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reconnect(config.id)} disabled={status?.state === "loading"}>
                      <Plug className="h-3 w-3 mr-1" />Reconectar
                    </Button>
                  </div>
                  {status?.error && <p className="text-xs text-destructive mt-2">{status.error}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
