# 57 — Testes que faltam de compromissos e do worker (roteiro 7.11, item S14 parte 2)

Já existem (não repetir): `appointments.service.spec.ts` cobre lembrete no criar, término/conflito/lembrete na **edição** e o cancelamento;
`notification.worker.spec.ts` cobre reserva, retry, falha definitiva, exceção, recuperação e "já em execução".
Este passo cobre só as lacunas. Testes unitários com mocks, no estilo dos specs existentes (reaproveitar os `beforeEach` e helpers que já estão nos arquivos).
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Editar: `backend/src/appointments/appointments.service.spec.ts`, `backend/src/notifications/notification.worker.spec.ts`

## Casos

### `AppointmentsService.create`
1. Agenda **PROFESSIONAL** com compromisso sobreposto (`prisma.appointment.findFirst` devolve um compromisso) → `BadRequestException` com "Conflito de horário";
   `prisma.appointment.create` não é chamado. Conferir que a busca de conflito usa `status: SCHEDULED` e a sobreposição `startTime < fim` e `endTime > início`.
2. Agenda **PERSONAL** com o mesmo cenário → cria normalmente (a checagem de conflito nem é feita: `findFirst` não é chamado).
3. Encostar sem sobrepor (novo começa exatamente quando o outro termina): `findFirst` devolve `null` → cria.
4. `startTime` inválido (`'não é data'`) → `BadRequestException`.
5. `endTime` igual ou anterior ao `startTime` → `BadRequestException`.
6. Sem `endTime` → `endTime` = início + 1 hora.
7. Sem permissão (`calendarAccess.verifyAccessOrThrow` rejeita com `ForbiddenException`) → a exceção sobe e nada é criado.
8. Sucesso grava auditoria (`auditService.log` com `action: 'CREATE'` e `metadata.title`/`metadata.startTime`) e incrementa a métrica de compromisso criado com a origem (`'WEB'` por padrão, `'TELEGRAM'` quando passado).

### `NotificationWorker`
9. Nenhum lembrete pendente → retorno com `processed: 0` e a mensagem de "aguardando próximo ciclo"; `sendReminderMessage` não é chamado.
10. A busca de pendentes filtra `status: PENDING`, `remindAt <= agora`, `retryCount < maxRetries` e **compromisso `SCHEDULED`** (cancelados não recebem lembrete).
11. Formato da mensagem: com `APP_TIMEZONE=America/Sao_Paulo` e um compromisso às `2026-11-10T11:00:00Z`, o texto contém o título, "10/11/2026" e "08:00",
    e o título com `<b>` é escapado (`&lt;b&gt;`).
12. `maxRetries` vem de `MAX_REMINDER_RETRIES` (ex.: com `'5'`, 4ª falha ainda volta para PENDING e a 5ª marca FAILED). Restaurar a variável no fim do teste.

## Critérios de aceite
- `npm test` no backend passa (todos os anteriores e os novos); `npm run lint` sem erros.

## O que NÃO alterar
- Código da aplicação. Se um teste revelar um defeito, não corrigir: anotar no fim deste plano em "Defeitos encontrados", com o passo para reproduzir.
