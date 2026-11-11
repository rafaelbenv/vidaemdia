# 17 — Acessibilidade e mobile

## Objetivo
Corrigir as falhas de acessibilidade e de toque encontradas na crítica.

## Arquivos
- `frontend/src/App.tsx`

## Passos
1. Todo `<label>` ganha `htmlFor` e todo input/select ganha o `id` correspondente (login, compromisso, delegação, chat).
2. Foco visível em todo elemento interativo:
   `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2`
   (botões, abas, cards de agenda, selects, input de e-mail da delegação).
3. Contraste: `text-stone-400` em texto informativo vira `text-stone-500` (ou `stone-600` sobre `stone-50`);
   `text-emerald-200` sobre `emerald-600` (~1504) vira `text-white/90`.
4. Status não depende só de emoji ou cor: cada status de lembrete tem texto ("Enviado", "Falhou", "Pendente 1/3").
   A agenda selecionada ganha ícone `Check`, além da borda.
   Trocar os emojis usados como ícone na UI (👤🩺🗂️✅❌✈️⚠️) por ícones lucide-react equivalentes
   (User, Stethoscope, FolderOpen, CheckCircle2, XCircle, Send, AlertTriangle), mesmo tamanho e traço.
   Emojis dentro de mensagens do bot/Telegram (conteúdo vindo do backend) ficam como estão.
5. Alvos de toque de pelo menos 44px no mobile: fechar do banner, Cancelar, Desconectar, chips do chat (`min-h-11` abaixo de `sm`).
6. Chat e mock de celular: trocar `h-96` e `max-h-[460px]` fixos por `max-h-[60vh]` no mobile.
7. Tabela de auditoria abaixo de `md`: virar lista de cartões (data, ator, ação); manter a tabela no desktop.
8. Polling do Telegram: pausar quando `document.hidden` e retomar no evento `visibilitychange`.

## Critérios de aceite
- `npm run build` passa.
- Todo label tem `htmlFor`.
- A jornada login → criar compromisso → cancelar funciona só com teclado, com foco sempre visível.

## NÃO alterar
- Lógica de negócio, backend, textos.
