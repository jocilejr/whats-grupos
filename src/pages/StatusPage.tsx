import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, Loader2, WifiOff, Wifi, Plug, Server } from "lucide-react";
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
      toast({ title: "Reconexão solicitada", description: result?.qrcode ? "QR Code gerado." : "Tentativa enviada." });
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
        return (
          <Badge className="gap-1.5 bg-primary/15 text-primary border-primary/25 shadow-[0_0_8px_hsl(var(--primary)/0.15)]">
            <Wifi className="h-3 w-3" />Conectado
          </Badge>
        );
      case "loading":
        return (
          <Badge variant="secondary" className="gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />Verificando...
          </Badge>
        );
      case "connecting":
        return (
          <Badge className="gap-1.5 bg-accent-foreground/15 text-accent-foreground border-accent-foreground/25">
            <Loader2 className="h-3 w-3 animate-spin" />Conectando...
          </Badge>
        );
      default:
        return (
          <Badge className="gap-1.5 bg-destructive/15 text-destructive border-destructive/25 shadow-[0_0_8px_hsl(var(--destructive)/0.15)]">
            <WifiOff className="h-3 w-3" />Desconectado
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Status</h1>
            <p className="text-muted-foreground text-sm">Monitore suas instâncias conectadas</p>
          </div>
        </div>
        <Button
          onClick={checkAll}
          disabled={loadingAll || !configs?.length}
          variant="outline"
          className="gap-2 border-border/50"
        >
          <RefreshCw className={`h-4 w-4 ${loadingAll ? "animate-spin" : ""}`} />
          Atualizar Tudo
        </Button>
      </div>

      {/* Content */}
      {configsLoading ? (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      ) : !configs?.length ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">Nenhuma instância configurada</p>
            <p className="text-muted-foreground text-sm">Vá até <strong>Configurações</strong> para adicionar uma instância.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {configs.map((config) => {
            const status = statuses[config.id];
            const isConnected = status?.state === "open";

            return (
              <Card
                key={config.id}
                className={`relative overflow-hidden transition-all ${
                  isConnected
                    ? "border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.06)]"
                    : "border-border/40"
                }`}
              >
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${isConnected ? "bg-primary" : "bg-muted"}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        isConnected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        <Server className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{config.instance_name}</h3>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{config.api_url}</p>
                      </div>
                    </div>
                    {getStateBadge(status?.state)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs border-border/50"
                      onClick={() => checkStatus(config.id, config.instance_name)}
                      disabled={status?.state === "loading"}
                    >
                      <RefreshCw className="h-3 w-3" />Verificar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs border-border/50"
                      onClick={() => reconnect(config.id)}
                      disabled={status?.state === "loading"}
                    >
                      <Plug className="h-3 w-3" />Reconectar
                    </Button>
                  </div>
                  {status?.error && (
                    <p className="text-xs text-destructive mt-2 bg-destructive/5 rounded-lg p-2">{status.error}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
