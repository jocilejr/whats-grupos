

# Monitoramento de Grupos por Eventos (Baileys)

## Problema atual

O sistema atual compara snapshots de contagem de membros entre dias, o que nao consegue identificar quem entrou ou saiu. Se 5 pessoas entram e 5 saem no mesmo dia, o sistema mostra 0 entradas e 0 saidas.

## Nova abordagem: Eventos em tempo real

O Baileys emite o evento `group-participants.update` sempre que alguem entra ou sai de um grupo. Vamos escutar esse evento e gravar cada ocorrencia no banco de dados.

## Componentes

### 1. Nova tabela: `group_participant_events`

Registra cada evento individual de entrada/saida:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| instance_name | text | Instancia que capturou o evento |
| group_id | text | ID do grupo |
| group_name | text | Nome do grupo (para exibicao) |
| participant_jid | text | JID do participante (numero@s.whatsapp.net) |
| action | text | "add", "remove", "promote", "demote" |
| triggered_by | text | JID de quem realizou a acao (admin, ou o proprio participante) |
| created_at | timestamptz | Momento do evento |

Sem necessidade de `user_id` no insert (o servidor Baileys nao tem essa info). A relacao com o usuario sera feita via `instance_name` ao consultar.

### 2. Modificacao no `baileys-server/server.js`

Adicionar listener do evento `group-participants.update` dentro da funcao `createSession()`:

```javascript
sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
  // id = group JID, participants = array de JIDs, action = "add"|"remove"|"promote"|"demote"
  // Envia para o endpoint de webhook no Supabase
});
```

O servidor fara um POST para uma nova Edge Function (`group-events-webhook`) passando os dados do evento.

### 3. Nova Edge Function: `group-events-webhook`

- Recebe os eventos do Baileys server (autenticada via API key, nao via JWT do usuario)
- Insere os registros na tabela `group_participant_events` usando service role
- Tambem atualiza o `member_count` na tabela `group_stats` existente

### 4. Atualizar `sync-group-stats`

Manter a sincronizacao de `member_count` (contagem total) via polling, mas agora calcular `joined_today` e `left_today` a partir dos **eventos reais** da tabela `group_participant_events` em vez de comparar snapshots.

### 5. Atualizar `GroupsPage.tsx`

- Manter os cards de resumo (agora com dados reais de eventos)
- Adicionar uma secao mostrando os eventos recentes (quem entrou/saiu, de qual grupo, quando)
- Manter o grafico de evolucao de membros

### 6. Atualizar `Dashboard.tsx`

- Os cards de grupos ja existentes passam a mostrar dados dos eventos reais

## Fluxo do sistema

```text
Baileys (evento group-participants.update)
  --> POST para group-events-webhook (Edge Function)
    --> INSERT na tabela group_participant_events
    --> UPDATE member_count na group_stats

sync-group-stats (cron cada 15 min)
  --> Busca member_count atual do Baileys (polling)
  --> Conta eventos de "add" e "remove" do dia na group_participant_events
  --> Upsert na group_stats com joined_today e left_today reais
```

## Detalhes tecnicos

### Tabela SQL

```sql
CREATE TABLE public.group_participant_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name text NOT NULL,
  group_id text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  participant_jid text NOT NULL,
  action text NOT NULL, -- 'add', 'remove', 'promote', 'demote'
  triggered_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gpe_instance_date ON public.group_participant_events (instance_name, created_at DESC);
CREATE INDEX idx_gpe_group_date ON public.group_participant_events (group_id, created_at DESC);

ALTER TABLE public.group_participant_events ENABLE ROW LEVEL SECURITY;

-- Politica: usuarios podem ler eventos das instancias que possuem
CREATE POLICY "Users read own instance events" ON public.group_participant_events
  FOR SELECT USING (
    instance_name IN (
      SELECT ac.instance_name FROM api_configs ac WHERE ac.user_id = auth.uid()
    )
  );

-- Service role insere (via Edge Function webhook)
CREATE POLICY "Service role can insert events" ON public.group_participant_events
  FOR INSERT WITH CHECK (true);
```

### Modificacao no `baileys-server/server.js`

Dentro de `createSession()`, apos o listener de `connection.update`, adicionar:

```javascript
sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
  try {
    const webhookUrl = process.env.SUPABASE_FUNCTIONS_URL || 'http://supabase-kong:8000';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    // Buscar nome do grupo
    let groupName = id;
    try {
      const metadata = await sock.groupMetadata(id);
      groupName = metadata.subject || id;
    } catch {}

    await fetch(`${webhookUrl}/functions/v1/group-events-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'x-instance-name': instanceName,
      },
      body: JSON.stringify({
        groupId: id,
        groupName,
        participants,
        action,
        instanceName,
      }),
    });
  } catch (err) {
    console.error(`[${instanceName}] group-participants.update webhook error:`, err.message);
  }
});
```

### Edge Function `group-events-webhook`

- Autenticada via service role key (vem do Baileys server, nao de um usuario)
- Insere eventos na `group_participant_events`
- Verifica JWT = false no config.toml (validacao manual via header)

### Atualizacao do `sync-group-stats`

O calculo de `joined_today` e `left_today` muda de comparacao de snapshots para:

```sql
SELECT
  COUNT(*) FILTER (WHERE action = 'add') as joined,
  COUNT(*) FILTER (WHERE action = 'remove') as left
FROM group_participant_events
WHERE group_id = $1
  AND created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + interval '1 day'
```

## Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabela `group_participant_events` |
| `baileys-server/server.js` | Adicionar listener `group-participants.update` |
| `supabase/functions/group-events-webhook/index.ts` | Nova Edge Function para receber webhooks |
| `supabase/functions/sync-group-stats/index.ts` | Usar eventos reais para joined/left |
| `src/pages/GroupsPage.tsx` | Adicionar lista de eventos recentes |
| `src/pages/Dashboard.tsx` | Dados de grupos baseados em eventos |

