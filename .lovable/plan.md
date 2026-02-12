

# Sistema Completo de Agendamento de Mensagens dentro de Campanhas

## Resumo

Implementar um sistema de agendamento de mensagens embutido dentro de cada campanha, com suporte a envio unico e recorrente (diario, semanal, mensal), tipos de mensagem texto + midia + templates, e backend completo para envio automatico.

---

## 1. Alteracoes no Banco de Dados

### 1.1 Adicionar `instance_name` nas tabelas

As tabelas `campaigns`, `scheduled_messages` e `message_logs` precisam saber qual instancia do WhatsApp usar para enviar:

```sql
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS instance_name text;
ALTER TABLE public.scheduled_messages ADD COLUMN IF NOT EXISTS instance_name text;
ALTER TABLE public.message_logs ADD COLUMN IF NOT EXISTS instance_name text;
```

### 1.2 Criar bucket de storage para midias

Para suportar envio de imagens/documentos, criar um bucket publico:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);
-- RLS: usuarios autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'media');
-- RLS: qualquer um pode ler (publico)
CREATE POLICY "Public can read media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');
-- RLS: usuarios podem deletar seus proprios arquivos
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'media');
```

---

## 2. Fluxo da Interface

A experiencia sera: ao clicar "Editar" em uma campanha (ou ao criar uma nova), o dialog mostra as mensagens agendadas daquela campanha, com opcao de adicionar novas.

### 2.1 CampaignDialog expandido

O dialog atual ja tem: nome, descricao, conexao, instancia WhatsApp, grupos, switch ativo. Sera adicionada uma nova secao **"Mensagens Agendadas"** abaixo dos grupos:

- Lista de mensagens ja vinculadas a esta campanha (da tabela `scheduled_messages` onde `campaign_id = campanha.id`)
- Cada mensagem mostra: tipo, preview do conteudo, data/hora ou recorrencia, status ativo/inativo, botoes editar/excluir
- Botao "Adicionar Mensagem"

### 2.2 Novo componente: `ScheduledMessageForm`

Dialog/secao para criar/editar uma mensagem agendada:

**Campos:**
- **Tipo de mensagem**: texto, imagem, video, documento (select)
- **Conteudo**: campo de texto para mensagem de texto, ou upload de midia + legenda
- **Usar template**: botao para selecionar um template salvo (preenche o conteudo automaticamente)
- **Tipo de agendamento**: unico, diario, semanal, mensal (radio/select)
- **Data/Hora**: date-time picker (para envio unico, define a data; para recorrente, define o horario)
- **Dia da semana** (se semanal): checkboxes dos dias
- **Dia do mes** (se mensal): selector de dia 1-28

### 2.3 Novo componente: `CampaignMessageList`

Lista as mensagens agendadas da campanha com:
- Preview compacto (icone do tipo + trecho do conteudo + horario)
- Badge de recorrencia (Unico, Diario, Semanal, Mensal)
- Switch ativo/inativo por mensagem
- Botoes de acao (editar, excluir)

---

## 3. Edge Function: `sendText` na Evolution API

Adicionar a acao `sendText` na edge function existente para enviar mensagens de texto e midia:

```text
case "sendText":    -> POST /message/sendText/{instanceName}
case "sendMedia":   -> POST /message/sendMedia/{instanceName}
```

O body vem do request POST.

---

## 4. Edge Function: `send-scheduled-messages`

Nova edge function que sera chamada a cada minuto pelo pg_cron:

**Logica:**
1. Buscar `scheduled_messages` onde `is_active = true`, `next_run_at <= now()`, e a campanha vinculada tambem esta ativa
2. Para cada mensagem encontrada:
   - Buscar os `group_ids` da campanha vinculada
   - Buscar a `api_config` correspondente
   - Para cada grupo, chamar a Evolution API (sendText ou sendMedia)
   - Registrar em `message_logs` (sucesso ou erro)
3. Atualizar `last_run_at` e calcular proximo `next_run_at`:
   - Unico: desativar a mensagem (`is_active = false`)
   - Diario: `next_run_at + 1 dia`
   - Semanal: proximo dia da semana configurado
   - Mensal: `next_run_at + 1 mes`

---

## 5. Cron Job (pg_cron)

Configurar um job que chama a edge function a cada minuto:

```sql
SELECT cron.schedule(
  'send-scheduled-messages',
  '* * * * *',
  $$ SELECT net.http_post(...) $$
);
```

---

## 6. Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| `src/components/campaigns/CampaignMessageList.tsx` | Lista de mensagens agendadas de uma campanha |
| `src/components/campaigns/ScheduledMessageForm.tsx` | Formulario para criar/editar mensagem agendada |
| `src/components/campaigns/TemplateSelector.tsx` | Seletor de templates salvos |
| `supabase/functions/send-scheduled-messages/index.ts` | Edge function de processamento automatico |

## 7. Arquivos a Modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/campaigns/CampaignDialog.tsx` | Salvar `instance_name`, incluir secao de mensagens |
| `supabase/functions/evolution-api/index.ts` | Adicionar acoes `sendText` e `sendMedia` |
| `supabase/config.toml` | Registrar nova edge function `send-scheduled-messages` com `verify_jwt = false` |

---

## 8. Resumo do Fluxo Completo

```text
Usuario cria campanha
  -> Seleciona conexao + instancia WhatsApp + grupos
  -> Adiciona mensagens agendadas (texto/midia/template + data/recorrencia)
  -> Ativa a campanha

A cada minuto (pg_cron):
  -> Edge function busca mensagens com next_run_at <= agora
  -> Verifica se campanha esta ativa
  -> Envia para cada grupo via Evolution API
  -> Registra no historico (message_logs)
  -> Calcula proximo envio ou desativa
```

