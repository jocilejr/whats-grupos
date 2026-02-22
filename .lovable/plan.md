
# Polling Automático de Status das Instâncias

## O que será feito

Adicionar verificação automática (polling) do status de conexão de cada instância WhatsApp na página de Configurações. Assim, ao abrir a página, o status será consultado imediatamente e atualizado a cada 15 segundos, sem necessidade de clicar no botão "Status" manualmente.

## Comportamento

- Ao carregar a lista de instâncias, o sistema consulta o status de todas automaticamente
- A cada 15 segundos, o status é atualizado em segundo plano (sem toasts/notificações)
- O polling para quando o usuário sai da página
- O botão manual "Status" continua funcionando normalmente

## Detalhes técnicos

**Arquivo:** `src/pages/SettingsPage.tsx`

1. Adicionar um `useEffect` que dispara quando `configs` muda (lista de instâncias carregada)
2. Criar uma função `pollAllStatuses` que chama `connectionState` para cada config via `callEvolutionApi` e atualiza o state `connectionStates`
3. Usar `setInterval` de 15 segundos dentro do efeito, com cleanup no return
4. Executar imediatamente na montagem (polling inicial)
5. Usar `useRef` para controlar se o componente ainda está montado, evitando updates em componente desmontado
