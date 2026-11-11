# 14 — Estados: loading, confirmação e listas vazias

## Objetivo
Corrigir o P0 (cancelar compromisso sem confirmação) e os P1 de status (sem loading, clique duplo).

## Arquivos
- `frontend/src/App.tsx`

## Passos
1. Estado `submitting: Record<string, boolean>` com as chaves `saveAppt`, `cancelAppt:<id>`, `grant`, `worker`, `chat`, `telegram`.
   Cada handler marca a chave no início e desmarca no `finally`.
2. Botões Salvar (~1003), Conceder (~1256), Executar worker (~1328), Enviar do chat (~1554), Cancelar compromisso (~1117),
   Conectar/Desconectar Telegram:
   `disabled={submitting[chave]}`, classes `disabled:opacity-60 disabled:cursor-not-allowed`,
   ícone `RefreshCw` com `animate-spin` e rótulo no gerúndio ("Salvando…", "Cancelando…", "Enviando…").
3. Componente `ConfirmDialog` simples (`role="dialog"`, `aria-modal="true"`, fecha com Esc e clique no fundo,
   foco inicial no botão seguro). Cancelar compromisso abre:
   "Cancelar '<título>' de <dd/mm> às <hh:mm>?" com [Manter] e [Cancelar compromisso] (vermelho).
4. "Desconectar Telegram" e "Trocar Conta" também passam pelo `ConfirmDialog`.
5. Formulário de compromisso: `min` no input de data = hoje; erro inline abaixo do campo se data/hora estiver no passado
   (bloqueia o envio).
6. Listas vazias que faltam: fila de lembretes (~1364), tabela de auditoria (~1656) e histórico do chat.
   Cada uma com ícone lucide, uma frase dizendo o que é e uma dica de como popular.
7. Skeleton (3 linhas `bg-stone-100 animate-pulse rounded`) na lista de compromissos enquanto troca de agenda.

## Critérios de aceite
- `npm run build` passa.
- Clicar duas vezes rápido em Salvar cria só 1 compromisso.
- Cancelar sempre passa pelo diálogo; Esc fecha sem cancelar.

## NÃO alterar
- API e backend. O cancelamento continua soft (riscado na lista).
- Textos técnicos (ver plano 13).
