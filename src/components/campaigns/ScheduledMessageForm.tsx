import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { TemplateSelector } from "./TemplateSelector";
import { Loader2, CalendarClock, FileText, Upload } from "lucide-react";

interface ScheduledMessageFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  apiConfigId: string;
  instanceName: string;
  groupIds: string[];
  message?: any;
}

const WEEKDAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export function ScheduledMessageForm({
  open, onOpenChange, campaignId, apiConfigId, instanceName, groupIds, message,
}: ScheduledMessageFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [messageType, setMessageType] = useState("text");
  const [textContent, setTextContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduleType, setScheduleType] = useState("once");
  const [scheduledAt, setScheduledAt] = useState("");
  const [runTime, setRunTime] = useState("08:00");
  const [weekDays, setWeekDays] = useState<number[]>([1]);
  const [monthDay, setMonthDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (message) {
        setMessageType(message.message_type || "text");
        const c = message.content as any || {};
        setTextContent(c.text || "");
        setMediaUrl(c.mediaUrl || "");
        setCaption(c.caption || "");
        setScheduleType(message.schedule_type || "once");
        setScheduledAt(message.scheduled_at ? message.scheduled_at.slice(0, 16) : "");
        setRunTime(c.runTime || "08:00");
        setWeekDays(c.weekDays || [1]);
        setMonthDay(c.monthDay || 1);
      } else {
        setMessageType("text");
        setTextContent("");
        setMediaUrl("");
        setCaption("");
        setScheduleType("once");
        setScheduledAt("");
        setRunTime("08:00");
        setWeekDays([1]);
        setMonthDay(1);
      }
    }
  }, [open, message]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("media").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
      setMediaUrl(urlData.publicUrl);
      toast({ title: "Arquivo enviado" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setMessageType(template.message_type);
    const c = template.content as any || {};
    setTextContent(c.text || "");
    setMediaUrl(c.mediaUrl || "");
    setCaption(c.caption || "");
  };

  const computeNextRunAt = () => {
    if (scheduleType === "once") return scheduledAt ? new Date(scheduledAt).toISOString() : null;
    const now = new Date();
    const [h, m] = runTime.split(":").map(Number);

    if (scheduleType === "daily") {
      const next = new Date(now);
      next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
    if (scheduleType === "weekly") {
      const next = new Date(now);
      next.setHours(h, m, 0, 0);
      for (let i = 0; i < 7; i++) {
        const candidate = new Date(next);
        candidate.setDate(candidate.getDate() + i);
        if (weekDays.includes(candidate.getDay()) && candidate > now) return candidate.toISOString();
      }
      const candidate = new Date(next);
      candidate.setDate(candidate.getDate() + 7);
      return candidate.toISOString();
    }
    if (scheduleType === "monthly") {
      const next = new Date(now.getFullYear(), now.getMonth(), monthDay, h, m, 0);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next.toISOString();
    }
    return null;
  };

  const handleSave = async () => {
    if (messageType === "text" && !textContent.trim()) {
      toast({ title: "Conteúdo obrigatório", variant: "destructive" });
      return;
    }
    if (messageType !== "text" && !mediaUrl) {
      toast({ title: "Envie um arquivo de mídia", variant: "destructive" });
      return;
    }
    if (scheduleType === "once" && !scheduledAt) {
      toast({ title: "Defina a data/hora", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const content: any = messageType === "text"
        ? { text: textContent }
        : { mediaUrl, caption, fileName: mediaUrl.split("/").pop() };

      if (scheduleType !== "once") {
        content.runTime = runTime;
        if (scheduleType === "weekly") content.weekDays = weekDays;
        if (scheduleType === "monthly") content.monthDay = monthDay;
      }

      const nextRunAt = computeNextRunAt();
      const payload = {
        user_id: user!.id,
        campaign_id: campaignId,
        api_config_id: apiConfigId,
        instance_name: instanceName,
        group_ids: groupIds,
        message_type: messageType,
        content,
        schedule_type: scheduleType,
        scheduled_at: scheduleType === "once" ? new Date(scheduledAt).toISOString() : null,
        next_run_at: nextRunAt,
        is_active: true,
      };

      if (message) {
        const { error } = await supabase.from("scheduled_messages").update(payload).eq("id", message.id);
        if (error) throw error;
        toast({ title: "Mensagem atualizada" });
      } else {
        const { error } = await supabase.from("scheduled_messages").insert(payload);
        if (error) throw error;
        toast({ title: "Mensagem agendada" });
      }

      queryClient.invalidateQueries({ queryKey: ["campaign-scheduled-messages"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-message-counts"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col sm:rounded-2xl border-border/50 bg-card">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{message ? "Editar Mensagem" : "Nova Mensagem Agendada"}</DialogTitle>
                <DialogDescription className="text-xs">Configure o conteúdo e agendamento</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
            {/* Template */}
            <Button variant="outline" size="sm" className="w-full gap-2 border-border/50" onClick={() => setTemplateOpen(true)}>
              <FileText className="h-3.5 w-3.5" />Usar Template
            </Button>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="image">Imagem</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="document">Documento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conteudo */}
            {messageType === "text" ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensagem</Label>
                <Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={3} placeholder="Digite a mensagem..." className="bg-background/50 border-border/50 resize-none" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Arquivo</Label>
                  <div className="flex gap-2">
                    <Input type="file" onChange={handleFileUpload} disabled={uploading} className="bg-background/50 border-border/50 text-xs" />
                    {uploading && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0 mt-2" />}
                  </div>
                  {mediaUrl && <p className="text-xs text-muted-foreground truncate">✓ {mediaUrl.split("/").pop()}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legenda (opcional)</Label>
                  <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda da mídia" className="bg-background/50 border-border/50" />
                </div>
              </div>
            )}

            {/* Agendamento */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agendamento</Label>
              <Select value={scheduleType} onValueChange={setScheduleType}>
                <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Envio único</SelectItem>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleType === "once" ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data e Hora</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="bg-background/50 border-border/50" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Horário</Label>
                  <Input type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} className="bg-background/50 border-border/50 w-32" />
                </div>

                {scheduleType === "weekly" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dias da semana</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((d) => (
                        <label key={d.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <Checkbox
                            checked={weekDays.includes(d.value)}
                            onCheckedChange={(checked) =>
                              setWeekDays(checked ? [...weekDays, d.value] : weekDays.filter((v) => v !== d.value))
                            }
                          />
                          {d.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {scheduleType === "monthly" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dia do mês</Label>
                    <Select value={String(monthDay)} onValueChange={(v) => setMonthDay(Number(v))}>
                      <SelectTrigger className="bg-background/50 border-border/50 w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border/50">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-[0_0_10px_hsl(var(--primary)/0.2)]">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {message ? "Salvar" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplateSelector open={templateOpen} onOpenChange={setTemplateOpen} onSelect={handleTemplateSelect} />
    </>
  );
}
