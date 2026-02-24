

## Adicionar retry com backoff exponencial para os ultimos grupos

### Problema
Os ultimos 3 grupos (#4, #8, #5) falham consistentemente mesmo com 1 retry. O WhatsApp aplica rate limit progressivo -- 1 retry com 3s nao e suficiente.

### Solucao

Implementar **backoff exponencial** no modo single-group da edge function `sync-invite-links`:

- 3 tentativas no total (em vez de 1 retry)
- Delays crescentes: 2s, 4s, 8s entre tentativas
- Logar cada tentativa para debug

### Alteracao

**Arquivo:** `supabase/functions/sync-invite-links/index.ts`

Substituir o bloco de single-group (linhas 96-118) por um loop com backoff:

```text
Para cada tentativa (max 3):
  1. Chamar GET /group/inviteCode/:instance/:jid
  2. Se sucesso -> retornar URL
  3. Se falhou -> esperar 2s * 2^tentativa (2s, 4s, 8s)
  4. Se todas falharam -> retornar erro
```

### Detalhes tecnicos

- Apenas o modo single-group e afetado (chamado pelo frontend grupo a grupo)
- O modo "all groups" tambem sera atualizado com a mesma logica
- O frontend ja tem delay de 500ms entre grupos, entao o backoff so se aplica dentro de cada grupo individual
- Tempo maximo por grupo com falha: ~14s (2+4+8), aceitavel para 15 grupos

