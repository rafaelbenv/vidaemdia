# 18 — Sugestões de melhoria (backlog)

Levantamento feito em 2026-11-10 lendo o código (front inteiro, auth, worker, webhooks, infra).
Este arquivo é só a lista do que fazer. Cada item que for escolhido vira um plano próprio
(`.plans/NN-nome.md`) antes de ser implementado.

Esforço: **P** = até 1h, **M** = meio dia, **G** = um dia ou mais.

## Situação dos planos de interface já escritos

- Planos 12 a 15 (identidade visual, selos técnicos, estados e confirmação, navegação por papel):
  já aparecem no `App.tsx` atual. Falta commitar (há ~900 linhas alteradas fora do stage).
- Plano 16 (painel "Hoje", lista agrupada por dia, remover o select de canal): **não implementado**.
- Plano 17 (acessibilidade e mobile): **não implementado**. Os `<label>` continuam sem `htmlFor`,
  os emojis continuam como ícone e o botão de fechar o aviso ainda é um "✕" pequeno.

Os itens abaixo não repetem o que já está nos planos 16 e 17.

---

## A. Bugs no front (corrigir primeiro)

| # | Problema | Onde | Esforço |
|---|----------|------|---------|
| A1 | A mensagem de sucesso diz sempre "Lembrete no Telegram 15 min antes", mesmo quando o usuário escolheu outro prazo. O padrão do formulário é "Imediato". | `App.tsx:684` | P |
| A2 | Ao recarregar a página com sessão ativa, a tela de login aparece por um instante antes da agenda, porque a condição é `!token \|\| !user` e o usuário ainda está carregando. Falta uma tela de carregamento. | `App.tsx:902` | P |
| A3 | Se a carga inicial falhar por qualquer motivo que não seja 401, o erro é engolido e a tela fica vazia sem aviso. | `App.tsx:504-507` | P |
| A4 | O link "Abrir /metrics" aponta para `http://localhost:3000/metrics` fixo. Fora da máquina local não abre. | `App.tsx:2210` | P |
| A5 | E-mail e senha (`123456`) já vêm preenchidos no login. Os botões de perfil rápido usam a senha digitada no campo, então quebram se o usuário alterar a senha. | `App.tsx:329-330`, `531-540` | P |
| A6 | O número de tentativas "x/3" está fixo no texto, em vez de usar `workerStats.maxRetries`. | `App.tsx:1616`, `1922`, `1943` | P |
| A7 | O texto da aba Acessos diz "autorize ou revogue", mas não existe botão de revogar. O backend já tem `DELETE /agendas/:id/permissoes/:granteeUserId`. | `App.tsx:1744`, `1807-1823` | P |
| A8 | O front em Docker chama `http://localhost:3000` porque `VITE_API_URL` não é definido no build. O padrão deveria ser `/api` (proxy do nginx). | `api.ts:3`, `frontend/Dockerfile` | P |
| A9 | Tailwind é carregado pelo CDN (`cdn.tailwindcss.com`), que não é para produção: CSS gerado no navegador, tela sem estilo no primeiro instante e dependência de internet. O pacote já está nas devDependencies; falta `tailwind.config` + PostCSS. | `index.html:10-29` | M |

## B. Funcionalidades que o backend já tem e o front não usa

| # | Sugestão | Endpoint existente | Esforço |
|---|----------|--------------------|---------|
| B1 | **Editar compromisso** (título, data, horário, descrição). Hoje só dá para cancelar e criar de novo. | `PATCH /compromissos/:id` | M |
| B2 | **Tela de cadastro** de conta. Hoje só entra quem está no seed. Depende de corrigir antes a falha de segurança S1. | `POST /auth/register` | M |
| B3 | **Criar agenda** nova (nome, tipo, cor). | `POST /agendas` | M |
| B4 | **Revogar acesso** de secretária (mesmo item A7). | `DELETE /agendas/:id/permissoes/:id` | P |
| B5 | **Permissões granulares** ao delegar: caixas para ver, criar, alterar e cancelar. Hoje o front manda sempre as quatro como `true`. | `POST /agendas/:id/permissoes` | P |
| B6 | **Horário de término ou duração** do compromisso. O campo `endTime` existe e o backend já checa conflito de horário, mas o formulário não envia. | `POST /compromissos` | P |
| B7 | **Marcar como concluído**. O status `COMPLETED` existe no banco e nunca é usado. Precisa de um pequeno ajuste no backend. | — | M |

## C. Experiência de uso da agenda

| # | Sugestão | Esforço |
|---|----------|---------|
| C1 | **Aviso de Telegram não conectado.** A conexão fica escondida no menu do avatar. Quem não conectou cria compromissos e nunca recebe lembrete, sem saber por quê. Mostrar uma faixa na aba Agenda ("Conecte o Telegram para receber lembretes") e avisar ao salvar. | P |
| C2 | **Visão de semana e de mês**, além da lista. É o que se espera de uma agenda; hoje é uma lista corrida de tudo que existe. | G |
| C3 | **Filtros na lista**: esconder cancelados por padrão, separar próximos de passados, busca por título. Hoje os cancelados ficam misturados para sempre. | M |
| C4 | **Abas na URL** (`/agenda`, `/acessos`…). Hoje recarregar a página volta para Agenda e o botão Voltar do navegador não funciona. `react-router` ou hash simples. | M |
| C5 | **Avisos como toast** fixo no canto, em vez da faixa no topo que some ao rolar a página. | P |
| C6 | **Atualização otimista**: depois de cada ação o front refaz as 6 chamadas de `loadInitialData`. Atualizar só o que mudou deixa a tela mais rápida. | M |
| C7 | **Carregar por papel**: o perfil USER também busca auditoria, status do worker e health, que ele nem vê. | P |
| C8 | **Atualização automática da aba Lembretes** (a cada 10–15 s enquanto estiver aberta). Hoje o status só muda ao recarregar. | P |
| C9 | **Mais opções de lembrete**: 1 dia antes, 2 horas antes, e mais de um lembrete por compromisso. | M |
| C10 | **Histórico do Assistente** some ao recarregar a página. Guardar na sessão do navegador. O campo também já vem preenchido com um exemplo. | P |
| C11 | **Compromissos recorrentes** (toda semana, todo mês). Exige mudança no banco. | G |
| C12 | **Dados do paciente** nas agendas profissionais (nome e telefone), já que o produto é de consultório. Exige mudança no banco. | G |
| C13 | **Fuso horário**: o front usa o fuso do navegador e o backend usa `APP_TIMEZONE`. Se alguém acessar de outro fuso, o horário exibido diverge do lembrete. Decidir uma regra e mostrar o fuso na tela. | M |

## D. Modo apresentação x produto

O plano 13 manteve os textos de arquitetura (JWT, PostgreSQL, RBAC, "Testar 403") para a apresentação.
Em vez de apagar depois, sugiro uma chave única:

| # | Sugestão | Esforço |
|---|----------|---------|
| D1 | Variável `VITE_DEMO_MODE`. Ligada: mostra `TechTag`, perfis rápidos de login, "Simular Erro", "Testar 403", rodapé de segurança e a coluna dos "três fluxos" no login. Desligada: a interface fica só com texto de produto. | M |
| D2 | Com o modo desligado, a secretária vê apenas as agendas autorizadas, sem a lista de todos os profissionais com botão de testar bloqueio. | P |
| D3 | Com o modo desligado, a aba Lembretes mostra só "seus lembretes" e esconde os controles do worker. | P |
| D4 | Trocar os rótulos em inglês que aparecem para o usuário (`USER`, `PROFESSIONAL`, `SECRETARY`, `CREATE`, `ACCESS_DENIED`, "Origem: WEB") por texto em português. | P |

## E. Organização do código do front

| # | Sugestão | Esforço |
|---|----------|---------|
| E1 | **Quebrar o `App.tsx`** (2.312 linhas, ~40 `useState`). Proposta: `pages/` (Login, Agenda, Acessos, Lembretes, Assistente, Auditoria), `components/` (ConfirmDialog, TechTag, Banner, cartões), `hooks/` (useAuth, useAppointments, useTelegramLink). Fazer antes de C2, B1 e D1, que mexem em muitas partes. | G |
| E2 | Centralizar as chamadas em `api.ts`. Hoje só o Telegram está lá; o resto usa `apiRequest` com a rota escrita no componente. Tratar 401 em um só lugar. | M |
| E3 | Tirar os `any` (`workerStats`, `healthData`, `err`, `import.meta as any`) e criar os tipos. | P |
| E4 | ESLint + Prettier e script `lint`. | P |
| E5 | Testes com Vitest + Testing Library: login, criar compromisso, cancelar com confirmação, abas por papel. | M |
| E6 | `ConfirmDialog` sem prisão de foco (Tab sai do diálogo) e sem devolver o foco ao botão que o abriu. | P |
| E7 | Falta favicon e `meta description` no `index.html`. | P |

## F. Segurança e infraestrutura (resumo da primeira revisão)

| # | Problema | Onde | Esforço |
|---|----------|------|---------|
| S1 | Qualquer pessoa se registra como ADMIN: o `role` vem do cliente. ADMIN ignora o RBAC. | `auth.dto.ts:31-34`, `auth.service.ts:75` | P |
| S2 | `GET /auth/demo-accounts` é público e lista todos os usuários com e-mail, telefone e chat do Telegram. | `auth.controller.ts:32-36` | P |
| S3 | Segredo JWT e senhas do Postgres e Grafana com valor padrão no código e no compose. | `auth.module.ts:14`, `jwt.strategy.ts:19`, `docker-compose.yml` | P |
| S4 | Endpoints do worker abertos a qualquer usuário logado; `status` mostra lembretes de todas as agendas. | `bot-webhook.controller.ts:49-87` | P |
| S5 | CORS `*` com credenciais; o compose não repassa `CORS_ORIGIN`. | `main.ts:10` | P |
| S6 | Sem limite de tentativas no login e sem helmet. | `main.ts` | P |
| S7 | Portas internas publicadas no host (5432, 3000, 9090, 3001); `/metrics` e `/health` públicos. | `docker-compose.yml` | P |
| S8 | `prisma db push --accept-data-loss` a cada inicialização, sem migrations versionadas. | `backend/Dockerfile:31` | M |
| S9 | Lembrete pode sair duplicado: a trava do worker é só em memória. | `notification.worker.ts:44` | M |
| S10 | Sem CI. Criar pipeline com lint, testes, build e build das imagens. | `.github/workflows` | M |
| S11 | Dockerfiles rodam como root, usam `npm install` e levam devDependencies; sem healthcheck no backend e no front. | `*/Dockerfile` | M |
| S12 | Grafana sem dashboards e Prometheus sem alertas. | `infra/monitoring` | M |
| S13 | nginx envia HSTS em HTTP e a porta 443 é publicada sem certificado. | `infra/nginx/nginx.conf` | P |
| S14 | Testes do backend cobrem só bot e vínculo do Telegram; faltam auth, RBAC, compromissos e worker. | `backend/src` | G |
| S15 | Sobras do WhatsApp no compose, `.env.example` e enum. | vários | P |

---

## Ordem sugerida

1. **Commitar** o que está pendente (planos 12–15 já aplicados).
2. **Bugs rápidos**: A1 a A8, mais S1 e S2.
3. **Planos 16 e 17**, que já estão escritos.
4. **E1** (quebrar o `App.tsx`), porque tudo que vem depois fica mais fácil e mais seguro de delegar.
5. **Produto**: C1, B1, B4/B5, B6, C3, C4.
6. **Infra**: S3 a S10, depois A9.
7. **Maiores**: D1 (modo apresentação), C2 (visão de semana/mês), B2/B3, C11/C12.

## Não verificado

Não li por inteiro `bot.service.ts`, `telegram.service.ts`, `appointments.service.ts` e `calendars.service.ts`.
Antes de planejar B7, C9, C11 e C13, conferir o que esses serviços já fazem.
