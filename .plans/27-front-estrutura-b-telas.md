# 27 — Estrutura do front, parte B: cada tela em seu arquivo (roteiro 2.1b)

Segunda de três partes do passo 2.1. Mapa em `.plans/25-contexto-app.md` (os números de linha mudaram
depois da parte A; localize os blocos pelo conteúdo, ex.: `activeTab === 'agenda'`).

**Regra de ouro: sem nenhuma mudança visual nem de comportamento.**
O JSX de cada tela é RECORTADO e COLADO no novo arquivo sem alterar texto, classes, atributos, ordem.
O ESTADO e os HANDLERS continuam no `App.tsx` nesta parte; cada tela recebe por props exatamente o que usa.
Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos (somente estes)
Criar:
- `frontend/src/pages/LoginPage.tsx` — tela de login inteira (o que hoje é renderizado quando não há sessão).
- `frontend/src/pages/AgendaPage.tsx` — conteúdo de `activeTab === 'agenda'`.
- `frontend/src/pages/AcessosPage.tsx` — conteúdo de `activeTab === 'rbac'`.
- `frontend/src/pages/LembretesPage.tsx` — conteúdo de `activeTab === 'worker'`.
- `frontend/src/pages/AssistentePage.tsx` — conteúdo de `activeTab === 'chatbot'`.
- `frontend/src/pages/AuditoriaPage.tsx` — conteúdo de `activeTab === 'auditoria'`.
- `frontend/src/components/UserMenu.tsx` — o botão de avatar e o dropdown do usuário no cabeçalho.
- `frontend/src/components/FeedbackBanner.tsx` — o banner de sucesso/erro (`feedbackBanner`), se estiver em um bloco JSX próprio.
Editar: `frontend/src/App.tsx`.

## Passos
1. Para cada arquivo acima, criar um componente com export nomeado (`export function AgendaPage(props: AgendaPageProps)`),
   com uma `interface ...Props` explícita no mesmo arquivo. A seção 5 do mapa sugere as props; confira lendo
   o bloco: toda variável, setter, handler ou função que o bloco usa e que vem do `App` vira prop com o mesmo nome.
   Funções puras de `lib/`, componentes de `components/` e ícones do `lucide-react` são importados direto no arquivo, não por prop.
2. Refs usadas pelo bloco (ex.: `userMenuRef`) também vão por prop.
3. No `App.tsx`, substituir cada bloco recortado por `<NomeDaPagina ...props />`, passando os valores do estado.
   A condição `activeTab === '...' &&` (ou equivalente) continua no `App.tsx`, em volta do componente.
4. Tipos: usar os de `types.ts`. Onde o `App` usa `any` hoje (workerStats, healthData), a prop também fica `any`.
   O tipo das mensagens do chat (`{ sender, text, time, channel }`) vira `export interface ChatMessage` em `types.ts`.
5. Remover do `App.tsx` imports que ficaram sem uso.

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros) passam em `frontend/`.
- `App.tsx` com menos de 900 linhas.
- Nenhum texto visível foi alterado: as strings em português dos arquivos novos são as mesmas que saíram do `App.tsx`.

## O que NÃO alterar
- Estado, `useEffect`, handlers e chamadas de API: ficam no `App.tsx` como estão.
- `api.ts`, `lib/`, `components/ConfirmDialog.tsx`, `components/TechTag.tsx`, `index.html`, `package.json`, backend.
- Não adicionar rotas nem bibliotecas (isso é a parte C).
