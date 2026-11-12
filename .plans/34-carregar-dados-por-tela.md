# 34 — Carregar dados por tela (roteiro 3.2; itens C7 e C6 em parte)

## Objetivo
A Agenda deixa de buscar auditoria, status do worker, health e diretório de profissionais. Só os Bastidores buscam.
Depois de uma ação na agenda, recarregar só o que mudou, e não as seis chamadas.
Isso também é pré-requisito do passo 3.4 (o backend vai restringir `/notificacoes/status`).
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Editar: `frontend/src/App.tsx` (e páginas só se uma prop mudar de tipo; não deve ser preciso).

## Passos
1. Dividir `loadInitialData(jwt)` em duas funções:
   - `loadSession(jwt)`: `getMe`, `getCalendars` e o status do Telegram, com todo o tratamento que existe hoje
     (`setUser`, agendas, primeira agenda selecionada, `setInitialLoadError`/banner de erro, 401 → logout, `setLoading`).
     É ela que o `useEffect` de `[token]` chama e que o `SessionLoadError` usa no "Tentar de novo".
   - `loadBastidoresData(jwt)`: `getProfessionals`, `getAuditLogs`, `getNotificationsStatus` e `getHealth`
     (um `Promise.all`), preenchendo `professionals`, `auditLogs`, `workerStats`, `remindersQueue`, `dispatchedMessages`, `healthData`.
     Em erro que não seja 401 (o 401 já é tratado no `api.ts`), mostrar o banner
     `{ type: 'error', title: 'Não foi possível carregar os dados técnicos.', detail: getErrorMessageByStatus(status) }`.
2. Novo `useEffect`: quando `user` estiver carregado e a rota for uma seção dos Bastidores (`sectionFromPath(...) !== null`),
   chamar `loadBastidoresData(token)`. Dependências: `[user?.id, section, token]`, para recarregar ao trocar de seção.
3. Trocar as chamadas a `loadInitialData` nos handlers:
   - Criar, cancelar compromisso e o handler do assistente: `loadAppointments(selectedCalendarId)`. Se a tela atual for dos Bastidores, também `loadBastidoresData(token)`.
   - Executar ciclo do worker e simular falha: `loadBastidoresData(token)` e `loadAppointments(selectedCalendarId)`.
   - Conectar ou desconectar o Telegram e dar acesso (compartilhar): `loadSession(token)`.
   - Lugares que hoje buscam só a auditoria depois de um erro (`getAuditLogs`): manter só se a tela atual for dos Bastidores; na agenda, remover.
4. Remover `loadInitialData` (não deve sobrar referência).

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- Login em `/agenda`: a rede mostra só `/auth/me`, `/agendas`, `/telegram/status` e `/compromissos?...`
  (nada de `/auditoria`, `/notificacoes/status`, `/health`, `/agendas/profissionais`).
- Abrir `/bastidores/lembretes`: as quatro chamadas técnicas acontecem e a tela mostra os dados como antes.
- Criar e cancelar compromisso na agenda continuam atualizando a lista.

## O que NÃO alterar
- Páginas e componentes (a não ser tipos de props), `api.ts`, backend.
