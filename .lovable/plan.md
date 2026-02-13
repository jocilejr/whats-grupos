
## Plano: Aba "Avancado" com agendamento personalizado via Cron

### Objetivo
Adicionar uma quinta aba "Avancado" no dialogo de mensagens da campanha, permitindo criar agendamentos personalizados como "Dia 1 e dia 16 de cada mes" ou qualquer combinacao de dias/horarios.

### Como funciona para o usuario
- Nova aba "Avancado" com icone de engrenagem ao lado das abas existentes (Unico, Diario, Semanal, Mensal)
- No formulario de agendamento, o usuario seleciona visualmente os dias do mes (1-31) clicando nos numeros desejados
- Define o horario de envio
- Exemplo: seleciona dias 1 e 16, horario 08:00 = mensagem enviada no dia 1 e 16 de cada mes as 08:00

### Mudancas tecnicas

#### 1. CampaignMessagesDialog.tsx
- Adicionar nova aba "Avancado" (value="custom") com icone `Settings2` ou `Cog`
- Listar mensagens com `schedule_type="custom"`
- Botao "Adicionar Mensagem" igual as outras abas

#### 2. ScheduledMessageForm.tsx
- Novo estado `customDays: number[]` para dias do mes selecionados (ex: [1, 16])
- Quando `scheduleType === "custom"`, exibir grid clicavel com numeros 1-31 (similar ao grid de dias da semana no weekly)
- Campo de horario (`runTime`)
- No `buildContent()`, salvar `customDays` e `runTime` no content
- No `computeNextRunAt()`, calcular proximo dia valido baseado nos `customDays`
- Validacao: ao menos 1 dia selecionado

#### 3. CampaignMessageList.tsx
- Exibir pills dos dias selecionados para mensagens do tipo "custom" (similar aos dias da semana no weekly)
- Na aba de programacao expandida, mostrar os dias selecionados

#### 4. Edge Function (send-scheduled-messages)
- Na funcao `calculateNextRunAt`, adicionar logica para `schedule_type === "custom"`:
  - Ler `content.customDays` (array de numeros)
  - Encontrar o proximo dia do mes que esta na lista
  - Se nenhum dia restante no mes atual, ir para o primeiro dia valido do proximo mes

### Detalhes de implementacao

**Grid de dias do mes (ScheduledMessageForm):**
```text
 1   2   3   4   5   6   7
 8   9  10  11  12  13  14
15  16  17  18  19  20  21
22  23  24  25  26  27  28
29  30  31
```
Cada numero e clicavel e fica destacado quando selecionado (estilo igual aos botoes de dia da semana).

**Calculo do proximo envio (computeNextRunAt para "custom"):**
- Ordenar os `customDays`
- A partir da data atual, encontrar o proximo dia valido no mes atual ou no proximo mes
- Aplicar o horario configurado

**Arquivos modificados:**
- `src/components/campaigns/CampaignMessagesDialog.tsx` - nova aba "Avancado"
- `src/components/campaigns/ScheduledMessageForm.tsx` - grid de dias + logica de calculo
- `src/components/campaigns/CampaignMessageList.tsx` - exibicao dos dias customizados
- `supabase/functions/send-scheduled-messages/index.ts` - calculateNextRunAt para custom

**Sem migracao necessaria:** A tabela `scheduled_messages` ja possui o campo `schedule_type` (text) que aceita qualquer valor, e os dias personalizados sao armazenados no JSON do campo `content`.
