

## Corrigir: tratar `invite_url: null` como falha e fazer retry

### Problema raiz

O endpoint do Baileys `/group/inviteCode/:name/:jid` retorna HTTP 200 com `{ invite_url: null }` quando o WhatsApp recusa o invite code (rate limit ou erro temporario). A edge function ve um HTTP 200, nao lanca erro, e nao faz retry -- marcando o grupo como "sem link" mesmo que o bot seja admin.

### Solucao

Na edge function `sync-invite-links`, apos receber a resposta com sucesso (HTTP 200), verificar se `invite_url` e `null`. Se for `null`, tratar como falha e continuar o loop de retry com backoff exponencial.

### Alteracao

**Arquivo:** `supabase/functions/sync-invite-links/index.ts`

No bloco single-group (linhas 100-117), adicionar verificacao:

```text
for (let attempt = 0; attempt < maxAttempts; attempt++) {
  const res = await fetch(...)
  if (!res.ok) throw new Error(...)
  const data = await res.json()
  inviteUrl = data.invite_url || null

  if (inviteUrl) {
    // Sucesso real - tem URL
    break
  }

  // invite_url veio null = falha silenciosa, tratar como erro
  if (attempt < maxAttempts - 1) {
    await sleep(2000 * 2^attempt)  // retry com backoff
  }
  // Se ultima tentativa e ainda null, nao seta error (ja e null)
}
```

Mesma logica sera aplicada ao modo "all groups" (linhas 169-195).

### Impacto

- Grupo #8 agora tera 3 tentativas com delays de 2s, 4s, 8s mesmo quando o Baileys retorna 200 com null
- Os outros 14 grupos que ja funcionam nao serao afetados (break no primeiro sucesso)
- Nenhuma alteracao no Baileys server necessaria

