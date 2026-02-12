

## Remover referências ao lovable-tagger

### Alterações

1. **`package.json`** (linha 82): Remover `"lovable-tagger": "^1.1.13"` das devDependencies.

2. **`vite.config.ts`**: Remover o import `import { componentTagger } from "lovable-tagger"` e a chamada `mode === "development" && componentTagger()` do array de plugins, mantendo apenas `[react()]`.

3. **`index.html`**: Nenhuma alteração necessária -- o script `gptengineer.js` e a meta tag `lovable-tagger` nao existem neste arquivo.

