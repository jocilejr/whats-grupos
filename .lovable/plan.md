

## Problema Identificado

O 405 persiste porque existem **3 camadas de retry** que se multiplicam:

1. **Edge function `reconnectInstance`**: delete → create → 3 polls de QR → fallback connect (cada um cria nova sessão)
2. **Frontend `reconnectInstance`**: após edge function, faz mais 2 retries com `connectInstance`
3. **Frontend `showQrCode`**: 3 tentativas de `connectInstance`
4. **Polling de status**: a cada 15s chama `connectionState` (esse é OK, não cria sessão)

Cada chamada que cria sessão dispara um novo WASocket que recebe 405 em ~2s, registra cooldown, mas o cooldown atual é apenas 5s e o servidor **espera** o cooldown em vez de rejeitar — então todas as chamadas concorrentes se empilham.

## Correções (3 arquivos)

### 1. `baileys-server/server.js`

- **Cooldown de 5s → 30s**: WhatsApp precisa de tempo para liberar a conexão
- **Rejeitar imediatamente durante cooldown** em vez de esperar (throw error com `COOLDOWN:Xs`)
- **Endpoints `/instance/create` e `/instance/connect`**: capturar erro de cooldown e retornar `{ error: "cooldown", retryAfter: N }` com status 429
- **`restoreSessions()`**: pular instâncias que já estão em cooldown

### 2. `supabase/functions/evolution-api/index.ts`

- **`reconnectInstance`**: reduzir retries de QR polling de 3 para 1
- **Detectar respostas `session_expired` e `cooldown`**: parar retries imediatamente e retornar o erro ao frontend
- **Remover o fallback connect** que criava mais uma sessão concorrente

### 3. `src/pages/SettingsPage.tsx`

- **`reconnectInstance`**: detectar erro `cooldown` ou `session_expired` na resposta e mostrar toast com tempo de espera, sem fazer retries adicionais
- **`showQrCode`**: mesma detecção — parar retries se receber cooldown/session_expired
- **`createInstance`**: mesma detecção no `connectInstance` pós-criação

### Resultado esperado

```text
Antes (loop infinito):
  UI clica Reconectar
  → Edge: delete + create + 3 polls + connect fallback = ~5 sessões criadas
  → Frontend: + 2 retries = ~7 sessões total
  → Cada sessão → 405 em 2s → cleanup → próxima sessão imediata
  → WhatsApp bloqueia mais → mais 405

Depois:
  UI clica Reconectar
  → Edge: delete + create + 1 poll → 405 → cooldown 30s → retorna {error: "cooldown", retryAfter: 28}
  → Frontend: recebe cooldown → mostra "Aguarde 28s antes de tentar novamente" → para
  → Após 30s, próxima tentativa tem socket limpo sem concorrência
```
