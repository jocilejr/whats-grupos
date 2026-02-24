import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, RefreshCw, Loader2, BarChart3, Settings, ListChecks } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import GroupSummaryCards from "@/components/groups/GroupSummaryCards";
import RecentEventsSection from "@/components/groups/RecentEventsSection";
import GroupSelectionDialog from "@/components/groups/GroupSelectionDialog";
import { useSelectedGroups } from "@/hooks/useSelectedGroups";
import { useNavigate } from "react-router-dom";

export default function GroupsPage() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedConfigId, setSelectedConfigId] = useState<string>("all");
  const [selectionOpen, setSelectionOpen] = useState(false);
  const autoSyncDone = useRef(false);

  const today = new Date().toISOString().split("T")[0];

  const { selectedGroups, selectedGroupIds, isLoading: selectionLoading, replaceAll, isReplacing } = useSelectedGroups();

  // Query api_configs
  const { data: apiConfigs, isLoading: configsLoading } = useQuery({
    queryKey: ["api-configs-active", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_configs")
        .select("id, instance_name, is_active")
        .eq("user_id", user!.id)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // All stats for today (auto-refresh every 30s)
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
    refetchInterval: 30000,
  });

  // Auto-sync on first load if no data today
  const syncMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (selectedConfigId !== "all") body.configId = selectedConfigId;
      const { data, error } = await supabase.functions.invoke("sync-group-stats", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.errors?.length) {
        toast.error(`Erros na sincronização: ${data.errors.join("; ")}`);
      } else {
        toast.success(`Sincronização concluída! ${data.synced} grupos atualizados`);
      }
      queryClient.invalidateQueries({ queryKey: ["group-stats-today"] });
      queryClient.invalidateQueries({ queryKey: ["group-stats-history"] });
      queryClient.invalidateQueries({ queryKey: ["group-events-recent"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao sincronizar: ${err.message}`);
    },
  });

  // Auto-sync if no data today
  useEffect(() => {
    if (autoSyncDone.current || isLoading || !todayStats || !session) return;
    if (todayStats.length === 0 && (apiConfigs?.length ?? 0) > 0) {
      autoSyncDone.current = true;
      syncMutation.mutate();
    } else {
      autoSyncDone.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStats, isLoading, session, apiConfigs]);

  // Derive instance filter
  const selectedConfig = apiConfigs?.find((c) => c.id === selectedConfigId);
  const instanceFilter = selectedConfigId === "all" ? "all" : (selectedConfig?.instance_name ?? "all");

  // Count events directly from group_participant_events (source of truth)
  const { data: eventCounts } = useQuery({
    queryKey: ["group-event-counts-today", user?.id, today, instanceFilter, Array.from(selectedGroupIds)],
    queryFn: async () => {
      let query = supabase
        .from("group_participant_events")
        .select("action, group_id")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59.999`);

      if (instanceFilter !== "all") {
        query = query.eq("instance_name", instanceFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let joined = 0, left = 0;
      for (const ev of data ?? []) {
        if (selectedGroupIds.size > 0 && !selectedGroupIds.has(ev.group_id)) continue;
        if (ev.action === "add") joined++;
        else if (ev.action === "remove") left++;
      }
      return { joined, left };
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Filter stats: by instance AND by selected groups
  const filteredStats = (todayStats ?? []).filter((s: any) => {
    if (instanceFilter !== "all" && s.instance_name !== instanceFilter) return false;
    if (selectedGroupIds.size > 0 && !selectedGroupIds.has(s.group_id)) return false;
    return true;
  });

  const totalGroups = filteredStats.length;
  const totalMembers = filteredStats.reduce((sum: number, s: any) => sum + s.member_count, 0);
  const totalJoined = eventCounts?.joined ?? 0;
  const totalLeft = eventCounts?.left ?? 0;

  // Available groups for selection dialog (all today stats)
  const availableGroups = (todayStats ?? []).map((s: any) => ({
    group_id: s.group_id,
    group_name: s.group_name,
    instance_name: s.instance_name,
    member_count: s.member_count,
  }));

  // Historical data (auto-refresh 30s)
  const { data: historicalData } = useQuery({
    queryKey: ["group-stats-history", user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await (supabase
        .from("group_stats" as any)
        .select("snapshot_date, member_count, joined_today, left_today, group_id")
        .eq("user_id", user!.id)
        .gte("snapshot_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true }) as any);
      if (error) throw error;
      const byDate: Record<string, { members: number; joined: number; left: number }> = {};
      for (const row of (data ?? []) as any[]) {
        // If user has selected groups, filter historical data too
        if (selectedGroupIds.size > 0 && !selectedGroupIds.has(row.group_id)) continue;
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
    refetchInterval: 30000,
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

  const hasConfigs = (apiConfigs?.length ?? 0) > 0;

  // Empty state: no instances configured
  if (!configsLoading && !hasConfigs) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Grupos</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Acompanhe membros, entradas e saídas em tempo real</p>
          </div>
        </div>
        <Card className="border-border/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Settings className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma instância configurada</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md">
              Para monitorar seus grupos, primeiro configure uma instância do WhatsApp na página de Configurações.
            </p>
            <Button onClick={() => navigate("/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Ir para Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas instâncias</SelectItem>
                {(apiConfigs ?? []).map((cfg) => (
                  <SelectItem key={cfg.id} value={cfg.id}>{cfg.instance_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setSelectionOpen(true)}>
              <ListChecks className="h-4 w-4 mr-2" />
              Gerenciar Grupos
              {selectedGroupIds.size > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px]">{selectedGroupIds.size}</Badge>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              size="sm"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar
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

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column: Table (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-border/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {selectedGroupIds.size > 0 ? "Grupos Monitorados" : "Todos os Grupos"} — Hoje
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
                  {selectedGroupIds.size > 0 ? (
                    <p className="text-sm">Nenhum dado para os grupos selecionados. Aguarde a próxima sincronização.</p>
                  ) : (
                    <div>
                      <p className="text-sm mb-4">Nenhum dado encontrado. Clique em "Gerenciar Grupos" para selecionar os grupos que deseja monitorar.</p>
                      <Button variant="outline" onClick={() => setSelectionOpen(true)}>
                        <ListChecks className="h-4 w-4 mr-2" />
                        Gerenciar Grupos
                      </Button>
                    </div>
                  )}
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

        {/* Right column: Events (2/5) */}
        <div className="lg:col-span-2">
          <RecentEventsSection
            instanceFilter={instanceFilter}
            onRealtimeEvent={() => {
              queryClient.invalidateQueries({ queryKey: ["group-stats-today"] });
              queryClient.invalidateQueries({ queryKey: ["group-event-counts-today"] });
            }}
          />
        </div>
      </div>

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

      {/* Selection Dialog */}
      <GroupSelectionDialog
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        availableGroups={availableGroups}
        selectedGroupIds={selectedGroupIds}
        onConfirm={replaceAll}
        isLoading={isReplacing}
      />
    </div>
  );
}
