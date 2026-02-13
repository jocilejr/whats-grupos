import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Search, ChevronLeft, ChevronRight, Image, FileText, CheckCircle2, XCircle, Clock, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

type MessageLog = {
  id: string;
  message_type: string;
  group_id: string;
  group_name: string | null;
  instance_name: string | null;
  status: string;
  error_message: string | null;
  content: Record<string, unknown>;
  sent_at: string | null;
  created_at: string;
};

export default function HistoryPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["message-logs", user?.id, page, statusFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("message_logs")
        .select("id, message_type, group_id, group_name, instance_name, status, error_message, content, sent_at, created_at", { count: "exact" })
        .order("sent_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchTerm) {
        query = query.or(`group_name.ilike.%${searchTerm}%,group_id.ilike.%${searchTerm}%,instance_name.ilike.%${searchTerm}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { logs: (data ?? []) as MessageLog[], total: count ?? 0 };
    },
    enabled: !!user?.id,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "sent": return "Enviada";
      case "error": return "Erro";
      case "pending": return "Pendente";
      default: return status;
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "image": return <Image className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getCaption = (content: Record<string, unknown>) => {
    const caption = (content?.caption as string) || (content?.text as string) || "";
    return caption.length > 80 ? caption.substring(0, 80) + "…" : caption;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(210_75%_52%/0.15)]">
            <History className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Histórico</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Log de todas as mensagens enviadas</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Mensagens Enviadas
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">{total}</Badge>
            )}
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por grupo ou instância..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviadas</SelectItem>
                <SelectItem value="error">Com erro</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma mensagem encontrada.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="hidden md:table-cell">Instância</TableHead>
                    <TableHead className="hidden lg:table-cell">Conteúdo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5" title={log.message_type}>
                          {typeIcon(log.message_type)}
                          <span className="hidden sm:inline text-xs capitalize">{log.message_type}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {log.group_name || log.group_id}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                        {log.instance_name || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[250px] truncate">
                        {getCaption(log.content)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {statusIcon(log.status)}
                          <span className="text-xs">{statusLabel(log.status)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.sent_at
                          ? format(new Date(log.sent_at), "dd/MM/yy HH:mm", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    Página {page + 1} de {totalPages} ({total} registros)
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalhes da Mensagem
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {statusIcon(selectedLog.status)}
                      <span>{statusLabel(selectedLog.status)}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Tipo</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {typeIcon(selectedLog.message_type)}
                      <span className="capitalize">{selectedLog.message_type}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Grupo</p>
                    <p className="mt-1 break-all">{selectedLog.group_name || selectedLog.group_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Instância</p>
                    <p className="mt-1">{selectedLog.instance_name || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Enviado em</p>
                    <p className="mt-1">
                      {selectedLog.sent_at
                        ? format(new Date(selectedLog.sent_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss", { locale: ptBR })
                        : "—"}
                    </p>
                  </div>
                </div>

                {selectedLog.error_message && (
                  <div className="rounded-md bg-destructive/10 p-3">
                    <p className="text-xs font-medium text-destructive">Erro</p>
                    <p className="text-sm mt-1">{selectedLog.error_message}</p>
                  </div>
                )}

                {/* Media preview */}
                {selectedLog.content?.mediaUrl && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-2">Mídia</p>
                    <img
                      src={selectedLog.content.mediaUrl as string}
                      alt="Mídia enviada"
                      className="rounded-md max-h-48 object-contain"
                    />
                  </div>
                )}

                {/* Caption / text */}
                {(selectedLog.content?.caption || selectedLog.content?.text) && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Conteúdo</p>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                      {(selectedLog.content.caption || selectedLog.content.text) as string}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
