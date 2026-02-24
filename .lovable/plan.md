

## Ocultar URLs e manter apenas botao de copiar

### Problema

As URLs longas continuam saindo do container. O usuario nao precisa ver as URLs — apenas precisa copiar.

### Solucao

**Arquivo:** `src/components/campaigns/CampaignLeadsDialog.tsx` (linhas 373-399)

Substituir os blocos de URL por versoes compactas sem exibir a URL. Apenas o label e o botao de copiar:

```tsx
{publicUrl && (
  <div className="space-y-2">
    <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="text-sm text-foreground">URL de Redirecionamento</p>
      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={copyUrl}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
    <div className="flex items-center justify-between rounded-lg border border-muted bg-muted/30 p-3">
      <p className="text-sm text-foreground">URL de Retorno (Texto)</p>
      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => {
        const getUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-link-api?slug=${slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
        navigator.clipboard.writeText(getUrl);
        toast({ title: "URL copiada!" });
      }}>
        <Copy className="h-3.5 w-3.5" />
        Copiar
      </Button>
    </div>
  </div>
)}
```

Isso remove completamente a exibicao da URL e mantem apenas o label descritivo e o botao de copiar, eliminando qualquer problema de overflow.

