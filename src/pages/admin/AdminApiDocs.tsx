import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Copy,
  Plus,
  Trash2,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  Globe,
  Send,
  Users,
  MessageSquare,
  Radio,
  Webhook,
} from "lucide-react";

const WEBHOOK_EVENTS = [
  { value: "message.received", label: "Mensagem recebida", description: "Disparado quando uma mensagem é recebida" },
  { value: "group.participant.update", label: "Participante atualizado", description: "Entrada/saída de participantes em grupos" },
  { value: "connection.update", label: "Conexão atualizada", description: "Status da conexão WhatsApp mudou" },
];

interface WebhookConfig {
  id: string;
  user_id: string;
  webhook_url: string;
  events: string[];
  is_active: boolean;
  secret: string | null;
  created_at: string;
}

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  POST: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
};

const endpoints = [
  {
    category: "Instâncias",
    icon: Globe,
    items: [
      {
        method: "POST",
        path: "/instance/create",
        description: "Criar ou conectar uma instância",
        body: '{ "instanceName": "minha-instancia" }',
        response: '{ "instance": { "instanceName": "minha-instancia", "status": "connecting" }, "qrcode": { "base64": "..." } }',
      },
      {
        method: "GET",
        path: "/instance/connect/:name",
        description: "Conectar instância e obter QR Code",
        body: null,
        response: '{ "base64": "data:image/png;base64,...", "code": "..." }',
      },
      {
        method: "GET",
        path: "/instance/connectionState/:name",
        description: "Verificar estado da conexão",
        body: null,
        response: '{ "instance": { "state": "open" } }',
      },
      {
        method: "GET",
        path: "/instance/fetchInstances",
        description: "Listar todas as instâncias ativas",
        body: null,
        response: '[{ "instance": { "instanceName": "...", "status": "open" } }]',
      },
      {
        method: "DELETE",
        path: "/instance/delete/:name",
        description: "Desconectar e remover instância",
        body: null,
        response: '{ "status": "deleted" }',
      },
    ],
  },
  {
    category: "Mensagens",
    icon: Send,
    items: [
      {
        method: "POST",
        path: "/message/sendText/:name",
        description: "Enviar mensagem de texto",
        body: '{ "number": "120363xxx@g.us", "text": "Olá!", "mentionsEveryOne": false }',
        response: '{ "key": { "id": "..." }, "status": "PENDING" }',
      },
      {
        method: "POST",
        path: "/message/sendMedia/:name",
        description: "Enviar imagem, vídeo ou documento",
        body: '{ "number": "120363xxx@g.us", "mediatype": "image", "media": "https://url/img.jpg", "caption": "Legenda", "mentionsEveryOne": false }',
        response: '{ "key": { "id": "..." }, "status": "PENDING" }',
      },
      {
        method: "POST",
        path: "/message/sendWhatsAppAudio/:name",
        description: "Enviar áudio (PTT)",
        body: '{ "number": "120363xxx@g.us", "audio": "https://url/audio.ogg" }',
        response: '{ "key": { "id": "..." }, "status": "PENDING" }',
      },
      {
        method: "POST",
        path: "/message/sendSticker/:name",
        description: "Enviar sticker",
        body: '{ "number": "120363xxx@g.us", "sticker": "https://url/sticker.webp" }',
        response: '{ "key": { "id": "..." }, "status": "PENDING" }',
      },
      {
        method: "POST",
        path: "/message/sendLocation/:name",
        description: "Enviar localização",
        body: '{ "number": "120363xxx@g.us", "name": "Local", "address": "Endereço", "latitude": -23.55, "longitude": -46.63 }',
        response: '{ "key": { "id": "..." }, "status": "PENDING" }',
      },
      {
        method: "POST",
        path: "/message/sendContact/:name",
        description: "Enviar contato",
        body: '{ "number": "120363xxx@g.us", "contact": [{ "fullName": "João", "phoneNumber": "+5511999999999" }] }',
        response: '{ "key": { "id": "..." }, "status": "PENDING" }',
      },
      {
        method: "POST",
        path: "/message/sendPoll/:name",
        description: "Enviar enquete",
        body: '{ "number": "120363xxx@g.us", "name": "Pergunta?", "values": ["Sim", "Não"], "selectableCount": 1 }',
        response: '{ "key": { "id": "..." }, "status": "PENDING" }',
      },
    ],
  },
  {
    category: "Grupos",
    icon: Users,
    items: [
      {
        method: "GET",
        path: "/group/fetchAllGroups/:name",
        description: "Listar todos os grupos da instância",
        body: null,
        response: '[{ "id": "120363xxx@g.us", "subject": "Meu Grupo", "size": 150 }]',
      },
      {
        method: "GET",
        path: "/group/inviteCode/:name/:jid",
        description: "Obter link de convite de um grupo",
        body: null,
        response: '{ "invite_url": "https://chat.whatsapp.com/xxx" }',
      },
      {
        method: "POST",
        path: "/group/inviteCodeBatch/:name",
        description: "Obter links de convite em lote",
        body: '{ "jids": ["120363xxx@g.us", "120363yyy@g.us"] }',
        response: '{ "results": { "120363xxx@g.us": "https://chat.whatsapp.com/xxx" } }',
      },
    ],
  },
];

function AdminApiDocs() {
  const { toast } = useToast();
  const [baseUrl, setBaseUrl] = useState("");
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: config } = await supabase
        .from("global_config")
        .select("baileys_api_url")
        .limit(1)
        .single();
      if (config?.baileys_api_url) {
        setBaseUrl(config.baileys_api_url);
      }

      const { data: wh } = await supabase
        .from("webhook_configs" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (wh) setWebhooks(wh as any);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function copyCurl(method: string, path: string, body: string | null) {
    const url = `${baseUrl || "http://localhost:3100"}${path}`;
    let cmd = `curl -X ${method} "${url}"`;
    if (body) {
      cmd += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
    }
    navigator.clipboard.writeText(cmd);
    toast({ title: "cURL copiado!", description: "Comando cURL copiado para a área de transferência." });
  }

  async function addWebhook() {
    if (!newUrl || newEvents.length === 0) {
      toast({ title: "Preencha a URL e selecione ao menos um evento", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("webhook_configs" as any).insert({
        user_id: user.id,
        webhook_url: newUrl,
        events: newEvents,
        secret: newSecret || null,
        is_active: true,
      } as any);
      if (error) throw error;

      setNewUrl("");
      setNewSecret("");
      setNewEvents([]);
      toast({ title: "Webhook adicionado!" });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro ao adicionar webhook", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleWebhook(id: string, active: boolean) {
    await supabase.from("webhook_configs" as any).update({ is_active: active } as any).eq("id", id);
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, is_active: active } : w));
  }

  async function deleteWebhook(id: string) {
    await supabase.from("webhook_configs" as any).delete().eq("id", id);
    setWebhooks(prev => prev.filter(w => w.id !== id));
    toast({ title: "Webhook removido" });
  }

  async function testWebhook(wh: WebhookConfig) {
    setTestingId(wh.id);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (wh.secret) headers["X-Webhook-Secret"] = wh.secret;
      const res = await fetch(wh.webhook_url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: "test",
          timestamp: new Date().toISOString(),
          data: { message: "Teste de webhook do Simplificando Grupos" },
        }),
      });
      toast({
        title: res.ok ? "Teste enviado com sucesso!" : `Erro: ${res.status}`,
        variant: res.ok ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Erro no teste", description: err.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Radio className="h-6 w-6 text-primary" />
          API & Webhooks
        </h1>
        <p className="text-muted-foreground mt-1">
          Documentação dos endpoints e configuração de webhooks para integração externa.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Base URL</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-sm bg-muted px-3 py-2 rounded block font-mono">
            {baseUrl || "http://localhost:3100"}
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Configurável em Config Global → URL API Baileys. As requisições vão direto ao servidor sem passar pela fila ou logs da aplicação.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="endpoints">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="endpoints" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Endpoints
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-4 mt-4">
          {endpoints.map((cat) => (
            <Card key={cat.category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <cat.icon className="h-4 w-4 text-primary" />
                  {cat.category}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Accordion type="multiple">
                  {cat.items.map((ep, i) => (
                    <AccordionItem key={i} value={`${cat.category}-${i}`} className="border-b last:border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <Badge variant="outline" className={`${methodColors[ep.method]} font-mono text-xs`}>
                            {ep.method}
                          </Badge>
                          <code className="text-sm font-mono">{ep.path}</code>
                          <span className="text-xs text-muted-foreground hidden sm:inline">{ep.description}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 space-y-3">
                        <p className="text-sm text-muted-foreground">{ep.description}</p>
                        {ep.body && (
                          <div>
                            <Label className="text-xs uppercase text-muted-foreground">Body</Label>
                            <pre className="bg-muted rounded p-3 text-xs font-mono overflow-x-auto mt-1">
                              {JSON.stringify(JSON.parse(ep.body), null, 2)}
                            </pre>
                          </div>
                        )}
                        <div>
                          <Label className="text-xs uppercase text-muted-foreground">Resposta</Label>
                          <pre className="bg-muted rounded p-3 text-xs font-mono overflow-x-auto mt-1">
                            {JSON.stringify(JSON.parse(ep.response), null, 2)}
                          </pre>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyCurl(ep.method, ep.path, ep.body)}
                          className="gap-2"
                        >
                          <Copy className="h-3.5 w-3.5" /> Copiar cURL
                        </Button>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4 mt-4">
          {/* Add webhook form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Novo Webhook</CardTitle>
              <CardDescription>Cadastre uma URL para receber eventos em tempo real.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <Input
                    placeholder="https://meu-servidor.com/webhook"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secret (opcional)</Label>
                  <Input
                    placeholder="Token de validação"
                    value={newSecret}
                    onChange={(e) => setNewSecret(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Enviado no header X-Webhook-Secret</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Eventos</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <label
                      key={ev.value}
                      className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={newEvents.includes(ev.value)}
                        onCheckedChange={(checked) => {
                          setNewEvents(prev =>
                            checked ? [...prev, ev.value] : prev.filter(e => e !== ev.value)
                          );
                        }}
                      />
                      <div>
                        <span className="text-sm font-medium">{ev.label}</span>
                        <p className="text-xs text-muted-foreground">{ev.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={addWebhook} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar Webhook
              </Button>
            </CardContent>
          </Card>

          {/* Webhooks list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhooks Configurados</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : webhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum webhook configurado.</p>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((wh) => (
                    <div
                      key={wh.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {wh.is_active ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <code className="text-sm font-mono truncate">{wh.webhook_url}</code>
                        </div>
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {wh.events.map((ev) => (
                            <Badge key={ev} variant="secondary" className="text-[10px]">
                              {ev}
                            </Badge>
                          ))}
                          {wh.secret && (
                            <Badge variant="outline" className="text-[10px]">🔑 secret</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={wh.is_active}
                          onCheckedChange={(v) => toggleWebhook(wh.id, v)}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => testWebhook(wh)}
                          disabled={testingId === wh.id}
                          title="Testar"
                        >
                          {testingId === wh.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <TestTube className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteWebhook(wh.id)}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payload example */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Formato do Payload</CardTitle>
              <CardDescription>Todos os webhooks recebem este formato via POST.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted rounded p-4 text-xs font-mono overflow-x-auto">
{JSON.stringify({
  event: "message.received",
  timestamp: "2025-01-01T12:00:00.000Z",
  data: {
    instanceName: "minha-instancia",
    from: "120363xxx@g.us",
    participant: "5511999999999@s.whatsapp.net",
    messageType: "text",
    content: "Olá!",
    timestamp: 1704106800,
    isGroup: true,
    messageId: "ABCDEF123456",
  },
}, null, 2)}
              </pre>
              <Separator className="my-4" />
              <div className="text-sm space-y-2">
                <p><strong>Headers enviados:</strong></p>
                <ul className="list-disc list-inside text-muted-foreground text-xs space-y-1">
                  <li><code>Content-Type: application/json</code></li>
                  <li><code>X-Webhook-Secret: seu-token</code> (se configurado)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdminApiDocs;
