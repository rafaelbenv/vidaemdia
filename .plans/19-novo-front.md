# 19 — Novo front: uma tela de agenda e uma área de bastidores

Proposta de redesenho da estrutura do front. É um plano de direção: depois de aprovado, cada fase
do final vira um plano de execução próprio (`.plans/20-…`, `21-…`).

## Decisões já tomadas (respostas de 2026-11-10)

- **Público:** os dois, separados. O sistema vira um produto simples, e a demonstração técnica do
  trabalho vai para uma área à parte, "Bastidores".
- **O que incomoda:** informação demais na tela e navegação confusa. Aparência não foi apontada,
  então **cores, fonte e estilo de card do plano 12 continuam** (tons `stone`, verde `brand`, Figtree).
- **Tela principal:** ficou a meu critério. Escolhi **dia + tira da semana** (justificativa na seção 3).

## 1. O problema do front atual

O front atual foi montado em volta dos três fluxos do diagrama do trabalho, e não em volta do que a
pessoa quer fazer. O resultado:

- Cinco abas (Agenda, Acessos, Lembretes, Assistente, Auditoria), das quais só a primeira é uso do dia a dia.
  As outras quatro são vitrines de arquitetura.
- A aba Agenda mostra ao mesmo tempo o seletor de agendas, o formulário de criação e a lista,
  cada um com selos e etiquetas. Nada é o principal.
- Cada compromisso carrega até quatro etiquetas (status, origem, autor, lembrete com contagem de tentativas).
- A mesma agenda pode ser trocada em três lugares diferentes (aba Agenda, aba Acessos da secretária,
  select da delegação).

## 2. A ideia central

**O produto passa a ter uma tela só: a Agenda. Sem abas.**

Quem entra vê o dia de hoje e um botão para criar compromisso. Todo o resto vira ação dentro dessa
tela ou sai dela:

| Hoje | No novo front |
|------|---------------|
| Aba **Agenda** | Tela única do produto |
| Seletor de agendas (cartões na lateral) | Menu no cabeçalho: "Agenda do Dr. João ▾" |
| Formulário sempre aberto | Botão "Novo compromisso" que abre um painel |
| Aba **Acessos** (profissional delega) | Item "Compartilhar esta agenda" no menu da agenda |
| Aba **Acessos** (secretária escolhe profissional) | As agendas que ela gerencia aparecem no mesmo menu de agendas |
| Aba **Lembretes** (fila do worker, simular falha, celular simulado) | Bastidores. No produto fica só uma linha por compromisso: "Lembrete enviado às 07:30" |
| Aba **Assistente** (simulador do chat) | Bastidores. O assistente de verdade é o bot no Telegram |
| Aba **Auditoria** (logs, saúde, métricas) | Bastidores |
| Selos técnicos (`TechTag`), "Testar 403", rodapé de segurança | Só nos Bastidores |

## 3. Tela da Agenda

Por que dia + tira da semana, e não a grade semanal estilo Google Agenda: a grade é mais trabalhosa,
fica ruim no celular e, para quem tem de 3 a 10 compromissos por dia, mostra muito espaço vazio.
A lista do dia responde direto à pergunta "o que eu tenho agora?" e a tira da semana resolve o
"e nos outros dias?".

### Desktop

```
┌──────────────────────────────────────────────────────────────────────────┐
│  VidaEmDia     ● Agenda do Dr. João ▾                              (JM) ▾ │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Terça, 10 de novembro                       [Hoje]  ‹  ›   [+ Novo]    │
│                                                                          │
│    seg     ter     qua     qui     sex     sáb     dom                   │
│     9     [10]     11      12      13      14      15                    │
│     2       3       1       ·       2       ·       ·                    │
│   ────────────────────────────────────────────────────────────────────   │
│                                                                          │
│   08:00   Consulta Ana Souza                                             │
│           Lembrete enviado às 07:30                                      │
│                                                                          │
│   10:30   Retorno Pedro Lima                                             │
│           Trazer exames · Lembrete às 10:00                              │
│                                                                          │
│   15:00   Reunião da clínica                                             │
│           Lembrete falhou                                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Regras:

- Coluna única centralizada (largura de leitura), sem cartões aninhados. Cada compromisso é uma linha
  com o horário em destaque à esquerda.
- A tira da semana mostra o número de compromissos de cada dia. Clicar no dia troca a lista.
  `‹ ›` andam uma semana; "Hoje" volta para o dia atual.
- Cada linha tem no máximo **duas informações secundárias**: a descrição (se houver) e o estado do lembrete.
  Saem da linha: "Origem: WEB", "Criado por", contagem de tentativas e o selo AGENDADO.
- Cancelados não aparecem. Um link discreto no fim da lista, "Mostrar 2 cancelados", revela os do dia.
- Horários que já passaram ficam em cinza. O próximo compromisso do dia recebe um marcador "agora" ou "em 40 min".
- Clicar na linha abre o painel de edição. Não há botão "Cancelar" solto em cada linha.
- Na agenda de outra pessoa (secretária), uma faixa fina abaixo do cabeçalho diz
  "Você está na agenda de Dr. João Mendes", na cor da agenda. Se a secretária criou o compromisso,
  a linha mostra "por Maria" (só nesse caso).

### Estados do lembrete (texto, não selo)

| Situação | Texto na linha |
|----------|----------------|
| Agendado | "Lembrete às 07:30" |
| Enviado | "Lembrete enviado às 07:30" |
| Falhou | "Lembrete falhou" em vermelho, com ícone |
| Telegram não conectado | "Sem lembrete — conecte o Telegram" (link) |

### Celular

```
┌──────────────────────────┐
│ ● Dr. João ▾        (JM) │
├──────────────────────────┤
│ Terça, 10 de novembro    │
│  S   T   Q   Q   S   S   D│
│  9 [10] 11  12  13  14  15│
│ ──────────────────────── │
│ 08:00  Consulta Ana Souza│
│        Lembrete enviado  │
│ 10:30  Retorno Pedro Lima│
│        Lembrete às 10:00 │
│ 15:00  Reunião da clínica│
│        Lembrete falhou   │
│                          │
│                    (+)   │
└──────────────────────────┘
```

O botão de criar vira um botão fixo no canto inferior. A tira da semana desliza com o dedo.

### Dia vazio

"Nada marcado para terça, 10 de novembro." com o botão "Novo compromisso" logo abaixo.

### Visão de mês

Um seletor "Dia | Mês" ao lado do título da data alterna entre as duas visões. A escolha fica na URL
(`/agenda?visao=mes`), então recarregar a página mantém a visão.

```
   Novembro de 2026                    [Dia | Mês]   [Hoje]  ‹  ›   [+ Novo]

    seg      ter      qua      qui      sex      sáb      dom
                                                            1
     2        3        4        5        6        7        8
     1                 2                 1
     9      [10]      11       12       13       14       15
     2        3        1                 2
    16       17       18       19       20       21       22
              1                 4
    23       24       25       26       27       28       29
     1                          2
    30
```

- Cada dia mostra só o **número de compromissos** (sem títulos dentro da célula). O mês serve para
  enxergar a carga e pular de data, não para ler nem editar.
- Clicar em um dia abre a visão de dia naquela data. `‹ ›` andam um mês.
- Hoje fica destacado; dias passados ficam em cinza; dias com lembrete que falhou ganham um ponto vermelho.
- No celular a grade continua com sete colunas, com o número menor, e a lista do dia tocado aparece
  logo abaixo da grade, sem trocar de tela.
- Cancelados não entram na contagem.

## 4. Criar e editar compromisso

Um painel lateral no desktop (tela cheia no celular), o mesmo para criar e editar.

```
┌─ Novo compromisso ───────────── ✕ ┐
│  ● Agenda do Dr. João             │
│                                   │
│  O que é?                         │
│  [ Consulta Ana Souza           ] │
│                                   │
│  Dia              Horário         │
│  [ 10/11/2026 ]   [ 08:00 ]       │
│                                   │
│  Lembrete no Telegram             │
│  [ 30 minutos antes          ▾ ]  │
│                                   │
│  ▸ Mais opções                    │
│    (término, descrição)           │
│                                   │
│  [ Salvar ]                       │
└───────────────────────────────────┘
```

- Três campos visíveis, mais o lembrete. Término e descrição ficam em "Mais opções".
- O dia já vem preenchido com o dia que está aberto na agenda.
- Lembrete padrão: 30 minutos antes. Opções: sem lembrete, na hora, 15 min, 30 min, 1 hora, 1 dia antes.
  Some o select "Canal do Lembrete" de opção única.
- No modo edição, o rodapé ganha "Cancelar compromisso" (vermelho, com confirmação).
- Erros aparecem ao lado do campo. O aviso de sucesso é um toast curto no canto:
  "Compromisso salvo. Lembrete às 07:30."

## 5. Cabeçalho: dois menus

**Menu da agenda** (à esquerda, com a bolinha na cor da agenda):

```
  Minhas agendas
    ● Agenda Profissional        ✓
    ● Agenda Pessoal
  Agendas que gerencio
    ● Dra. Ana Lima
  ─────────────────────────
  Compartilhar esta agenda
  Histórico desta agenda
```

- "Agendas que gerencio" só aparece para quem recebeu acesso. Substitui o painel da secretária.
- "Compartilhar esta agenda" e "Histórico desta agenda" só aparecem quando a agenda aberta é da própria pessoa.
- "Nova agenda" fica fora desta versão (ver seção 14).

**Menu da conta** (avatar, à direita):

```
  João Mendes
  dr.joao@vidaemdia.com.br
  ─────────────────────────
  Telegram: conectado          Desconectar
  ─────────────────────────
  Bastidores (área técnica)
  Sair
```

O papel deixa de aparecer em inglês (`PROFESSIONAL`). Se for preciso mostrar, usa-se "Profissional",
"Secretária" ou "Usuário".

## 6. Compartilhar agenda

Página simples, aberta pelo menu da agenda, com um "Voltar para a agenda".

```
  ‹ Agenda        Compartilhar "Agenda Profissional"

  Quem tem acesso
    Maria Oliveira · secretaria.maria@…     Pode: ver, criar, alterar, cancelar   [Remover]

  Dar acesso a alguém
    E-mail  [                          ]
    Pode    [x] ver   [x] criar   [x] alterar   [x] cancelar
    [ Dar acesso ]
```

- Usa os endpoints que já existem, inclusive o de remover, que o front atual não usa.
- Vocabulário: "acesso" e "compartilhar". As palavras "RBAC", "delegação" e "permissão RBAC" saem.

## 6b. Histórico da agenda

Página aberta pelo menu da agenda, para o dono ver quem mexeu nela. É o caso do profissional que
quer saber o que a secretária marcou, alterou ou cancelou.

```
  ‹ Agenda        Histórico de "Agenda Profissional"

  Hoje
    09:12   Maria Oliveira marcou "Consulta Ana Souza" para 10/11 às 08:00
    08:40   Você cancelou "Retorno Carlos Reis" de 11/11 às 14:00

  Ontem
    17:05   Maria Oliveira alterou "Reunião da clínica" para 10/11 às 15:00
    16:30   Você deu acesso a Maria Oliveira
    11:02   Tentativa de acesso negada: Paula Dias
```

- Uma linha por acontecimento, em frase: quem, o que fez, em qual compromisso. Agrupado por dia,
  do mais recente para o mais antigo.
- Sem tabela, sem selos `CREATE` / `ACCESS_DENIED` e sem a coluna de papel em inglês.
- Tentativas de acesso negadas aparecem com ícone de alerta, porque é o que o dono mais precisa notar.
- Usa `GET /auditoria?calendarId=…`, que já existe e devolve os 100 registros mais recentes.
  Os logins não aparecem aqui (não são da agenda); continuam na tabela completa dos Bastidores.
- Ponto a conferir na fase: o campo `details` vem do backend como texto técnico pronto
  ("403 Acesso negado: Usuário (SECRETARY) tentou executar [VIEW]…"). A frase do histórico deve ser
  montada no front a partir de `action`, `actorUser` e `targetCalendar`; se faltar dado para isso
  (título e horário do compromisso), o plano da fase define um pequeno ajuste no backend.

## 7. Primeiro uso

Quem entra sem Telegram conectado vê, acima da lista, um cartão único:

```
  Receba seus lembretes no Telegram
  Sem conectar, os compromissos ficam salvos mas nenhum lembrete é enviado.
  [ Conectar Telegram ]                                        Agora não
```

Enquanto aguarda a confirmação, o cartão mostra "Abra o Telegram e toque em Iniciar". Ao conectar, some.
"Agora não" esconde o cartão naquela sessão; as linhas continuam mostrando "Sem lembrete — conecte o Telegram".

## 8. Login

Uma coluna só. Sai a coluna lateral que explica os "três fluxos arquiteturais".

```
        VidaEmDia
        Sua agenda com lembretes no Telegram

        E-mail   [                    ]
        Senha    [                    ]
        [ Entrar ]

        ▸ Entrar com uma conta de demonstração
```

- Campos vazios (hoje vêm preenchidos com e-mail e senha).
- As contas de demonstração ficam recolhidas em uma linha. Abertas, mostram três botões com nome e papel
  em português, sem selos.
- "Criar conta" fica fora desta versão (ver seção 14).

## 9. Bastidores

Rota própria (`/bastidores`), aberta pelo menu da conta. Visualmente diferente do produto: cabeçalho
escuro com o aviso "Área técnica — demonstração do trabalho" e um "Voltar para a agenda".
É aqui, e só aqui, que vivem os selos técnicos, os termos JWT, RBAC, PostgreSQL e Worker.

Organizada como roteiro de apresentação, com um menu lateral de cinco seções:

| Seção | O que mostra (tudo já existe hoje) |
|-------|------------------------------------|
| 1. Envio de lembretes | Estado do worker, fila de lembretes, "Executar agora", "Simular falha", celular simulado |
| 2. Assistente | Simulador do chat do bot |
| 3. Controle de acesso | Lista de profissionais com "Testar acesso" (mostra o 200 ou o 403) |
| 4. Auditoria | Tabela de logs |
| 5. Saúde do sistema | Cartões de health, link para métricas |

Cada seção abre com uma frase dizendo o que ela demonstra e qual parte do diagrama cobre.
No celular, o menu lateral vira uma lista de seções no topo.

Uma variável `VITE_SHOW_BASTIDORES` (ligada por padrão) esconde o item do menu e a rota quando desligada.

## 10. Vocabulário

| Hoje | Novo |
|------|------|
| RBAC, delegação, permissão RBAC | acesso, compartilhar |
| Worker, ciclo do worker | envio de lembretes |
| Chatbot, webhook | assistente |
| SCHEDULED / CANCELLED | agendado / cancelado |
| USER / PROFESSIONAL / SECRETARY | Usuário / Profissional / Secretária |
| "Entrar (Gerar JWT)" | "Entrar" |
| "Salvar Compromisso na Agenda" | "Salvar" |
| "Agendas Autorizadas (Pessoal / Profissional)" | "Minhas agendas" |

Nos Bastidores os termos técnicos continuam, porque lá eles são o assunto.

## 11. O que não muda

- Backend e contrato da API. Tudo aqui usa endpoints que já existem.
- Cores, fonte e estilo de card definidos no plano 12.
- Comportamentos já prontos: diálogo de confirmação, estados de carregamento, vínculo do Telegram por link.

Planos anteriores: o **plano 16** (painel "Hoje") fica substituído por este. Os itens do **plano 17**
(rótulos ligados aos campos, foco visível, contraste, alvos de toque de 44px, ícones no lugar de emojis)
viram critério de aceite de cada fase abaixo, em vez de um passo separado.

## 12. Fases de execução

Cada fase vira um plano próprio e pode ser entregue sozinha.

| Fase | Entrega | Depende de | Esforço |
|------|---------|------------|---------|
| 1. Estrutura | Quebrar o `App.tsx` em `pages/`, `components/`, `hooks/` e criar as rotas (`/entrar`, `/agenda`, `/agenda/compartilhar`, `/agenda/historico`, `/bastidores`). Sem mudança visual. | — | G |
| 2. Bastidores | Mover as abas Lembretes, Assistente, Auditoria e o teste de acesso para `/bastidores`. O produto fica só com a Agenda. | 1 | M |
| 3. Agenda nova | Lista do dia, tira da semana, linhas simplificadas, cancelados escondidos. | 1 | G |
| 4. Painel de compromisso | Criar e editar no painel lateral (usa `PATCH /compromissos/:id`). | 3 | M |
| 5. Visão de mês | Seletor "Dia \| Mês", grade com contagem por dia, lista do dia abaixo da grade no celular. | 3 | M |
| 6. Cabeçalho e compartilhamento | Menu de agendas, menu da conta, página de compartilhar com remover e caixas de acesso. | 2 | M |
| 7. Histórico da agenda | Página de histórico em frases, agrupada por dia. | 6 | M |
| 8. Primeiro uso e login | Cartão do Telegram, login em uma coluna, contas de demonstração recolhidas. | 6 | P |
| 9. Texto e acabamento | Vocabulário da seção 10, toasts, revisão no celular e de acessibilidade. | todas | M |

As fases 2 e 3 já entregam a maior parte da sensação de "mais simples": somem quatro abas e a tela
principal passa a ter um foco só.

## 13. Critérios de aceite gerais

- `npm run build` passa em todas as fases.
- Com cada conta de demonstração, a primeira tela depois do login é a agenda do dia, sem abas.
- Nenhum termo da coluna "Hoje" da seção 10 aparece fora de `/bastidores`.
- Criar, editar e cancelar um compromisso funciona em tela de 375px de largura, sem rolagem horizontal.
- Tudo que as abas Lembretes, Assistente e Auditoria fazem hoje continua disponível em `/bastidores`.
- Recarregar a página mantém a pessoa na mesma tela (rota na URL).

## 14. Decisões em aberto

Decididas em 2026-11-10:

- **Histórico para o profissional:** entra (seção 6b, fase 7).
- **Visão de mês:** entra (seção 3, fase 5).

Ainda em aberto:

1. **Quem vê os Bastidores.** Proposta: qualquer conta logada enquanto for trabalho de faculdade.
   Quando a falha S4 do plano 18 for corrigida no backend, restringir a Profissional e Admin.
2. **Criar conta e Nova agenda.** Recomendação: deixar as duas fora desta versão.
   As três contas do seed já cobrem os fluxos do trabalho, e cada conta já nasce com as agendas de que precisa.
   "Criar conta" ainda exigiria corrigir antes a falha S1 do plano 18 (registro aceitando papel ADMIN).
   Os endpoints continuam no backend e aparecem no Swagger, então dá para mostrá-los sem tela.
