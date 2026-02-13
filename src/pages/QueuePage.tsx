import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RefreshCw, Trash2, RotateCcw, Clock, Send, CheckCircle2, AlertCircle, Loader2, Settings2, ListOrdered } from "lucide-react";
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
      api_url: "resolved-at-runtime",
      api_key: "resolved-at-runtime",
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

  const summaryCards = [
    {
      title: "Pendentes",
      value: counts.pending,
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
      icon: Clock,
    },
    {
      title: "Enviando",
      value: counts.sending,
      gradient: "from-[hsl(28_85%_56%/0.2)] to-[hsl(28_85%_56%/0.05)]",
      iconColor: "text-[hsl(28,85%,60%)]",
      borderColor: "border-[hsl(28_85%_56%/0.2)]",
      icon: Send,
    },
    {
      title: "Enviados",
      value: counts.sent,
      gradient: "from-[hsl(142_71%_45%/0.2)] to-[hsl(142_71%_45%/0.05)]",
      iconColor: "text-[hsl(142,71%,45%)]",
      borderColor: "border-[hsl(142_71%_45%/0.2)]",
      icon: CheckCircle2,
    },
    {
      title: "Erros",
      value: counts.error,
      gradient: "from-destructive/20 to-destructive/5",
      iconColor: "text-destructive",
      borderColor: "border-destructive/20",
      icon: AlertCircle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(210_75%_52%/0.15)]">
              <ListOrdered className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Fila de Mensagens</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Acompanhe o envio em tempo real</p>
            </div>
          </div>
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

      {/* Premium Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card
            key={card.title}
            className={`relative overflow-hidden border ${card.borderColor} hover:scale-[1.02] transition-all duration-300`}
          >
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${card.gradient}`} />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient}`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tighter">{card.value}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">{card.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delay config */}
      <Card className="border-border/30">
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
      <Card className="border-border/30">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
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
                  {queueItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <ListOrdered className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground">Nenhum item na fila</p>
                      </TableCell>
                    </TableRow>
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
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
