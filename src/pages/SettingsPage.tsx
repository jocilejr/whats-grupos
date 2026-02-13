import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Wifi, Loader2, CheckCircle2, XCircle, QrCode } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function SettingsPage() {
  const { user } = useAuth();
  const { plan } = usePlan();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newInstanceName, setNewInstanceName] = useState("");
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ name: string; qrcode: string } | null>(null);

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

  const maxInstances = plan?.max_instances ?? 1;
  const currentCount = configs?.length ?? 0;
  const canCreate = currentCount < maxInstances;

  const [testingId, setTestingId] = useState<string | null>(null);
  const [connectionStates, setConnectionStates] = useState<Record<string, any>>({});

  const callEvolutionApi = async (action: string, configId: string, body?: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=${action}&configId=${configId}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }
    );
    return resp.json();
  };

  const createInstance = async () => {
    if (!newInstanceName.trim()) return;
    setCreatingInstance(true);
    try {
      // First create a local api_config record
      const { data: newConfig, error } = await supabase.from("api_configs").insert({
        user_id: user!.id,
        instance_name: newInstanceName,
        api_url: "global", // placeholder, evolution-api edge function uses global_config
        api_key: "global",
      }).select().single();
      if (error) throw error;

      // Call edge function to create instance on Evolution API
      const result = await callEvolutionApi("createInstance", newConfig.id);
      
      if (result.error) {
        // Rollback
        await supabase.from("api_configs").delete().eq("id", newConfig.id);
        throw new Error(result.error);
      }

      queryClient.invalidateQueries({ queryKey: ["api-configs"] });
      setNewInstanceName("");
      toast({ title: "Instância criada!" });

      // Auto-fetch QR code
      const qr = await callEvolutionApi("connectInstance", newConfig.id);
      if (qr?.base64) {
        setQrCodeData({ name: newInstanceName, qrcode: qr.base64 });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCreatingInstance(false);
    }
  };

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

  const testConnection = async (configId: string) => {
    setTestingId(configId);
    try {
      const result = await callEvolutionApi("connectionState", configId);
      setConnectionStates((prev) => ({ ...prev, [configId]: result }));
      const state = result?.instance?.state || result?.state;
      if (state === "open") {
        toast({ title: "Conexão ativa!", description: "Instância conectada ao WhatsApp." });
      } else {
        toast({ title: "Status: " + (state || "desconhecido"), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao testar", description: e.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const showQrCode = async (configId: string, name: string) => {
    try {
      const result = await callEvolutionApi("connectInstance", configId);
      if (result?.base64) {
        setQrCodeData({ name, qrcode: result.base64 });
      } else {
        toast({ title: "QR Code não disponível", description: "A instância pode já estar conectada.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
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
        <h1 className="text-3xl font-bold tracking-tight">Minhas Instâncias</h1>
        <p className="text-muted-foreground">Gerencie suas conexões WhatsApp</p>
      </div>

      {/* Usage bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Instâncias utilizadas</span>
            <span className="text-sm text-muted-foreground">{currentCount} de {maxInstances}</span>
          </div>
          <Progress value={(currentCount / maxInstances) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Create instance */}
      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Nova Instância</CardTitle>
            <CardDescription>Crie uma nova conexão WhatsApp</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createInstance(); }} className="flex gap-3">
              <div className="flex-1">
                <Label className="sr-only">Nome da Instância</Label>
                <Input
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Nome da instância (ex: Vendas)"
                  required
                />
              </div>
              <Button type="submit" disabled={creatingInstance}>
                {creatingInstance ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Criar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Instances list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wifi className="h-5 w-5" /> Instâncias</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !configs?.length ? (
            <p className="text-muted-foreground">Nenhuma instância criada ainda.</p>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => {
                const state = getStateForConfig(config.id);
                return (
                  <div key={config.id} className="flex items-center justify-between rounded-lg border p-4 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{config.instance_name}</p>
                        {state === "open" && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                          </Badge>
                        )}
                        {state && state !== "open" && (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" /> {state}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => showQrCode(config.id, config.instance_name)}>
                        <QrCode className="h-4 w-4 mr-1" /> QR Code
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(config.id)}
                        disabled={testingId === config.id}
                      >
                        {testingId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                        <span className="ml-1 hidden sm:inline">Status</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteConfig.mutate(config.id)}>
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

      {/* QR Code Dialog */}
      <Dialog open={!!qrCodeData} onOpenChange={(o) => !o && setQrCodeData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code - {qrCodeData?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {qrCodeData?.qrcode ? (
              <img src={qrCodeData.qrcode} alt="QR Code WhatsApp" className="max-w-[300px] rounded-lg" />
            ) : (
              <p className="text-muted-foreground">QR Code não disponível</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrCodeData(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
