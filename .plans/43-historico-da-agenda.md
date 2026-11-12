# 43 — Histórico da agenda (roteiro 5.3; Fase 7 do plano 19)

Referência de desenho: seção 6b do `.plans/19-novo-front.md`.
Não execute comandos de terminal. Use só ferramentas de arquivo.
Este plano tem duas seções, executadas e commitadas separadamente. Quando o pedido disser "seção A" ou "seção B", fazer só ela.

## O que os registros de auditoria trazem hoje (conferido)
`GET /auditoria?calendarId=` (já checa acesso desde o passo 1.3) devolve até 100 registros, mais recentes primeiro, com `actorUser {id, name}`,
`action`, `entityType`, `metadata`, `createdAt`.
- Compromisso `CREATE`: `metadata.title`, `metadata.startTime`.
- Compromisso `UPDATE`/`CANCEL`: `metadata.before {title, startTime, endTime, status}` e `metadata.after {...}`.
- Acesso concedido (`entityType PERMISSION`, `action UPDATE`): só as caixas (`canView`...). **O nome da pessoa só está no texto `details`.**
- Acesso removido (`PERMISSION`, `CANCEL`): **sem a pessoa**.
- Acesso negado (`RBAC`, `ACCESS_DENIED`): `actorUser` é quem tentou; `metadata.operation`.

---

## Seção A — Backend: guardar a pessoa nos registros de acesso

Arquivo: `backend/src/calendars/calendars.service.ts` (e o spec, se existir um para ele; senão criar `calendars.service.spec.ts`).

1. Em `grantPermission`, acrescentar ao `metadata` do log: `granteeUserId: secretary.id`, `granteeName: secretary.name`, `granteeEmail: secretary.email`.
2. Em `revokePermission`, antes do `delete`, buscar o usuário (`prisma.user.findUnique({ where: { id: granteeUserId }, select: { name: true, email: true } })`)
   e gravar no log `metadata: { granteeUserId, granteeName, granteeEmail }`. Se a permissão não existir, o `delete` já falha como hoje (não mudar).
3. Testes (mocks, estilo `bot.service.spec.ts`): o `auditService.log` de conceder e de remover recebe `granteeName` e `granteeEmail` no `metadata`;
   conceder e remover por quem não é dono continuam lançando `ForbiddenException`.

Aceite: `npm run build`, `npm run lint` (0 erros), `npm test` no backend.
Não alterar: schema, controllers, outros services, frontend.

---

## Seção B — Front: página de histórico

Arquivos: criar `frontend/src/pages/HistoricoPage.tsx` e `frontend/src/lib/historySentence.ts`;
editar `frontend/src/api.ts`, `frontend/src/lib/routes.ts`, `frontend/src/App.tsx`, `frontend/src/components/CalendarMenu.tsx`, `frontend/src/types.ts` (tipos de `metadata`, se preciso).

1. `api.ts`: `getCalendarHistory(token, calendarId)` → `GET /auditoria?calendarId=...` (tipo `AuditLogEntry[]`).
2. `routes.ts`: `HISTORICO_PATH = '/agenda/historico'`.
3. `lib/historySentence.ts`: `historySentence(entry, me: { id: string }) → { time: string; text: string; tone: 'normal' | 'alert' } | null`.
   - Quem: `entry.actorUser?.id === me.id` → "Você"; senão o nome (`actorUser.name`); sem ator → "Alguém".
   - Compromisso (`entityType === 'APPOINTMENT'`), título `t` e quando `q` = "dd/mm às HH:MM" (do `startTime` correspondente):
     - `CREATE`: "<Quem> marcou "<t>" para <q>" (`metadata.title`/`metadata.startTime`).
     - `UPDATE`: se `before.startTime !== after.startTime` → "<Quem> alterou "<t>" para <q do after>"; senão → "<Quem> alterou "<t>"" (título do `after`).
     - `CANCEL`: "<Quem> cancelou "<t>" de <q do before>".
     - Sem `metadata` suficiente: "<Quem> mexeu em um compromisso".
   - Acesso (`entityType === 'PERMISSION'`), pessoa `p` = `metadata.granteeName` (ou "uma pessoa" se faltar, para registros antigos):
     - `UPDATE`: "<Quem> deu acesso a <p>"; `CANCEL`: "<Quem> removeu o acesso de <p>".
   - Negado (`entityType === 'RBAC'`, `ACCESS_DENIED`): "Tentativa de acesso negada: <nome de quem tentou>", `tone: 'alert'`.
   - `AUTH`, `CHATBOT` e outros: `null` (não aparecem; logins ficam só nos Bastidores).
   - `time` = "HH:MM" do `createdAt`.
4. `pages/HistoricoPage.tsx` — props `{ token: string; calendar: Calendar; me: User; onBack: () => void }`:
   - Busca ao abrir e quando `calendar.id` muda; estados de carregando ("Carregando…"), erro (`role="alert"` com `getErrorMessageByStatus`) e vazio
     ("Nada aconteceu nesta agenda ainda.").
   - Topo: botão "‹ Agenda" (`onBack`) e `h1` "Histórico de "<calendar.name>"" (`text-lg font-semibold`).
   - Grupos por dia, do mais recente para o mais antigo: título "Hoje", "Ontem" ou "Terça, 10 de novembro" (`formatLongDate`), `text-xs font-semibold text-stone-500 uppercase tracking-wide mt-6 mb-2`.
   - Linha: `flex gap-4 py-2 text-sm`, hora `w-12 tabular-nums text-stone-500`, texto `text-stone-800`; `tone: 'alert'` → ícone `ShieldAlert` `text-amber-600` antes do texto.
   - Sem tabela, sem selos `CREATE`/`ACCESS_DENIED`, sem papel em inglês. Contêiner `max-w-3xl mx-auto px-4 sm:px-6 py-6`.
5. `CalendarMenu`: item "Histórico desta agenda" (ícone `History`), logo abaixo de "Compartilhar esta agenda", com a mesma condição (`canShareSelected`) e callback `onHistory`.
6. `App.tsx`: rota `/agenda/historico` com o cabeçalho do produto e a `HistoricoPage`; mesma regra de acesso do compartilhar (dono da agenda aberta ou ADMIN), senão `/agenda`.

Aceite (B): `npm run build`, `npm run lint` (0 erros); Dr. João abre "Histórico desta agenda" no Consultório e vê frases como
"Maria Oliveira marcou "Paciente: …" para 09/11 às 08:00", agrupadas por dia; recarregar mantém a página; Maria (agenda delegada) não vê o item.
Não alterar: backend, Bastidores (a tabela de auditoria completa continua lá), painel, compartilhar.
