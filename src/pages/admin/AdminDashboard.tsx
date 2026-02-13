import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wifi, MessageSquare, Megaphone } from "lucide-react";

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
    { title: "Usuários", value: stats?.users ?? 0, icon: Users },
    { title: "Instâncias", value: stats?.instances ?? 0, icon: Wifi },
    { title: "Mensagens Enviadas", value: stats?.messages ?? 0, icon: MessageSquare },
    { title: "Campanhas", value: stats?.campaigns ?? 0, icon: Megaphone },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="text-muted-foreground">Visão geral do sistema</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
