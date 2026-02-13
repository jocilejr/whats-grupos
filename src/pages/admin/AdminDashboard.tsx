import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Wifi, MessageSquare, Megaphone, Shield, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [profiles, instances, messages, campaigns] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("api_configs").select("id", { count: "exact", head: true }),
        supabase.from("message_logs").select("id", { count: "exact", head: true }),
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
      ]);
      return {
        users: profiles.count ?? 0,
        instances: instances.count ?? 0,
        messages: messages.count ?? 0,
        campaigns: campaigns.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const cards = [
    {
      title: "Usuários",
      value: stats?.users ?? 0,
      icon: Users,
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
    },
    {
      title: "Instâncias",
      value: stats?.instances ?? 0,
      icon: Wifi,
      gradient: "from-[hsl(142_71%_45%/0.2)] to-[hsl(142_71%_45%/0.05)]",
      iconColor: "text-[hsl(142,71%,45%)]",
      borderColor: "border-[hsl(142_71%_45%/0.2)]",
    },
    {
      title: "Mensagens Enviadas",
      value: stats?.messages ?? 0,
      icon: MessageSquare,
      gradient: "from-[hsl(28_85%_56%/0.2)] to-[hsl(28_85%_56%/0.05)]",
      iconColor: "text-[hsl(28,85%,60%)]",
      borderColor: "border-[hsl(28_85%_56%/0.2)]",
    },
    {
      title: "Campanhas",
      value: stats?.campaigns ?? 0,
      icon: Megaphone,
      gradient: "from-[hsl(262_60%_55%/0.2)] to-[hsl(262_60%_55%/0.05)]",
      iconColor: "text-[hsl(262,60%,60%)]",
      borderColor: "border-[hsl(262_60%_55%/0.2)]",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(210_75%_52%/0.15)]">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Painel Administrativo</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Visão geral do sistema</p>
          </div>
        </div>
      </div>

      {/* Premium Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
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
                <TrendingUp className="h-4 w-4 text-muted-foreground/30" />
              </div>
              <p className="text-3xl font-bold tracking-tighter">{card.value}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">{card.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
