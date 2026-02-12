import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CalendarClock, FileText, Image, Video, File,
  Upload, CalendarIcon, BookTemplate, Mic, Sticker, MapPin,
  Contact, BarChart3, List, MousePointerClick, Plus, Trash2,
} from "lucide-react";
import { format } from "date-fns";
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

const MESSAGE_TYPES = [
  { value: "text", icon: FileText, label: "Texto" },
  { value: "image", icon: Image, label: "Imagem" },
  { value: "video", icon: Video, label: "Vídeo" },
  { value: "document", icon: File, label: "Documento" },
  { value: "audio", icon: Mic, label: "Áudio" },
  { value: "sticker", icon: Sticker, label: "Figurinha" },
  { value: "location", icon: MapPin, label: "Localização" },
  { value: "contact", icon: Contact, label: "Contato" },
  { value: "poll", icon: BarChart3, label: "Enquete" },
  { value: "list", icon: List, label: "Lista" },
  { value: "buttons", icon: MousePointerClick, label: "Botões" },
];

const WEEKDAYS = [
  { value: 0, label: "Dom" }, { value: 1, label: "Seg" }, { value: 2, label: "Ter" },
  { value: 3, label: "Qua" }, { value: 4, label: "Qui" }, { value: 5, label: "Sex" }, { value: 6, label: "Sáb" },
];

export function ScheduledMessageForm({
  open, onOpenChange, campaignId, apiConfigId, instanceName, groupIds, message, defaultScheduleType,
}: ScheduledMessageFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"compose" | "template">("compose");
  const [messageType, setMessageType] = useState("text");

  // Text
  const [textContent, setTextContent] = useState("");
  // Media (image/video/document/audio/sticker)
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  // Location
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");
  // Contact
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  // Poll
  const [pollName, setPollName] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollSelectable, setPollSelectable] = useState(1);
  // List
  const [listTitle, setListTitle] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [listButtonText, setListButtonText] = useState("Ver opções");
  const [listFooter, setListFooter] = useState("");
  const [listSections, setListSections] = useState<{ title: string; rows: { title: string; description: string }[] }[]>(
    [{ title: "Seção 1", rows: [{ title: "", description: "" }] }]
  );
  // Buttons
  const [btnTitle, setBtnTitle] = useState("");
  const [btnDescription, setBtnDescription] = useState("");
  const [btnFooter, setBtnFooter] = useState("");
  const [btnButtons, setBtnButtons] = useState<{ type: string; body: string }[]>([{ type: "reply", body: "" }]);

  // Schedule
  const [scheduleType, setScheduleType] = useState("once");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState("08:00");
  const [runTime, setRunTime] = useState("08:00");
  const [weekDays, setWeekDays] = useState<number[]>([1]);
  const [monthDay, setMonthDay] = useState(1);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      const c = message?.content as any || {};
      if (message) {
        setMessageType(message.message_type || "text");
        setTextContent(c.text || "");
        setMediaUrl(c.mediaUrl || c.audio || c.sticker || "");
        setCaption(c.caption || "");
        setLocName(c.name || ""); setLocAddress(c.address || "");
        setLocLat(c.latitude?.toString() || ""); setLocLng(c.longitude?.toString() || "");
        setContactName(c.contactName || ""); setContactPhone(c.contactPhone || "");
        setPollName(c.pollName || ""); setPollOptions(c.pollOptions || ["", ""]);
        setPollSelectable(c.pollSelectable || 1);
        setListTitle(c.listTitle || ""); setListDescription(c.listDescription || "");
        setListButtonText(c.listButtonText || "Ver opções"); setListFooter(c.listFooter || "");
        setListSections(c.listSections || [{ title: "Seção 1", rows: [{ title: "", description: "" }] }]);
        setBtnTitle(c.btnTitle || ""); setBtnDescription(c.btnDescription || "");
        setBtnFooter(c.btnFooter || "");
        setBtnButtons(c.btnButtons || [{ type: "reply", body: "" }]);
        setScheduleType(message.schedule_type || defaultScheduleType || "once");
        if (message.scheduled_at) {
          const d = new Date(message.scheduled_at);
          setScheduledDate(d); setScheduledTime(format(d, "HH:mm"));
        } else { setScheduledDate(undefined); setScheduledTime("08:00"); }
        setRunTime(c.runTime || "08:00");
        setWeekDays(c.weekDays || [1]); setMonthDay(c.monthDay || 1);
      } else {
        setMessageType("text"); setTextContent(""); setMediaUrl(""); setCaption("");
        setLocName(""); setLocAddress(""); setLocLat(""); setLocLng("");
        setContactName(""); setContactPhone("");
        setPollName(""); setPollOptions(["", ""]); setPollSelectable(1);
        setListTitle(""); setListDescription(""); setListButtonText("Ver opções"); setListFooter("");
        setListSections([{ title: "Seção 1", rows: [{ title: "", description: "" }] }]);
        setBtnTitle(""); setBtnDescription(""); setBtnFooter("");
        setBtnButtons([{ type: "reply", body: "" }]);
        setScheduleType(defaultScheduleType || "once");
        setScheduledDate(undefined); setScheduledTime("08:00");
        setRunTime("08:00"); setWeekDays([1]); setMonthDay(1);
      }
      setActiveTab("compose");
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
    } finally { setUploading(false); }
  };

  const handleTemplateSelect = (template: any) => {
    setMessageType(template.message_type);
    const c = template.content as any || {};
    setTextContent(c.text || ""); setMediaUrl(c.mediaUrl || ""); setCaption(c.caption || "");
    setActiveTab("compose");
    toast({ title: "Template aplicado", description: template.name });
  };

  const computeNextRunAt = () => {
    if (scheduleType === "once") {
      if (!scheduledDate) return null;
      const [h, m] = scheduledTime.split(":").map(Number);
      const d = new Date(scheduledDate); d.setHours(h, m, 0, 0);
      return d.toISOString();
    }
    const now = new Date();
    const [h, m] = runTime.split(":").map(Number);
    if (scheduleType === "daily") {
      const next = new Date(now); next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }
    if (scheduleType === "weekly") {
      for (let i = 0; i < 7; i++) {
        const c = new Date(now); c.setDate(c.getDate() + i); c.setHours(h, m, 0, 0);
        if (weekDays.includes(c.getDay()) && c > now) return c.toISOString();
      }
      const f = new Date(now); f.setDate(f.getDate() + 7); f.setHours(h, m, 0, 0);
      return f.toISOString();
    }
    if (scheduleType === "monthly") {
      const next = new Date(now.getFullYear(), now.getMonth(), monthDay, h, m, 0);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next.toISOString();
    }
    return null;
  };

  const buildContent = () => {
    const base: any = {};
    switch (messageType) {
      case "text": base.text = textContent; break;
      case "image": case "video": case "document":
        base.mediaUrl = mediaUrl; base.caption = caption; base.fileName = mediaUrl.split("/").pop(); break;
      case "audio": base.audio = mediaUrl; break;
      case "sticker": base.sticker = mediaUrl; break;
      case "location":
        base.name = locName; base.address = locAddress;
        base.latitude = parseFloat(locLat); base.longitude = parseFloat(locLng); break;
      case "contact": base.contactName = contactName; base.contactPhone = contactPhone; break;
      case "poll":
        base.pollName = pollName; base.pollOptions = pollOptions.filter(o => o.trim());
        base.pollSelectable = pollSelectable; break;
      case "list":
        base.listTitle = listTitle; base.listDescription = listDescription;
        base.listButtonText = listButtonText; base.listFooter = listFooter;
        base.listSections = listSections; break;
      case "buttons":
        base.btnTitle = btnTitle; base.btnDescription = btnDescription;
        base.btnFooter = btnFooter; base.btnButtons = btnButtons; break;
    }
    if (scheduleType !== "once") {
      base.runTime = runTime;
      if (scheduleType === "weekly") base.weekDays = weekDays;
      if (scheduleType === "monthly") base.monthDay = monthDay;
    }
    return base;
  };

  const validate = () => {
    switch (messageType) {
      case "text": if (!textContent.trim()) { toast({ title: "Digite a mensagem", variant: "destructive" }); return false; } break;
      case "image": case "video": case "document": case "audio": case "sticker":
        if (!mediaUrl) { toast({ title: "Envie o arquivo", variant: "destructive" }); return false; } break;
      case "location":
        if (!locLat || !locLng) { toast({ title: "Preencha latitude e longitude", variant: "destructive" }); return false; } break;
      case "contact":
        if (!contactName || !contactPhone) { toast({ title: "Preencha nome e telefone", variant: "destructive" }); return false; } break;
      case "poll":
        if (!pollName || pollOptions.filter(o => o.trim()).length < 2) {
          toast({ title: "Enquete precisa de nome e ao menos 2 opções", variant: "destructive" }); return false;
        } break;
      case "list":
        if (!listTitle || !listDescription) { toast({ title: "Preencha título e descrição da lista", variant: "destructive" }); return false; } break;
      case "buttons":
        if (!btnTitle || btnButtons.filter(b => b.body.trim()).length === 0) {
          toast({ title: "Preencha título e ao menos 1 botão", variant: "destructive" }); return false;
        } break;
    }
    if (scheduleType === "once" && !scheduledDate) { toast({ title: "Selecione a data", variant: "destructive" }); return false; }
    if (scheduleType === "weekly" && weekDays.length === 0) { toast({ title: "Selecione ao menos um dia", variant: "destructive" }); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const content = buildContent();
      const nextRunAt = computeNextRunAt();
      const scheduledAtValue = scheduleType === "once" && scheduledDate
        ? (() => { const [h, m] = scheduledTime.split(":").map(Number); const d = new Date(scheduledDate); d.setHours(h, m, 0, 0); return d.toISOString(); })()
        : null;

      const payload = {
        user_id: user!.id, campaign_id: campaignId, api_config_id: apiConfigId,
        instance_name: instanceName, group_ids: groupIds, message_type: messageType,
        content, schedule_type: scheduleType, scheduled_at: scheduledAtValue,
        next_run_at: nextRunAt, is_active: true,
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
    } finally { setSaving(false); }
  };

  const mediaTypes = ["image", "video", "document", "audio", "sticker"];
  const mediaLabel = messageType === "audio" ? "um áudio" : messageType === "sticker" ? "uma figurinha" : messageType === "image" ? "uma imagem" : messageType === "video" ? "um vídeo" : "um documento";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col sm:rounded-2xl border-border/50 bg-card p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{message ? "Editar Mensagem" : "Nova Mensagem Agendada"}</DialogTitle>
              <DialogDescription className="text-xs">Compose ou use um modelo existente</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="px-6 pt-3">
              <TabsList className="w-full bg-secondary/40 h-10 p-1">
                <TabsTrigger value="compose" className="flex-1 gap-2 text-xs data-[state=active]:bg-card">
                  <FileText className="h-3.5 w-3.5" />Compor
                </TabsTrigger>
                <TabsTrigger value="template" className="flex-1 gap-2 text-xs data-[state=active]:bg-card">
                  <BookTemplate className="h-3.5 w-3.5" />Modelos
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="compose" className="px-6 py-4 space-y-5 mt-0">
              {/* Message type grid */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo de mensagem</Label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {MESSAGE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setMessageType(t.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-[11px] font-medium",
                        messageType === t.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                      )}
                    >
                      <t.icon className="h-4 w-4" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* === CONTENT FIELDS === */}
              {messageType === "text" && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensagem</Label>
                  <Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={4} placeholder="Digite sua mensagem..." className="bg-background/50 border-border/50 resize-none" />
                  <p className="text-[11px] text-muted-foreground">{textContent.length} caracteres</p>
                </div>
              )}

              {mediaTypes.includes(messageType) && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Arquivo</Label>
                    <div className="border border-dashed border-border/50 rounded-xl p-4 text-center bg-background/30">
                      {mediaUrl ? (
                        <div className="space-y-2">
                          {messageType === "image" && <img src={mediaUrl} alt="Preview" className="max-h-28 mx-auto rounded-lg object-cover" />}
                          <p className="text-xs text-muted-foreground truncate">✓ {mediaUrl.split("/").pop()}</p>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => setMediaUrl("")}>Trocar</Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-1.5" />
                          <p className="text-xs text-muted-foreground">Clique para enviar {mediaLabel}</p>
                          <input type="file" onChange={handleFileUpload} className="hidden" />
                          {uploading && <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto mt-2" />}
                        </label>
                      )}
                    </div>
                  </div>
                  {(messageType === "image" || messageType === "video" || messageType === "document") && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legenda (opcional)</Label>
                      <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda..." className="bg-background/50 border-border/50" />
                    </div>
                  )}
                </div>
              )}

              {messageType === "location" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Latitude *</Label>
                      <Input value={locLat} onChange={(e) => setLocLat(e.target.value)} placeholder="-23.5505" className="bg-background/50 border-border/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Longitude *</Label>
                      <Input value={locLng} onChange={(e) => setLocLng(e.target.value)} placeholder="-46.6333" className="bg-background/50 border-border/50" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome do local (opcional)</Label>
                    <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Ex: Escritório" className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Endereço (opcional)</Label>
                    <Input value={locAddress} onChange={(e) => setLocAddress(e.target.value)} placeholder="Rua, número, bairro..." className="bg-background/50 border-border/50" />
                  </div>
                </div>
              )}

              {messageType === "contact" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome completo *</Label>
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="João da Silva" className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Telefone (com DDI) *</Label>
                    <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="5511999999999" className="bg-background/50 border-border/50" />
                  </div>
                </div>
              )}

              {messageType === "poll" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Pergunta da enquete *</Label>
                    <Input value={pollName} onChange={(e) => setPollName(e.target.value)} placeholder="Qual sua preferência?" className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Opções *</Label>
                    <div className="space-y-1.5">
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={opt}
                            onChange={(e) => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }}
                            placeholder={`Opção ${i + 1}`}
                            className="bg-background/50 border-border/50"
                          />
                          {pollOptions.length > 2 && (
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 12 && (
                        <Button variant="outline" size="sm" className="text-xs gap-1 w-full border-dashed" onClick={() => setPollOptions([...pollOptions, ""])}>
                          <Plus className="h-3 w-3" />Adicionar opção
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Máximo de seleções</Label>
                    <Select value={String(pollSelectable)} onValueChange={(v) => setPollSelectable(Number(v))}>
                      <SelectTrigger className="bg-background/50 border-border/50 w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: Math.max(pollOptions.length, 1) }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {messageType === "list" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Título *</Label>
                      <Input value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder="Título da lista" className="bg-background/50 border-border/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Texto do botão</Label>
                      <Input value={listButtonText} onChange={(e) => setListButtonText(e.target.value)} placeholder="Ver opções" className="bg-background/50 border-border/50" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Descrição *</Label>
                    <Textarea value={listDescription} onChange={(e) => setListDescription(e.target.value)} rows={2} placeholder="Descrição da lista" className="bg-background/50 border-border/50 resize-none" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Rodapé</Label>
                    <Input value={listFooter} onChange={(e) => setListFooter(e.target.value)} placeholder="Texto do rodapé" className="bg-background/50 border-border/50" />
                  </div>
                  {/* Sections */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Seções</Label>
                    {listSections.map((sec, si) => (
                      <div key={si} className="border border-border/40 rounded-lg p-3 space-y-2 bg-background/20">
                        <div className="flex items-center gap-2">
                          <Input value={sec.title} onChange={(e) => { const s = [...listSections]; s[si].title = e.target.value; setListSections(s); }} placeholder="Nome da seção" className="bg-background/50 border-border/50 text-sm" />
                          {listSections.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setListSections(listSections.filter((_, j) => j !== si))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {sec.rows.map((row, ri) => (
                          <div key={ri} className="flex gap-2 pl-3">
                            <Input value={row.title} onChange={(e) => { const s = [...listSections]; s[si].rows[ri].title = e.target.value; setListSections(s); }} placeholder="Título do item" className="bg-background/50 border-border/50 text-xs" />
                            <Input value={row.description} onChange={(e) => { const s = [...listSections]; s[si].rows[ri].description = e.target.value; setListSections(s); }} placeholder="Descrição" className="bg-background/50 border-border/50 text-xs" />
                            {sec.rows.length > 1 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => { const s = [...listSections]; s[si].rows = s[si].rows.filter((_, j) => j !== ri); setListSections(s); }}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="text-[11px] gap-1 border-dashed ml-3" onClick={() => { const s = [...listSections]; s[si].rows.push({ title: "", description: "" }); setListSections(s); }}>
                          <Plus className="h-3 w-3" />Item
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="text-xs gap-1 w-full border-dashed" onClick={() => setListSections([...listSections, { title: "", rows: [{ title: "", description: "" }] }])}>
                      <Plus className="h-3 w-3" />Adicionar seção
                    </Button>
                  </div>
                </div>
              )}

              {messageType === "buttons" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Título *</Label>
                    <Input value={btnTitle} onChange={(e) => setBtnTitle(e.target.value)} placeholder="Título da mensagem" className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Descrição</Label>
                    <Textarea value={btnDescription} onChange={(e) => setBtnDescription(e.target.value)} rows={2} placeholder="Descrição" className="bg-background/50 border-border/50 resize-none" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Rodapé</Label>
                    <Input value={btnFooter} onChange={(e) => setBtnFooter(e.target.value)} placeholder="Texto do rodapé" className="bg-background/50 border-border/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Botões (máx. 3)</Label>
                    {btnButtons.map((btn, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={btn.body} onChange={(e) => { const b = [...btnButtons]; b[i].body = e.target.value; setBtnButtons(b); }} placeholder={`Botão ${i + 1}`} className="bg-background/50 border-border/50" />
                        {btnButtons.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => setBtnButtons(btnButtons.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {btnButtons.length < 3 && (
                      <Button variant="outline" size="sm" className="text-xs gap-1 w-full border-dashed" onClick={() => setBtnButtons([...btnButtons, { type: "reply", body: "" }])}>
                        <Plus className="h-3 w-3" />Adicionar botão
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Schedule config */}
              <div className="border-t border-border/30 pt-4 space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agendamento</h4>
                {scheduleType === "once" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Data</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-background/50 border-border/50 text-sm", !scheduledDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {scheduledDate ? format(scheduledDate, "dd/MM/yyyy") : "Selecionar"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} disabled={(d) => d < new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Horário</Label>
                      <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="bg-background/50 border-border/50" />
                    </div>
                  </div>
                )}
                {scheduleType === "daily" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Horário diário</Label>
                    <Input type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} className="bg-background/50 border-border/50 w-36" />
                  </div>
                )}
                {scheduleType === "weekly" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Horário</Label>
                      <Input type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} className="bg-background/50 border-border/50 w-36" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Dias</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAYS.map((d) => (
                          <button
                            key={d.value}
                            onClick={() => setWeekDays(weekDays.includes(d.value) ? weekDays.filter(v => v !== d.value) : [...weekDays, d.value])}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                              weekDays.includes(d.value)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                            )}
                          >{d.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {scheduleType === "monthly" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
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
                    <div className="space-y-1.5">
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

        <DialogFooter className="px-6 py-3 border-t border-border/30 gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border/50">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white shadow-[0_0_10px_hsl(var(--success)/0.25)]">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {message ? "Salvar" : "Agendar Mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline template selector
function TemplateSelectorInline({ onSelect }: { onSelect: (t: any) => void }) {
  const { user } = useAuth();
  const { data: templates, isLoading } = useQuery({
    queryKey: ["message-templates", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("message_templates").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) return <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></div>;
  if (!templates?.length) return (
    <div className="py-10 text-center">
      <BookTemplate className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm font-medium">Nenhum modelo salvo</p>
      <p className="text-xs text-muted-foreground mt-1">Crie modelos na aba "Modelos" para reutilizá-los aqui.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-2">Selecione um modelo para preencher o conteúdo:</p>
      {templates.map((t) => {
        const content = t.content as any;
        const preview = content?.text || content?.caption || content?.pollName || "(sem conteúdo)";
        return (
          <button key={t.id} onClick={() => onSelect(t)} className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-primary/5 hover:border-primary/30 transition-all text-left">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground truncate">{preview}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">{t.message_type}</Badge>
          </button>
        );
      })}
    </div>
  );
}
