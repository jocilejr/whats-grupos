import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { TemplateSelector } from "./TemplateSelector";
import {
  Loader2, CalendarClock, FileText, Image, Video, File,
  Upload, CalendarIcon, BookTemplate,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ScheduledMessageFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  apiConfigId: string;
  instanceName: string;
  groupIds: string[];
  message?: any;
  defaultScheduleType?: string;
}

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export function ScheduledMessageForm({
  open, onOpenChange, campaignId, apiConfigId, instanceName, groupIds, message, defaultScheduleType,
}: ScheduledMessageFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"compose" | "template">("compose");
  const [messageType, setMessageType] = useState("text");
  const [textContent, setTextContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduleType, setScheduleType] = useState("once");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("08:00");
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
        setScheduleType(message.schedule_type || defaultScheduleType || "once");
        if (message.scheduled_at) {
          const d = new Date(message.scheduled_at);
          setScheduledDate(d);
          setScheduledTime(format(d, "HH:mm"));
        } else {
          setScheduledDate(undefined);
          setScheduledTime("08:00");
        }
        setRunTime(c.runTime || "08:00");
        setWeekDays(c.weekDays || [1]);
        setMonthDay(c.monthDay || 1);
        setActiveTab("compose");
      } else {
        setMessageType("text");
        setTextContent("");
        setMediaUrl("");
        setCaption("");
        setScheduleType(defaultScheduleType || "once");
        setScheduledDate(undefined);
        setScheduledTime("08:00");
        setRunTime("08:00");
        setWeekDays([1]);
        setMonthDay(1);
        setActiveTab("compose");
      }
    }
  }, [open, message, defaultScheduleType]);

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
    setActiveTab("compose");
    toast({ title: "Template aplicado", description: template.name });
  };

  const computeNextRunAt = () => {
    if (scheduleType === "once") {
      if (!scheduledDate) return null;
      const [h, m] = scheduledTime.split(":").map(Number);
      const d = new Date(scheduledDate);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    }
    const now = new Date();
    const [h, m] = runTime.split(":").map(Number);

    if (scheduleType === "daily") {
      const next = new Date(now);
      next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
    if (scheduleType === "weekly") {
      for (let i = 0; i < 7; i++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + i);
        candidate.setHours(h, m, 0, 0);
        if (weekDays.includes(candidate.getDay()) && candidate > now) return candidate.toISOString();
      }
      const fallback = new Date(now);
      fallback.setDate(fallback.getDate() + 7);
      fallback.setHours(h, m, 0, 0);
      return fallback.toISOString();
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
      toast({ title: "Conteúdo obrigatório", variant: "destructive" }); return;
    }
    if (messageType !== "text" && !mediaUrl) {
      toast({ title: "Envie um arquivo de mídia", variant: "destructive" }); return;
    }
    if (scheduleType === "once" && !scheduledDate) {
      toast({ title: "Selecione a data", variant: "destructive" }); return;
    }
    if (scheduleType === "weekly" && weekDays.length === 0) {
      toast({ title: "Selecione ao menos um dia", variant: "destructive" }); return;
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
      const scheduledAtValue = scheduleType === "once" && scheduledDate
        ? (() => { const [h, m] = scheduledTime.split(":").map(Number); const d = new Date(scheduledDate); d.setHours(h, m, 0, 0); return d.toISOString(); })()
        : null;

      const payload = {
        user_id: user!.id,
        campaign_id: campaignId,
        api_config_id: apiConfigId,
        instance_name: instanceName,
        group_ids: groupIds,
        message_type: messageType,
        content,
        schedule_type: scheduleType,
        scheduled_at: scheduledAtValue,
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
        toast({ title: "Mensagem agendada com sucesso" });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col sm:rounded-2xl border-border/50 bg-card p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{message ? "Editar Mensagem" : "Nova Mensagem Agendada"}</DialogTitle>
              <DialogDescription className="text-xs">Compose sua mensagem ou use um modelo existente</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Compose / Template tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col h-full">
            <div className="px-6 pt-4">
              <TabsList className="w-full bg-secondary/50 h-10">
                <TabsTrigger value="compose" className="flex-1 gap-2 data-[state=active]:bg-background">
                  <FileText className="h-4 w-4" />Compor Mensagem
                </TabsTrigger>
                <TabsTrigger value="template" className="flex-1 gap-2 data-[state=active]:bg-background">
                  <BookTemplate className="h-4 w-4" />Modelos
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="compose" className="px-6 py-4 space-y-5 mt-0">
              {/* Message Type */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: "text", icon: FileText, label: "Texto" },
                  { value: "image", icon: Image, label: "Imagem" },
                  { value: "video", icon: Video, label: "Vídeo" },
                  { value: "document", icon: File, label: "Documento" },
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setMessageType(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium",
                      messageType === t.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 bg-background/30 text-muted-foreground hover:bg-secondary/50"
                    )}
                  >
                    <t.icon className="h-5 w-5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              {messageType === "text" ? (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conteúdo da mensagem</Label>
                  <Textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    rows={5}
                    placeholder="Digite sua mensagem aqui... Use variáveis como {nome} se desejar."
                    className="bg-background/50 border-border/50 resize-none"
                  />
                  <p className="text-[11px] text-muted-foreground">{textContent.length} caracteres</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Arquivo de mídia</Label>
                    <div className="border border-dashed border-border/50 rounded-xl p-4 text-center bg-background/30">
                      {mediaUrl ? (
                        <div className="space-y-2">
                          {messageType === "image" && (
                            <img src={mediaUrl} alt="Preview" className="max-h-32 mx-auto rounded-lg object-cover" />
                          )}
                          <p className="text-xs text-muted-foreground truncate">✓ {mediaUrl.split("/").pop()}</p>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => setMediaUrl("")}>
                            Trocar arquivo
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Clique para enviar {messageType === "image" ? "uma imagem" : messageType === "video" ? "um vídeo" : "um documento"}</p>
                          <input type="file" onChange={handleFileUpload} className="hidden" />
                          {uploading && <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mt-2" />}
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legenda (opcional)</Label>
                    <Textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={2}
                      placeholder="Adicione uma legenda à mídia..."
                      className="bg-background/50 border-border/50 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Schedule config */}
              <div className="border-t border-border/30 pt-4 space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configuração de Agendamento</h4>

                {scheduleType === "once" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Data</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background/50 border-border/50", !scheduledDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {scheduledDate ? format(scheduledDate, "dd/MM/yyyy") : "Selecionar data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={scheduledDate}
                            onSelect={setScheduledDate}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Horário</Label>
                      <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="bg-background/50 border-border/50" />
                    </div>
                  </div>
                )}

                {scheduleType === "daily" && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Horário de envio diário</Label>
                    <Input type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} className="bg-background/50 border-border/50 w-40" />
                  </div>
                )}

                {scheduleType === "weekly" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Horário de envio</Label>
                      <Input type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} className="bg-background/50 border-border/50 w-40" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Dias da semana</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {WEEKDAYS.map((d) => (
                          <label
                            key={d.value}
                            className={cn(
                              "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm",
                              weekDays.includes(d.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/50 bg-background/30 text-muted-foreground hover:bg-secondary/50"
                            )}
                          >
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
                  </div>
                )}

                {scheduleType === "monthly" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Dia do mês</Label>
                      <Select value={String(monthDay)} onValueChange={(v) => setMonthDay(Number(v))}>
                        <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>Dia {i + 1}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Horário</Label>
                      <Input type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} className="bg-background/50 border-border/50" />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="template" className="px-6 py-4 mt-0">
              <TemplateSelectorInline onSelect={handleTemplateSelect} />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/30 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border/50">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white shadow-[0_0_12px_hsl(var(--success)/0.3)]"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {message ? "Salvar Alterações" : "Agendar Mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline template selector (embedded in the form)
function TemplateSelectorInline({ onSelect }: { onSelect: (t: any) => void }) {
  const { user } = useAuth();
  const { data: templates, isLoading } = useQuery({
    queryKey: ["message-templates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const typeIcons: Record<string, any> = { text: FileText, image: Image, video: Video, document: File };

  if (isLoading) return <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></div>;
  if (!templates?.length) return (
    <div className="py-12 text-center">
      <BookTemplate className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm font-medium">Nenhum modelo salvo</p>
      <p className="text-xs text-muted-foreground mt-1">Crie modelos na aba "Modelos" para reutilizá-los aqui.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-3">Selecione um modelo para preencher automaticamente o conteúdo da mensagem:</p>
      {templates.map((t) => {
        const Icon = typeIcons[t.message_type] || FileText;
        const content = t.content as any;
        const preview = content?.text || content?.caption || "(sem conteúdo)";
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all text-left group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/15">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{preview}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">{t.message_type}</Badge>
          </button>
        );
      })}
    </div>
  );
}

// Need these imports for inline template selector
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
