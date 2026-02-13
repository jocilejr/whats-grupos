

# Preview de Mensagem estilo WhatsApp

## Objetivo
Criar um componente de preview em tempo real que simula a aparencia de um balao de mensagem do WhatsApp, atualizado conforme o usuario digita/edita o conteudo.

## Onde sera exibido
- **ScheduledMessageForm** (dialog de agendamento nas campanhas) - ao lado ou abaixo dos campos de composicao
- **Messages.tsx** (envio manual) - no card de conteudo, ao lado dos campos

## Componente: `WhatsAppPreview`

Um componente reutilizavel que recebe as props do conteudo e renderiza o balao correspondente ao tipo de mensagem.

### Visual
- Fundo simulando o wallpaper padrao do WhatsApp (padrao escuro com textura sutil)
- Balao verde (outgoing) no canto direito, com sombra leve
- Hora ficticia no canto inferior direito do balao (ex: "12:00")
- Icone de check duplo azul
- Cantos arredondados no estilo WhatsApp
- Responsivo: no dialog de agendamento, aparece abaixo dos campos de composicao

### Tipos renderizados

| Tipo | Renderizacao no balao |
|------|----------------------|
| text | Texto com quebras de linha preservadas |
| ai | Placeholder com icone de sparkles: "Texto gerado pela I.A." |
| image | Thumbnail da imagem + legenda abaixo |
| video | Thumbnail com icone de play + legenda |
| document | Icone de documento + nome do arquivo + legenda |
| audio | Barra de audio estilizada (waveform fake) |
| sticker | Imagem sem balao (fundo transparente) |
| location | Mini mapa placeholder com nome/endereco |
| contact | Card de contato com nome e telefone |
| poll | Pergunta + opcoes como botoes |
| list | Titulo + descricao + botao "Ver opcoes" |

### Props do componente

```text
WhatsAppPreview {
  messageType: string
  textContent?: string
  mediaUrl?: string
  caption?: string
  locName?: string
  locAddress?: string
  locLat?: string
  locLng?: string
  contactName?: string
  contactPhone?: string
  pollName?: string
  pollOptions?: string[]
  listTitle?: string
  listDescription?: string
  listButtonText?: string
  listFooter?: string
  listSections?: array
  mentionAll?: boolean
  aiPrompt?: string
}
```

## Detalhes Tecnicos

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/WhatsAppPreview.tsx` | **Criar** - componente reutilizavel |
| `src/components/campaigns/ScheduledMessageForm.tsx` | **Editar** - adicionar preview abaixo da area de composicao |
| `src/pages/Messages.tsx` | **Editar** - adicionar preview no card de conteudo |

### Estilizacao (Tailwind puro, sem CSS extra)

- Fundo do container: `bg-[#0b141a]` (wallpaper escuro do WhatsApp)
- Padrao de textura: pseudo-elemento com opacidade ou gradiente sutil
- Balao outgoing: `bg-[#005c4b]` com `rounded-lg` e cauda usando CSS
- Texto: `text-[#e9edef]` (branco suave do WhatsApp)
- Hora/checks: `text-[#ffffff99]` com tamanho `text-[10px]`
- Legenda de midia: mesma cor do texto, abaixo da midia
- Estado vazio: texto placeholder centralizado "Compose uma mensagem para ver o preview"

### Integracao no ScheduledMessageForm

O dialog atual tem `max-w-2xl`. O preview sera adicionado dentro da aba "compose", abaixo dos campos de conteudo e acima das opcoes de envio, como um card com label "Preview".

### Integracao no Messages.tsx

O preview sera adicionado dentro do card "Conteudo", apos os campos de input, como uma secao colapsavel ou sempre visivel.

### Responsividade

- Em telas menores, o preview aparece abaixo dos campos (full width)
- O balao mantem proporcoes realistas (max-width ~320px dentro do container)

