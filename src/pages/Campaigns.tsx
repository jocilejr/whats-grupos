import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone, Plus, Users, CalendarClock, Loader2, Pencil, Trash2,
  Zap, ZapOff, Sparkles, MessageSquare, Radio,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CampaignDialog } from "@/components/campaigns/CampaignDialog";
import { CampaignMessagesDialog } from "@/components/campaigns/CampaignMessagesDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [messagesCampaign, setMessagesCampaign] = useState<any>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["campaigns", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: scheduledCounts } = useQuery({
    queryKey: ["campaign-message-counts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("campaign_id")
        .eq("user_id", user!.id)
        .not("campaign_id", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((m: any) => {
        counts[m.campaign_id] = (counts[m.campaign_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!user,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("campaigns").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha excluída" });
      setDeletingId(null);
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(210_75%_52%/0.15)]">
            <Megaphone className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Gerencie campanhas de mensagens para seus grupos</p>
          </div>
        </div>
        <Button
          onClick={() => { setEditingCampaign(null); setDialogOpen(true); }}
          className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-[0_4px_20px_hsl(210_75%_52%/0.3)] hover:shadow-[0_4px_30px_hsl(210_75%_52%/0.5)] transition-all"
        >
          <Plus className="h-4 w-4" />Nova Campanha
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">Carregando campanhas...</p>
        </div>
      ) : !campaigns?.length ? (
        <div className="relative py-20 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent rounded-3xl" />
          <div className="relative">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-secondary to-muted border border-border/50 mb-5">
              <Sparkles className="h-9 w-9 text-muted-foreground" />
            </div>
            <p className="text-foreground font-semibold text-lg mb-1">Nenhuma campanha criada</p>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">Crie sua primeira campanha para começar a enviar mensagens automatizadas para seus grupos.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c: any) => {
            const active = c.is_active;
            const groupCount = c.group_ids?.length || 0;
            const msgCount = scheduledCounts?.[c.id] || 0;

            return (
              <Card
                key={c.id}
                className={`relative overflow-hidden group transition-all duration-300 ${
                  active
                    ? "border-primary/15 shadow-[0_0_20px_hsl(210_75%_52%/0.06)] hover:shadow-[0_0_35px_hsl(210_75%_52%/0.12)] hover:border-primary/25"
                    : "border-border/30 opacity-60 hover:opacity-80"
                }`}
              >
                {/* Top gradient */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] transition-all ${
                  active 
                    ? "bg-gradient-to-r from-transparent via-primary to-transparent" 
                    : "bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent"
                }`} />

                {/* Background glow */}
                {active && (
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/8 transition-all duration-500" />
                )}

                <div className="relative p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all ${
                        active 
                          ? "bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_15px_hsl(210_75%_52%/0.1)]" 
                          : "bg-muted border border-border/30"
                      }`}>
                        {active ? <Zap className="h-5 w-5 text-primary" /> : <ZapOff className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate text-[15px]">{c.name}</h3>
                        {c.instance_name && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Radio className="h-2.5 w-2.5" />{c.instance_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: c.id, is_active: checked })}
                      className="shrink-0"
                    />
                  </div>

                  {/* Stats */}
                  <div className="flex gap-2 mb-5">
                    <div className="flex-1 rounded-lg bg-secondary/60 border border-border/30 px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                        <Users className="h-3 w-3 text-primary/70" />
                        Grupos
                      </div>
                      <p className="text-lg font-bold tracking-tight">{groupCount}</p>
                    </div>
                    <div className="flex-1 rounded-lg bg-secondary/60 border border-border/30 px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                        <CalendarClock className="h-3 w-3 text-[hsl(210,75%,62%)]/70" />
                        Mensagens
                      </div>
                      <p className="text-lg font-bold tracking-tight">{msgCount}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs border-border/40 hover:bg-secondary/80 hover:border-border/60 transition-all"
                      onClick={() => { setEditingCampaign(c); setDialogOpen(true); }}
                    >
                      <Pencil className="h-3 w-3" />Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/30 transition-all"
                      onClick={() => setMessagesCampaign(c)}
                    >
                      <MessageSquare className="h-3 w-3" />Mensagens
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all px-2.5"
                      onClick={() => setDeletingId(c.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CampaignDialog open={dialogOpen} onOpenChange={setDialogOpen} campaign={editingCampaign} />
      <CampaignMessagesDialog open={!!messagesCampaign} onOpenChange={(o) => !o && setMessagesCampaign(null)} campaign={messagesCampaign} />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As mensagens agendadas desta campanha serão desvinculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
