# 08 — Validação ponta a ponta com o bot real

## Roteiro (usuário + Opus)
1. `.env`: `TELEGRAM_MODE=polling`, token e username preenchidos.
2. `docker compose up -d --build` + seed.
3. Logar como Carlos no site → "Conectar Telegram" → Iniciar no bot → site mostra "conectado".
4. No Telegram: `/ajuda`, `/agenda`, `Marcar Teste amanhã às 10:00` → compromisso aparece no site.
5. Criar no site um compromisso para daqui 32 min com lembrete de 30 min → em ~2 min chega o lembrete no Telegram; status `SENT` na aba de notificações.
6. Retry: `POST /notificacoes/simular-falha {failCount: 2}` → lembrete chega na 3ª tentativa; Grafana mostra falhas.
7. Desconectar no site → mandar `/agenda` → bot pede vínculo.
8. (Opcional) `TELEGRAM_MODE=webhook` com túnel `cloudflared tunnel --url http://localhost:3000` ou ngrok; repetir passo 4; testar POST sem header secreto → 401.

## Critério de aceite
Todos os passos 1–7 funcionando. Passo 8 se houver túnel disponível.
