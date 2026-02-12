import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScheduledMessageForm } from "./ScheduledMessageForm";
import { useState } from "react";
import {
  Plus, FileText, Image, Video, File, Pencil, Trash2, Loader2,
  CalendarClock, Clock, Repeat,
} from "lucide-react";

interface CampaignMessageListProps {
  campaignId: string;
  apiConfigId: string;
  instanceName: string;
  groupIds: string[];
}

const typeIcons: Record<string, any> = {
  text: FileText,
  image: Image,
  video: Video,
  document: File,
};

const scheduleLabels: Record<string, string> = {
  once: "Único",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export function CampaignMessageList({ campaignId, apiConfigId, instanceName, groupIds }: CampaignMessageListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingMsg, setEditingMsg] = useState<any>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["campaign-scheduled-messages", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!campaignId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("scheduled_messages").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign-scheduled-messages"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-scheduled-messages"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-message-counts"] });
      toast({ title: "Mensagem excluída" });
    },
  });

  const getPreview = (msg: any) => {
    const c = msg.content as any || {};
    if (msg.message_type === "text") return c.text?.slice(0, 50) || "(vazio)";
    return c.caption || c.fileName || "Mídia";
  };

  const getTimeInfo = (msg: any) => {
    if (msg.schedule_type === "once" && msg.scheduled_at) {
      return new Date(msg.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    }
    const c = msg.content as any || {};
    return c.runTime || "";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <CalendarClock className="h-3 w-3" />Mensagens Agendadas
        </Label>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-border/50 h-7"
          onClick={() => { setEditingMsg(null); setFormOpen(true); }}
          disabled={!apiConfigId || !instanceName}
        >
          <Plus className="h-3 w-3" />Adicionar
        </Button>
      </div>

      {isLoading ? (
        <div className="py-4 text-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />
        </div>
      ) : !messages?.length ? (
        <div className="rounded-xl border border-dashed border-border/50 p-4 text-center">
          <p className="text-xs text-muted-foreground">Nenhuma mensagem agendada.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {messages.map((msg) => {
            const Icon = typeIcons[msg.message_type] || FileText;
            const active = msg.is_active;
            return (
              <div
                key={msg.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                  active ? "border-border/50 bg-background/30" : "border-border/30 opacity-60"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{getPreview(msg)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {msg.schedule_type === "once" ? <Clock className="h-2.5 w-2.5 mr-0.5" /> : <Repeat className="h-2.5 w-2.5 mr-0.5" />}
                      {scheduleLabels[msg.schedule_type] || msg.schedule_type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{getTimeInfo(msg)}</span>
                  </div>
                </div>
                <Switch
                  checked={!!active}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: msg.id, is_active: checked })}
                  className="scale-75"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingMsg(msg); setFormOpen(true); }}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(msg.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <ScheduledMessageForm
        open={formOpen}
        onOpenChange={setFormOpen}
        campaignId={campaignId}
        apiConfigId={apiConfigId}
        instanceName={instanceName}
        groupIds={groupIds}
        message={editingMsg}
      />
    </div>
  );
}

// Need Label import
import { Label } from "@/components/ui/label";
