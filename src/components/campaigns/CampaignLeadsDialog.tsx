import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Check, Users, MousePointerClick, UserPlus, RefreshCw, Link2, Link2Off, X, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface GroupLink {
  group_id: string;
  invite_url: string;
  position: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: any;
}

export function CampaignLeadsDialog({ open, onOpenChange, campaign }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [slug, setSlug] = useState("");
  const [maxMembers, setMaxMembers] = useState(200);
  const [groupLinks, setGroupLinks] = useState<GroupLink[]>([]);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<string, "syncing" | "success" | "error">>({});

  const campaignId = campaign?.id;
  const groupIds: string[] = campaign?.group_ids || [];

  // Fetch existing smart link
  const { data: smartLink, isLoading: loadingSL } = useQuery({
    queryKey: ["smart-link", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_smart_links")
        .select("*")
        .eq("campaign_id", campaignId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId && open,
  });

  // Fetch group stats (latest snapshot per group) including invite_url
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["group-stats-latest", groupIds],
    queryFn: async () => {
      if (!groupIds.length) return [];
      const { data, error } = await supabase
        .from("group_stats")
        .select("group_id, group_name, member_count, snapshot_date, invite_url")
        .in("group_id", groupIds)
        .order("snapshot_date", { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      return (data || []).filter((s) => {
        if (seen.has(s.group_id)) return false;
        seen.add(s.group_id);
        return true;
      });
    },
    enabled: groupIds.length > 0 && open,
  });

  // Fetch group names from user_selected_groups
  const { data: selectedGroups } = useQuery({
    queryKey: ["selected-groups-names", groupIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_selected_groups")
        .select("group_id, group_name")
        .in("group_id", groupIds);
      if (error) throw error;
      return data || [];
    },
    enabled: groupIds.length > 0 && open,
  });

  // Fetch click counts per group
  const { data: clickCounts } = useQuery({
    queryKey: ["smart-link-clicks", smartLink?.id],
    queryFn: async () => {
      if (!smartLink?.id) return [];
      const { data, error } = await supabase
        .from("smart_link_clicks")
        .select("group_id")
        .eq("smart_link_id", smartLink.id);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        counts[r.group_id] = (counts[r.group_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!smartLink?.id && open,
  });

  // Fetch conversions (add events since smart link creation)
  const { data: joinCounts } = useQuery({
    queryKey: ["smart-link-joins", groupIds, smartLink?.created_at],
    queryFn: async () => {
      if (!groupIds.length || !smartLink?.created_at) return {};
      const { data, error } = await supabase
        .from("group_participant_events")
        .select("group_id")
        .in("group_id", groupIds)
        .eq("action", "add")
        .gte("created_at", smartLink.created_at);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r) => {
        counts[r.group_id] = (counts[r.group_id] || 0) + 1;
      });
      return counts;
    },
    enabled: groupIds.length > 0 && !!smartLink?.created_at && open,
  });

  // Initialize form from existing smart link or defaults
  useEffect(() => {
    if (smartLink) {
      setSlug(smartLink.slug || "");
      setMaxMembers(smartLink.max_members_per_group || 200);
      setGroupLinks((smartLink.group_links as any as GroupLink[]) || []);
    } else if (groupIds.length) {
      setSlug("");
      setMaxMembers(200);
      setGroupLinks(
        groupIds.map((gid, i) => ({ group_id: gid, invite_url: "", position: i }))
      );
    }
  }, [smartLink, campaignId, open]);

  // Ensure all campaign groups are in groupLinks
  useEffect(() => {
    if (!groupIds.length) return;
    setGroupLinks((prev) => {
      const existing = new Set(prev.map((g) => g.group_id));
      const newLinks = [...prev];
      groupIds.forEach((gid) => {
        if (!existing.has(gid)) {
          newLinks.push({ group_id: gid, invite_url: "", position: newLinks.length });
        }
      });
      return newLinks
        .filter((g) => groupIds.includes(g.group_id))
        .map((g, i) => ({ ...g, position: i }));
    });
  }, [groupIds]);

  const statsMap = Object.fromEntries(
    (stats || []).map((s) => [s.group_id, s])
  );
  const namesMap = Object.fromEntries(
    (selectedGroups || []).map((g) => [g.group_id, g.group_name])
  );
  const clicksMap = (clickCounts || {}) as Record<string, number>;
  const joinsMap = (joinCounts || {}) as Record<string, number>;

  const totalClicks = Object.values(clicksMap).reduce((a, b) => a + b, 0);
  const totalJoins = Object.values(joinsMap).reduce((a, b) => a + b, 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!slug.trim()) throw new Error("Defina um slug para a URL");

      // Update group_links with latest invite_urls from stats
      const updatedLinks = groupLinks.map((gl) => {
        const stat = statsMap[gl.group_id];
        const inviteUrl = (stat as any)?.invite_url || gl.invite_url || "";
        return { ...gl, invite_url: inviteUrl };
      });

      const payload = {
        campaign_id: campaignId,
        user_id: user!.id,
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        max_members_per_group: maxMembers,
        group_links: updatedLinks as any,
        is_active: true,
      };

      if (smartLink?.id) {
        const { error } = await supabase
          .from("campaign_smart_links")
          .update(payload)
          .eq("id", smartLink.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("campaign_smart_links")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-link", campaignId] });
      toast({ title: "Smart Link salvo!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const handleSyncUrls = async () => {
    setSyncing(true);
    setSyncStatus({});
    try {
      const { data: globalCfg } = await supabase
        .from("global_config")
        .select("vps_api_url")
        .limit(1)
        .maybeSingle();

      const vpsBase = (globalCfg as any)?.vps_api_url?.replace(/\/$/, "");

      if (!vpsBase) {
        toast({ title: "URL da VPS não configurada", description: "Peça ao administrador para configurar a URL da API da VPS em Configurações Globais.", variant: "destructive" });
        setSyncing(false);
        return;
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      };

      // Start sync-group-stats in parallel (fire and forget)
      fetch(`${vpsBase}/functions/v1/sync-group-stats`, { method: "POST", headers }).catch(() => {});

      // Sequential sync per group
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      for (const gl of groupLinks) {
        const groupId = gl.group_id;
        setSyncStatus((prev) => ({ ...prev, [groupId]: "syncing" }));

        try {
          const res = await fetch(`${vpsBase}/functions/v1/sync-invite-links`, {
            method: "POST",
            headers,
            body: JSON.stringify({ group_id: groupId }),
          });
          const json = await res.json();

          if (json.success && json.invite_url) {
            setSyncStatus((prev) => ({ ...prev, [groupId]: "success" }));
          } else if (json.success && !json.invite_url) {
            // Synced but no URL available
            setSyncStatus((prev) => ({ ...prev, [groupId]: "error" }));
          } else {
            setSyncStatus((prev) => ({ ...prev, [groupId]: "error" }));
          }
        } catch {
          setSyncStatus((prev) => ({ ...prev, [groupId]: "error" }));
        }

        await sleep(500);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["group-stats-latest"] });
      queryClient.invalidateQueries({ queryKey: ["smart-link", campaignId] });

      toast({ title: "Sincronização concluída!" });

      // Clear status after 5 seconds
      setTimeout(() => {
        setSyncStatus({});
      }, 5000);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const publicUrl = slug
    ? `${window.location.origin}/r/${slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}`
    : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLoading = loadingSL || loadingStats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Smart Link — {campaign?.name}
          </DialogTitle>
          <DialogDescription>
            Configure o rotacionador de grupos. URLs de convite são buscadas automaticamente via Baileys.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            {smartLink && (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <MousePointerClick className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{totalClicks}</p>
                      <p className="text-xs text-muted-foreground">Cliques totais</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <UserPlus className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{totalJoins}</p>
                      <p className="text-xs text-muted-foreground">Entradas totais</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Config */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Slug da URL</Label>
                <Input
                  placeholder="minha-campanha"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Limite de membros por grupo</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Public URL */}
            {publicUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-xs text-muted-foreground mb-0.5">URL de Redirecionamento</p>
                    <code className="text-sm block text-foreground truncate">{publicUrl}</code>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copyUrl}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 p-3">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-xs text-muted-foreground mb-0.5">URL de Retorno (Texto)</p>
                    <code className="text-sm block text-foreground truncate">{`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-link-api?slug=${slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}`}</code>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => {
                    const getUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-link-api?slug=${slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
                    navigator.clipboard.writeText(getUrl);
                    toast({ title: "URL GET copiada!" });
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </Button>
                </div>
              </div>
            )}

            {/* Sync button */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                URLs buscadas automaticamente a cada 15 minutos
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleSyncUrls}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                Sincronizar URLs agora
              </Button>
            </div>

            {/* Groups table */}
            <div className="rounded-lg border overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="w-24 text-center">Membros</TableHead>
                    <TableHead className="w-20 text-center">Cliques</TableHead>
                    <TableHead className="w-20 text-center">Entradas</TableHead>
                    <TableHead>Status do Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupLinks.map((gl, idx) => {
                    const stat = statsMap[gl.group_id];
                    const name = stat?.group_name || namesMap[gl.group_id] || gl.group_id;
                    const count = stat?.member_count ?? 0;
                    const isFull = count >= maxMembers;
                    const clicks = clicksMap[gl.group_id] ?? 0;
                    const joins = joinsMap[gl.group_id] ?? 0;
                    const inviteUrl = (stat as any)?.invite_url || gl.invite_url || null;
                    const hasUrl = !!inviteUrl;
                    const isActive = hasUrl && !isFull && !groupLinks.slice(0, idx).some((prev) => {
                      const prevStat = statsMap[prev.group_id];
                      const prevUrl = (prevStat as any)?.invite_url || prev.invite_url || null;
                      const prevCount = prevStat?.member_count ?? 0;
                      return !!prevUrl && prevCount < maxMembers;
                    });

                    return (
                      <TableRow key={gl.group_id} className={isActive ? "bg-primary/5" : ""}>
                        <TableCell className="text-muted-foreground text-center">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{name}</span>
                            {isActive && (
                              <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/30 bg-primary/10">
                                Ativo
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={isFull ? "destructive" : "secondary"} className="text-xs">
                            {count} / {maxMembers}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{clicks}</TableCell>
                        <TableCell className="text-center text-sm">{joins}</TableCell>
                        <TableCell>
                          {syncStatus[gl.group_id] === "syncing" ? (
                            <Badge variant="outline" className="text-xs gap-1 text-primary border-primary/30 bg-primary/10">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Buscando...
                            </Badge>
                          ) : syncStatus[gl.group_id] === "success" ? (
                            <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-300 bg-green-50">
                              <Check className="h-3 w-3" />
                              Atualizado
                            </Badge>
                          ) : syncStatus[gl.group_id] === "error" ? (
                            <Badge variant="outline" className="text-xs gap-1 text-destructive border-destructive/30 bg-destructive/5">
                              <X className="h-3 w-3" />
                              Falhou
                            </Badge>
                          ) : !syncing ? (
                            hasUrl ? (
                              <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-300 bg-green-50">
                                <Link2 className="h-3 w-3" />
                                Disponível
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs gap-1 text-destructive border-destructive/30 bg-destructive/5">
                                <Link2Off className="h-3 w-3" />
                                Sem link
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground border-muted">
                              <Clock className="h-3 w-3" />
                              Aguardando
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="gap-2"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar Smart Link
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
