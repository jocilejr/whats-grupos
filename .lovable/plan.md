
# Completar Funcionalidade de Monitoramento de Grupos

## Problema

A pagina de Grupos esta incompleta:
- O seletor de instancia so aparece quando ja existem dados (`instances` vem dos `todayStats`, que esta vazio)
- O botao "Sincronizar Agora" nao envia qual instancia sincronizar
- Nao ha feedback quando nenhuma instancia esta configurada
- O usuario nao consegue iniciar o fluxo porque nao ha como selecionar a instancia antes da primeira sincronizacao

## Solucao

### 1. Carregar instancias disponiveis da tabela `api_configs`

Adicionar uma query separada para buscar as instancias ativas do usuario diretamente da tabela `api_configs` (independente de ja ter dados em `group_stats`).

### 2. Mostrar seletor de instancia SEMPRE

O seletor de instancia deve aparecer sempre que o usuario tiver instancias configuradas, nao apenas quando ja existem dados sincronizados.

### 3. Enviar `configId` na sincronizacao

Quando o usuario clicar em "Sincronizar Agora", enviar o `configId` selecionado para a Edge Function, que ja suporta esse parametro no body.

### 4. Estado vazio informativo

Quando nao houver nenhuma instancia configurada, mostrar mensagem direcionando o usuario para a pagina de Configuracoes.

## Detalhes Tecnicos

### Arquivo: `src/pages/GroupsPage.tsx`

Mudancas:

1. **Nova query para instancias**: Buscar `api_configs` do usuario com `is_active = true`
2. **State `selectedInstance`**: Controlar qual instancia esta selecionada (default: primeira instancia ou "all")
3. **Seletor sempre visivel**: Renderizar o `Select` baseado nas configs, nao nos stats
4. **Passar configId no sync**: Enviar `{ configId }` no body da chamada `supabase.functions.invoke`
5. **Estado vazio**: Se nao houver configs, mostrar card com botao "Ir para Configuracoes"
6. **Filtrar dados por instancia selecionada**: Usar `selectedInstance` tanto para filtrar a tabela quanto para o sync

### Fluxo atualizado

```text
Usuario abre /groups
  |
  v
Carrega api_configs ativas do usuario
  |
  +-- Sem instancias? --> Mostra "Configure uma instancia em Configuracoes"
  |
  +-- Com instancias --> Mostra seletor de instancia + botao Sincronizar
        |
        v
  Usuario seleciona instancia e clica Sincronizar
        |
        v
  Edge Function busca grupos do Baileys para aquela instancia
        |
        v
  Dados aparecem na tabela e graficos
```

### Edge Function `sync-group-stats`

Nenhuma mudanca necessaria -- ja suporta receber `configId` no body do POST e filtrar por ele.
