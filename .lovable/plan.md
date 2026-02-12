

# Remover instalacao do Supabase CLI

## Problema

O Supabase CLI nao suporta mais instalacao global via `npm install -g supabase@latest`. O comando falha com erro.

## Solucao

Remover completamente o bloco que tenta instalar o Supabase CLI (linhas 296-300 do `install.sh`), pois ele nao e utilizado. O deploy das edge functions ja e feito copiando os arquivos diretamente para o volume do Docker e reiniciando o container -- o CLI nao participa desse processo.

## Detalhe tecnico

Remover estas linhas do `install.sh`:

```text
# Instalar Supabase CLI se necessario
if ! command -v supabase &>/dev/null; then
  log_info "Instalando Supabase CLI..."
  npm install -g supabase@latest
fi
```

O restante do bloco (copiar funcoes para o volume e reiniciar o container) permanece inalterado.

