

# Backup Completo para VPS - Sem Dependencia do Lovable Cloud

## Objetivo

Atualmente o backup exporta dados e midias usando a Edge Function `backup-export` do Lovable Cloud, e a restauracao faz upload de volta para o Storage do Lovable Cloud. O objetivo e tornar o sistema 100% autonomo na VPS, sem depender do Lovable Cloud para armazenamento de arquivos.

## Mudancas Necessarias

### 1. Exportacao de Midias - Direto pelo Storage URL (sem Edge Function)

Atualmente o `backup.ts` usa `supabase.functions.invoke("backup-export")` para baixar cada midia. Vamos mudar para baixar diretamente via `fetch()` da URL publica do Storage (que ja funciona tanto no Lovable Cloud quanto na VPS com Supabase self-hosted).

**Arquivo: `src/lib/backup.ts`**
- Substituir a chamada `supabase.functions.invoke("backup-export")` por um `fetch()` direto na URL publica da midia
- Converter o blob baixado para data URL (base64) no proprio frontend
- Isso elimina a dependencia da Edge Function `backup-export`

### 2. Restauracao de Midias - Upload para o Storage da VPS

A restauracao ja faz upload para o Storage via `supabase.storage.from("media").upload()`. Isso funciona automaticamente apontando para o Supabase da VPS desde que o `VITE_SUPABASE_URL` esteja configurado corretamente no `.env` da VPS.

Nenhuma mudanca necessaria aqui - ja funciona para qualquer Supabase (Cloud ou self-hosted).

### 3. Reescrita de URLs durante Restauracao

Adicionar logica para detectar e substituir URLs de midia do servidor de origem (ex: Lovable Cloud) pelas URLs do servidor de destino (VPS). Atualmente o `replaceUrls` so mapeia URLs de midias re-uploadadas. Vamos garantir que TODAS as URLs de midia nos registros apontem para o novo servidor.

**Arquivo: `src/lib/backup.ts`**
- Na funcao `importBackup`, alem do mapa de URLs das midias re-uploadadas, tambem substituir o dominio base de todas as URLs de midia que referenciem o servidor de origem (salvo no backup) pelo `VITE_SUPABASE_URL` atual

### 4. Salvar URL de Origem no Backup

**Arquivo: `src/lib/backup.ts`**
- Adicionar campo `source_url` no `BackupFile` com o valor de `VITE_SUPABASE_URL` no momento da exportacao
- Na restauracao, usar esse campo para fazer a substituicao de dominio automaticamente

---

## Detalhes Tecnicos

### Arquivo: `src/lib/backup.ts`

**Interface BackupFile** - Adicionar campo:
```typescript
source_url: string; // VITE_SUPABASE_URL de onde o backup foi gerado
```

**Funcao `exportBackup`** - Substituir download via Edge Function:
```typescript
// ANTES: supabase.functions.invoke("backup-export", { body: { media_path } })
// DEPOIS: fetch direto da URL publica
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publicUrl = `${supabaseUrl}/storage/v1/object/public/media/${mediaPaths[i]}`;
const resp = await fetch(publicUrl);
const blob = await resp.blob();
// converter blob para data URL base64
```

**Funcao `importBackup`** - Adicionar substituicao de dominio:
```typescript
// Apos upload das midias, substituir tambem o dominio base
const sourceUrl = backup.source_url;
const targetUrl = import.meta.env.VITE_SUPABASE_URL;
// Em replaceUrls, tambem trocar sourceUrl por targetUrl em todas as strings
```

**Funcao `replaceUrls`** - Expandir para aceitar tambem substituicao de dominio:
```typescript
// Alem do urlMap existente, fazer string.replace do dominio de origem pelo destino
```

### Arquivo: `supabase/functions/backup-export/index.ts`

Nenhuma mudanca - a Edge Function continua existindo para compatibilidade, mas nao sera mais chamada pelo novo codigo.

---

## Resumo do Fluxo

### Exportacao (de qualquer servidor)
1. Buscar todos os dados das tabelas
2. Identificar URLs de midia nos registros
3. Baixar cada midia diretamente pela URL publica (sem Edge Function)
4. Salvar tudo no JSON incluindo o `source_url`

### Restauracao (na VPS de destino)
1. Fazer upload de cada midia para o Storage do servidor de destino
2. Construir mapa de URLs antigas para novas
3. Substituir o dominio de origem pelo de destino em todas as URLs
4. Inserir todos os registros com URLs atualizadas

