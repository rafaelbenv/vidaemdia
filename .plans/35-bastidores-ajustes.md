# 35 — Ajustes nos Bastidores (roteiro 3.3; itens C8, A6, A4, C10)

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos
- Editar: `frontend/src/App.tsx`, `frontend/src/pages/LembretesPage.tsx`, `frontend/src/pages/SaudePage.tsx`,
  `frontend/src/pages/AgendaPage.tsx` (só o texto "x/3" das tentativas, se existir lá), `frontend/src/types.ts` (se `WorkerStats` não tiver `maxRetries`).

## Passos

### C8 — Atualização automática dos lembretes
No `App.tsx`, enquanto a rota for `/bastidores/lembretes` e houver `token`, chamar `loadBastidoresData(token)` a cada **10 segundos**
(`window.setInterval` em um `useEffect` com limpeza no retorno; dependências: seção atual e `token`).
Não mostrar o banner de erro a cada falha do intervalo: passar um parâmetro `{ silent: true }` para `loadBastidoresData`, que nesse modo só ignora o erro.
Na `LembretesPage`, abaixo do título da fila, um texto `text-xs text-stone-500`: "Atualiza sozinho a cada 10 segundos."

### A6 — Tentativas a partir de `maxRetries`
Todo texto que mostra tentativas como `.../3` ou "Máx. 3 tentativas" passa a usar `workerStats?.maxRetries ?? 3`.
Procurar por `/3`, `3 tentativas` e `(MÁX 3` em `LembretesPage.tsx` e `AgendaPage.tsx`.
Se a `AgendaPage` não recebe `workerStats`, criar a prop `maxRetries: number` e passar `workerStats?.maxRetries ?? 3` no `App`.
`WorkerStats` em `types.ts` deve ter `maxRetries: number` (o backend devolve em `GET /notificacoes/status` → `worker.maxRetries`).

### A4 — Link de métricas pela base da API
Na `SaudePage`, trocar `href="http://localhost:3000/metrics"` por `` href={`${API_BASE_URL}/metrics`} `` (import de `../api`).
Com a base `/api`, o link vira `/api/metrics`, que o nginx e o proxy do Vite encaminham para o backend.

### C10 — Histórico do assistente na sessão do navegador
- `chatHistory`: estado inicial lido de `sessionStorage.getItem('vidaemdia_chat')` (JSON), com `try/catch`; se não houver ou falhar, usar a mensagem de boas-vindas de hoje.
- `useEffect` que grava `chatHistory` em `sessionStorage` a cada mudança (com `try/catch`).
- `handleLogout` apaga a chave `vidaemdia_chat` e volta o histórico para a mensagem de boas-vindas.
- O campo `botInput` passa a começar vazio (`''`). O exemplo vira `placeholder` do input na `AssistentePage`:
  `placeholder="Ex.: Marcar Consulta médica hoje às 08:00"` (pode editar `AssistentePage.tsx` só para isso).

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- Em `/bastidores/lembretes`, a rede mostra `/notificacoes/status` a cada ~10 s; em outra rota, para.
- Nenhum `/3` fixo sobrou (`grep` por `/3` nas páginas só encontra o que não é tentativa).
- O link de métricas abre `/api/metrics`.
- Recarregar a página mantém o histórico do assistente; sair apaga.

## O que NÃO alterar
- `api.ts`, hooks, `LoginPage`, backend.
