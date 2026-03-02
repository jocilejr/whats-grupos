

## Plano: Adicionar busca por palavra-chave nas mensagens da campanha

### O que será feito

Adicionar um campo de busca no diálogo de mensagens da campanha (`CampaignMessagesDialog`) que filtra as programações pelo conteúdo de texto (texto, legenda, nome de enquete, título de lista, nome de contato, etc.).

### Implementação

**Arquivo: `src/components/campaigns/CampaignMessagesDialog.tsx`**
- Adicionar um estado `searchQuery` (string)
- Inserir um `Input` com ícone de `Search` entre os tabs e o subheader de cada aba
- Passar `searchQuery` como prop para `CampaignMessageList`

**Arquivo: `src/components/campaigns/CampaignMessageList.tsx`**
- Adicionar prop `searchQuery?: string` na interface
- Após o filtro de `weekdayFilter` (linha ~145), aplicar um segundo filtro que verifica se o texto do conteúdo (text, caption, pollName, listTitle, contactName, fileName, name, address) contém a query (case-insensitive)
- Atualizar a mensagem de "nenhuma mensagem" para indicar quando é resultado do filtro de busca

### Localização do campo de busca

O campo ficará fixo acima da lista de mensagens, dentro de cada `TabsContent`, ao lado do botão "Adicionar Mensagem" ou logo abaixo dele. Será um input compacto com ícone de lupa e placeholder "Buscar por conteúdo...".

### Detalhes técnicos

- O filtro é client-side sobre os dados já carregados (sem chamada extra ao banco)
- A busca usa `toLowerCase().includes()` sobre os campos de texto do `content` JSON
- O estado de busca é compartilhado entre todas as abas (um único input no topo, fora dos tabs, ou resetado ao trocar de aba — manteremos compartilhado para UX mais fluida)

