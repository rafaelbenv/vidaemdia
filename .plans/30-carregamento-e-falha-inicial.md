# 30 — Tela de carregamento e aviso de falha na carga inicial (roteiro 2.2, itens A2 e A3)

## Problema
- **A2:** ao recarregar com sessão salva, a condição `if (!token || !user)` do `App.tsx` mostra o login por um instante,
  porque `user` ainda está sendo carregado.
- **A3:** em `loadInitialData`, erro que não seja 401 é engolido. Com o backend fora do ar, quem tem sessão
  fica preso na tela de login sem aviso. Se uma recarga feita depois de uma ação falhar, nada é avisado.

Não execute comandos de terminal. Use só ferramentas de arquivo.

## Arquivos (somente estes)
- Criar: `frontend/src/components/SessionLoading.tsx`, `frontend/src/components/SessionLoadError.tsx`
- Editar: `frontend/src/App.tsx`

## Passos

### 1. `components/SessionLoading.tsx`
Export nomeado `SessionLoading` (sem props). Tela cheia no mesmo fundo do login:
```tsx
<div className="min-h-screen bg-stone-900 flex items-center justify-center p-4" role="status" aria-live="polite">
  <div className="flex flex-col items-center gap-4 text-white">
    <div className="p-3 bg-brand-700 rounded-md">
      <CalendarIcon className="w-8 h-8 text-white" />   {/* import { Calendar as CalendarIcon } from 'lucide-react' */}
    </div>
    <div className="flex items-center gap-2 text-sm text-stone-200">
      <Loader2 className="w-4 h-4 animate-spin" />      {/* lucide-react */}
      Carregando sua agenda…
    </div>
  </div>
</div>
```

### 2. `components/SessionLoadError.tsx`
Export nomeado `SessionLoadError` com props `{ message: string; retrying: boolean; onRetry: () => void; onLogout: () => void }`.
Mesmo fundo (`min-h-screen bg-stone-900 flex items-center justify-center p-4`). Cartão
`bg-white rounded-lg border border-stone-200 p-6 max-w-sm w-full text-center`, com `role="alert"`:
- Ícone `CloudOff` (lucide-react) `w-8 h-8 text-stone-400 mx-auto mb-3`.
- Título `h1` `text-lg font-semibold text-stone-900`: "Não foi possível carregar sua agenda".
- Parágrafo `text-sm text-stone-600 mt-1`: `{message}`.
- Botões em `mt-5 flex flex-col gap-2`:
  - Primário "Tentar de novo": `w-full bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium py-2.5 rounded-md disabled:opacity-60`,
    `disabled={retrying}`. Enquanto `retrying`, mostrar `Loader2` girando e "Tentando…".
  - Secundário "Sair": `w-full text-sm text-stone-600 hover:text-stone-900 py-2`, chama `onLogout`.

### 3. `App.tsx`
a) Novo estado: `const [initialLoadError, setInitialLoadError] = useState<string | null>(null);`

b) Em `loadInitialData`:
- No início do `try`: `setInitialLoadError(null);`
- No `catch`, manter o tratamento de 401 e acrescentar, para qualquer outro erro:
  ```ts
  } else {
    const message = getErrorMessageByStatus(err?.status);
    if (!user) {
      setInitialLoadError(message);
    } else {
      setFeedbackBanner({ type: 'error', title: 'Não foi possível atualizar os dados.', detail: message });
    }
  }
  ```
  (`getErrorMessageByStatus` já existe em `lib/format.ts`. Erro de rede sem `status` cai na mensagem padrão "O servidor não respondeu…".)

c) Trocar o bloco `if (!token || !user) { return (<LoginPage .../>); }` por:
```tsx
if (!token) {
  return (<LoginPage ...mesmas props de hoje... />);
}
if (!user) {
  if (initialLoadError) {
    return (
      <SessionLoadError
        message={initialLoadError}
        retrying={loading}
        onRetry={() => loadInitialData(token)}
        onLogout={handleLogout}
      />
    );
  }
  return <SessionLoading />;
}
```

d) Em `handleLogout`, acrescentar `setInitialLoadError(null);`.

## Critérios de aceite
- `npm run build` e `npm run lint` (0 erros) em `frontend/`.
- Recarregar com sessão: não aparece o login; aparece "Carregando sua agenda…" e depois a agenda, na mesma URL.
- Com o backend parado e sessão salva: aparece o cartão de erro; "Tentar de novo" com o backend de volta abre a agenda; "Sair" vai para `/entrar`.
- Token inválido ou expirado (401): vai para `/entrar`, como hoje.
- Sem sessão: login igual a hoje.

## O que NÃO alterar
- `pages/`, outros `components/`, `api.ts`, `lib/`, hooks, backend.
- Os outros fluxos do `App.tsx`.
