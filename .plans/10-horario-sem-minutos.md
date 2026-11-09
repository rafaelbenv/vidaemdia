# 10 — Aceitar horários sem minutos no chatbot

## Problema (visto no teste da etapa 08)
"Marcar dentista amanhã às 9" → título "dentista às 9", hora 09:00 só por coincidência (padrão). O parser só reconhece `HH:MM` e `HHhMM`.

## Arquivos
- `backend/src/notifications/bot.service.ts` (só `parseNaturalLanguageAppointment`)
- `backend/src/notifications/bot.service.spec.ts` (novos casos)

## Formatos que devem funcionar
| Entrada | Hora |
|---|---|
| `às 9` / `as 9` | 09:00 |
| `às 15` | 15:00 |
| `9h` / `às 9h` / `15h` | 09:00 / 15:00 |
| `9h30` / `9:30` / `às 09:30` | 09:30 |
| `às 9 horas` / `9 hrs` | 09:00 |
Continuam valendo: datas `DD/MM` e `DD/MM/AAAA`, `hoje`, `amanhã`/`amanha`.

## Passos
1. Substituir a extração de horário por uma regex única aplicada nesta ordem de prioridade:
   a) `(\d{1,2})\s*[:h]\s*(\d{2})` (com minutos);
   b) `(?:^|\s)[aà]s\s+(\d{1,2})(?:\s*(?:h|hs|hrs?|horas?))?(?=\s|$|[.,!?])` (às + hora);
   c) `(?:^|\s)(\d{1,2})\s*(?:h|hs|hrs?|horas?)(?=\s|$|[.,!?])` (hora com sufixo).
   Hora fora de 0–23 ou minuto fora de 0–59 → ignorar o match (usar padrão 09:00).
   ATENÇÃO: o número de uma data `30/11` não pode ser lido como hora (b e c exigem "às" ou sufixo h).
2. Remover do título exatamente o trecho de horário que casou (incluindo "às"/"as" e o sufixo), além de `hoje`/`amanhã` e da data, como já é feito. Colapsar espaços.
3. Testes no spec (manter os existentes): os 9 exemplos da tabela acima com título esperado "dentista" (ex.: "Marcar dentista amanhã às 9 horas" → título "dentista", amanhã 09:00), mais "Criar Prova 30/11/2026 às 14" → "Prova", 30/11/2026 14:00.

## Critérios de aceite
- `npx jest` e `npm run build` passam em `backend/`.

## NÃO alterar
- Qualquer outro método ou arquivo.
