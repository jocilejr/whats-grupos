

## Diagnóstico: Instabilidade de Conexão (502 Bad Gateway)

### Problema Identificado

A captura de tela mostra erros **502 (Bad Gateway)** no console, o que significa que o container do Baileys Server está caindo/reiniciando. Isso é quase certamente causado pela atualização recente para `@whiskeysockets/baileys@7.0.0-rc.9`, que é uma **Release Candidate** com breaking changes em relação à v6.

Na v7, a API do Baileys mudou significativamente:
- `fetchLatestBaileysVersion` pode não existir mais ou ter assinatura diferente
- `makeCacheableSignalKeyStore` pode ter sido removido/renomeado  
- A estrutura de exports mudou (o server.js usa `require` com destructuring que pode falhar)

Quando o container crasha, o polling de status retorna "desconhecido" (502). Quando ele reinicia brevemente, funciona por um momento antes de crashar novamente - explicando o comportamento intermitente.

### Plano: Estabilizar o Baileys Server

**1. `baileys-server/server.js`** - Tornar os imports resilientes à v7:
- Envolver os imports em try/catch com fallbacks
- Remover dependência de `fetchLatestBaileysVersion` (usar versão fixa ou detectar automaticamente)
- Usar `makeCacheableSignalKeyStore` apenas se disponível, senão usar `state.keys` diretamente
- Adicionar log de erro claro na inicialização para diagnóstico

**2. `baileys-server/package.json`** - Alternativa segura:
- Se a v7 RC continuar instável, reverter para `"@whiskeysockets/baileys": "^6.7.16"` que é a versão estável comprovada
- Ou fixar em `"6.7.16"` (sem `^`) para máxima estabilidade

### Recomendação

A abordagem mais segura é **reverter para a v6 estável** (`6.7.16`) até que a v7 saia do estágio RC. A v7.0.0-rc.9 tem breaking changes documentados e não é recomendada para produção.

### Mudanças Concretas

1. **`baileys-server/package.json`**: Reverter `@whiskeysockets/baileys` para `"6.7.16"` (versão exata, sem `^`)
2. **`baileys-server/server.js`**: Manter o endpoint `/health` com retorno de versão (já implementado)
3. **Pós-deploy**: Rebuild do container na VPS com `sudo ./scripts/deploy.sh`

