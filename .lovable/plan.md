

## Diagnóstico: Card de Contato sem interação

**Problema:** O vCard gerado pelo Baileys server está incompleto. Falta o parâmetro `waid` (WhatsApp ID) no campo `TEL` do vCard, que e o que permite o WhatsApp vincular o contato a um perfil real e mostrar os botoes "Enviar mensagem" / "Salvar contato" de forma interativa.

**vCard atual (bugado):**
```text
BEGIN:VCARD
VERSION:3.0
FN:Meire Rosana
TEL;type=CELL:5537919994987
END:VCARD
```

**vCard correto (interativo):**
```text
BEGIN:VCARD
VERSION:3.0
FN:Meire Rosana
TEL;type=CELL;type=VOICE;waid=5537919994987:+55 37 91999-4987
END:VCARD
```

O `waid=NUMERO` e o que faz o WhatsApp reconhecer o contato como um perfil real e habilitar a interacao.

---

### Plano de correção

**1. Corrigir `baileys-server/server.js` (rota `/message/sendContact`)**

Alterar a construcao do vCard para:
- Adicionar `waid=NUMERO` no campo TEL
- Formatar o telefone com `+` no valor do TEL
- Limpar o numero (remover caracteres nao numericos) para o `waid`

De:
```js
vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${c.fullName}\nTEL;type=CELL:${c.phoneNumber}\nEND:VCARD`
```

Para:
```js
const cleanNum = c.phoneNumber.replace(/\D/g, '');
vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${c.fullName}\nTEL;type=CELL;type=VOICE;waid=${cleanNum}:+${cleanNum}\nEND:VCARD`
```

**2. Corrigir `supabase/functions/process-queue/index.ts` (payload do contact)**

O `wuid` enviado no payload precisa ser apenas numeros (sem `+`, parenteses, espacos). Garantir que o `contactPhone` seja limpo antes de enviar:

```typescript
const cleanPhone = content.contactPhone.replace(/\D/g, '');
body = {
  number: groupId,
  contact: [{
    fullName: content.contactName,
    wuid: cleanPhone,
    phoneNumber: cleanPhone
  }]
};
```

**3. Corrigir `supabase/functions/evolution-api/index.ts`**

O endpoint `sendContact` da Evolution API tambem precisa que o payload inclua o `wuid` corretamente. Este arquivo ja repassa o body diretamente, entao nao precisa de mudanca se o payload do process-queue estiver correto. Mas devemos confirmar que a Evolution API espera o mesmo formato.

---

### Resumo das alteracoes
| Arquivo | Mudanca |
|---|---|
| `baileys-server/server.js` | Adicionar `waid` e `+` no vCard |
| `supabase/functions/process-queue/index.ts` | Limpar telefone antes de montar payload |

Duas alteracoes pontuais que resolvem o card bugado em ambos os provedores (Baileys e Evolution API).

