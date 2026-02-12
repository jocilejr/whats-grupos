import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Users, CalendarClock, Loader2, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CampaignDialog } from "@/components/campaigns/CampaignDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground">Gerencie campanhas de mensagens para seus grupos</p>
        </div>
        <Button onClick={() => { setEditingCampaign(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nova Campanha
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></CardContent></Card>
      ) : !campaigns?.length ? (
        <Card><CardContent className="py-10 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma campanha criada ainda.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c: any) => (
            <Card key={c.id} className={`transition-opacity ${!c.is_active ? "opacity-60" : ""}`}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{c.name}</CardTitle>
                  {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                </div>
                <Switch
                  checked={c.is_active}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: c.id, is_active: checked })}
                />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-3">
                  <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{c.group_ids?.length || 0} grupos</Badge>
                  <Badge variant="secondary"><CalendarClock className="h-3 w-3 mr-1" />{scheduledCounts?.[c.id] || 0} mensagens</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditingCampaign(c); setDialogOpen(true); }}>
                    <Pencil className="h-3 w-3 mr-1" />Editar
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeletingId(c.id)}>
                    <Trash2 className="h-3 w-3 mr-1" />Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editingCampaign}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. As mensagens agendadas desta campanha serão desvinculadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
