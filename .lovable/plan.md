

## Correção: Timeout no `reconnectInstance`

### Causa raiz confirmada
A edge function `reconnectInstance` excede o wall clock limit do Deno isolate (~8s+). Os logs mostram `early termination has been triggered` consistentemente.

### Solução: Dividir o fluxo em 2 chamadas rápidas

**`supabase/functions/evolution-api/index.ts`** — Simplificar `reconnectInstance`:
- Fazer apenas DELETE → 2s wait → CREATE → retornar imediatamente
- Remover o wait de 5s (reduzir para 2s) e remover a chamada ao `/instance/connect`
- Total: ~4-5s em vez de 10-13s

**`src/pages/SettingsPage.tsx`** — Frontend faz o connect separadamente:
- Após `reconnectInstance` retornar, esperar 2s e chamar `connectInstance` (que já tem o polling de 15s no server.js)
- Mostrar feedback ao usuário durante cada etapa ("Recriando instância..." → "Gerando QR Code...")

### Fluxo final
```text
Frontend                    Edge Function           Baileys Server
   |--- reconnectInstance -->|                           |
   |                         |--- DELETE /instance ----->|
   |                         |     (wait 2s)             |
   |                         |--- POST /instance/create->|
   |<-- {ok} ---------------|                           |
   |     (wait 2s)           |                           |
   |--- connectInstance ---->|                           |
   |                         |--- GET /instance/connect->|
   |                         |     (polling 15s for QR)  |
   |<-- {qrcode: "..."} ----|                           |
```

### Arquivos modificados
| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/evolution-api/index.ts` | reconnectInstance: reduzir para DELETE + 2s + CREATE apenas |
| `src/pages/SettingsPage.tsx` | reconnectInstance: após retorno, wait 2s + chamar connectInstance |

