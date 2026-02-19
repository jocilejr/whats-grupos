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
import { Plus, Trash2, Wifi, Loader2, CheckCircle2, XCircle, QrCode, Settings2, Smartphone } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
      const { data: newConfig, error } = await supabase.from("api_configs").insert({
        user_id: user!.id,
        instance_name: newInstanceName,
        api_url: "global",
        api_key: "global",
      }).select().single();
      if (error) throw error;

      const result = await callEvolutionApi("createInstance", newConfig.id);
      
      if (result.error) {
        await supabase.from("api_configs").delete().eq("id", newConfig.id);
        throw new Error(result.error);
      }

      queryClient.invalidateQueries({ queryKey: ["api-configs"] });
      setNewInstanceName("");
      toast({ title: "Instância criada!" });

      const qrResult = await callEvolutionApi("connectInstance", newConfig.id);
      const qrCode = qrResult?.base64 || qrResult?.qrcode?.base64 || qrResult?.qrcode || qrResult?.code;
      if (qrCode && typeof qrCode === "string" && qrCode.length > 50) {
        const src = qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`;
        setQrCodeData({ name: newInstanceName, qrcode: src });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCreatingInstance(false);
    }
  };

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      try {
        await callEvolutionApi("deleteInstance", id);
      } catch {
        // Continue even if Evolution API fails
      }
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
      } else if (state === "connecting") {
        toast({ title: "Conectando...", description: "A instância está em processo de conexão. Aguarde alguns segundos e teste novamente." });
      } else if (state === "close") {
        toast({ title: "Desconectada", description: "Clique em 'QR Code' para reconectar.", variant: "destructive" });
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
      console.log("connectInstance response:", JSON.stringify(result));
      
      // If count === 0, the instance is already connected - no QR needed
      if (result?.count === 0 || (typeof result?.count === "number" && result.count === 0)) {
        toast({ title: "Instância já conectada!", description: "Não é necessário escanear o QR Code." });
        // Refresh connection state
        const stateResult = await callEvolutionApi("connectionState", configId);
        setConnectionStates((prev) => ({ ...prev, [configId]: stateResult }));
        return;
      }
      
      const qr = result?.base64 || result?.qrcode?.base64 || result?.qrcode || result?.code;
      if (qr && typeof qr === "string" && qr.length > 50) {
        const src = qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
        setQrCodeData({ name, qrcode: src });
      } else {
        toast({ title: "QR Code não disponível", description: "Tente desconectar e reconectar a instância na Evolution API.", variant: "destructive" });
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
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(210_75%_52%/0.15)]">
            <Settings2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Minhas Instâncias</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Gerencie suas conexões WhatsApp</p>
          </div>
        </div>
      </div>

      {/* Usage bar */}
      <Card className="border-border/30 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Instâncias utilizadas</span>
            <Badge variant="secondary" className="text-xs font-mono">{currentCount} / {maxInstances}</Badge>
          </div>
          <Progress value={(currentCount / maxInstances) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Create instance */}
      {canCreate && (
        <Card className="border-dashed border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-5 w-5 text-primary" /> Nova Instância
            </CardTitle>
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
                  className="bg-background/50 border-border/50"
                />
              </div>
              <Button type="submit" disabled={creatingInstance} className="gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-[0_4px_15px_hsl(210_75%_52%/0.25)]">
                {creatingInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Instances list */}
      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        </div>
      ) : !configs?.length ? (
        <div className="py-16 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/50 mb-4">
            <Smartphone className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Nenhuma instância criada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => {
            const state = getStateForConfig(config.id);
            const connected = state === "open";
            return (
              <Card
                key={config.id}
                className={`relative overflow-hidden transition-all group ${
                  connected 
                    ? "border-[hsl(210_75%_52%/0.2)] shadow-[0_0_20px_hsl(210_75%_52%/0.06)]" 
                    : "border-border/30"
                }`}
              >
                <div className={`absolute top-0 left-0 right-0 h-[2px] transition-all ${
                  connected ? "bg-gradient-to-r from-transparent via-[hsl(210,75%,52%)]/60 to-transparent" : "bg-transparent"
                }`} />
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                      connected
                        ? "bg-gradient-to-br from-[hsl(210_75%_52%/0.2)] to-[hsl(210_75%_52%/0.05)] border border-[hsl(210_75%_52%/0.2)]"
                        : "bg-secondary border border-border/30"
                    }`}>
                      <Wifi className={`h-4 w-4 ${connected ? "text-[hsl(210,75%,62%)]" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px]">{config.instance_name}</p>
                      {state && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {connected ? (
                            <Badge className="bg-[hsl(210_75%_52%/0.15)] text-[hsl(210,75%,62%)] border-[hsl(210_75%_52%/0.2)] text-[10px] gap-1 px-1.5 py-0">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Conectado
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0">
                              <XCircle className="h-2.5 w-2.5" /> {state}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => showQrCode(config.id, config.instance_name)} className="gap-1.5 text-xs border-border/40">
                      <QrCode className="h-3.5 w-3.5" /> QR Code
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(config.id)}
                      disabled={testingId === config.id}
                      className="gap-1.5 text-xs border-border/40"
                    >
                      {testingId === config.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">Status</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir instância?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A instância "{config.instance_name}" será removida permanentemente. Essa ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogAction onClick={() => deleteConfig.mutate(config.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Excluir
                        </AlertDialogAction>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
