
# Correção direta: QR Code não gera em nenhuma instância

## Diagnóstico do código atual

Analisando o `baileys-server/server.js`, identifiquei **3 problemas concretos** que impedem a geração de QR Code:

### Problema 1: Auto-reconnect cria loop infinito
Linhas 220-225 — quando ocorre um disconnect NÃO-terminal (ex: timeout de rede), o servidor automaticamente tenta reconectar após 3s. Isso cria um ciclo que acumula tentativas e bloqueia o IP no WhatsApp:
```javascript
if (shouldReconnect) {
  setTimeout(() => {
    sessions.delete(instanceName);
    createSession(instanceName).catch(console.error); // LOOP!
  }, 3000);
}
```

### Problema 2: Race condition na geração de QR
O `_doCreateSession` abre o WebSocket e retorna. O endpoint `/instance/connect` faz polling por 15s esperando o QR. Mas se o WhatsApp responde com 405 antes do QR chegar, a `connection.update` callback deleta a sessão do Map, e o polling detecta `session_expired` — o QR nunca chega ao frontend.

### Problema 3: Sessões residuais no disco
O `/instance/create` cria o diretório vazio. Se houve uma tentativa anterior que falhou, podem existir arquivos de auth corrompidos no disco (mesmo após o cleanup do 405), causando rejeição imediata pelo WhatsApp em vez de gerar QR novo.

## Correções (apenas `baileys-server/server.js`)

### A. Remover completamente o auto-reconnect
Substituir o `setTimeout → createSession` por apenas limpar a sessão e logar. O usuário reconecta manualmente quando quiser.

### B. Limpar sessões residuais no startup
No boot do servidor, remover TODOS os diretórios de sessão existentes. Isso garante que toda conexão começa do zero, sem credenciais antigas que causam 405.

### C. Garantir limpeza antes de cada createSession
Antes de chamar `useMultiFileAuthState`, deletar o diretório de sessão se existir, forçando geração de novas chaves e QR Code limpo.

### D. Reduzir cooldown para 10s
O cooldown de 60s é excessivo para novas instâncias. Reduzir para 10s permite tentar novamente mais rápido após uma falha transitória.

```text
Fluxo corrigido:
  Startup → limpa TODAS as sessões do disco → servidor pronto
  Connect → deleta dir antigo → useMultiFileAuthState (fresh) → WebSocket → QR
  Disconnect terminal → limpa sessão + dir, cooldown 10s
  Disconnect não-terminal → limpa sessão, NÃO reconecta automaticamente
```

## Arquivos alterados
- `baileys-server/server.js` — todas as 4 correções acima
