import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Wifi, WifiOff, Loader2, CheckCircle2, XCircle, Pencil, RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [instanceName, setInstanceName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [availableInstances, setAvailableInstances] = useState<any[]>([]);
  const [showInstanceSelector, setShowInstanceSelector] = useState(false);

  const { data: configs, isLoading } = useQuery({
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

  // Fetch sent message counts per instance in the last hour
  const { data: usageCounts } = useQuery({
    queryKey: ["usage-counts", user?.id],
    queryFn: async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("message_logs")
        .select("api_config_id")
        .eq("user_id", user!.id)
        .eq("status", "sent")
        .gte("created_at", oneHourAgo);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((row) => {
        counts[row.api_config_id] = (counts[row.api_config_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const addConfig = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("api_configs").insert({
        user_id: user!.id,
        instance_name: instanceName,
        api_url: apiUrl.replace(/\/$/, ""),
        api_key: apiKey,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-configs"] });
      setInstanceName("");
      setApiUrl("");
      setApiKey("");
      toast({ title: "Instância adicionada com sucesso!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-configs"] });
      toast({ title: "Instância removida!" });
    },
  });

  const [testingId, setTestingId] = useState<string | null>(null);
  const [connectionStates, setConnectionStates] = useState<Record<string, any>>({});

  // Edit state
  const [editConfig, setEditConfig] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editKey, setEditKey] = useState("");
  const [editMaxPerHour, setEditMaxPerHour] = useState(100);

  const openEdit = (config: any) => {
    setEditConfig(config);
    setEditName(config.instance_name);
    setEditUrl(config.api_url);
    setEditKey(config.api_key);
    setEditMaxPerHour(config.max_messages_per_hour ?? 100);
  };

  const updateConfig = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("api_configs").update({
        instance_name: editName,
        api_url: editUrl.replace(/\/$/, ""),
        api_key: editKey,
        max_messages_per_hour: editMaxPerHour,
      }).eq("id", editConfig.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-configs"] });
      setEditConfig(null);
      toast({ title: "Instância atualizada!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const testConnection = async (configId: string) => {
    setTestingId(configId);
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
      setConnectionStates((prev) => ({ ...prev, [configId]: result }));
      const state = result?.instance?.state || result?.state;
      if (state === "open") {
        toast({ title: "Conexão ativa!", description: "Instância conectada ao WhatsApp." });
      } else {
        toast({ title: "Status: " + (state || "desconhecido"), description: "Verifique a instância.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao testar", description: e.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const fetchAvailableInstances = async () => {
    if (!apiUrl || !apiKey) {
      toast({ title: "Preencha a URL e a chave de API primeiro", variant: "destructive" });
      return;
    }

    setLoadingInstances(true);
    try {
      // First, create a temporary config to test the API connection and fetch instances
      // We'll use a local fetch to the Evolution API instead of edge function
      const headers = { apikey: apiKey };
      const resp = await fetch(`${apiUrl}/instance/fetchInstances`, { headers });

      if (!resp.ok) {
        throw new Error("Erro ao conectar. Verifique a URL e API Key.");
      }

      const data = await resp.json();
      
      if (Array.isArray(data.data)) {
        setAvailableInstances(data.data);
        setShowInstanceSelector(true);
      } else if (Array.isArray(data)) {
        setAvailableInstances(data);
        setShowInstanceSelector(true);
      } else {
        toast({ title: "Nenhuma instância encontrada", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoadingInstances(false);
    }
  };

  const selectInstance = (instance: any) => {
    const instName = instance.instance?.instanceName || instance.name || instance.instanceName;
    setInstanceName(instName);
    setShowInstanceSelector(false);
    toast({ title: `Instância "${instName}" selecionada!` });
  };

  const getStateForConfig = (id: string) => {
    const s = connectionStates[id];
    if (!s) return null;
    return s?.instance?.state || s?.state || null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie suas instâncias da Evolution API</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar Instância
          </CardTitle>
          <CardDescription>Insira os dados da sua Evolution API</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addConfig.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <div className="flex gap-2">
                <Input
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="Ex: Minha instância principal"
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchAvailableInstances}
                  disabled={loadingInstances || !apiUrl || !apiKey}
                  className="px-3"
                >
                  {loadingInstances ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://sua-evolution-api.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Sua chave de API"
                required
              />
            </div>
            <Button type="submit" disabled={addConfig.isPending}>
              {addConfig.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Instâncias Configuradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !configs?.length ? (
            <p className="text-muted-foreground">Nenhuma instância configurada.</p>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => {
                const state = getStateForConfig(config.id);
                return (
                  <div
                    key={config.id}
                    className="flex items-center justify-between rounded-lg border p-4 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{config.instance_name}</p>
                        {state === "open" && (
                          <Badge variant="default" className="bg-primary text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                          </Badge>
                        )}
                        {state && state !== "open" && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" /> {state}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{config.api_url}</p>
                      {(() => {
                        const maxPerHour = config.max_messages_per_hour ?? 100;
                        const sent = usageCounts?.[config.id] || 0;
                        const remaining = Math.max(0, maxPerHour - sent);
                        const pct = (sent / maxPerHour) * 100;
                        return (
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {remaining} de {maxPerHour} restantes/hora
                              </span>
                              <span className={sent >= maxPerHour ? "text-destructive font-medium" : "text-muted-foreground"}>
                                {sent}/{maxPerHour} enviadas
                              </span>
                            </div>
                            <Progress value={pct} className="h-2" />
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(config.id)}
                        disabled={testingId === config.id}
                      >
                        {testingId === config.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wifi className="h-4 w-4" />
                        )}
                        <span className="ml-1 hidden sm:inline">Testar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(config)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteConfig.mutate(config.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Edit Dialog */}
      <Dialog open={!!editConfig} onOpenChange={(o) => !o && setEditConfig(null)}>
        <DialogContent className="sm:rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle>Editar Instância</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateConfig.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input type="password" value={editKey} onChange={(e) => setEditKey(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Limite de mensagens por hora</Label>
              <Input type="number" min={1} max={1000} value={editMaxPerHour} onChange={(e) => setEditMaxPerHour(Number(e.target.value))} required />
              <p className="text-xs text-muted-foreground">Máximo de mensagens enviadas por hora nesta instância</p>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditConfig(null)}>Cancelar</Button>
              <Button type="submit" disabled={updateConfig.isPending}>
                {updateConfig.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Instance Selector Dialog */}
      <Dialog open={showInstanceSelector} onOpenChange={setShowInstanceSelector}>
        <DialogContent className="sm:rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <DialogTitle>Selecionar Instância</DialogTitle>
            <CardDescription>Escolha uma das instâncias disponíveis na sua Evolution API</CardDescription>
          </DialogHeader>
          {availableInstances.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma instância encontrada.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {availableInstances.map((instance, idx) => {
                const instName = instance.instance?.instanceName || instance.name || instance.instanceName;
                const status = instance.connectionStatus || instance.instance?.state || "unknown";
                return (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-auto py-3 px-4 text-left"
                    onClick={() => selectInstance(instance)}
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <span className="font-medium">{instName}</span>
                      <span className="text-xs text-muted-foreground">Status: {status}</span>
                    </div>
                    {status === "open" && (
                      <Badge variant="default" className="ml-2">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setShowInstanceSelector(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
