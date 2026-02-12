import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, CalendarClock, Users, Wifi } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const [logsRes, schedulesRes, configsRes] = await Promise.all([
        supabase
          .from("message_logs")
          .select("id, status", { count: "exact" })
          .eq("user_id", user!.id),
        supabase
          .from("scheduled_messages")
          .select("id", { count: "exact" })
          .eq("user_id", user!.id)
          .eq("is_active", true),
        supabase
          .from("api_configs")
          .select("id", { count: "exact" })
          .eq("user_id", user!.id)
          .eq("is_active", true),
      ]);
      return {
        totalSent: logsRes.count ?? 0,
        activeSchedules: schedulesRes.count ?? 0,
        activeConfigs: configsRes.count ?? 0,
      };
    },
    enabled: !!user,
  });

  const cards = [
    {
      title: "Mensagens Enviadas",
      value: stats?.totalSent ?? 0,
      icon: Send,
      description: "Total de mensagens",
    },
    {
      title: "Agendamentos Ativos",
      value: stats?.activeSchedules ?? 0,
      icon: CalendarClock,
      description: "Mensagens programadas",
    },
    {
      title: "Instâncias Ativas",
      value: stats?.activeConfigs ?? 0,
      icon: Wifi,
      description: "APIs conectadas",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu sistema de automação</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
