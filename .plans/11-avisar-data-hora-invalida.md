# 11 — Avisar hora/data inválida no chatbot

## Problema
"Marcar consulta amanhã às 25" cria o compromisso às 09:00 sem avisar. "Marcar prova 31/02" vira 03/03 (o `Date` do JS "rola" a data).

## Arquivos
- `backend/src/notifications/bot.service.ts` (`parseNaturalLanguageAppointment` e o trecho de criação em `handleMessage`)
- `backend/src/notifications/bot.service.spec.ts`

## Passos
1. `parseNaturalLanguageAppointment` passa a retornar `{ title, startTime, error?: string }`.
   - Hora: se um dos padrões de horário (a, b ou c da tarefa 10) casar mas a hora for > 23 ou o minuto > 59 → `error = 'Horário inválido: "<trecho digitado>". Use de 0 a 23 horas, por exemplo "às 15" ou "15:30".'`
   - Data: se `DD/MM[/AAAA]` casar e o dia/mês não existirem (mês fora de 1–12, ou dia maior que os dias daquele mês, considerando ano bissexto) → `error = 'Data inválida: "<trecho digitado>". Use dia/mês existentes, por exemplo "30/11" ou "30/11/2026".'` Validar comparando a data criada: `d.getDate() === dia && d.getMonth() === mes - 1`.
   - Sem horário informado continua 09:00 (não é erro).
   - Com `error`, `title`/`startTime` podem ter qualquer valor; não serão usados.
2. Em `handleMessage`, antes da checagem de "data no passado": se `parsed.error`, responder `⚠️ <b>Não consegui agendar.</b>\n${escapeHtml(parsed.error)}` e NÃO chamar `appointmentsService.create`.
3. Testes novos (manter os existentes): "às 25", "25h", "10:75", "31/02", "15/13/2026", "29/02/2027" → erro e `create` não chamado; "29/02/2028" → válido. Os testes atuais que esperavam fallback 09:00 para hora inválida devem ser atualizados para esperar erro.

## Critérios de aceite
- `npx jest` e `npm run build` passam em `backend/`.

## NÃO alterar
- Outros métodos e arquivos.
