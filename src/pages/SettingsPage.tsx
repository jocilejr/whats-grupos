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
import { Plus, Trash2, Wifi, WifiOff, Loader2, CheckCircle2, XCircle, Pencil } from "lucide-react";
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
              <Input
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Ex: Minha instância principal"
                required
              />
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
                      <p className="text-xs text-muted-foreground">Limite: {(config as any).max_messages_per_hour ?? 100} msgs/hora</p>
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
    </div>
  );
}
