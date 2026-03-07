

## Diagnóstico: Bug de Timezone no Agendamento "Uma vez"

### Causa raiz

No `computeNextRunAt()` (linha 213-218) e no `handleSave` (linha 318), o código faz:

```javascript
const d = new Date(scheduledDate);       // midnight LOCAL time
d.setUTCHours(h + BRT_OFFSET, m, 0, 0); // sets UTC hours but keeps UTC DATE from local midnight
```

O problema: `new Date(scheduledDate)` cria a data à meia-noite no fuso do **navegador**. Se o fuso do navegador for diferente de BRT, o componente UTC da data pode ser o dia anterior. Exemplo: se o preview do Lovable roda em UTC+0 ou se o browser tem timezone diferente, a conversão pode deslocar o dia.

Mesmo em BRT, há um caso sutil: o react-day-picker retorna a data como `Date` local. Ao copiar com `new Date(scheduledDate)` e depois chamar `setUTCHours`, o **dia UTC** já está definido pela conversão implícita do construtor, podendo causar shift de 1 dia.

### Correção

**`src/components/campaigns/ScheduledMessageForm.tsx`** — Em 2 pontos, extrair ano/mês/dia explicitamente do `scheduledDate` local e construir a data UTC diretamente:

1. **`computeNextRunAt()`** (linha ~216-218): Substituir por:
```javascript
const d = new Date(Date.UTC(
  scheduledDate.getFullYear(),
  scheduledDate.getMonth(),
  scheduledDate.getDate(),
  h + BRT_OFFSET, m, 0, 0
));
return d.toISOString();
```

2. **`handleSave` → `scheduledAtValue`** (linha ~318): Mesma correção:
```javascript
const d = new Date(Date.UTC(
  scheduledDate.getFullYear(),
  scheduledDate.getMonth(),
  scheduledDate.getDate(),
  h + BRT_OFFSET, m, 0, 0
));
return d.toISOString();
```

Isso garante que o dia selecionado no calendário é preservado independente do timezone do navegador.

