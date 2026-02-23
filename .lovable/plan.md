
# Correcao do Upload de Midias no Backup

## Problemas Identificados

1. **Conversao base64 falha silenciosamente para arquivos grandes**: As funcoes `btoa()` e `atob()` do navegador tem limites de tamanho de string. Videos e audios maiores (1-20MB) causam erro, mas o `catch` vazio ignora.

2. **Nenhum feedback sobre falhas**: O usuario nao sabe quais arquivos falharam - o codigo simplesmente pula sem avisar.

3. **Import tambem falha silenciosamente**: Na funcao `uploadMedia`, a conversao `atob(base64)` tambem pode falhar para arquivos grandes, e o erro e ignorado.

4. **URL map no import esta incorreta**: Na funcao `uploadMedia`, o `oldUrl` e construido usando o `VITE_SUPABASE_URL` atual (do destino), mas deveria usar a URL de origem do backup para fazer o mapeamento correto.

## Correcoes Planejadas

### Arquivo: `src/lib/backup.ts`

**1. Substituir `btoa()`/`atob()` por conversao chunked**

Na exportacao, trocar `blobToDataUrl` (que usa `FileReader.readAsDataURL`) por uma funcao que converte o ArrayBuffer em base64 em chunks de 8KB, evitando estouro de stack:

```typescript
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}
```

Na importacao, trocar `atob()` por conversao chunked similar.

**2. Adicionar logs e contadores de erro**

Em vez de `catch {}` vazio, registrar quais arquivos falharam e mostrar um resumo ao final:

- Na exportacao: contar arquivos baixados vs falhados
- Na importacao: contar arquivos uploadados vs falhados  
- Exibir toast com resumo ("X de Y arquivos de midia transferidos, Z falharam")

**3. Corrigir mapeamento de URLs no import**

Na funcao `uploadMedia`, o `oldUrl` precisa usar a URL de origem do backup (`backup.source_url`), nao a URL do destino:

```typescript
// ANTES (errado):
const oldUrl = `${supabaseUrl}/storage/v1/object/public/media/${originalPath}`;
// DEPOIS (correto):
const oldUrl = `${sourceUrl}/storage/v1/object/public/media/${originalPath}`;
```

Passar `sourceUrl` como parametro para `uploadMedia`.

**4. Melhorar progresso na exportacao**

Mostrar nome do arquivo sendo baixado e tipo (imagem/video/audio) para o usuario acompanhar.

### Arquivo: `src/pages/BackupPage.tsx`

**5. Mostrar resumo de midias apos export/import**

Exibir toast detalhado informando quantos arquivos de midia foram processados com sucesso e quantos falharam, para o usuario saber se precisa tentar novamente.

---

## Detalhes Tecnicos

### Funcao `exportBackup` - Mudancas

- Substituir `blobToDataUrl(blob)` por: obter `ArrayBuffer` do blob, converter com `arrayBufferToBase64`, e montar o data URL manualmente (`data:${blob.type};base64,${base64}`)
- Adicionar contador de falhas
- Retornar info de falhas no resultado

### Funcao `uploadMedia` - Mudancas  

- Receber `sourceUrl` como parametro adicional
- Usar `sourceUrl` para construir `oldUrl` no mapeamento
- Substituir `atob(base64)` por conversao chunked: iterar o base64 em blocos, decodificar cada bloco separadamente
- Adicionar contador de falhas e log de erros

### Funcao `importBackup` - Mudancas

- Passar `backup.source_url` para `uploadMedia`
- Coletar resultado de falhas e propagar ao caller

### Funcao `blobToDataUrl` - Sera substituida

- Removida em favor da nova funcao `arrayBufferToBase64` que nao depende de `FileReader`

