# 15 — Navegação por papel e rótulos curtos

## Objetivo
Reduzir as 5 abas técnicas ao que cada papel precisa, sem esconder nada da apresentação (o admin continua vendo tudo).

## Arquivos
- `frontend/src/App.tsx`

## Passos
1. Antes de implementar, conferir em `frontend/src/types.ts` e no seed (`backend/prisma/seed.ts`) quais papéis existem
   e qual perfil demo é admin. Se não houver papel admin, o PROFESSIONAL vê todas as abas.
2. Renomear as abas, tirando a numeração: "Agenda", "Acessos", "Lembretes", "Assistente", "Auditoria".
   O nome técnico antigo vira `TechTag` (plano 13) ao lado do título dentro da aba, não no botão.
3. Visibilidade por papel do usuário logado:
   - USER: Agenda, Assistente.
   - SECRETARY: Agenda, Acessos (só o painel "Agendas que gerencio"), Assistente.
   - PROFESSIONAL: Agenda, Acessos (só o painel de delegação), Lembretes, Assistente.
   - ADMIN (se existir): todas as 5.
   Se a aba ativa sumir ao trocar de conta, voltar para "Agenda".
4. Barra de abas acessível: `role="tablist"`; cada botão com `role="tab"`, `aria-selected` e `aria-controls`;
   setas ←/→ trocam de aba.
5. Mobile (`<sm`): ícone + rótulo curto e gradiente nas bordas da barra indicando que há rolagem.
6. Header: agrupar as ações do usuário (Telegram, Trocar Conta) num menu do avatar; "Trocar Conta" vira "Sair".

## Critérios de aceite
- `npm run build` passa.
- Login com cada perfil demo mostra só as abas da regra.
- Navegação por teclado funciona na barra de abas.

## NÃO alterar
- Regras de RBAC do backend (isto é só visual; o backend continua validando).
- Conteúdo interno das abas além do título.
