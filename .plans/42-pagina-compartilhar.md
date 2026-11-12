# 42 — Página de compartilhar agenda (roteiro 5.2; Fase 6 do plano 19; itens A7, B4, B5)

Referência de desenho: seção 6 do `.plans/19-novo-front.md`.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## O que a API já entrega
- `GET /agendas` → `owned[]`, cada agenda com `permissions[]` (`granteeUser {id, name, email}`, `canView`, `canCreate`, `canUpdate`, `canCancel`).
- `POST /agendas/:id/permissoes` com `{ secretaryEmail, canView, canCreate, canUpdate, canCancel }` faz *upsert*: dá acesso ou atualiza o de quem já tem.
  E-mail sem conta → 400 "Nenhum usuário encontrado com o e-mail …".
- `DELETE /agendas/:id/permissoes/:granteeUserId` remove o acesso (o front de hoje não usa).

## Arquivos
- Reescrever: `frontend/src/pages/CompartilharPage.tsx`
- Editar: `frontend/src/api.ts` (função de remover), `frontend/src/App.tsx` (handlers e props)

## Passos

### 1. `api.ts`
`revokePermission(token, calendarId, granteeUserId)` → `DELETE /agendas/:calendarId/permissoes/:granteeUserId`.

### 2. `App.tsx`
- Remover o estado `secretaryEmailToGrant` e o `handleGrantSecretaryPermission` antigo.
- `handleGrantAccess(email, caps: { canView, canCreate, canUpdate, canCancel }): Promise<string | null>` — chama `grantPermission` na agenda aberta,
  em sucesso faz `loadSession(token)` (atualiza `permissions`) e devolve `null`; em erro devolve a mensagem (`errorMessage`), sem banner.
- `handleRevokeAccess(perm)`: abre o `ConfirmDialog` existente com título "Remover o acesso de <nome>?",
  texto "<nome> deixa de ver e de mexer nesta agenda.", botão de confirmar "Remover acesso" (estilo de perigo, como no cancelar).
  Ao confirmar: `revokePermission`, `loadSession(token)` e banner de sucesso "Acesso de <nome> removido.".
- Passar à página: `calendar` (= `activeCalendar`, dona do usuário), `me` (`user`), `onGrant`, `onRevoke`, `onBack`.

### 3. `CompartilharPage.tsx`
Layout `max-w-3xl mx-auto px-4 sm:px-6 py-6`:
- Topo: botão "‹ Agenda" (`onBack`) e `h1` "Compartilhar "<calendar.name>"" (`text-lg font-semibold`).
- Card "Quem tem acesso" (`bg-white rounded-lg border border-stone-200 p-4 sm:p-5`, título `h2 text-sm font-semibold`):
  - Vazio: "Só você tem acesso a esta agenda." (`text-sm text-stone-600`).
  - Uma linha por pessoa (`py-3 border-b border-stone-100 last:border-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between`):
    nome (`font-medium`) · e-mail (`text-stone-500 truncate`); embaixo "Pode: ver, criar, alterar, cancelar" (só os que estão ligados, em minúsculas, separados por vírgula).
    Ações: "Alterar" (abre, na própria linha, as quatro caixas com os valores atuais + "Salvar" e "Cancelar"; salvar chama `onGrant(email, caixas)`)
    e "Remover" (`text-red-700`), que chama `onRevoke(perm)`.
- Card "Dar acesso a alguém" com `<form>`:
  - Campo "E-mail" (`type=email`, `id`/`htmlFor`, obrigatório).
  - "Pode" com quatro caixas, todas marcadas por padrão: "ver", "criar", "alterar", "cancelar" (cada `input type=checkbox` com `label` ligado; alvo de toque de 44px).
    Se "ver" for desmarcada, as outras três ficam desmarcadas e desabilitadas (sem ver não dá para mexer).
  - Botão "Dar acesso" (primário), com "Dando acesso…" enquanto envia.
  - Validações antes de enviar: e-mail vazio → "Informe o e-mail da pessoa."; e-mail igual ao do usuário → "Você já é dono desta agenda.";
    e-mail de quem já tem acesso → "<nome> já tem acesso. Use "Alterar" na lista acima.".
  - Erro do servidor (ex.: e-mail sem conta) aparece abaixo do campo, `text-xs text-red-600`, com `aria-describedby`.
  - Sucesso: limpa o campo, volta as caixas ao padrão e mostra `text-sm text-emerald-700` "Acesso dado a <email>." por 4 s.
- Vocabulário: só "acesso" e "compartilhar". Nada de "RBAC", "delegação", "permissão RBAC", "Secretária", `TechTag`.

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- Dr. João, no Consultório: vê Maria em "Quem tem acesso" com "Pode: ver, criar, alterar, cancelar".
- Alterar: desmarcar "cancelar" e salvar → a linha passa a "Pode: ver, criar, alterar"; Maria, ao tentar cancelar um compromisso dessa agenda, não vê o botão (o painel usa `myPermissions`).
- Remover (com confirmação) tira Maria da lista; dar acesso de novo a `secretaria.maria@vidaemdia.com.br` a traz de volta.
- E-mail sem conta mostra o erro do servidor abaixo do campo.
- Em 375px: sem rolagem horizontal.

## O que NÃO alterar
- Backend, Bastidores (a página de teste de acesso continua lá), cabeçalho e menus, agenda.
