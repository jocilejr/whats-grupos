

## Plano: Tornar campanhas independentes das instancias

### Objetivo
Permitir que campanhas existam sem uma instancia (api_config) vinculada, podendo trocar ou remover a instancia livremente. Deletar uma instancia nao apagara mais as campanhas.

### Mudancas necessarias

#### 1. Migracao no banco de dados
- Tornar `api_config_id` nullable na tabela `campaigns`
- Remover a constraint de foreign key com CASCADE e recriar com `ON DELETE SET NULL`
- Fazer o mesmo para `scheduled_messages` e `message_logs` (para consistencia)

```text
campaigns.api_config_id:      NOT NULL + CASCADE  -->  NULLABLE + SET NULL
scheduled_messages.api_config_id: NOT NULL + CASCADE  -->  NULLABLE + SET NULL  
message_logs.api_config_id:   NOT NULL + CASCADE  -->  NULLABLE + SET NULL
```

#### 2. Formulario de campanha (CampaignDialog.tsx)
- Remover a validacao obrigatoria de `configId` (linha 91: "Selecione uma instancia")
- Permitir salvar campanha sem instancia selecionada, enviando `api_config_id: configId || null`
- A selecao de instancia e grupos passa a ser opcional

#### 3. Listagem de campanhas (Campaigns.tsx)
- Tratar campanhas sem instancia vinculada na UI (ex: mostrar badge "Sem instancia" ou indicador visual)
- Permitir que o usuario edite a campanha para vincular uma nova instancia a qualquer momento

#### 4. Backup/Restore (backup.ts)
- Na restauracao, nao pular campanhas sem `api_config_id` mapeado — importar com `api_config_id: null`
- Mesmo tratamento para `scheduled_messages` e `message_logs`

#### 5. Mensagens agendadas (ScheduledMessageForm.tsx)
- Ao agendar mensagem, usar o `api_config_id` da campanha se disponivel, mas permitir que seja null (validar apenas no momento do envio)

---

### Secao tecnica

**Migracao SQL:**
```sql
-- campaigns
ALTER TABLE public.campaigns ALTER COLUMN api_config_id DROP NOT NULL;
ALTER TABLE public.campaigns DROP CONSTRAINT campaigns_api_config_id_fkey;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_api_config_id_fkey
  FOREIGN KEY (api_config_id) REFERENCES public.api_configs(id) ON DELETE SET NULL;

-- scheduled_messages  
ALTER TABLE public.scheduled_messages ALTER COLUMN api_config_id DROP NOT NULL;
ALTER TABLE public.scheduled_messages DROP CONSTRAINT scheduled_messages_api_config_id_fkey;
ALTER TABLE public.scheduled_messages ADD CONSTRAINT scheduled_messages_api_config_id_fkey
  FOREIGN KEY (api_config_id) REFERENCES public.api_configs(id) ON DELETE SET NULL;

-- message_logs
ALTER TABLE public.message_logs ALTER COLUMN api_config_id DROP NOT NULL;
ALTER TABLE public.message_logs DROP CONSTRAINT message_logs_api_config_id_fkey;
ALTER TABLE public.message_logs ADD CONSTRAINT message_logs_api_config_id_fkey
  FOREIGN KEY (api_config_id) REFERENCES public.api_configs(id) ON DELETE SET NULL;
```

**Arquivos modificados:**
- `src/components/campaigns/CampaignDialog.tsx` — remover validacao obrigatoria, enviar null quando vazio
- `src/pages/Campaigns.tsx` — tratar visualmente campanhas sem instancia
- `src/lib/backup.ts` — nao pular registros sem api_config mapeado
- `src/components/campaigns/ScheduledMessageForm.tsx` — tratar api_config_id opcional

