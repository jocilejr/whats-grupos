import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, UserPlus, UserMinus, RefreshCw, Loader2, BarChart3, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import GroupSummaryCards from "@/components/groups/GroupSummaryCards";
import RecentEventsSection from "@/components/groups/RecentEventsSection";

export default function GroupsPage() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [instanceFilter, setInstanceFilter] = useState<string>("all");

  const today = new Date().toISOString().split("T")[0];

  const { data: todayStats, isLoading } = useQuery({
    queryKey: ["group-stats-today", user?.id, today],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("group_stats" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("snapshot_date", today)
        .order("member_count", { ascending: false }) as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  const instances = [...new Set((todayStats ?? []).map((s: any) => s.instance_name))];

  const filteredStats = instanceFilter === "all"
    ? (todayStats ?? [])
    : (todayStats ?? []).filter((s: any) => s.instance_name === instanceFilter);

  const totalGroups = filteredStats.length;
  const totalMembers = filteredStats.reduce((sum: number, s: any) => sum + s.member_count, 0);
  const totalJoined = filteredStats.reduce((sum: number, s: any) => sum + s.joined_today, 0);
  const totalLeft = filteredStats.reduce((sum: number, s: any) => sum + s.left_today, 0);

  const { data: historicalData } = useQuery({
    queryKey: ["group-stats-history", user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await (supabase
        .from("group_stats" as any)
        .select("snapshot_date, member_count, joined_today, left_today")
        .eq("user_id", user!.id)
        .gte("snapshot_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true }) as any);
      if (error) throw error;
      const byDate: Record<string, { members: number; joined: number; left: number }> = {};
      for (const row of (data ?? []) as any[]) {
        const d = row.snapshot_date;
        if (!byDate[d]) byDate[d] = { members: 0, joined: 0, left: 0 };
        byDate[d].members += row.member_count;
        byDate[d].joined += row.joined_today;
        byDate[d].left += row.left_today;
      }
      return Object.entries(byDate).map(([date, val]) => ({
        date: `${date.split("-")[2]}/${date.split("-")[1]}`,
        Membros: val.members,
        Entradas: val.joined,
        Saídas: val.left,
      }));
    },
    enabled: !!user,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-group-stats", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sincronização concluída! ${data.synced} grupos, +${data.joined} entradas, -${data.left} saídas`);
      queryClient.invalidateQueries({ queryKey: ["group-stats-today"] });
      queryClient.invalidateQueries({ queryKey: ["group-stats-history"] });
      queryClient.invalidateQueries({ queryKey: ["group-stats-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["group-events-recent"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao sincronizar: ${err.message}`);
    },
  });

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 shadow-xl">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(210_75%_52%/0.15)]">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Monitoramento de Grupos
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Acompanhe membros, entradas e saídas em tempo real
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {instances.length > 1 && (
              <Select value={instanceFilter} onValueChange={setInstanceFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas instâncias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas instâncias</SelectItem>
                  {instances.map((inst) => (
                    <SelectItem key={inst} value={inst}>{inst}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar Agora
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <GroupSummaryCards
        totalGroups={totalGroups}
        totalMembers={totalMembers}
        totalJoined={totalJoined}
        totalLeft={totalLeft}
      />

      {/* Recent Events */}
      <RecentEventsSection instanceFilter={instanceFilter} />

      {/* Chart */}
      {(historicalData?.length ?? 0) > 1 && (
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground/40" />
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Evolução de Membros — Últimos 30 dias
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradMembers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(210, 75%, 52%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(210, 75%, 52%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 15%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Membros" stroke="hsl(210, 75%, 52%)" fill="url(#gradMembers)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups Table */}
      <Card className="border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Grupos — Dados de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum dado encontrado. Clique em "Sincronizar Agora" para buscar os grupos.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-center">Membros</TableHead>
                  <TableHead className="text-center">Entradas</TableHead>
                  <TableHead className="text-center">Saídas</TableHead>
                  <TableHead>Instância</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStats.map((stat: any) => (
                  <TableRow key={stat.id}>
                    <TableCell className="font-medium max-w-[250px] truncate">
                      {stat.group_name}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {stat.member_count}
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.joined_today > 0 ? (
                        <Badge variant="outline" className="border-[hsl(142_71%_45%/0.3)] text-[hsl(142,71%,45%)]">
                          +{stat.joined_today}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.left_today > 0 ? (
                        <Badge variant="outline" className="border-destructive/30 text-destructive">
                          -{stat.left_today}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {stat.instance_name}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
