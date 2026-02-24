

## Corrigir erro de boot da Edge Function `smart-link-api`

### Problema

A edge function `smart-link-api` esta retornando erro 500 com a mensagem:
```
"InvalidWorkerCreation: worker boot error: failed to bootstrap runtime: could not find an appropriate entrypoint"
```

Isso acontece tanto no Supabase self-hosted (VPS) quanto no Lovable Cloud (onde a funcao nem esta deployada).

### Causa raiz

O import `https://esm.sh/@supabase/supabase-js@2` pode causar falhas de bootstrap no edge runtime. O formato recomendado e usar `npm:` specifier que e mais estavel.

### Solucao

**Arquivo:** `supabase/functions/smart-link-api/index.ts`

1. Trocar o import de `https://esm.sh/@supabase/supabase-js@2` para `npm:@supabase/supabase-js@2`
2. Fazer deploy automatico da funcao no Lovable Cloud

Isso resolve o problema de boot e tambem garante que a funcao esteja disponivel no Lovable Cloud. Para o servidor VPS, o usuario precisara fazer o deploy manualmente apos o pull das mudancas.

### Alteracao tecnica

Linha 1 do arquivo:
- De: `import { createClient } from "https://esm.sh/@supabase/supabase-js@2";`
- Para: `import { createClient } from "npm:@supabase/supabase-js@2";`

Tambem verificar e atualizar a edge function `smart-link-redirect` que pode ter o mesmo problema de import.

