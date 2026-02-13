import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Send, CalendarClock, Wifi, Megaphone, Activity, CheckCircle2,
  XCircle, Sparkles, TrendingUp, TrendingDown, Clock, BarChart3,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const CHART_COLORS = {
  primary: "hsl(210, 75%, 52%)",
  success: "hsl(142, 71%, 45%)",
  error: "hsl(0, 62%, 50%)",
  orange: "hsl(28, 85%, 56%)",
  muted: "hsl(215, 15%, 35%)",
  purple: "hsl(262, 60%, 55%)",
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.orange,
  CHART_COLORS.success,
  CHART_COLORS.purple,
  CHART_COLORS.error,
  CHART_COLORS.muted,
];

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

export default function Dashboard() {
  const { user } = useAuth();

  // Core stats
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const [logsRes, schedulesRes, configsRes, campaignsRes] = await Promise.all([
        supabase.from("message_logs").select("id, status", { count: "exact" }).eq("user_id", user!.id),
        supabase.from("scheduled_messages").select("id", { count: "exact" }).eq("user_id", user!.id).eq("is_active", true),
        supabase.from("api_configs").select("id", { count: "exact" }).eq("user_id", user!.id).eq("is_active", true),
        supabase.from("campaigns").select("id", { count: "exact" }).eq("user_id", user!.id),
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

  // Message logs for charts (last 30 days)
  const { data: logs } = useQuery({
    queryKey: ["dashboard-logs-30d", user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from("message_logs")
        .select("created_at, status, message_type, group_name")
        .eq("user_id", user!.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Today's stats
  const { data: todayStats } = useQuery({
    queryKey: ["dashboard-today", user?.id],
    queryFn: async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("message_logs")
        .select("status, message_type")
        .eq("user_id", user!.id)
        .gte("created_at", startOfToday.toISOString());
      if (error) throw error;
      const sent = (data ?? []).filter(l => l.status === "sent").length;
      const errors = (data ?? []).filter(l => l.status === "error").length;
      const ai = (data ?? []).filter(l => l.message_type === "ai").length;
      return { sent, errors, total: data?.length ?? 0, ai };
    },
    enabled: !!user,
  });

  // Build daily chart data (last 14 days)
  const dailyData = (() => {
    if (!logs) return [];
    const days: Record<string, { sent: number; error: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days[key] = { sent: 0, error: 0 };
    }
    for (const log of logs) {
      const key = log.created_at.split("T")[0];
      if (days[key]) {
        if (log.status === "sent") days[key].sent++;
        else if (log.status === "error") days[key].error++;
      }
    }
    return Object.entries(days).map(([date, val]) => ({
      date: `${date.split("-")[2]}/${date.split("-")[1]}`,
      Enviadas: val.sent,
      Erros: val.error,
    }));
  })();

  // Message type distribution
  const typeDistribution = (() => {
    if (!logs) return [];
    const counts: Record<string, number> = {};
    for (const log of logs) {
      const t = log.message_type || "text";
      counts[t] = (counts[t] || 0) + 1;
    }
    const labels: Record<string, string> = {
      text: "Texto", ai: "I.A.", image: "Imagem", video: "Vídeo",
      document: "Documento", audio: "Áudio", sticker: "Figurinha",
      location: "Localização", contact: "Contato", poll: "Enquete", list: "Lista",
    };
    return Object.entries(counts)
      .map(([key, value]) => ({ name: labels[key] || key, value }))
      .sort((a, b) => b.value - a.value);
  })();

  // Hourly distribution (what hour of day messages are sent)
  const hourlyData = (() => {
    if (!logs) return [];
    const hours: number[] = new Array(24).fill(0);
    for (const log of logs) {
      const h = new Date(log.created_at).getHours();
      hours[h]++;
    }
    return hours.map((count, h) => ({
      hour: `${String(h).padStart(2, "0")}h`,
      Mensagens: count,
    }));
  })();

  // Top groups
  const topGroups = (() => {
    if (!logs) return [];
    const counts: Record<string, { name: string; sent: number; error: number }> = {};
    for (const log of logs) {
      const name = log.group_name || "Desconhecido";
      if (!counts[name]) counts[name] = { name, sent: 0, error: 0 };
      if (log.status === "sent") counts[name].sent++;
      else counts[name].error++;
    }
    return Object.values(counts)
      .sort((a, b) => (b.sent + b.error) - (a.sent + a.error))
      .slice(0, 5);
  })();

  // Success rate
  const successRate = (() => {
    if (!logs?.length) return 0;
    const sent = logs.filter(l => l.status === "sent").length;
    return Math.round((sent / logs.length) * 100);
  })();

  // Compare with previous period
  const { data: prevPeriodCount } = useQuery({
    queryKey: ["dashboard-prev-period", user?.id],
    queryFn: async () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count } = await supabase
        .from("message_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .gte("created_at", sixtyDaysAgo.toISOString())
        .lt("created_at", thirtyDaysAgo.toISOString());
      return count ?? 0;
    },
    enabled: !!user,
  });

  const growthPercent = (() => {
    if (!prevPeriodCount || !logs) return null;
    if (prevPeriodCount === 0) return logs.length > 0 ? 100 : 0;
    return Math.round(((logs.length - prevPeriodCount) / prevPeriodCount) * 100);
  })();

  const metricCards = [
    {
      title: "Mensagens Enviadas",
      value: stats?.totalSent ?? 0,
      icon: Send,
      gradient: "from-primary/20 to-primary/5",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
      subtitle: growthPercent !== null
        ? `${growthPercent >= 0 ? "+" : ""}${growthPercent}% vs período anterior`
        : undefined,
      trend: growthPercent !== null ? (growthPercent >= 0 ? "up" : "down") : undefined,
    },
    {
      title: "Hoje",
      value: todayStats?.sent ?? 0,
      icon: Activity,
      gradient: "from-[hsl(142_71%_45%/0.2)] to-[hsl(142_71%_45%/0.05)]",
      iconColor: "text-[hsl(142,71%,45%)]",
      borderColor: "border-[hsl(142_71%_45%/0.2)]",
      subtitle: todayStats?.errors ? `${todayStats.errors} erro(s)` : "Sem erros",
      trend: !todayStats?.errors ? "up" : "down",
    },
    {
      title: "Campanhas",
      value: stats?.totalCampaigns ?? 0,
      icon: Megaphone,
      gradient: "from-[hsl(28_85%_56%/0.2)] to-[hsl(28_85%_56%/0.05)]",
      iconColor: "text-[hsl(28,85%,60%)]",
      borderColor: "border-[hsl(28_85%_56%/0.2)]",
      subtitle: `${stats?.activeSchedules ?? 0} agendamento(s) ativo(s)`,
    },
    {
      title: "Taxa de Sucesso",
      value: `${successRate}%`,
      icon: CheckCircle2,
      gradient: successRate >= 90
        ? "from-[hsl(142_71%_45%/0.2)] to-[hsl(142_71%_45%/0.05)]"
        : "from-[hsl(0_62%_50%/0.2)] to-[hsl(0_62%_50%/0.05)]",
      iconColor: successRate >= 90 ? "text-[hsl(142,71%,45%)]" : "text-destructive",
      borderColor: successRate >= 90 ? "border-[hsl(142_71%_45%/0.2)]" : "border-destructive/20",
      subtitle: `${logs?.length ?? 0} mensagens nos últimos 30 dias`,
      trend: successRate >= 90 ? "up" : "down",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(210_75%_52%/0.15)]">
            <BarChart3 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Visão geral de desempenho e métricas</p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <Card
            key={card.title}
            className={`relative overflow-hidden border ${card.borderColor} hover:scale-[1.02] transition-all duration-300 group`}
          >
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${card.gradient}`} />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient}`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                {card.trend === "up" && <TrendingUp className="h-4 w-4 text-[hsl(142,71%,45%)]" />}
                {card.trend === "down" && <TrendingDown className="h-4 w-4 text-destructive" />}
              </div>
              <p className="text-3xl font-bold tracking-tighter">{card.value}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">{card.title}</p>
              {card.subtitle && (
                <p className={`text-[11px] mt-1.5 ${card.trend === "up" ? "text-[hsl(142,71%,45%)]" : card.trend === "down" ? "text-destructive/80" : "text-muted-foreground"}`}>
                  {card.subtitle}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Area + Pie */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Daily Messages Area Chart */}
        <Card className="lg:col-span-2 border-border/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Envios — Últimos 14 dias
              </CardTitle>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.primary }} />
                  Enviadas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.error }} />
                  Erros
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradError" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.error} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={CHART_COLORS.error} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 15%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Enviadas" stroke={CHART_COLORS.primary} fill="url(#gradSent)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: CHART_COLORS.primary }} />
                  <Area type="monotone" dataKey="Erros" stroke={CHART_COLORS.error} fill="url(#gradError)" strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: CHART_COLORS.error }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Message Type Pie */}
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Tipos de Mensagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] flex items-center justify-center">
              {typeDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados ainda</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {typeDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      formatter={(value: string) => <span className="text-[11px] text-muted-foreground">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Hourly + Top Groups */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Hourly Distribution */}
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Distribuição por Horário
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground/40" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 15%)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 55%)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Mensagens" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Groups */}
        <Card className="border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Top 5 Grupos — 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Sem dados ainda</p>
            ) : (
              <div className="space-y-3">
                {topGroups.map((group, i) => {
                  const total = group.sent + group.error;
                  const successPct = total > 0 ? Math.round((group.sent / total) * 100) : 0;
                  const maxTotal = topGroups[0].sent + topGroups[0].error;
                  const barWidth = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                  return (
                    <div key={group.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                          <span className="text-sm font-medium truncate">{group.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold">{total}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${successPct >= 90 ? "border-[hsl(142_71%_45%/0.3)] text-[hsl(142,71%,45%)]" : "border-destructive/30 text-destructive"}`}
                          >
                            {successPct}%
                          </Badge>
                        </div>
                      </div>
                      <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barWidth}%`,
                            background: `linear-gradient(90deg, ${CHART_COLORS.primary}, ${CHART_COLORS.primary}88)`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/30">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Wifi className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.activeConfigs ?? 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Instâncias Ativas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(262_60%_55%/0.15)]">
              <Sparkles className="h-5 w-5 text-[hsl(262,60%,55%)]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{todayStats?.ai ?? 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Mensagens I.A. Hoje</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/30">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(28_85%_56%/0.15)]">
              <CalendarClock className="h-5 w-5 text-[hsl(28,85%,60%)]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.activeSchedules ?? 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Agendamentos Ativos</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
