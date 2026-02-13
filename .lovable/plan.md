
# Plano de Correção: Bugs 1, 2, 3, 5, 6, 7

## Resumo
Corrigir 6 bugs críticos e médios na função `send-scheduled-messages/index.ts` para garantir que:
1. Envios manuais parem no primeiro erro (não continuem iterando)
2. Envios manuais não verifiquem duplicatas (permitam reset completo)
3. Envios manuais marquem como concluído **apenas** se sem erros
4. O cálculo de próximo agendamento respeite o timezone do servidor (UTC)
5. Envios automáticos (cron) verifiquem duplicatas para proteger contra timeouts
6. Remover campo `sent_group_index` obsoleto

## Detalhes das Mudanças

### Bug 1: Manual não para em erro
**Localização:** `processManualMessage`, linhas 187-272

**Problema:** Loop continua iterando mesmo com erro. Incrementa `errors` e prossegue.

**Solução:** Adicionar `break` após registrar o erro, saindo do loop imediatamente.

```
Depois de linha 255 (else errors++;) ou 260 (errors++;):
→ Adicionar: break;
```

### Bug 2: Manual verifica duplicatas desnecessariamente
**Localização:** `processManualMessage`, linhas 180-203

**Problema:** Verificação `triggerTime` e query `message_logs` impedem reset manual completo.

**Solução:** Remover:
- Linha 181: `const triggerTime = new Date().toISOString();`
- Linhas 190-203: Todo o bloco de verificação de duplicata
- Remover também o console.log que alerta grupo já enviado (linha 200)

### Bug 3: Manual marca concluído mesmo com erros
**Localização:** Manual trigger response, linhas 65-78

**Problema:** Sempre atualiza `last_completed_at` independente de erros.

**Solução:** 
- Modificar a lógica: só finalizar se `errors === 0`
- Se houver erros, apenas liberar o lock (executar `releaseLock`)

**Implementação:**
```
if (errors === 0) {
  // Atualizar last_run_at, last_completed_at, etc
} else {
  // Apenas liberar lock
  await releaseLock(supabase, manualMessageId);
}
```

### Bug 5: Timezone UTC no calculateNextRunAt
**Localização:** `calculateNextRunAt`, linhas 433-470

**Problema:** Usa `new Date()` (UTC) para `setHours`, mas Deno roda em UTC puro.

**Solução:** 
- Este é um bug baixo porque depende da configuração da máquina.
- Deixar como está por agora, pois o Deno/Supabase roda em UTC.
- Se no futuro precisar suportar timezones do usuário, adicionar parâmetro `timezoneOffset`.
- **Documentar:** Todos os horários são em UTC (não Brasil local).

### Bug 6: Reintroduzir verificação de duplicata no cron (processMessage)
**Localização:** `processMessage`, linhas 336-412

**Problema:** Sem verificação, timeout + retry causa reenvio completo.

**Solução:**
- Antes do loop (linha 332), capturar `const processingStartedAt = msg.processing_started_at;`
- Dentro do loop (após linha 337), antes de enviar, verificar se grupo já foi enviado nesta execução
- Pular o grupo se já foi enviado com sucesso

**Implementação:**
```typescript
for (let i = 0; i < allGroupIds.length; i++) {
  const groupId = allGroupIds[i];
  
  // Per-group duplicate check: skip if already sent successfully in this execution
  const { count: alreadySent } = await supabase
    .from("message_logs")
    .select("*", { count: "exact", head: true })
    .eq("scheduled_message_id", msg.id)
    .eq("group_id", groupId)
    .eq("status", "sent")
    .gte("created_at", processingStartedAt);

  if ((alreadySent || 0) > 0) {
    console.log(`Message ${msg.id}: group ${groupId} already sent in this execution, skipping`);
    totalProcessed++;
    continue;
  }
  
  // Continuar com envio...
}
```

### Bug 7: Remover `sent_group_index`
**Localização:** Múltiplas linhas (70, 76, 420, 426)

**Problema:** Campo não é mais utilizado em nenhuma lógica.

**Solução:** Remover as 4 ocorrências de `sent_group_index: 0,` dos updates:
- Linha 70 (update manual once)
- Linha 76 (update manual recorrente)
- Linha 420 (update automático once)
- Linha 426 (update automático recorrente)

## Ordem de Implementação

1. **Bug 7** (mais simples): Remover `sent_group_index`
2. **Bug 2**: Remover verificação de duplicata manual
3. **Bug 1**: Adicionar `break` no manual
4. **Bug 3**: Condicionar finalização manual a `errors === 0`
5. **Bug 6**: Reintroduzir check de duplicata no cron
6. **Bug 5**: Documentar timezone (sem mudança de código)

## Arquivos Modificados
- `supabase/functions/send-scheduled-messages/index.ts`

## Validação
Após as mudanças:
- ✅ Manual sem erro: marca como concluído
- ✅ Manual com erro: libera lock, sem marcar concluído
- ✅ Manual re-trigger: reprocessa todos os grupos (sem check)
- ✅ Cron com timeout: resume dos grupos não enviados (com check)
- ✅ Sem `sent_group_index` nos updates

