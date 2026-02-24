

## Adicionar coluna "URL" na tabela de Leads

A tabela na aba de Leads atualmente mostra #, Grupo, Membros, Cliques, Entradas e Status do Link, mas nao exibe a URL de convite do grupo. A alteracao vai adicionar uma coluna "URL" que mostra a invite_url de cada grupo.

### Alteracao

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx`

1. Adicionar uma nova coluna "URL" no `TableHeader` entre "Entradas" e "Status do Link"
2. Adicionar a `TableCell` correspondente no body da tabela
3. A URL sera exibida de forma truncada (text-xs, truncate) com um botao pequeno para copiar
4. Se nao houver URL, mostrar um texto "—" cinza

### Detalhes tecnicos

- A variavel `inviteUrl` ja existe na linha 421 do componente, basta exibi-la
- A coluna tera largura fixa (`w-44`) com overflow truncado para nao quebrar o layout
- Um botao de copiar inline ao lado da URL permitira copiar rapidamente
- Sem alteracao de banco de dados — os dados ja estao disponiveis via `group_stats.invite_url`

