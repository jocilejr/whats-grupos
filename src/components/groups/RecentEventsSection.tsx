import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserMinus, ArrowUpDown, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecentEventsSectionProps {
  instanceFilter: string;
}

export default function RecentEventsSection({ instanceFilter }: RecentEventsSectionProps) {
  const { user } = useAuth();

  const { data: events, isLoading } = useQuery({
    queryKey: ["group-events-recent", user?.id, instanceFilter],
    queryFn: async () => {
      let query = supabase
        .from("group_participant_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50) as any;

      if (instanceFilter !== "all") {
        query = query.eq("instance_name", instanceFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30s
  });

  const formatJid = (jid: string) => {
    if (!jid) return "Desconhecido";
    return jid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  };

  const getActionConfig = (action: string) => {
    switch (action) {
      case "add":
        return { label: "Entrou", icon: UserPlus, color: "text-[hsl(142,71%,45%)]", border: "border-[hsl(142_71%_45%/0.3)]" };
      case "remove":
        return { label: "Saiu", icon: UserMinus, color: "text-destructive", border: "border-destructive/30" };
      case "promote":
        return { label: "Promovido", icon: ArrowUpDown, color: "text-primary", border: "border-primary/30" };
      case "demote":
        return { label: "Rebaixado", icon: ArrowUpDown, color: "text-[hsl(28,85%,60%)]", border: "border-[hsl(28_85%_56%/0.3)]" };
      default:
        return { label: action, icon: ArrowUpDown, color: "text-muted-foreground", border: "border-border" };
    }
  };

  return (
    <Card className="border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Eventos Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !events?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum evento registrado ainda. Os eventos aparecerão aqui quando alguém entrar ou sair de um grupo.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {events.map((event: any) => {
              const config = getActionConfig(event.action);
              const ActionIcon = config.icon;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
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
