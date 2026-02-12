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
  Zap, ZapOff, Sparkles, MessageSquare,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
            <p className="text-muted-foreground text-sm">Gerencie campanhas de mensagens para seus grupos</p>
          </div>
        </div>
        <Button
          onClick={() => { setEditingCampaign(null); setDialogOpen(true); }}
          className="gap-2 shadow-[0_0_15px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.4)] transition-shadow"
        >
          <Plus className="h-4 w-4" />Nova Campanha
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <Card className="border-border/50">
          <CardContent className="py-16 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground mt-3 text-sm">Carregando campanhas...</p>
          </CardContent>
        </Card>
      ) : !campaigns?.length ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">Nenhuma campanha criada</p>
            <p className="text-muted-foreground text-sm">Crie sua primeira campanha para começar a enviar mensagens.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c: any) => {
            const active = c.is_active;
            const groupCount = c.group_ids?.length || 0;
            const msgCount = scheduledCounts?.[c.id] || 0;

            return (
              <Card
                key={c.id}
                className={`relative overflow-hidden transition-all duration-300 group ${
                  active
                    ? "border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.06)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.12)]"
                    : "border-border/40 opacity-70 hover:opacity-90"
                }`}
              >
                {/* Active indicator bar */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 transition-colors ${active ? "bg-primary" : "bg-muted"}`} />

                <div className="p-5">
                  {/* Top row: icon + name + switch */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        {active ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{c.name}</h3>
                        {c.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.description}</p>
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
                  <div className="flex gap-2 mb-4">
                    <Badge variant="secondary" className="gap-1.5 text-xs font-normal bg-secondary/80">
                      <Users className="h-3 w-3 text-accent-foreground" />
                      {groupCount} grupo{groupCount !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="secondary" className="gap-1.5 text-xs font-normal bg-secondary/80">
                      <CalendarClock className="h-3 w-3 text-accent-foreground" />
                      {msgCount} mensage{msgCount !== 1 ? "ns" : "m"}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs border-border/50 hover:bg-secondary hover:text-foreground"
                      onClick={() => { setEditingCampaign(c); setDialogOpen(true); }}
                    >
                      <Pencil className="h-3 w-3" />Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                      onClick={() => setMessagesCampaign(c)}
                    >
                      <MessageSquare className="h-3 w-3" />Mensagens
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs border-border/50 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                      onClick={() => setDeletingId(c.id)}
                    >
                      <Trash2 className="h-3 w-3" />
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
