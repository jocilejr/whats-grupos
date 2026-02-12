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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, FileText, Image, Video, File, Upload, Mic, Sticker, MapPin,
  Contact, BarChart3, List, Plus, Trash2, Link2, BookTemplate,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "marketing", label: "Marketing" },
  { value: "informativo", label: "Informativo" },
  { value: "suporte", label: "Suporte" },
];

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: any;
}

export function TemplateFormDialog({ open, onOpenChange, template }: TemplateFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("geral");
  const [messageType, setMessageType] = useState("text");

  // Text
  const [textContent, setTextContent] = useState("");
  const [linkPreview, setLinkPreview] = useState(true);
  // Media
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

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      const c = template.content as any || {};
      setName(template.name || "");
      setCategory(template.category || "geral");
      setMessageType(template.message_type || "text");
      setTextContent(c.text || "");
      setLinkPreview(c.linkPreview !== false);
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
    } else {
      setName(""); setCategory("geral"); setMessageType("text");
      setTextContent(""); setLinkPreview(true); setMediaUrl(""); setCaption("");
      setLocName(""); setLocAddress(""); setLocLat(""); setLocLng("");
      setContactName(""); setContactPhone("");
      setPollName(""); setPollOptions(["", ""]); setPollSelectable(1);
      setListTitle(""); setListDescription(""); setListButtonText("Ver opções"); setListFooter("");
      setListSections([{ title: "Seção 1", rows: [{ title: "", description: "" }] }]);
    }
  }, [open, template]);

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

  const buildContent = () => {
    const base: any = {};
    switch (messageType) {
      case "text": base.text = textContent; base.linkPreview = linkPreview; break;
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
    }
    return base;
  };

  const validate = () => {
    if (!name.trim()) { toast({ title: "Digite o nome do template", variant: "destructive" }); return false; }
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
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const content = buildContent();
      const payload = {
        name, category, message_type: messageType, content, user_id: user!.id,
      };
      if (template) {
        const { error } = await supabase.from("message_templates").update(payload).eq("id", template.id);
        if (error) throw error;
        toast({ title: "Template atualizado" });
      } else {
        const { error } = await supabase.from("message_templates").insert(payload);
        if (error) throw error;
        toast({ title: "Template criado" });
      }
      queryClient.invalidateQueries({ queryKey: ["message-templates"] });
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
              <BookTemplate className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{template ? "Editar Template" : "Novo Template"}</DialogTitle>
              <DialogDescription className="text-xs">Crie um modelo reutilizável de mensagem</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-5">
          {/* Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas" className="bg-background/50 border-border/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-background/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

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
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensagem</Label>
                <Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={4} placeholder="Digite sua mensagem..." className="bg-background/50 border-border/50 resize-none" />
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
                <Switch checked={linkPreview} onCheckedChange={setLinkPreview} />
              </div>
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
              {["image", "video", "document"].includes(messageType) && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legenda (opcional)</Label>
                  <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda..." className="bg-background/50 border-border/50 min-h-[80px] resize-y" />
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
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Seções</Label>
                {listSections.map((section, si) => (
                  <div key={si} className="border border-border/40 rounded-lg p-3 space-y-2 bg-background/20">
                    <div className="flex items-center gap-2">
                      <Input
                        value={section.title}
                        onChange={(e) => { const s = [...listSections]; s[si].title = e.target.value; setListSections(s); }}
                        placeholder="Nome da seção" className="bg-background/50 border-border/50 text-sm"
                      />
                      {listSections.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => setListSections(listSections.filter((_, j) => j !== si))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    {section.rows.map((row, ri) => (
                      <div key={ri} className="flex gap-2 pl-3">
                        <Input
                          value={row.title}
                          onChange={(e) => { const s = [...listSections]; s[si].rows[ri].title = e.target.value; setListSections(s); }}
                          placeholder="Título" className="bg-background/50 border-border/50 text-xs"
                        />
                        <Input
                          value={row.description}
                          onChange={(e) => { const s = [...listSections]; s[si].rows[ri].description = e.target.value; setListSections(s); }}
                          placeholder="Descrição" className="bg-background/50 border-border/50 text-xs"
                        />
                        {section.rows.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => {
                            const s = [...listSections]; s[si].rows = s[si].rows.filter((_, j) => j !== ri); setListSections(s);
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="text-xs gap-1 ml-3 border-dashed" onClick={() => {
                      const s = [...listSections]; s[si].rows.push({ title: "", description: "" }); setListSections(s);
                    }}>
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
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {template ? "Salvar" : "Criar Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
