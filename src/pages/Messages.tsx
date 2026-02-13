import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GroupSelector } from "@/components/campaigns/GroupSelector";
import { useToast } from "@/hooks/use-toast";
import {
  Send, FileText, Image, Video, File, Mic, Sticker, MapPin,
  Contact, BarChart3, List, Plus, Trash2, AtSign, Link2,
  Upload, Loader2, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
];

type SendStatus = { groupId: string; groupName: string; status: "pending" | "sending" | "sent" | "error"; error?: string };

export default function Messages() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Instance
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [selectedInstanceName, setSelectedInstanceName] = useState("");

  // Groups
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupsMap, setGroupsMap] = useState<Record<string, string>>({});

  // Message type
  const [messageType, setMessageType] = useState("text");

  // Text
  const [textContent, setTextContent] = useState("");
  const [mentionAll, setMentionAll] = useState(false);
  const [linkPreview, setLinkPreview] = useState(true);

  // Media
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

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

  // Sending state
  const [sending, setSending] = useState(false);
  const [sendStatuses, setSendStatuses] = useState<SendStatus[]>([]);
  const abortRef = useRef(false);

  // Fetch api_configs
  const { data: apiConfigs } = useQuery({
    queryKey: ["api-configs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_configs")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Auto-select first config
  useEffect(() => {
    if (apiConfigs?.length && !selectedConfigId) {
      setSelectedConfigId(apiConfigs[0].id);
      setSelectedInstanceName(apiConfigs[0].instance_name);
    }
  }, [apiConfigs, selectedConfigId]);

  const handleConfigChange = (configId: string) => {
    setSelectedConfigId(configId);
    const config = apiConfigs?.find((c) => c.id === configId);
    setSelectedInstanceName(config?.instance_name || "");
    setSelectedGroupIds([]);
  };

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

  const buildPayload = (groupId: string) => {
    const base: any = { number: groupId };
    if (mentionAll) base.mentionsEveryOne = true;

    switch (messageType) {
      case "text":
        base.text = textContent;
        base.linkPreview = linkPreview;
        break;
      case "image":
      case "video":
      case "document":
        base.mediatype = messageType;
        base.media = mediaUrl;
        base.caption = caption;
        base.fileName = mediaUrl.split("/").pop();
        break;
      case "audio":
        base.audio = mediaUrl;
        break;
      case "sticker":
        base.sticker = mediaUrl;
        break;
      case "location":
        base.name = locName;
        base.address = locAddress;
        base.latitude = parseFloat(locLat);
        base.longitude = parseFloat(locLng);
        break;
      case "contact":
        base.contact = [{ fullName: contactName, wuid: contactPhone, phoneNumber: contactPhone }];
        break;
      case "poll":
        base.name = pollName;
        base.values = pollOptions.filter((o) => o.trim());
        base.selectableCount = pollSelectable;
        break;
      case "list":
        base.title = listTitle;
        base.description = listDescription;
        base.buttonText = listButtonText;
        base.footerText = listFooter;
        base.sections = listSections;
        break;
    }
    return base;
  };

  const getAction = () => {
    switch (messageType) {
      case "text": return "sendText";
      case "image": case "video": case "document": return "sendMedia";
      case "audio": return "sendAudio";
      case "sticker": return "sendSticker";
      case "location": return "sendLocation";
      case "contact": return "sendContact";
      case "poll": return "sendPoll";
      case "list": return "sendList";
      default: return "sendText";
    }
  };

  const buildLogContent = () => {
    const base: any = {};
    switch (messageType) {
      case "text": base.text = textContent; base.linkPreview = linkPreview; break;
      case "image": case "video": case "document":
        base.mediaUrl = mediaUrl; base.caption = caption; break;
      case "audio": base.audio = mediaUrl; break;
      case "sticker": base.sticker = mediaUrl; break;
      case "location":
        base.name = locName; base.address = locAddress;
        base.latitude = parseFloat(locLat); base.longitude = parseFloat(locLng); break;
      case "contact": base.contactName = contactName; base.contactPhone = contactPhone; break;
      case "poll":
        base.pollName = pollName; base.pollOptions = pollOptions.filter((o) => o.trim());
        base.pollSelectable = pollSelectable; break;
      case "list":
        base.listTitle = listTitle; base.listDescription = listDescription;
        base.listButtonText = listButtonText; base.listFooter = listFooter;
        base.listSections = listSections; break;
    }
    if (mentionAll) base.mentionsEveryOne = true;
    return base;
  };

  const validate = () => {
    if (!selectedConfigId) { toast({ title: "Selecione uma instância", variant: "destructive" }); return false; }
    if (selectedGroupIds.length === 0) { toast({ title: "Selecione ao menos um grupo", variant: "destructive" }); return false; }
    switch (messageType) {
      case "text": if (!textContent.trim()) { toast({ title: "Digite a mensagem", variant: "destructive" }); return false; } break;
      case "image": case "video": case "document": case "audio": case "sticker":
        if (!mediaUrl) { toast({ title: "Envie o arquivo", variant: "destructive" }); return false; } break;
      case "location":
        if (!locLat || !locLng) { toast({ title: "Preencha latitude e longitude", variant: "destructive" }); return false; } break;
      case "contact":
        if (!contactName || !contactPhone) { toast({ title: "Preencha nome e telefone", variant: "destructive" }); return false; } break;
      case "poll":
        if (!pollName || pollOptions.filter((o) => o.trim()).length < 2) {
          toast({ title: "Enquete precisa de nome e ao menos 2 opções", variant: "destructive" }); return false;
        } break;
      case "list":
        if (!listTitle || !listDescription) { toast({ title: "Preencha título e descrição da lista", variant: "destructive" }); return false; } break;
    }
    return true;
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleSend = useCallback(async () => {
    if (!validate() || !user) return;
    setSending(true);
    abortRef.current = false;

    const statuses: SendStatus[] = selectedGroupIds.map((gid) => ({
      groupId: gid,
      groupName: groupsMap[gid] || gid,
      status: "pending",
    }));
    setSendStatuses(statuses);

    const { data: { session } } = await supabase.auth.getSession();
    const action = getAction();
    const logContent = buildLogContent();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statuses.length; i++) {
      if (abortRef.current) break;

      setSendStatuses((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "sending" } : s))
      );

      try {
        const payload = buildPayload(statuses[i].groupId);
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-api?action=${action}&configId=${selectedConfigId}&instanceName=${encodeURIComponent(selectedInstanceName)}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const result = await resp.json();

        if (!resp.ok || result.error) {
          throw new Error(result.error || result.message || "Erro no envio");
        }

        setSendStatuses((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "sent" } : s))
        );
        successCount++;

        // Log success
        await supabase.from("message_logs").insert({
          user_id: user.id,
          api_config_id: selectedConfigId,
          instance_name: selectedInstanceName,
          group_id: statuses[i].groupId,
          group_name: statuses[i].groupName,
          message_type: messageType,
          content: logContent,
          status: "sent",
          sent_at: new Date().toISOString(),
        });
      } catch (err: any) {
        setSendStatuses((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "error", error: err.message } : s))
        );
        errorCount++;

        await supabase.from("message_logs").insert({
          user_id: user.id,
          api_config_id: selectedConfigId,
          instance_name: selectedInstanceName,
          group_id: statuses[i].groupId,
          group_name: statuses[i].groupName,
          message_type: messageType,
          content: logContent,
          status: "error",
          error_message: err.message,
        });
      }

      // 10s delay between groups (except last)
      if (i < statuses.length - 1 && !abortRef.current) {
        await delay(10000);
      }
    }

    setSending(false);
    if (errorCount === 0) {
      toast({ title: "Todas as mensagens enviadas!", description: `${successCount} grupo(s) com sucesso` });
    } else {
      toast({
        title: "Envio concluído com erros",
        description: `${successCount} sucesso, ${errorCount} erro(s)`,
        variant: "destructive",
      });
    }
  }, [selectedGroupIds, selectedConfigId, selectedInstanceName, messageType, textContent, mediaUrl, caption, locLat, locLng, locName, locAddress, contactName, contactPhone, pollName, pollOptions, pollSelectable, listTitle, listDescription, listButtonText, listFooter, listSections, mentionAll, linkPreview, user, groupsMap]);

  const completedCount = sendStatuses.filter((s) => s.status === "sent" || s.status === "error").length;
  const progressPercent = sendStatuses.length > 0 ? (completedCount / sendStatuses.length) * 100 : 0;
  const currentSending = sendStatuses.find((s) => s.status === "sending");

  const mediaTypes = ["image", "video", "document", "audio", "sticker"];
  const mediaLabel = messageType === "audio" ? "um áudio" : messageType === "sticker" ? "uma figurinha" : messageType === "image" ? "uma imagem" : messageType === "video" ? "um vídeo" : "um documento";

  // Track group names from GroupSelector
  const handleGroupSelection = (ids: string[]) => {
    setSelectedGroupIds(ids);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-[0_0_25px_hsl(28_85%_56%/0.15)]">
            <Send className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Enviar Mensagem</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Envie mensagens imediatas para grupos do WhatsApp</p>
          </div>
        </div>
      </div>

      {/* Instance selector */}
      <Card className="border-border/30 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Instância</CardTitle>
        </CardHeader>
        <CardContent>
          {!apiConfigs?.length ? (
            <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Configure uma instância nas Configurações primeiro.
              </p>
            </div>
          ) : (
            <Select value={selectedConfigId} onValueChange={handleConfigChange}>
              <SelectTrigger className="bg-background/50 border-border/50">
                <SelectValue placeholder="Selecione a instância" />
              </SelectTrigger>
              <SelectContent>
                {apiConfigs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Group selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Grupos destinatários</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupSelector
            configId={selectedConfigId}
            instanceName={selectedInstanceName}
            selectedIds={selectedGroupIds}
            onSelectionChange={handleGroupSelection}
            lazy
          />
        </CardContent>
      </Card>

      {/* Message type */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {MESSAGE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setMessageType(t.value)}
                disabled={sending}
                className={cn(
                  "flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all text-[11px] font-medium",
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
        </CardContent>
      </Card>

      {/* Content form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conteúdo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Text */}
          {messageType === "text" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensagem</Label>
                <Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={4} placeholder="Digite sua mensagem..." className="bg-background/50 border-border/50 resize-none" disabled={sending} />
                <p className="text-[11px] text-muted-foreground">{textContent.length} caracteres</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Preview de link</p>
                    <p className="text-[11px] text-muted-foreground">Exibe preview de links na mensagem</p>
                  </div>
                </div>
                <Switch checked={linkPreview} onCheckedChange={setLinkPreview} disabled={sending} />
              </div>
            </div>
          )}

          {/* Media */}
          {mediaTypes.includes(messageType) && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Arquivo</Label>
                <div className="border border-dashed border-border/50 rounded-xl p-4 text-center bg-background/30">
                  {mediaUrl ? (
                    <div className="space-y-2">
                      {messageType === "image" && <img src={mediaUrl} alt="Preview" className="max-h-28 mx-auto rounded-lg object-cover" />}
                      <p className="text-xs text-muted-foreground truncate">✓ {mediaUrl.split("/").pop()}</p>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => setMediaUrl("")} disabled={sending}>Trocar</Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-1.5" />
                      <p className="text-xs text-muted-foreground">Clique para enviar {mediaLabel}</p>
                      <input type="file" onChange={handleFileUpload} className="hidden" disabled={sending} />
                      {uploading && <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto mt-2" />}
                    </label>
                  )}
                </div>
              </div>
              {(messageType === "image" || messageType === "video" || messageType === "document") && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legenda (opcional)</Label>
                  <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda..." className="bg-background/50 border-border/50 min-h-[80px] resize-y" disabled={sending} />
                </div>
              )}
            </div>
          )}

          {/* Location */}
          {messageType === "location" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Latitude *</Label>
                  <Input value={locLat} onChange={(e) => setLocLat(e.target.value)} placeholder="-23.5505" className="bg-background/50 border-border/50" disabled={sending} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Longitude *</Label>
                  <Input value={locLng} onChange={(e) => setLocLng(e.target.value)} placeholder="-46.6333" className="bg-background/50 border-border/50" disabled={sending} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome do local (opcional)</Label>
                <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Ex: Escritório" className="bg-background/50 border-border/50" disabled={sending} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Endereço (opcional)</Label>
                <Input value={locAddress} onChange={(e) => setLocAddress(e.target.value)} placeholder="Rua, número, bairro..." className="bg-background/50 border-border/50" disabled={sending} />
              </div>
            </div>
          )}

          {/* Contact */}
          {messageType === "contact" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome completo *</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="João da Silva" className="bg-background/50 border-border/50" disabled={sending} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Telefone (com DDI) *</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="5511999999999" className="bg-background/50 border-border/50" disabled={sending} />
              </div>
            </div>
          )}

          {/* Poll */}
          {messageType === "poll" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pergunta da enquete *</Label>
                <Input value={pollName} onChange={(e) => setPollName(e.target.value)} placeholder="Qual sua preferência?" className="bg-background/50 border-border/50" disabled={sending} />
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
                        disabled={sending}
                      />
                      {pollOptions.length > 2 && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} disabled={sending}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 12 && (
                    <Button variant="outline" size="sm" className="text-xs gap-1 w-full border-dashed" onClick={() => setPollOptions([...pollOptions, ""])} disabled={sending}>
                      <Plus className="h-3 w-3" />Adicionar opção
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Máximo de seleções</Label>
                <Select value={String(pollSelectable)} onValueChange={(v) => setPollSelectable(Number(v))} disabled={sending}>
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

          {/* List */}
          {messageType === "list" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Título *</Label>
                  <Input value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder="Título da lista" className="bg-background/50 border-border/50" disabled={sending} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Texto do botão</Label>
                  <Input value={listButtonText} onChange={(e) => setListButtonText(e.target.value)} placeholder="Ver opções" className="bg-background/50 border-border/50" disabled={sending} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrição *</Label>
                <Textarea value={listDescription} onChange={(e) => setListDescription(e.target.value)} rows={2} placeholder="Descrição da lista" className="bg-background/50 border-border/50 resize-none" disabled={sending} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Rodapé</Label>
                <Input value={listFooter} onChange={(e) => setListFooter(e.target.value)} placeholder="Texto do rodapé" className="bg-background/50 border-border/50" disabled={sending} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Seções</Label>
                {listSections.map((sec, si) => (
                  <div key={si} className="border border-border/40 rounded-lg p-3 space-y-2 bg-background/20">
                    <div className="flex items-center gap-2">
                      <Input value={sec.title} onChange={(e) => { const s = [...listSections]; s[si].title = e.target.value; setListSections(s); }} placeholder="Nome da seção" className="bg-background/50 border-border/50 text-sm" disabled={sending} />
                      {listSections.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setListSections(listSections.filter((_, j) => j !== si))} disabled={sending}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {sec.rows.map((row, ri) => (
                      <div key={ri} className="flex gap-2 pl-3">
                        <Input value={row.title} onChange={(e) => { const s = [...listSections]; s[si].rows[ri].title = e.target.value; setListSections(s); }} placeholder="Título do item" className="bg-background/50 border-border/50 text-xs" disabled={sending} />
                        <Input value={row.description} onChange={(e) => { const s = [...listSections]; s[si].rows[ri].description = e.target.value; setListSections(s); }} placeholder="Descrição" className="bg-background/50 border-border/50 text-xs" disabled={sending} />
                        {sec.rows.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => { const s = [...listSections]; s[si].rows = s[si].rows.filter((_, j) => j !== ri); setListSections(s); }} disabled={sending}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="text-[11px] gap-1 border-dashed ml-3" onClick={() => { const s = [...listSections]; s[si].rows.push({ title: "", description: "" }); setListSections(s); }} disabled={sending}>
                      <Plus className="h-3 w-3" />Item
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="text-xs gap-1 w-full border-dashed" onClick={() => setListSections([...listSections, { title: "", rows: [{ title: "", description: "" }] }])} disabled={sending}>
                  <Plus className="h-3 w-3" />Adicionar seção
                </Button>
              </div>
            </div>
          )}

          {/* Mention all */}
          <div className="border-t border-border/30 pt-4">
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <AtSign className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Mencionar todos</p>
                  <p className="text-[11px] text-muted-foreground">Marca todos os participantes do grupo</p>
                </div>
              </div>
              <Switch checked={mentionAll} onCheckedChange={setMentionAll} disabled={sending} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Send button + progress */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleSend}
            disabled={sending || !selectedConfigId || selectedGroupIds.length === 0}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando {completedCount}/{sendStatuses.length}...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar para {selectedGroupIds.length} grupo{selectedGroupIds.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>

          {sending && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2" />
              {currentSending && (
                <p className="text-xs text-muted-foreground text-center">
                  Enviando para: {currentSending.groupName}
                </p>
              )}
            </div>
          )}

          {sendStatuses.length > 0 && !sending && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {sendStatuses.map((s) => (
                <div key={s.groupId} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg bg-background/30">
                  {s.status === "sent" && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  {s.status === "error" && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                  <span className="truncate flex-1">{s.groupName}</span>
                  {s.status === "sent" && <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Enviado</Badge>}
                  {s.status === "error" && (
                    <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                      {s.error || "Erro"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
