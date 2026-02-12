import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Image, Video, File, Pencil, Trash2, Loader2,
  Clock, AlertCircle, Mic, Sticker, MapPin,
  Contact, BarChart3, List, AtSign, Link2, CalendarDays,
  CalendarClock, Calendar, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function CampaignMessageList({ campaignId, apiConfigId, instanceName, groupIds, scheduleType, onEdit, weekdayFilter }: CampaignMessageListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const getTime = (msg: any) => {
    const c = msg.content as any || {};
    return c.runTime || (msg.scheduled_at ? new Date(msg.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "08:00");
  };

  const getPreview = (msg: any) => {
    const c = msg.content as any || {};
    switch (msg.message_type) {
      case "text": return c.text || "(vazio)";
      case "image": case "video": case "document": return c.caption || c.fileName || "Mídia";
      case "audio": return "Áudio";
      case "sticker": return "Figurinha";
      case "location": return c.name || "Localização";
      case "contact": return c.contactName || "Contato";
      case "poll": return c.pollName || "Enquete";
      case "list": return c.listTitle || "Lista";
      default: return c.text || "(sem conteúdo)";
    }
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
    <div className="space-y-1.5">
      {filteredMessages.map((msg) => {
        const Icon = typeIcons[msg.message_type] || FileText;
        const active = msg.is_active;
        const c = msg.content as any || {};
        const expanded = expandedId === msg.id;
        const hasImage = msg.message_type === "image" && c.mediaUrl;
        const hasVideo = msg.message_type === "video" && c.mediaUrl;
        const hasMention = c.mentionsEveryOne;
        const nextRun = getNextRun(msg);
        const time = getTime(msg);

        return (
          <div
            key={msg.id}
            className={cn(
              "rounded-xl border overflow-hidden transition-all",
              active ? "border-border/50 bg-background/40" : "border-border/30 bg-muted/20 opacity-60",
              expanded && "ring-1 ring-primary/20"
            )}
          >
            {/* Collapsed row — click to expand */}
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : msg.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              {/* Time badge */}
              <div className={cn(
                "flex items-center justify-center rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums shrink-0",
                active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {time}
              </div>

              {/* Type icon */}
              <div className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                active ? "bg-secondary" : "bg-muted"
              )}>
                <Icon className={cn("h-4 w-4", active ? "text-foreground" : "text-muted-foreground")} />
              </div>

              {/* Preview text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getPreview(msg)}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="secondary" className="text-[10px] gap-0.5 font-normal px-1.5 py-0">
                    {typeLabels[msg.message_type] || msg.message_type}
                  </Badge>
                  {hasMention && (
                    <Badge variant="outline" className="text-[10px] gap-0.5 font-normal border-primary/30 text-primary px-1.5 py-0">
                      <AtSign className="h-2.5 w-2.5" />
                    </Badge>
                  )}
                  {!active && (
                    <Badge variant="outline" className="text-[10px] font-normal border-border/50 text-muted-foreground px-1.5 py-0">
                      Inativo
                    </Badge>
                  )}
                </div>
              </div>

              {/* Weekly day pills (compact) */}
              {msg.schedule_type === "weekly" && c.weekDays && (
                <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                  {DAYS.map((d, i) => (
                    <span
                      key={i}
                      className={cn(
                        "text-[9px] font-bold w-5 h-5 rounded flex items-center justify-center",
                        (c.weekDays as number[]).includes(i)
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground/30"
                      )}
                    >{d[0]}</span>
                  ))}
                </div>
              )}

              {/* Once: date */}
              {msg.schedule_type === "once" && msg.scheduled_at && (
                <span className="hidden sm:block text-[11px] text-muted-foreground shrink-0">
                  {new Date(msg.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </span>
              )}

              {/* Monthly: day */}
              {msg.schedule_type === "monthly" && (
                <span className="hidden sm:block text-[11px] text-muted-foreground shrink-0">
                  Dia {c.monthDay || 1}
                </span>
              )}

              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                expanded && "rotate-180"
              )} />
            </button>

            {/* Expanded details */}
            {expanded && (
              <div className="border-t border-border/30">
                <div className="flex min-h-[200px]">
                  {/* LEFT: Full media preview */}
                  {(hasImage || hasVideo) && (
                    <div className="shrink-0 bg-black/5 flex items-start justify-center p-2">
                      {hasImage && (
                        <img src={c.mediaUrl} alt="Preview" className="max-w-[220px] max-h-[400px] rounded-lg object-contain" />
                      )}
                      {hasVideo && (
                        <div className="relative">
                          <video src={c.mediaUrl} className="max-w-[220px] max-h-[400px] rounded-lg object-contain" muted />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                            <div className="h-10 w-10 rounded-full bg-background/80 flex items-center justify-center">
                              <Video className="h-5 w-5 text-primary" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CENTER: Content / Caption */}
                  <div className="flex-1 min-w-0 p-4 space-y-3 border-r border-border/30">
                    <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo</h4>

                    {(hasImage || hasVideo) && c.caption && (
                      <div className="rounded-lg bg-muted/30 border border-border/20 p-3">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.caption}</p>
                      </div>
                    )}
                    {(hasImage || hasVideo) && !c.caption && (
                      <p className="text-xs text-muted-foreground italic">Sem legenda</p>
                    )}

                    {msg.message_type === "text" && (
                      <div className="rounded-lg bg-muted/30 border border-border/20 p-3">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{c.text}</p>
                      </div>
                    )}

                    {msg.message_type === "location" && (
                      <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1">
                        <p className="text-sm font-medium">{c.name || "Localização"}</p>
                        {c.address && <p className="text-xs text-muted-foreground">{c.address}</p>}
                        <p className="text-xs text-muted-foreground font-mono">{c.latitude}, {c.longitude}</p>
                      </div>
                    )}

                    {msg.message_type === "contact" && (
                      <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-1">
                        <p className="text-sm font-medium">{c.contactName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.contactPhone}</p>
                      </div>
                    )}

                    {msg.message_type === "poll" && (
                      <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-2">
                        <p className="text-sm font-medium">{c.pollName}</p>
                        <div className="space-y-1">
                          {(c.pollOptions || []).map((opt: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              {opt}
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Máx. {c.pollSelectable || 1} seleção(ões)</p>
                      </div>
                    )}

                    {msg.message_type === "list" && (
                      <div className="rounded-lg bg-muted/30 border border-border/20 p-3 space-y-2">
                        <p className="text-sm font-medium">{c.listTitle}</p>
                        <p className="text-xs text-muted-foreground">{c.listDescription}</p>
                        {(c.listSections || []).map((sec: any, si: number) => (
                          <div key={si} className="space-y-1">
                            <p className="text-[11px] font-semibold text-foreground">{sec.title}</p>
                            {(sec.rows || []).map((row: any, ri: number) => (
                              <div key={ri} className="flex items-center gap-2 text-xs pl-2">
                                <div className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                                <span>{row.title}</span>
                                {row.description && <span className="text-muted-foreground">— {row.description}</span>}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {(msg.message_type === "audio" || msg.message_type === "sticker" || msg.message_type === "document") && (
                      <div className="rounded-lg bg-muted/30 border border-border/20 p-3">
                        <p className="text-xs text-muted-foreground truncate">{c.mediaUrl || c.audio || c.sticker || "Arquivo"}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {hasMention && (
                        <Badge variant="outline" className="text-[10px] gap-1 font-normal border-primary/30 text-primary">
                          <AtSign className="h-3 w-3" />Mencionar todos
                        </Badge>
                      )}
                      {msg.message_type === "text" && c.linkPreview !== false && (
                        <Badge variant="outline" className="text-[10px] gap-1 font-normal border-border/50">
                          <Link2 className="h-3 w-3" />Preview de link ativo
                        </Badge>
                      )}
                      {msg.message_type === "text" && c.linkPreview === false && (
                        <Badge variant="outline" className="text-[10px] gap-1 font-normal border-border/50 text-muted-foreground">
                          <Link2 className="h-3 w-3" />Sem preview de link
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: Schedule + Actions */}
                  <div className="w-52 shrink-0 bg-muted/5 p-4 space-y-4">
                    <div>
                      <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Programação</h4>
                      <div className="flex items-center gap-2 mb-2">
                        {msg.schedule_type === "once" && <Clock className="h-4 w-4 text-primary" />}
                        {msg.schedule_type === "daily" && <CalendarClock className="h-4 w-4 text-primary" />}
                        {msg.schedule_type === "weekly" && <CalendarDays className="h-4 w-4 text-primary" />}
                        {msg.schedule_type === "monthly" && <Calendar className="h-4 w-4 text-primary" />}
                        <span className="text-xs font-semibold text-foreground">
                          {msg.schedule_type === "once" ? "Envio único" : msg.schedule_type === "daily" ? "Diário" : msg.schedule_type === "weekly" ? "Semanal" : "Mensal"}
                        </span>
                      </div>
                      <div className="text-2xl font-mono font-bold text-foreground tabular-nums">{time}</div>
                    </div>

                    {msg.schedule_type === "weekly" && c.weekDays && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1.5">Dias da semana</p>
                        <div className="grid grid-cols-7 gap-0.5">
                          {DAYS.map((d, i) => (
                            <div
                              key={i}
                              className={cn(
                                "text-center text-[10px] font-bold py-1 rounded",
                                (c.weekDays as number[]).includes(i)
                                  ? "bg-primary/15 text-primary"
                                  : "bg-muted/30 text-muted-foreground/30"
                              )}
                            >{d[0]}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.schedule_type === "once" && msg.scheduled_at && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Data</p>
                        <p className="text-sm font-medium">
                          {new Date(msg.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    )}

                    {msg.schedule_type === "monthly" && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Dia do mês</p>
                        <p className="text-sm font-medium">Dia {c.monthDay || 1}</p>
                      </div>
                    )}

                    {nextRun && (
                      <div className="border-t border-border/20 pt-3">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Próximo envio</p>
                        <p className="text-xs font-medium text-foreground">{nextRun}</p>
                      </div>
                    )}

                    {msg.last_run_at && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Último envio</p>
                        <p className="text-xs text-foreground">
                          {new Date(msg.last_run_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Grupos</p>
                      <p className="text-xs font-medium">{msg.group_ids?.length || 0} grupo(s)</p>
                    </div>

                    {/* Actions */}
                    <div className="border-t border-border/20 pt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: msg.id, is_active: checked })}
                          className="scale-75 origin-left"
                        />
                        <span className="text-[11px] text-muted-foreground">{active ? "Ativo" : "Inativo"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 flex-1" onClick={() => onEdit(msg)}>
                          <Pencil className="h-3 w-3" />Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(msg.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
