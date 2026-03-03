

## Diagnóstico: Race Condition na Criação de Sessão

### O que está acontecendo

Os logs mostram claramente o ciclo:
1. `createSession("Rosana")` cria um WASocket
2. Socket entra em `connecting`, mas recebe `close` com status 405 em ~2-4 segundos (antes do QR ser gerado)
3. O close handler limpa os arquivos e remove da memória
4. Mas enquanto isso, a UI/edge function faz **múltiplas chamadas concorrentes** que criam novos sockets antes do anterior terminar
5. Cada novo socket encontra o mesmo problema — 405 antes do QR

O problema fundamental: **não há mutex/lock por instância**. Múltiplas chamadas de `createSession("Rosana")` rodam ao mesmo tempo, criando sockets concorrentes que competem entre si e com WhatsApp, resultando em 405 repetido.

Além disso, o endpoint `/instance/connect` chama `createSession` e depois faz polling de 15s no objeto `session`, mas o close handler já removeu esse session do Map e deletou os arquivos. O polling continua verificando um objeto "morto".

### Plano de Correção

**`baileys-server/server.js`** — 3 mudanças:

1. **Adicionar lock por instância**: Um `Map<string, Promise>` que impede chamadas concorrentes de `createSession` para o mesmo nome. Se já existe uma criação em andamento, aguarda ela terminar.

2. **Adicionar cooldown após 405**: Quando receber 405, registrar um timestamp. Na próxima tentativa de criar sessão, esperar pelo menos 5 segundos desde o último 405 antes de criar novo socket. Isso evita flood de conexões que o WhatsApp rejeita.

3. **Endpoint `/instance/connect` deve detectar sessão morta**: Durante o polling, verificar se a session ainda existe no Map. Se foi removida (por 405), parar o polling e retornar um erro claro em vez de `state: connecting`.

```text
Mudanças em server.js:

+ const sessionLocks = new Map();     // mutex por instância
+ const sessionCooldowns = new Map(); // timestamp do último 405

  createSession():
    - Checar se já existe lock ativo → aguardar
    - Checar cooldown → aguardar se < 5s desde último 405
    - Criar lock antes de iniciar, liberar quando socket emitir QR ou close

  connection.update (close com 405):
    - Registrar cooldown: sessionCooldowns.set(name, Date.now())
    - Fechar socket com sock.end() antes de deletar sessão

  /instance/connect:
    - No polling, checar sessions.has(name) a cada iteração
    - Se session sumiu do Map, retornar { error: "session_expired", message: "Sessão invalidada. Tente novamente em alguns segundos." }

  /instance/create:
    - Mesmo tratamento de lock/cooldown
```

Após deploy, o comportamento será:
- Primeira tentativa: cria socket, se receber 405, limpa e registra cooldown
- Segunda tentativa (dentro de 5s): aguarda cooldown, depois cria socket limpo
- Sem chamadas concorrentes competindo
- UI recebe erro claro em vez de timeout silencioso

