# 33 — Bastidores: o produto fica só com a Agenda (roteiro 3.1; Fase 2 do plano 19; itens D1, D2, D3)

Referência de desenho: seção 9 do `.plans/19-novo-front.md`.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Decisões (tomadas pelo orquestrador em 2026-11-12)
- Qualquer conta logada entra nos Bastidores (proposta do plano 19, seção 14.1).
- Os botões "Executar ciclo" e "Simular erro" da seção Lembretes ficam visíveis só para `PROFESSIONAL` e `ADMIN`.
  Para os outros papéis, no lugar dos botões aparece o texto
  "Disponível para contas de Profissional." (`text-xs text-stone-500`). Isso prepara o passo 3.4 (backend).
- Enquanto os menus do cabeçalho (passo 5.1) não existem, os atalhos ficam no menu da conta (`UserMenu`):
  "Compartilhar agenda" (só `PROFESSIONAL`/`ADMIN`) e "Bastidores (área técnica)" (todos, se `VITE_SHOW_BASTIDORES` não for `'false'`).

## Rotas finais deste passo
| Caminho | Conteúdo |
|---------|----------|
| `/entrar` | Login (igual) |
| `/agenda` | `AgendaPage` (igual), **sem barra de abas** |
| `/agenda/compartilhar` | Só o painel do profissional da `AcessosPage` (dar acesso à secretária + lista de quem tem acesso), com "‹ Voltar para a agenda" no topo. Só `PROFESSIONAL`/`ADMIN`; os outros vão para `/agenda`. |
| `/bastidores` | Redireciona para `/bastidores/lembretes` |
| `/bastidores/lembretes` | `LembretesPage` |
| `/bastidores/assistente` | `AssistentePage` |
| `/bastidores/acesso` | Painel da secretária da `AcessosPage` (lista de profissionais com "Acessar agenda"/"Tentar acesso (Testar 403)"), para qualquer papel |
| `/bastidores/auditoria` | Tabela de logs (parte de baixo da `AuditoriaPage`) |
| `/bastidores/saude` | Os quatro cartões de saúde (parte de cima da `AuditoriaPage`) + o botão "Abrir /metrics (Prometheus)" |

Com `VITE_SHOW_BASTIDORES === 'false'`, qualquer `/bastidores/*` vai para `/agenda` e o item some do menu.

## Arquivos
- Criar: `frontend/src/lib/routes.ts`, `frontend/src/components/BastidoresLayout.tsx`,
  `frontend/src/pages/CompartilharPage.tsx`, `frontend/src/pages/TesteAcessoPage.tsx`, `frontend/src/pages/SaudePage.tsx`
- Editar: `frontend/src/App.tsx`, `frontend/src/components/UserMenu.tsx`, `frontend/src/pages/AuditoriaPage.tsx`,
  `frontend/src/pages/LembretesPage.tsx`, `frontend/src/pages/AcessosPage.tsx` (pode ser apagado se todo o conteúdo migrar),
  `frontend/src/lib/tabs.ts` (pode ser apagado se nada mais usar)

## Passos

### 1. `lib/routes.ts`
```ts
export const LOGIN_PATH = '/entrar';
export const AGENDA_PATH = '/agenda';
export const COMPARTILHAR_PATH = '/agenda/compartilhar';
export const SHOW_BASTIDORES = import.meta.env.VITE_SHOW_BASTIDORES !== 'false';
export type BastidoresSection = 'lembretes' | 'assistente' | 'acesso' | 'auditoria' | 'saude';
export const BASTIDORES_SECTIONS: { id: BastidoresSection; label: string; intro: string; icon: LucideIcon }[] = [
  { id: 'lembretes', label: '1. Envio de lembretes', icon: Bell,
    intro: 'Worker que consulta o PostgreSQL a cada minuto e envia os lembretes pelo Telegram, com até 3 tentativas. Cobre o Fluxo 3 do diagrama.' },
  { id: 'assistente', label: '2. Assistente', icon: MessageSquare,
    intro: 'Simulador do bot do Telegram: o texto passa pelo mesmo webhook e cria compromissos de verdade. Cobre o Fluxo 3 (chatbot).' },
  { id: 'acesso', label: '3. Controle de acesso', icon: ShieldCheck,
    intro: 'Teste do RBAC: acessar a agenda de um profissional devolve 200 com autorização e 403 sem ela. Cobre o Fluxo 2 do diagrama.' },
  { id: 'auditoria', label: '4. Auditoria', icon: FileText,
    intro: 'Registro imutável de quem criou, alterou, cancelou ou teve o acesso negado, gravado no PostgreSQL.' },
  { id: 'saude', label: '5. Saúde do sistema', icon: Activity,
    intro: 'Estado do backend, do banco e do worker, e as métricas expostas para o Prometheus e o Grafana.' },
];
export const bastidoresPath = (s: BastidoresSection) => `/bastidores/${s}`;
export function sectionFromPath(pathname: string): BastidoresSection | null { /* '/bastidores/<id>' -> id válido, senão null */ }
```
Criar também `frontend/src/vite-env.d.ts` com `ImportMetaEnv { readonly VITE_SHOW_BASTIDORES?: string; readonly VITE_API_URL?: string }`
se ainda não declarar essas variáveis (se o arquivo já existir, só acrescentar).

### 2. `components/BastidoresLayout.tsx`
Props: `{ section: BastidoresSection; userName: string; onBack: () => void; children: React.ReactNode }`.
- Cabeçalho escuro (`bg-stone-950 text-white border-b border-stone-800`), conteúdo em `max-w-7xl mx-auto px-4 sm:px-6 py-3`
  com `flex items-center justify-between gap-4`:
  - Esquerda: ícone `Wrench` (lucide) + "Bastidores" (`font-semibold`) e, abaixo, "Área técnica — demonstração do trabalho" (`text-xs text-stone-400`).
  - Direita: botão "‹ Voltar para a agenda" (`ArrowLeft` + texto), `text-sm text-stone-200 hover:text-white`, chama `onBack`.
- Corpo: `max-w-7xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[220px_1fr] gap-6`.
  - Menu lateral `<nav aria-label="Seções dos bastidores">` com os 5 itens de `BASTIDORES_SECTIONS`, como `<Link>` do react-router.
    Item ativo: `bg-brand-50 text-brand-800 font-semibold`; outros: `text-stone-700 hover:bg-stone-100`; todos `rounded-md px-3 py-2 text-sm flex items-center gap-2`, com `aria-current="page"` no ativo.
    No celular (abaixo de `lg`), o menu vira uma faixa horizontal rolável (`flex lg:flex-col overflow-x-auto`).
  - Conteúdo: título `h1` da seção (`text-lg font-semibold text-stone-900`), a frase `intro` (`text-sm text-stone-600 mt-1 mb-5 max-w-3xl`) e `children`.

### 3. Páginas novas (recortando JSX existente, sem mudar textos e classes do que é recortado)
- `CompartilharPage.tsx`: o bloco `showProfessionalPanel` da `AcessosPage`, com as mesmas props que ele usa, envolvido em
  `max-w-3xl mx-auto` e precedido do botão "‹ Voltar para a agenda" (`text-sm text-stone-600 hover:text-stone-900 mb-4 inline-flex items-center gap-1`).
- `TesteAcessoPage.tsx`: o bloco `showSecretaryPanel` da `AcessosPage`, com as mesmas props.
- `SaudePage.tsx`: os quatro cartões de saúde da `AuditoriaPage` + o link "Abrir /metrics (Prometheus)" (mantém o `href` atual; o passo 3.3 corrige).
- `AuditoriaPage.tsx` fica só com a tabela de logs.
- `handleSelectProfessionalCalendar` continua igual: com 200 seleciona a agenda e leva para `/agenda` (trocar o `setActiveTab('agenda')` por `navigate(AGENDA_PATH)`).

### 4. `LembretesPage.tsx`
Nova prop `canControlWorker: boolean`. Se `false`, no lugar dos dois botões ("Simular Erro…" e "Executar Ciclo…") mostrar
`<p className="text-xs text-stone-500">Disponível para contas de Profissional.</p>`.
No `App`, passar `canControlWorker={user.role === 'PROFESSIONAL' || user.role === 'ADMIN'}`.

### 5. `App.tsx`
- Remover a barra de abas (`role="tablist"`, `handleTabKeyDown`, `TAB_DEFINITIONS`, `getVisibleTabs`, `activeTab`, `setActiveTab`, `tabFromPath`, `TAB_PATHS`).
- Decidir a tela pela URL:
  ```ts
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const section = sectionFromPath(path);
  const canShare = user?.role === 'PROFESSIONAL' || user?.role === 'ADMIN';
  ```
  - `section !== null && SHOW_BASTIDORES` → renderizar `<BastidoresLayout>` com a página da seção. **Sem** o cabeçalho e o rodapé do produto.
  - `path === COMPARTILHAR_PATH && canShare` → cabeçalho do produto + `CompartilharPage`.
  - `path === AGENDA_PATH` → cabeçalho do produto + `AgendaPage`.
  - O `FeedbackBanner` e o `ConfirmDialog` aparecem nos dois layouts.
- Efeito de redirecionamento (substitui o atual), mantendo a regra "sem token → `/entrar`" e "sessão sendo validada → não mexe":
  com `user` carregado, se `path` for `/entrar`, `/bastidores` (sem seção), desconhecido, `/bastidores/*` com `SHOW_BASTIDORES` falso,
  ou `/agenda/compartilhar` sem `canShare` → `navigate(...)` com `replace: true` para `/agenda`, exceto `/bastidores` com `SHOW_BASTIDORES`, que vai para `/bastidores/lembretes`.
- O efeito antigo "Se a aba ativa sumir ao trocar de conta" sai (o novo efeito cobre o caso).
- O rodapé "SEGURANÇA VIDAEMDIA — …" sai do produto e vai para o fim do `BastidoresLayout`, com as mesmas classes.
- `handleLogin` e `handleLogout`: trocar o que usava `setActiveTab`/`TAB_PATHS` por `navigate(AGENDA_PATH)` / `navigate(LOGIN_PATH, { replace: true })`.

### 6. `UserMenu.tsx`
Novas props: `canShare: boolean`, `showBastidores: boolean`, `onOpenShare: () => void`, `onOpenBastidores: () => void`.
Acrescentar, antes do item de sair e no mesmo estilo dos itens existentes do menu:
- "Compartilhar agenda" (ícone `Users`), só se `canShare`.
- "Bastidores (área técnica)" (ícone `Wrench`), só se `showBastidores`.
Ao clicar, fechar o menu e chamar o callback (`navigate(COMPARTILHAR_PATH)` / `navigate(bastidoresPath('lembretes'))` no `App`).

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros).
- Depois do login, com qualquer conta: `/agenda` sem barra de abas.
- `/bastidores/*` mostra o cabeçalho escuro, o menu de 5 seções e "Voltar para a agenda"; cada seção funciona como a aba antiga.
- Carlos: menu da conta sem "Compartilhar agenda", com "Bastidores"; em Lembretes vê o aviso no lugar dos botões; `/agenda/compartilhar` leva para `/agenda`.
- Dr. João: "Compartilhar agenda" abre a página de dar acesso; botões do worker funcionam.
- Maria: em `/bastidores/acesso`, "Acessar agenda" de um profissional autorizado seleciona a agenda e volta para `/agenda`.
- Recarregar mantém a tela em todas as rotas.

## O que NÃO alterar
- `AgendaPage`, `LoginPage`, `AssistentePage`, `api.ts`, hooks, backend.
- Textos e classes dos blocos recortados.
