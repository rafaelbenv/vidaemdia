# 28 — Estrutura do front, parte C: rotas na URL e hooks (roteiro 2.1c, itens C4 e E1)

Terceira e última parte do passo 2.1. `react-router-dom@6` JÁ ESTÁ INSTALADO.
**Sem mudança visual.** A barra de abas continua igual (mesmos botões, mesmas classes, mesma navegação por teclado);
a diferença é que a aba ativa passa a morar na URL: recarregar a página mantém a tela e o "Voltar" do navegador funciona.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos (somente estes)
- Editar: `frontend/src/main.tsx`, `frontend/src/lib/tabs.ts`, `frontend/src/App.tsx`
- Criar: `frontend/src/hooks/useUserMenu.ts`, `frontend/src/hooks/useAppointmentForm.ts`, `frontend/src/hooks/useTelegramLink.ts`

## Passos

### 1. `main.tsx`
Envolver `<App />` em `<BrowserRouter>` (import de `react-router-dom`), dentro do `React.StrictMode`.

### 2. `lib/tabs.ts` — mapa aba ↔ caminho
Acrescentar e exportar:
```ts
export const LOGIN_PATH = '/entrar';
export const TAB_PATHS: Record<TabId, string> = {
  agenda: '/agenda',
  rbac: '/agenda/compartilhar',
  worker: '/bastidores/lembretes',
  chatbot: '/bastidores/assistente',
  auditoria: '/bastidores/auditoria',
};
export function tabFromPath(pathname: string): TabId | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const entry = (Object.entries(TAB_PATHS) as [TabId, string][]).find(([, p]) => p === clean);
  return entry ? entry[0] : null;
}
```

### 3. `App.tsx` — aba ativa derivada da URL
a) Trocar `const [activeTab, setActiveTab] = useState<TabId>('agenda');` por:
```ts
const location = useLocation();
const navigate = useNavigate();
const activeTab: TabId = tabFromPath(location.pathname) ?? 'agenda';
const setActiveTab = (tab: TabId) => navigate(TAB_PATHS[tab]);
```
Assim, todas as chamadas `setActiveTab(...)` existentes continuam funcionando e passam a mudar a URL. Não mexa nelas,
exceto nos itens c) e d).

b) Novo efeito de redirecionamento (colocar junto aos outros efeitos, depois do bloco do item a):
```ts
useEffect(() => {
  const path = location.pathname;
  if (!token) {
    if (path !== LOGIN_PATH) navigate(LOGIN_PATH, { replace: true });
    return;
  }
  if (!user) return; // sessão ainda sendo validada: não mexe na URL (recarregar mantém a tela)
  if (path === LOGIN_PATH || tabFromPath(path) === null) {
    navigate(TAB_PATHS.agenda, { replace: true });
  }
}, [token, user, location.pathname, navigate]);
```

c) No efeito "Se a aba ativa sumir ao trocar de conta", trocar `setActiveTab('agenda')` por
`navigate(TAB_PATHS.agenda, { replace: true })` e usar `[user, activeTab, navigate]` como dependências.

d) Em `handleLogout`, trocar `setActiveTab('agenda')` por `navigate(LOGIN_PATH, { replace: true })`.

e) A renderização continua decidida por `activeTab === '...'` e por `if (!token || !user)` exatamente como hoje.
Não usar `<Routes>`: a URL decide a aba, e as condições existentes decidem o que aparece.

### 4. Hooks (mover código do `App.tsx` sem mudar o comportamento)
a) `hooks/useUserMenu.ts`: mover `userMenuOpen`/`setUserMenuOpen`, `userMenuRef` e o `useEffect` de "clique fora ou Esc".
   Retornar `{ userMenuOpen, setUserMenuOpen, userMenuRef }`. No `App`: `const { userMenuOpen, setUserMenuOpen, userMenuRef } = useUserMenu();`
b) `hooks/useAppointmentForm.ts`: mover os estados `formTitle`, `formDate`, `formTime`, `formDesc`,
   `formReminderMinutes`, `formChannel`, `dateError` (com os mesmos valores iniciais). Retornar cada valor e setter com os mesmos nomes.
   No `App`, desestruturar com os mesmos nomes, para o resto do código não mudar.
c) `hooks/useTelegramLink.ts`: mover `telegramLinked`, `telegramWaiting`, `pollingRef`, `pollingTimeoutRef`, a função `stopPolling`
   e o `useEffect` de limpeza ao desmontar. Retornar tudo com os mesmos nomes (inclusive os setters).
   Os handlers `handleConnectTelegram` e `handleUnlinkTelegram` ficam no `App` (usam estado compartilhado).

### 5. Imports
Remover do `App.tsx` imports que ficarem sem uso (ex.: `useState` de `TabId`, se for o caso).

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros) em `frontend/`.
- Abrir `/` sem sessão vai para `/entrar`; depois do login vai para `/agenda`.
- Clicar em cada aba muda a URL para o caminho da tabela; recarregar mantém a aba.
- Conta sem permissão para uma aba (ex.: Carlos em `/bastidores/lembretes`) é levada para `/agenda`.
- Sair leva para `/entrar`.
- Nenhum texto, classe ou elemento visível alterado.

## O que NÃO alterar
- `pages/`, `components/`, `api.ts`, `lib/format.ts`, `index.html`, `vite.config.ts`, `package.json`, backend.
- A lógica dos handlers (`handleLogin`, `handleCreateAppointment` etc.), a não ser o descrito em 3c e 3d.
