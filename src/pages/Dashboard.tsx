import { Card, CardContent } from "@/components/ui/card";
import { Send, CalendarClock, Wifi, Megaphone, TrendingUp, Activity } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const [logsRes, schedulesRes, configsRes, campaignsRes] = await Promise.all([
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
        supabase
          .from("campaigns")
          .select("id", { count: "exact" })
          .eq("user_id", user!.id),
      ]);
      return {
        totalSent: logsRes.count ?? 0,
        activeSchedules: schedulesRes.count ?? 0,
        activeConfigs: configsRes.count ?? 0,
        totalCampaigns: campaignsRes.count ?? 0,
      };
    },
    enabled: !!user,
  });

  const cards = [
    {
      title: "Mensagens Enviadas",
      value: stats?.totalSent ?? 0,
      icon: Send,
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
      glowColor: "shadow-[0_0_30px_hsl(210_75%_52%/0.08)]",
    },
    {
      title: "Agendamentos Ativos",
      value: stats?.activeSchedules ?? 0,
      icon: CalendarClock,
      gradient: "from-primary/15 to-primary/5",
      iconColor: "text-primary/80",
      borderColor: "border-primary/15",
      glowColor: "shadow-[0_0_30px_hsl(210_75%_52%/0.06)]",
    },
    {
      title: "Campanhas",
      value: stats?.totalCampaigns ?? 0,
      icon: Megaphone,
      gradient: "from-[hsl(28_85%_56%/0.2)] to-[hsl(28_85%_56%/0.05)]",
      iconColor: "text-[hsl(28,85%,60%)]",
      borderColor: "border-[hsl(28_85%_56%/0.2)]",
      glowColor: "shadow-[0_0_30px_hsl(28_85%_56%/0.08)]",
    },
    {
      title: "Instâncias Ativas",
      value: stats?.activeConfigs ?? 0,
      icon: Wifi,
      gradient: "from-primary/15 to-primary/5",
      iconColor: "text-primary/80",
      borderColor: "border-primary/15",
      glowColor: "shadow-[0_0_30px_hsl(210_75%_52%/0.06)]",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(210_75%_52%/0.15)]">
            <Activity className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Visão geral do seu sistema de automação</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            className={`relative overflow-hidden border ${card.borderColor} ${card.glowColor} hover:scale-[1.02] transition-all duration-300 group`}
          >
            {/* Top gradient bar */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${card.gradient}`} />
            
            <CardContent className="pt-6 pb-5">
              <div className="flex items-start justify-between mb-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} border border-white/5`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <TrendingUp className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-bold tracking-tighter">{card.value}</p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.title}</p>
              </div>
            </CardContent>

            {/* Subtle corner glow */}
            <div className={`absolute -bottom-8 -right-8 w-24 h-24 bg-gradient-to-tl ${card.gradient} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
          </Card>
        ))}
      </div>
    </div>
  );
}
