# 16 — Painel "Hoje" no topo da Agenda

## Objetivo
Dar foco à tela principal: o que acontece hoje. Hoje a aba Agenda divide a atenção entre seletor, formulário e lista ao mesmo tempo.

## Arquivos
- `frontend/src/App.tsx`

## Passos
1. No topo da aba Agenda, uma faixa "Hoje, <dia da semana>, <dd de mês>" com 3 números calculados dos compromissos já carregados:
   consultas hoje, próxima (hh:mm + título) e lembretes com falha.
   Se houver falhas, o número fica em vermelho e leva para a aba Lembretes.
   Formato: UMA faixa horizontal compacta (uma linha no desktop), texto em frase, por exemplo
   "**9 consultas** · próxima **08:00 Consulta Ana** · **2 lembretes falharam**". NÃO fazer cards de KPI com número gigante.
2. Reorganizar a aba no `lg`: lista de compromissos à esquerda (2/3), seletor de agenda + formulário à direita (1/3).
   No mobile: faixa Hoje → lista → botão "Novo compromisso" que expande o formulário (recolhido por padrão).
3. Lista agrupada por dia ("Hoje", "Amanhã", "<dd/mm>"), com o horário em destaque à esquerda
   (`text-base font-semibold tabular-nums`).
4. Cabeçalho do formulário: "Salvando em: ● <nome da agenda>", com a bolinha na cor da agenda.
5. Remover o select "Canal do Lembrete" de opção única; mostrar o texto fixo "Lembrete via Telegram".

## Critérios de aceite
- `npm run build` passa.
- Sem compromissos hoje, a faixa mostra "Nenhuma consulta hoje" e não quebra.
- No mobile os compromissos aparecem na primeira tela.

## NÃO alterar
- Chamadas de API (só derivar dados no front), backend, outras abas.
