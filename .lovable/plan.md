

## Problema: Reativacao de campanha dispara tudo de uma vez

Quando uma campanha e reativada, os `scheduled_messages` vinculados ainda tem `next_run_at` no passado. O `claim_due_messages` pega tudo que esta dentro da janela de 2 horas, e os que estao alem disso ficam com `next_run_at` antigo que sera capturado assim que o cron rodar.

### Solucao

Quando o usuario ativar uma campanha, recalcular o `next_run_at` de todas as mensagens agendadas dessa campanha para a proxima execucao futura.

**Arquivo: `src/pages/Campaigns.tsx`** (toggleMutation)

Ao ativar (`is_active = true`), apos atualizar a campanha, buscar todos os `scheduled_messages` da campanha com `schedule_type != 'once'` e atualizar o `next_run_at` para o proximo horario futuro valido:

```typescript
const toggleMutation = useMutation({
  mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
    const { error } = await supabase.from("campaigns").update({ is_active }).eq("id", id);
    if (error) throw error;

    if (is_active) {
      // Recalcular next_run_at para evitar disparo em massa
      const { data: msgs } = await supabase
        .from("scheduled_messages")
        .select("id, content, schedule_type")
        .eq("campaign_id", id)
        .eq("is_active", true)
        .neq("schedule_type", "once");

      if (msgs?.length) {
        const now = new Date();
        for (const msg of msgs) {
          const nextRun = calculateNextFutureRun(msg, now);
          if (nextRun) {
            await supabase.from("scheduled_messages")
              .update({ next_run_at: nextRun, processing_started_at: null })
              .eq("id", msg.id);
          }
        }
      }
    }
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
});
```

A funcao `calculateNextFutureRun` sera uma versao client-side da mesma logica `calculateNextRunAt` que ja existe na edge function, adaptada para calcular o proximo horario futuro baseado no `schedule_type` e no conteudo (`runTime`, `weekDays`, `monthDay`, `customDays`).

### Resumo
| Arquivo | Mudanca |
|---|---|
| `src/pages/Campaigns.tsx` | Ao ativar campanha, recalcular `next_run_at` de todos os agendamentos para o proximo horario futuro |

Uma unica alteracao no frontend que impede o acumulo de execucoes antigas ao reativar uma campanha.

