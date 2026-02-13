

# Ajuste na Logica de Erro da Fila

## Mudanca

Quando um item da fila falhar, o comportamento sera:

- Marca aquele item especifico como `status = 'error'`
- **Continua** processando os proximos itens da fila normalmente
- A fila nunca para por causa de um erro individual

## Comparacao

| Comportamento | Antes (plano anterior) | Agora |
|---------------|----------------------|-------|
| Erro no grupo 3 de 15 | Para tudo, grupos 4-15 ficam pendentes | Marca grupo 3 como erro, continua grupos 4-15 |
| Visibilidade | Usuario precisa reenviar manualmente | Usuario ve quais grupos falharam e pode reenviar so esses |

## Impacto no `process-queue`

Dentro do loop de consumo da fila, ao receber erro da API:

```text
Pega item (pending)
  -> Marca "sending"
  -> Envia via API
     -> Sucesso: marca "sent", continua proximo
     -> Erro: marca "error", registra erro, CONTINUA proximo
  -> Delay 10s
  -> Repete
```

A unica situacao que para a fila e quando nao ha mais itens pendentes ou o timeout da funcao e atingido (nesse caso, o proximo ciclo do cron retoma).

## Reenvio de erros

Na pagina "Fila", itens com erro terao um botao "Reenviar" que insere um novo item na fila com o mesmo grupo/conteudo, permitindo retry seletivo.

Todo o resto do plano anterior permanece identico. Esta e a unica alteracao comportamental.

