

## Simplificar exibicao das URLs no Smart Link

### Problema

As URLs longas estao saindo do container mesmo com `overflow-hidden`. O usuario nao precisa ver a URL completa — apenas precisa do botao de copiar.

### Solucao

Redesenhar os dois blocos de URL para mostrar apenas o label, uma versao curta/truncada da URL, e o botao de copiar. Usar `max-w-0` + `overflow-hidden` no container de texto com flex para garantir que o texto nunca force o layout.

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx` (linhas 374-399)

Substituir os dois blocos de URL por um layout compacto:

```tsx
{/* URL de Redirecionamento */}
<div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
  <div className="flex-1 min-w-0 overflow-hidden">
    <p className="text-xs text-muted-foreground mb-0.5">URL de Redirecionamento</p>
    <code className="text-sm block text-foreground truncate">{publicUrl}</code>
  </div>
  <Button ...>Copiar</Button>
</div>

{/* URL de Retorno */}
<div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 p-3">
  <div className="flex-1 min-w-0 overflow-hidden">
    <p className="text-xs text-muted-foreground mb-0.5">URL de Retorno (Texto)</p>
    <code className="text-sm block text-foreground truncate">{getUrl}</code>
  </div>
  <Button ...>Copiar</Button>
</div>
```

A chave e garantir que o `div` pai do texto tenha `min-w-0 overflow-hidden` (ambos), e o `code` tenha `truncate` (que inclui `overflow-hidden`, `text-overflow: ellipsis`, `white-space: nowrap`). O `min-w-0` e essencial em flex children para permitir que o elemento encolha abaixo do tamanho do conteudo.

