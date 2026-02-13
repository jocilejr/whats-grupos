import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Trash2, RotateCcw, Clock, Send, CheckCircle2, AlertCircle, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

type QueueItem = {
  id: string;
  user_id: string;
  scheduled_message_id: string | null;
  campaign_id: string | null;
  group_id: string;
  group_name: string | null;
  instance_name: string;
  message_type: string;
  content: any;
  api_config_id: string | null;
  api_url: string;
  api_key: string;
  status: string;
  error_message: string | null;
  priority: number;
  execution_batch: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Pendente", variant: "outline", icon: Clock },
  sending: { label: "Enviando", variant: "default", icon: Loader2 },
  sent: { label: "Enviado", variant: "secondary", icon: CheckCircle2 },
  error: { label: "Erro", variant: "destructive", icon: AlertCircle },
};

export default function QueuePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [delaySeconds, setDelaySeconds] = useState<number>(10);
  const [delayInput, setDelayInput] = useState<string>("10");

  // Fetch delay config
  const { data: globalConfig } = useQuery({
    queryKey: ["global-config-delay"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_config")
        .select("queue_delay_seconds")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (globalConfig?.queue_delay_seconds != null) {
      setDelaySeconds(globalConfig.queue_delay_seconds);
      setDelayInput(String(globalConfig.queue_delay_seconds));
    }
  }, [globalConfig]);

  const saveDelay = useMutation({
    mutationFn: async (seconds: number) => {
      const { error } = await supabase
        .from("global_config")
        .update({ queue_delay_seconds: seconds } as any)
        .not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-config-delay"] });
      toast.success("Delay atualizado!");
    },
    onError: () => toast.error("Erro ao salvar delay"),
  });

  const { data: queueItems = [], isLoading } = useQuery({
    queryKey: ["message-queue", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("message_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as QueueItem[];
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("queue-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_queue" }, () => {
        queryClient.invalidateQueries({ queryKey: ["message-queue"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const counts = {
    pending: queueItems.filter((i) => i.status === "pending").length,
    sending: queueItems.filter((i) => i.status === "sending").length,
    sent: queueItems.filter((i) => i.status === "sent").length,
    error: queueItems.filter((i) => i.status === "error").length,
  };

  const handleRetry = async (item: QueueItem) => {
    const { error } = await supabase.from("message_queue").insert({
      user_id: item.user_id,
      scheduled_message_id: item.scheduled_message_id,
      campaign_id: item.campaign_id,
      group_id: item.group_id,
      group_name: item.group_name,
      instance_name: item.instance_name,
      message_type: item.message_type,
      content: item.content,
      api_config_id: item.api_config_id,
      api_url: item.api_url,
      api_key: item.api_key,
      status: "pending",
      priority: 0,
      execution_batch: item.execution_batch,
    });
    if (error) {
      toast.error("Erro ao reenviar item");
    } else {
      toast.success("Item adicionado à fila novamente");
    }
  };

  const handleClearSent = async () => {
    const { error } = await supabase
      .from("message_queue")
      .delete()
      .eq("status", "sent");
    if (error) {
      toast.error("Erro ao limpar concluídos");
    } else {
      toast.success("Itens concluídos removidos");
      queryClient.invalidateQueries({ queryKey: ["message-queue"] });
    }
  };

  const handleClearAllQueue = async () => {
    const { error } = await supabase
      .from("message_queue")
      .delete()
      .in("status", ["pending", "sent"]);
    if (error) {
      toast.error("Erro ao limpar fila");
    } else {
      toast.success("Fila limpa completamente");
      queryClient.invalidateQueries({ queryKey: ["message-queue"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fila de Mensagens</h1>
          <p className="text-muted-foreground">Acompanhe o envio em tempo real</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" /> Limpar fila
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar fila?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação removerá todos os itens pendentes e enviados da fila. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogAction onClick={handleClearAllQueue} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Limpar fila
              </AlertDialogAction>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={handleClearSent}>
            <Trash2 className="h-4 w-4 mr-2" /> Limpar concluídos
          </Button>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["message-queue"] })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{counts.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Enviando</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{counts.sending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Enviados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{counts.sent}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Erros</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{counts.error}</div></CardContent>
        </Card>
      </div>

      {/* Delay config */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Settings2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-3 flex-1">
              <Label htmlFor="delay" className="text-sm whitespace-nowrap">Delay entre mensagens:</Label>
              <Input
                id="delay"
                type="number"
                min={1}
                max={300}
                className="w-24"
                value={delayInput}
                onChange={(e) => setDelayInput(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">segundos</span>
              <Button
                size="sm"
                disabled={saveDelay.isPending || Number(delayInput) === delaySeconds}
                onClick={() => {
                  const val = Math.max(1, Math.min(300, Number(delayInput) || 10));
                  setDelayInput(String(val));
                  saveDelay.mutate(val);
                }}
              >
                {saveDelay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="sending">Enviando</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="error">Erros</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Queue table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Instância</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : queueItems.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum item na fila</TableCell></TableRow>
              ) : (
                queueItems.map((item) => {
                  const cfg = statusConfig[item.status] || statusConfig.pending;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.group_name || item.group_id}</TableCell>
                      <TableCell><Badge variant="outline">{item.message_type}</Badge></TableCell>
                      <TableCell className="text-xs">{item.instance_name}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="gap-1">
                          <Icon className={`h-3 w-3 ${item.status === "sending" ? "animate-spin" : ""}`} />
                          {cfg.label}
                        </Badge>
                        {item.error_message && (
                          <p className="text-xs text-destructive mt-1 max-w-[200px] truncate" title={item.error_message}>
                            {item.error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        {item.status === "error" && (
                          <Button variant="ghost" size="sm" onClick={() => handleRetry(item)}>
                            <RotateCcw className="h-4 w-4 mr-1" /> Reenviar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
