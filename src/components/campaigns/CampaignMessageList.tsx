import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Image, Video, File, Pencil, Trash2, Loader2,
  Clock, Repeat, AlertCircle, Mic, Sticker, MapPin,
  Contact, BarChart3, List, AtSign, Link2, CalendarDays,
  CalendarClock, Calendar, Power,
} from "lucide-react";

interface CampaignMessageListProps {
  campaignId: string;
  apiConfigId: string;
  instanceName: string;
  groupIds: string[];
  scheduleType: string;
  onEdit: (msg: any) => void;
  weekdayFilter?: number | null;
}

const typeIcons: Record<string, any> = {
  text: FileText, image: Image, video: Video, document: File,
  audio: Mic, sticker: Sticker, location: MapPin, contact: Contact,
  poll: BarChart3, list: List,
};

const typeLabels: Record<string, string> = {
  text: "Texto", image: "Imagem", video: "Vídeo", document: "Documento",
  audio: "Áudio", sticker: "Figurinha", location: "Localização", contact: "Contato",
  poll: "Enquete", list: "Lista",
};

export function CampaignMessageList({ campaignId, apiConfigId, instanceName, groupIds, scheduleType, onEdit, weekdayFilter }: CampaignMessageListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["campaign-scheduled-messages", campaignId, scheduleType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", user!.id)
        .eq("schedule_type", scheduleType)
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
    switch (msg.message_type) {
      case "text": return c.text || "(vazio)";
      case "image": case "video": case "document": return c.caption || c.fileName || "Mídia";
      case "audio": return "🎵 Áudio";
      case "sticker": return "🖼️ Figurinha";
      case "location": return `📍 ${c.name || "Localização"} ${c.address ? `- ${c.address}` : ""}`;
      case "contact": return `👤 ${c.contactName || "Contato"}`;
      case "poll": return `📊 ${c.pollName || "Enquete"}`;
      case "list": return `📋 ${c.listTitle || "Lista"}`;
      case "buttons": return `🔘 ${c.btnTitle || "Botões"}`;
      default: return c.text || "(sem conteúdo)";
    }
  };

  const getScheduleInfo = (msg: any) => {
    const c = msg.content as any || {};
    if (msg.schedule_type === "once" && msg.scheduled_at) {
      return new Date(msg.scheduled_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
    }
    const time = c.runTime || "08:00";
    if (msg.schedule_type === "daily") return `Todos os dias às ${time}`;
    if (msg.schedule_type === "weekly") {
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const selected = (c.weekDays || []).map((d: number) => days[d]).join(", ");
      return `${selected} às ${time}`;
    }
    if (msg.schedule_type === "monthly") return `Dia ${c.monthDay || 1} às ${time}`;
    return "";
  };

  const getNextRun = (msg: any) => {
    if (!msg.next_run_at) return null;
    return new Date(msg.next_run_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground mt-2">Carregando mensagens...</p>
      </div>
    );
  }

  const filteredMessages = weekdayFilter != null
    ? (messages || []).filter((msg) => {
        const wd = (msg.content as any)?.weekDays as number[] | undefined;
        return wd?.includes(weekdayFilter);
      })
    : messages || [];

  if (!filteredMessages.length) {
    return (
      <div className="py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mx-auto mb-3">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {weekdayFilter != null ? "Nenhuma mensagem neste dia" : "Nenhuma mensagem agendada"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Clique em "Adicionar Mensagem" para criar uma.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {filteredMessages.map((msg) => {
        const Icon = typeIcons[msg.message_type] || FileText;
        const active = msg.is_active;
        const nextRun = getNextRun(msg);
        const c = msg.content as any || {};
        const hasImage = msg.message_type === "image" && c.mediaUrl;
        const hasVideo = msg.message_type === "video" && c.mediaUrl;
        const hasMention = c.mentionsEveryOne;
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

        return (
          <div
            key={msg.id}
            className={`rounded-xl border overflow-hidden transition-all ${
              active
                ? "border-border/50 bg-background/40 hover:shadow-md"
                : "border-border/30 bg-muted/20 opacity-60"
            }`}
          >
            <div className="flex">
              {/* Left: Content preview */}
              <div className="flex-1 min-w-0">
                {/* Media thumbnail or icon strip */}
                {hasImage ? (
                  <div className="relative h-24 w-full bg-muted/30">
                    <img src={c.mediaUrl} alt="Preview" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/60" />
                    <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] gap-0.5 font-normal px-1.5 py-0 bg-background/80 backdrop-blur-sm">
                      <Image className="h-2.5 w-2.5" />Imagem
                    </Badge>
                  </div>
                ) : hasVideo ? (
                  <div className="relative h-24 w-full bg-muted/30">
                    <video src={c.mediaUrl} className="h-full w-full object-cover" muted />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/60" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center">
                        <Video className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 pb-2">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary/10" : "bg-muted"}`}>
                        <Icon className={`h-4.5 w-4.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant="secondary" className="text-[10px] gap-0.5 font-normal px-1.5 py-0">
                            {typeLabels[msg.message_type] || msg.message_type}
                          </Badge>
                          {hasMention && (
                            <Badge variant="outline" className="text-[10px] gap-0.5 font-normal border-primary/30 text-primary px-1.5 py-0">
                              <AtSign className="h-2.5 w-2.5" />Todos
                            </Badge>
                          )}
                          {msg.message_type === "text" && c.linkPreview === false && (
                            <Badge variant="outline" className="text-[10px] gap-0.5 font-normal border-border/50 text-muted-foreground px-1.5 py-0">
                              <Link2 className="h-2.5 w-2.5" />Sem preview
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-foreground line-clamp-3 leading-relaxed">{getPreview(msg)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Caption for media */}
                {(hasImage || hasVideo) && (
                  <div className="px-4 pt-2 pb-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {hasMention && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 font-normal border-primary/30 text-primary px-1.5 py-0">
                          <AtSign className="h-2.5 w-2.5" />Todos
                        </Badge>
                      )}
                    </div>
                    {c.caption && <p className="text-xs text-foreground line-clamp-2">{c.caption}</p>}
                  </div>
                )}
              </div>

              {/* Right: Schedule panel */}
              <div className="w-40 shrink-0 border-l border-border/30 bg-muted/10 flex flex-col">
                <div className="p-3 flex-1 space-y-2">
                  {/* Schedule type header */}
                  <div className="flex items-center gap-1.5">
                    {msg.schedule_type === "once" && <Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                    {msg.schedule_type === "daily" && <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />}
                    {msg.schedule_type === "weekly" && <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />}
                    {msg.schedule_type === "monthly" && <Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                      {msg.schedule_type === "once" ? "Único" : msg.schedule_type === "daily" ? "Diário" : msg.schedule_type === "weekly" ? "Semanal" : "Mensal"}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="text-lg font-mono font-bold text-foreground tabular-nums leading-none">
                    {c.runTime || (msg.scheduled_at ? new Date(msg.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "08:00")}
                  </div>

                  {/* Weekly days pills */}
                  {msg.schedule_type === "weekly" && c.weekDays && (
                    <div className="flex flex-wrap gap-0.5">
                      {days.map((d, i) => (
                        <span
                          key={i}
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                            (c.weekDays as number[]).includes(i)
                              ? "bg-primary/15 text-primary"
                              : "text-muted-foreground/40"
                          }`}
                        >{d}</span>
                      ))}
                    </div>
                  )}

                  {/* Once: date */}
                  {msg.schedule_type === "once" && msg.scheduled_at && (
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(msg.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}

                  {/* Monthly: day */}
                  {msg.schedule_type === "monthly" && (
                    <p className="text-[11px] text-muted-foreground">Dia {c.monthDay || 1} de cada mês</p>
                  )}

                  {/* Next run */}
                  {nextRun && (
                    <div className="pt-1 border-t border-border/20">
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-medium">Próximo:</span> {nextRun}
                      </p>
                    </div>
                  )}
                  {msg.last_run_at && (
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Último:</span> {new Date(msg.last_run_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-border/20 px-2 py-1.5">
                  <Switch
                    checked={!!active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: msg.id, is_active: checked })}
                    className="scale-[0.65] origin-left"
                  />
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(msg)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(msg.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
