# 06 — Frontend: conectar Telegram e esconder WhatsApp

## Arquivos
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/types.ts`

## Passos
1. `api.ts`: funções `getTelegramStatus()`, `createTelegramLink()`, `unlinkTelegram()` para os endpoints da tarefa 05.
2. Em `App.tsx`, na área de perfil/topo:
   - Não vinculado: botão "Conectar Telegram" → chama `createTelegramLink()` e abre `url` em nova aba; mostrar texto "Clique em Iniciar no Telegram e volte aqui". Fazer polling de `getTelegramStatus()` a cada 3 s por até 10 min até `linked = true`.
   - Vinculado: selo "Telegram conectado" + botão "Desconectar".
3. Remover opções/menções a WhatsApp dos selects de canal e textos (canal fixo Telegram). Não apagar os tipos.
4. Aba do chatbot: o simulador envia só `{ text }` (sem campo de e-mail/remetente nem seletor de canal).
5. Manter o estilo visual existente (Tailwind). Não reestruturar o arquivo além do necessário.

## Critérios de aceite
- `npm run build` no frontend passa sem erros de TypeScript.
- Nenhuma ocorrência visível de "WhatsApp" na interface.

## NÃO alterar
- Backend, lógica de login, abas de RBAC/auditoria.

## Complementos (contratos reais do backend, após a tarefa 05)
- `GET /telegram/status` → `{ linked: boolean, botUsername: string | null }`
- `POST /telegram/link` → `{ url: string, expiresAt: string }` (503 se o bot não estiver configurado: mostrar a mensagem de erro)
- `DELETE /telegram/link` → `{ ok, message }`
- `GET` do perfil passa a ter `telegramLinked: boolean` e não tem mais `telegramChatId`.
- `POST /notificacoes/bot/webhook` agora exige JWT e recebe só `{ text }`; resposta `{ botReply }` em HTML do Telegram (`<b>`, `<i>`, `<code>`). Mostrar o `botReply` convertendo só essas tags (ex.: troca para elementos React ou `dangerouslySetInnerHTML` APÓS remover qualquer tag que não seja b/i/code). Nunca injetar HTML sem esse filtro.
- Remover do formulário de cadastro/perfil os campos de chat_id do Telegram e de WhatsApp.
- Abrir o link com `window.open(url, '_blank', 'noopener')`.
- Polling de status: parar ao vincular, ao passar 10 min ou ao desmontar o componente (limpar o intervalo).
