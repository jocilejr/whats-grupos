import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus, ArrowUpDown, Loader2, Radio, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecentEventsSectionProps {
  instanceFilter: string;
  onRealtimeEvent?: (action: string) => void;
}

type EventFilter = "all" | "add" | "remove";

export default function RecentEventsSection({ instanceFilter, onRealtimeEvent }: RecentEventsSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const listRef = useRef<HTMLDivElement>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["group-events-recent", user?.id, instanceFilter],
    queryFn: async () => {
      let query = supabase
        .from("group_participant_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100) as any;

      if (instanceFilter !== "all") {
        query = query.eq("instance_name", instanceFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("group-events-realtime")
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "group_participant_events",
        },
        (payload: any) => {
          const newEvent = payload.new;
          if (instanceFilter !== "all" && newEvent.instance_name !== instanceFilter) return;

          // Add to new events set for animation
          setNewEventIds((prev) => new Set(prev).add(newEvent.id));
          setTimeout(() => {
            setNewEventIds((prev) => {
              const next = new Set(prev);
              next.delete(newEvent.id);
              return next;
            });
          }, 3000);

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["group-events-recent"] });
          queryClient.invalidateQueries({ queryKey: ["group-stats-today"] });
          queryClient.invalidateQueries({ queryKey: ["group-stats-dashboard"] });

          // Notify parent for summary card updates
          onRealtimeEvent?.(newEvent.action);

          // Scroll to top
          if (listRef.current) {
            listRef.current.scrollTo({ top: 0, behavior: "smooth" });
          }
        }
      )
      .subscribe((status: string) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, instanceFilter, queryClient, onRealtimeEvent]);

  const formatJid = (jid: string) => {
    if (!jid) return "Desconhecido";
    return jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  };

  const getActionConfig = (action: string) => {
    switch (action) {
      case "add":
        return { label: "Entrou", icon: UserPlus, color: "text-[hsl(142,71%,45%)]", bg: "bg-[hsl(142_71%_45%/0.1)]", border: "border-[hsl(142_71%_45%/0.3)]" };
      case "remove":
        return { label: "Saiu", icon: UserMinus, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" };
      case "promote":
        return { label: "Promovido", icon: ArrowUpDown, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" };
      case "demote":
        return { label: "Rebaixado", icon: ArrowUpDown, color: "text-[hsl(28,85%,60%)]", bg: "bg-[hsl(28_85%_60%/0.1)]", border: "border-[hsl(28_85%_56%/0.3)]" };
      default:
        return { label: action, icon: ArrowUpDown, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" };
    }
  };

  const filteredEvents = (events ?? []).filter((e: any) => {
    if (eventFilter === "all") return true;
    return e.action === eventFilter;
  });

  const todayCount = (events ?? []).filter((e: any) => {
    const eventDate = new Date(e.created_at).toDateString();
    return eventDate === new Date().toDateString();
  }).length;

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Eventos Recentes
            </CardTitle>
            {isConnected && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[hsl(142_71%_45%/0.1)] border border-[hsl(142_71%_45%/0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(142,71%,45%)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(142,71%,45%)]" />
                </span>
                <span className="text-[10px] font-semibold text-[hsl(142,71%,45%)] uppercase">Live</span>
              </div>
            )}
            {todayCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {todayCount} hoje
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(["all", "add", "remove"] as EventFilter[]).map((filter) => (
              <Button
                key={filter}
                variant={eventFilter === filter ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setEventFilter(filter)}
              >
                {filter === "all" ? "Todos" : filter === "add" ? "Entradas" : "Saídas"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredEvents.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {eventFilter !== "all"
              ? `Nenhum evento de ${eventFilter === "add" ? "entrada" : "saída"} encontrado.`
              : "Nenhum evento registrado ainda. Os eventos aparecerão aqui quando alguém entrar ou sair de um grupo."}
          </p>
        ) : (
          <div ref={listRef} className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredEvents.map((event: any) => {
              const config = getActionConfig(event.action);
              const ActionIcon = config.icon;
              const isNew = newEventIds.has(event.id);
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-500 ${
                    isNew
                      ? `${config.bg} border ${config.border} scale-[1.01] shadow-sm`
                      : "bg-secondary/30 hover:bg-secondary/50"
                  }`}
                  style={{
                    animation: isNew ? "slideIn 0.4s ease-out" : undefined,
                  }}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border ${config.border}`}>
                    <ActionIcon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {formatJid(event.participant_jid)}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${config.border} ${config.color}`}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {event.group_name || formatJid(event.group_id)}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
