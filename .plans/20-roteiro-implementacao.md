# 20 — Roteiro de implementação (dependências e sequência)

Junta o backlog do plano 18 e as fases do plano 19 em uma única ordem de execução.
Cada passo abaixo vira um plano de execução próprio em `.plans/` no momento em que for feito
(objetivo, arquivos, passos exatos, critérios de aceite, o que não alterar).

- Códigos como `A1`, `S4`, `C7` são os itens do plano 18.
- "Fase N" é a fase do plano 19.
- Esforço: **P** = até 1h, **M** = meio dia, **G** = um dia ou mais.

## 1. Sequência

Seguir na ordem. Um passo só começa quando os da coluna "Depende de" estiverem aprovados.

### Bloco 0 — Preparação

| Passo | Entrega | Cobre | Depende de | Esforço |
|-------|---------|-------|------------|---------|
| 0.1 | Commitar o que está pendente (planos 12–15 aplicados no `App.tsx`, planos 12–20). | — | — | P |
| 0.2 | Fazer o `agy` funcionar no modo headless: regra `permissions.allow` no settings dele ou sessão interativa para checar autenticação. Testar com uma tarefa de leitura pequena. | — | — | P |
| 0.3 | ESLint + Prettier no front e no backend, com script `lint`. | E4 | 0.1 | P |
| 0.4 | CI mínimo no GitHub Actions: lint, build do front, build e testes do backend. | S10 (parte 1) | 0.3 | M |

O CI entra cedo de propósito: todos os passos seguintes são delegados, e o CI é a conferência automática de cada um.

### Bloco 1 — Segurança do backend que não afeta o front

| Passo | Entrega | Cobre | Depende de | Esforço |
|-------|---------|-------|------------|---------|
| 1.1 | Registro público cria sempre `USER`; o campo `role` sai do `RegisterDto`. | S1 | 0.4 | P |
| 1.2 | Remover `GET /auth/demo-accounts`. Conferido: o front não usa esse endpoint. | S2 | 0.4 | P |
| 1.3 | `GET /auditoria?calendarId=…` passa a checar se o usuário tem acesso à agenda. Hoje, com `calendarId`, o filtro de dono é ignorado (`audit.service.ts:37-38`) e qualquer conta logada lê o histórico de qualquer agenda. | S16 (novo) | 0.4 | P |
| 1.4 | Limite de tentativas no login e no registro (`@nestjs/throttler`) e `helmet`. | S6 | 0.4 | P |
| 1.5 | Testes de auth e de controle de acesso por agenda, cobrindo 1.1 e 1.3. | S14 (parte 1) | 1.1, 1.3 | M |

### Bloco 2 — Estrutura do front (Fase 1)

| Passo | Entrega | Cobre | Depende de | Esforço |
|-------|---------|-------|------------|---------|
| 2.1 | Quebrar o `App.tsx` em `pages/`, `components/`, `hooks/` e criar as rotas (`/entrar`, `/agenda`, `/agenda/compartilhar`, `/agenda/historico`, `/bastidores`). Sem mudança visual. Chamadas centralizadas em `api.ts`, com 401 tratado em um lugar só. | Fase 1, E1, E2, C4 | 0.4 | G |
| 2.2 | Tela de carregamento enquanto a sessão é validada (fim do "pisca" do login) e aviso quando a carga inicial falha. | A2, A3 | 2.1 | P |
| 2.3 | Base da API vira `/api` por padrão; `VITE_API_URL` só para desenvolvimento. Ajustar o proxy do Vite. | A8 | 2.1 | P |
| 2.4 | Tailwind sai do CDN e passa a ser compilado (`tailwind.config`, PostCSS), levando junto as cores `brand` e a fonte que hoje estão no `index.html`. | A9 | 2.1 | M |
| 2.5 | Tipos no lugar dos `any` (`workerStats`, `healthData`, erros de API). | E3 | 2.1 | P |

O passo 2.1 é o maior risco do roteiro: é uma refatoração grande sem mudança visível. Critério de aceite
obrigatório: as três contas de demonstração fazem exatamente o mesmo de antes.

### Bloco 3 — Bastidores (Fase 2)

| Passo | Entrega | Cobre | Depende de | Esforço |
|-------|---------|-------|------------|---------|
| 3.1 | Mover Lembretes, Assistente, Auditoria, saúde do sistema e o teste de acesso para `/bastidores`, com menu lateral de cinco seções. O produto fica só com a Agenda. Variável `VITE_SHOW_BASTIDORES`. | Fase 2, D1, D2, D3 | 2.1 | M |
| 3.2 | Carregar dados por tela: a Agenda deixa de buscar auditoria, status do worker e health. Só os Bastidores buscam. | C7, C6 (parte) | 3.1 | P |
| 3.3 | Nos Bastidores: atualização automática dos lembretes, tentativas vindas de `maxRetries`, link de métricas pela base da API, histórico do chat guardado na sessão. | C8, A6, A4, C10 | 3.1, 2.3 | P |
| 3.4 | Backend: `GET /notificacoes/status` devolve só lembretes das agendas que o usuário pode ver; `executar-worker` e `simular-falha` ficam restritos a Profissional e Admin. | S4 | 3.2 | P |

O passo 3.4 só pode vir depois do 3.2. Hoje o front chama `/notificacoes/status` na carga inicial
para todos os papéis; restringir antes faria a conta de usuário comum quebrar ao entrar.

### Bloco 4 — Agenda nova (Fases 3, 4 e 5)

| Passo | Entrega | Cobre | Depende de | Esforço |
|-------|---------|-------|------------|---------|
| 4.1 | Lista do dia, tira da semana, linhas simplificadas, estado do lembrete em texto, cancelados escondidos. | Fase 3, C2 (dia/semana), C3 | 3.1 | G |
| 4.2 | Painel lateral de criar e editar: três campos, lembrete, "Mais opções" com término e descrição, cancelar com confirmação. Mensagem de sucesso com o horário real do lembrete. | Fase 4, B1, B6, A1, C9 | 4.1 | M |
| 4.3 | Visão de mês com seletor "Dia \| Mês" e contagem por dia. | Fase 5, C2 (mês) | 4.1 | M |

Conferido no backend: o lembrete aceita de 0 a 10.080 minutos, então "1 dia antes" não exige mudança.
Vários lembretes por compromisso ficam fora desta versão.

### Bloco 5 — Cabeçalho, compartilhamento e histórico (Fases 6 e 7)

| Passo | Entrega | Cobre | Depende de | Esforço |
|-------|---------|-------|------------|---------|
| 5.1 | Menu de agendas e menu da conta no cabeçalho. Faixa "Você está na agenda de…". | Fase 6 (parte) | 3.1 | M |
| 5.2 | Página de compartilhar: lista de quem tem acesso, remover, caixas de ver, criar, alterar e cancelar. | Fase 6, A7, B4, B5 | 5.1 | M |
| 5.3 | Página de histórico da agenda, em frases agrupadas por dia. | Fase 7 | 5.1, 1.3 | M |

Conferido no backend: os registros de auditoria de compromisso já guardam título e horário em `metadata`,
então as frases do histórico podem ser montadas no front sem alterar o backend. Falta confirmar, ao
escrever o plano do 5.3, se os registros de acesso concedido, removido e negado trazem o nome da outra pessoa.

### Bloco 6 — Primeiro uso, login e acabamento (Fases 8 e 9)

| Passo | Entrega | Cobre | Depende de | Esforço |
|-------|---------|-------|------------|---------|
| 6.1 | Cartão "Receba seus lembretes no Telegram" na Agenda para quem não conectou. | Fase 8, C1 | 4.1, 5.1 | P |
| 6.2 | Login em uma coluna, campos vazios, contas de demonstração recolhidas e sem depender do campo de senha. | Fase 8, A5 | 2.1 | P |
| 6.3 | Vocabulário da seção 10 do plano 19, avisos como toast, rótulos em português. | Fase 9, C5, D4 | 4.2, 5.3 | M |
| 6.4 | Acessibilidade e celular: rótulos ligados aos campos, foco visível, contraste, alvos de 44px, ícones no lugar de emojis, foco preso no diálogo, favicon e descrição da página. | Plano 17, E6, E7 | 6.3 | M |
| 6.5 | Testes do front (Vitest + Testing Library): login, criar, editar e cancelar compromisso, troca de agenda, visão de mês. Incluir no CI. | E5 | 6.3 | M |

### Bloco 7 — Infraestrutura

Mexe em arquivos diferentes do front, então pode ser intercalado com os blocos 4 a 6 se convier.
As dependências internas precisam ser respeitadas.

| Passo | Entrega | Cobre | Depende de | Esforço |
|-------|---------|-------|------------|---------|
| 7.1 | Migrations versionadas do Prisma no lugar do `db push --accept-data-loss`. Criar a migration inicial e marcar como aplicada no banco que já existe. | S8 | 0.4 | M |
| 7.2 | Worker reserva o lembrete no banco antes de enviar, para não duplicar com mais de uma réplica. Pode exigir novo valor no enum de status. | S9 | 7.1 | M |
| 7.3 | Remover sobras do WhatsApp: variáveis no compose e no `.env.example`, valores `WHATSAPP` e `BOTH` dos enums, tipos do front. | S15 | 7.1, 6.3 | M |
| 7.4 | Segredos sem valor padrão: o backend não sobe sem `JWT_SECRET`; senhas do Postgres e do Grafana vêm só do `.env`. Atualizar README e os segredos do CI. | S3 | 0.4 | P |
| 7.5 | CORS restrito à origem configurada, repassada pelo compose. | S5 | 2.3 | P |
| 7.6 | Publicar no host só o nginx. Postgres, backend, Prometheus e Grafana ficam na rede interna (ou atrás do nginx). | S7 | 2.3, 3.3 | P |
| 7.7 | nginx: HSTS só em HTTPS; remover a porta 443 ou configurar certificado. | S13 | 7.6 | P |
| 7.8 | Dockerfiles: `npm ci`, usuário sem privilégio, só dependências de produção na imagem final, healthcheck no backend e no front. | S11 | 7.1 | M |
| 7.9 | CI completo: build das imagens e verificação de vulnerabilidades. | S10 (parte 2) | 7.8 | M |
| 7.10 | Dashboards do Grafana provisionados e regras de alerta no Prometheus. | S12 | 7.6 | M |
| 7.11 | Testes de compromissos (conflito de horário) e do worker. | S14 (parte 2) | 7.2 | M |

### Bloco 8 — Sincronização com o Google Agenda (nos dois sentidos)

Adicionado em 2026-11-12, por sugestão do professor. Análise completa e regras decididas em `.plans/29-google-agenda-analise.md`.
Compromissos criados no VidaEmDia vão para o Google Agenda e vice-versa; os importados também recebem lembrete pelo Telegram.

| Passo | Entrega | Cobre | Depende de | Esforço |
|-------|---------|-------|------------|---------|
| 8.1 | Projeto no Google Cloud, variáveis `GOOGLE_*`, tabela `GoogleAccount` com token criptografado, conectar e desconectar (OAuth). | G1 | 7.1, 7.4 | M |
| 8.2 | Ligar uma agenda do VidaEmDia a uma agenda do Google (só o dono); listar as agendas do Google. | G2 | 8.1 | P |
| 8.3 | VidaEmDia → Google: fila de saída (`GoogleSyncJob`) alimentada por criar, alterar e cancelar, mais o worker com tentativas. | G3 | 8.2, 7.2 | M |
| 8.4 | Google → VidaEmDia: carga inicial e incremental (`syncToken`, 410), sem eco, cancelamento. | G4 | 8.3 | G |
| 8.5 | Regras: conflito sinalizado (não recusado), dia inteiro (lembrete às 8h), privacidade ("Ocupado" para quem não é dono), convites recusados, última alteração vence. | G5 | 8.4 | G |
| 8.6 | Front: conectar, escolher agenda, marcas "Google", "Conflito", "Dia inteiro" e "Ocupado", opção "Dia inteiro" no painel. | G6 | 8.5, 4.2 | M |
| 8.7 | Testes (client do Google com mock) e métricas de sincronização. | G7 | 8.5 | M |

Atenção: em modo de teste no Google, o refresh token expira em 7 dias. Para a apresentação, reconectar antes.

## 2. Dependências que mais importam

Estas são as ordens que não podem ser invertidas, com o motivo:

1. **2.1 antes de todo o front novo.** Todas as fases mexem no mesmo arquivo de 2.312 linhas; sem quebrar antes, cada passo vira conflito com o anterior.
2. **3.2 antes de 3.4.** Restringir os endpoints do worker enquanto a Agenda ainda os chama quebra o login do usuário comum.
3. **2.3 antes de 7.5 e 7.6.** Enquanto o front chamar `localhost:3000` direto, fechar a porta 3000 ou restringir o CORS derruba o sistema.
4. **1.3 antes de 5.3.** A página de histórico usa o endpoint de auditoria por agenda, que hoje não checa acesso.
5. **7.1 antes de qualquer mudança no banco** (7.2 e 7.3). Sem migrations, a mudança é aplicada com `--accept-data-loss`.
6. **7.3 depois de 6.3.** O front ainda converte `WHATSAPP` e `BOTH` para "TELEGRAM" na tela; tirar os valores do enum antes quebra os tipos.
7. **0.4 antes de tudo que é delegado.** O CI é a conferência de cada entrega.
8. **7.1, 7.2 e 7.4 antes do Bloco 8.** Ele muda o banco, guarda credencial do Google e tem worker próprio, que precisa da reserva no banco para não duplicar.

## 3. Onde foi parar cada item do plano 18

| Item | Destino |
|------|---------|
| A1 | 4.2 |
| A2, A3 | 2.2 |
| A4, A6 | 3.3 |
| A5 | 6.2 |
| A7 | 5.2 |
| A8 | 2.3 |
| A9 | 2.4 |
| B1, B6 | 4.2 |
| B4, B5 | 5.2 |
| B2 (criar conta), B3 (nova agenda) | Fora desta versão, por decisão de 2026-11-10 |
| B7 (marcar como concluído) | Fora desta versão |
| C1 | 6.1 |
| C2 | 4.1 e 4.3 |
| C3 | 4.1 (busca por título fica fora) |
| C4 | 2.1 |
| C5 | 6.3 |
| C6, C7 | 3.2 |
| C8, C10 | 3.3 |
| C9 | 4.2 (um lembrete por compromisso; vários ficam fora) |
| C11 (recorrência), C12 (dados do paciente) | Fora desta versão; exigem mudança no banco |
| C13 (fuso horário) | Fora desta versão; registrar no README que o sistema assume o fuso de São Paulo |
| D1, D2, D3 | 3.1 (substituídos pela área de Bastidores) |
| D4 | 6.3 |
| E1, E2 | 2.1 |
| E3 | 2.5 |
| E4 | 0.3 |
| E5 | 6.5 |
| E6, E7 | 6.4 |
| S1 | 1.1 |
| S2 | 1.2 |
| S3 | 7.4 |
| S4 | 3.4 |
| S5 | 7.5 |
| S6 | 1.4 |
| S7 | 7.6 |
| S8 | 7.1 |
| S9 | 7.2 |
| S10 | 0.4 e 7.9 |
| S11 | 7.8 |
| S12 | 7.10 |
| S13 | 7.7 |
| S14 | 1.5 e 7.11 |
| S15 | 7.3 |
| S16 (novo) | 1.3 |

Planos antigos: o 16 está substituído pelo 19 (não implementar); o 17 está coberto pelo passo 6.4.

## 4. Se o prazo apertar

Ordem de corte, do que sai primeiro para o que sai por último:

1. 7.10, 7.11, 7.9 (dashboards, testes extras, CI completo).
2. 6.5 (testes do front) e 2.5 (tipos).
3. 4.3 (visão de mês) e 5.3 (histórico).
4. 7.2, 7.3, 7.8.

Bloco 8, se o prazo apertar: sai primeiro o 8.7; depois o 8.4 e o 8.5 (fica só VidaEmDia → Google, que já demonstra a integração).
Mínimo da integração: 8.1, 8.2, 8.3 e a parte de "conectar" do 8.6.

Mínimo para apresentar o novo front com segurança básica:
blocos 0, 1 (sem 1.5), 2 (sem 2.5), 3, passos 4.1 e 4.2, 5.1 e 5.2, 6.2 e 6.3, mais 7.1 e 7.4.

## 5. Decisões que ainda dependem de você

1. **Quem vê os Bastidores.** O passo 3.4 assume Profissional e Admin para os botões de executar e simular falha.
   Como o seed não tem Admin, a apresentação dessa parte seria feita com a conta do Dr. João.
   Se a conta de usuário comum também precisar demonstrar, o 3.4 muda.
2. **Porta 443 no nginx (7.7).** Remover, ou configurar um certificado autoassinado para mostrar HTTPS na apresentação.
3. **Monitoramento atrás do nginx (7.6).** Grafana e Prometheus só na rede interna, ou acessíveis por um caminho como `/grafana`.

## 6. Como executar cada passo

1. Escrever o plano do passo em `.plans/NN-nome.md`.
2. Delegar ao `agy` (depende do passo 0.2).
3. Revisar o diff, rodar build, lint e testes.
4. Conferir na tela, com as três contas de demonstração, quando o passo mexer no front.
5. Commitar um passo por commit, para poder desfazer sem perder os seguintes.
