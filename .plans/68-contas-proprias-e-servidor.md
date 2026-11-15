# 68 — Contas próprias e ida para um servidor público (Bloco 9, para fazer depois)

Criado em 2026-11-15. É um roteiro, como o plano 20: cada passo vira um plano próprio (`69-...`, `70-...`) na hora de executar, com arquivos exatos e critérios de aceite.

## Objetivo

Qualquer pessoa cria a própria conta e passa a usar o VidaEmDia de verdade, num servidor público: agenda pessoal, lembretes pelo Telegram e Google Agenda, sem depender das contas do seed.

## Decisões (2026-11-15)

| Tema | Decisão |
|------|---------|
| Tipo de conta no cadastro | Só **uso pessoal** (papel `USER`), que é o foco do projeto. Profissional e secretária ficam para uma evolução futura; até lá o Admin muda o papel de uma conta. A tela de cadastro não oferece escolha. |
| Senha esquecida | Código de recuperação pelo **bot do Telegram**. Só funciona para quem vinculou o Telegram; a tela avisa isso no cadastro. |
| Ambiente | **Servidor público**: HTTPS, domínio, segredos novos, Google fora do modo de teste, termos de uso e LGPD. |
| Contas de demonstração | Escondidas por variável (`VITE_SHOW_DEMO_ACCOUNTS`). Por padrão ficam desligadas; ligar só na apresentação. |

## O que já existe

- `POST /auth/register` (`backend/src/auth/auth.service.ts`): cria `USER`, cria a agenda pessoal, registra auditoria e devolve o login. Limite de 5 cadastros por minuto por IP. Senha mínima de 6 caracteres.
- Vínculo do Telegram por link (`TelegramLinkToken`, `telegram-link.service.ts`) e cartão "Receba seus lembretes no Telegram" (plano 44).
- Bastidores controlados por `VITE_SHOW_BASTIDORES` (hoje ligados por padrão).

## Bloco 9A — Cadastro e primeiro uso (app)

| Passo | Entrega | Depende de | Esforço |
|-------|---------|------------|---------|
| 9.1 | Ajustes no cadastro do backend: senha mínima de 8 caracteres com letra e número; nome com no máximo 80 caracteres; e-mail normalizado também no login; nome da agenda pessoal "Minha agenda"; mensagem de e-mail já usado que não confirma se a conta existe ("Não foi possível criar a conta com este e-mail"). Testes no `auth.service.spec.ts` e `auth.dto.spec.ts`. | — | P |
| 9.2 | Tela **Criar conta** (`/criar-conta`): nome, e-mail, senha com confirmação, aceite dos termos (9.9). Link "Criar conta" na tela de login e "Já tenho conta" na de cadastro. Erros por campo, no padrão do login. Ao terminar, entra direto na agenda. | 9.1 | M |
| 9.3 | Contas demo atrás de `VITE_SHOW_DEMO_ACCOUNTS` (padrão desligado), como já é feito com os Bastidores. Documentar no README. | — | P |
| 9.4 | **Primeiro uso**: na primeira entrada de uma conta nova, a agenda vazia mostra um passo a passo curto: 1) vincular o Telegram (com o aviso de que ele também recupera a senha), 2) criar o primeiro compromisso, 3) conectar o Google Agenda (opcional). Cada passo some quando é feito; dá para dispensar. | 9.2 | M |
| 9.5 | Tela **Minha conta** (no menu do usuário): mudar nome, trocar senha (pede a atual), ver o Telegram e o Google vinculados. Rotas `PATCH /auth/me` e `POST /auth/me/senha`, com auditoria. | 9.2 | M |
| 9.6 | **Recuperar senha pelo Telegram**. Backend: tabela `PasswordResetCode` (código de 6 dígitos guardado com hash, expira em 15 min, uso único, no máximo 5 tentativas); `POST /auth/senha/esqueci` recebe o e-mail e, se a conta tiver Telegram, o bot envia o código (a resposta é sempre a mesma, com ou sem conta); `POST /auth/senha/redefinir` recebe e-mail, código e senha nova. Limite de pedidos por IP e por e-mail. Front: link "Esqueci a senha" no login, com duas etapas (e-mail, depois código e senha nova). Quem não tem Telegram vinculado vê uma orientação para falar com o suporte. Testes de expiração, reuso e excesso de tentativas. | 9.5 | G |
| 9.7 | **Excluir minha conta** (LGPD) em Minha conta: confirma com a senha, revoga o Google, desvincula o Telegram e apaga o usuário com as agendas e compromissos (o `onDelete: Cascade` já cobre a maior parte; conferir auditoria e fila do Google). | 9.5 | M |
| 9.8 | Isolamento entre contas: revisar o que uma conta nova consegue ver das outras. `GET /agendas/profissionais` hoje lista todos os profissionais para qualquer usuário; os Bastidores e o "Teste de acesso" mostram dados de demonstração. Para o servidor, limitar a lista a quem precisa e desligar os Bastidores (`VITE_SHOW_BASTIDORES=false`). Testes de acesso negado entre duas contas novas. | 9.2 | M |

## Bloco 9B — Ir para um servidor público (infra)

| Passo | Entrega | Depende de | Esforço |
|-------|---------|------------|---------|
| 9.9 | **Termos de uso e política de privacidade** (páginas estáticas no front, linkadas no cadastro): que dados guardamos, para que, Telegram e Google como terceiros, como excluir a conta. O Google exige o link da política para sair do modo de teste. | 9.2 | P |
| 9.10 | Escolher onde hospedar e o domínio (decisão do usuário: VPS com Docker Compose é o caminho mais curto, porque o projeto já roda inteiro no Compose). | — | P |
| 9.11 | **HTTPS**: certificado Let's Encrypt no nginx (ou proxy como Caddy na frente), porta 443 de volta, redirecionar 80 → 443, HSTS. Cookies e CORS para o domínio real (`FRONTEND_URL`, lista do CORS). | 9.10 | M |
| 9.12 | **Segredos de produção**: senhas novas do Postgres (com `ALTER USER`) e do Grafana, `JWT_SECRET` e `GOOGLE_TOKEN_ENC_KEY` novos, `.env` só no servidor. Nunca rodar o seed em produção (ele apaga as agendas das contas demo); bloquear o seed quando `NODE_ENV=production`. | 9.10 | P |
| 9.13 | **Google em produção**: redirect URI e origem com o domínio; publicar o app OAuth (sair do modo de teste, para o token não vencer em 7 dias). Os escopos de agenda são sensíveis, então o Google pede verificação (política de privacidade, domínio verificado, vídeo de demonstração). Até a verificação sair, dá para usar com até 100 usuários de teste. | 9.9, 9.11 | M |
| 9.14 | **Telegram em produção**: modo `webhook` com a URL HTTPS do domínio e o segredo do webhook. | 9.11 | P |
| 9.15 | **Backups e monitoramento no servidor**: backup diário fora do servidor (cópia para outro lugar), teste de restauração, Grafana protegido por senha forte ou só por túnel, alerta de disco cheio. | 9.12 | M |
| 9.16 | **Deploy pelo CI**: publicar as imagens num registro e atualizar o servidor (por exemplo `docker compose pull && up -d` via SSH) quando houver push na `main`, com as migrations aplicadas ao subir. | 9.11 | M |

## Ordem sugerida

1. 9.1, 9.3, 9.2 e 9.4: já dá para criar conta e usar localmente.
2. 9.5 e 9.6: conta completa, com troca e recuperação de senha.
3. 9.8, 9.9 e 9.7: pronto para pessoas de fora.
4. 9.10 a 9.16: servidor.

Se o prazo apertar, o mínimo para pessoas reais usarem é: 9.1, 9.2, 9.3, 9.8, 9.9, 9.11, 9.12 e 9.14.

## Fica fora deste bloco

- Cadastro como profissional e convite de secretária pelo próprio app (evolução futura; ver a decisão acima).
- Confirmação de e-mail e recuperação por e-mail (exigem um serviço de e-mail).
- Login com o Google como forma de entrar (hoje o Google só serve para a agenda).
- Vários fusos horários (o sistema assume São Paulo).

## Decisões que ainda dependem do usuário

1. Onde hospedar e qual domínio (9.10).
2. Contato de suporte para quem esqueceu a senha e não vinculou o Telegram (9.6).
3. Quem é o responsável pelos dados nos termos de uso (nome ou e-mail de contato) (9.9).
