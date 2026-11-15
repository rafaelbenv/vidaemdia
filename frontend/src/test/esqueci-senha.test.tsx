import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { installMockApi, calls } from './mockApi';
import { renderApp } from './renderApp';

describe('Recuperar Senha', () => {
  beforeEach(() => {
    installMockApi();
  });

  it('"Esqueci a senha" no login abre "Recuperar a senha"', async () => {
    const { user } = renderApp({ path: '/entrar' });

    const forgotBtn = screen.getByRole('button', { name: /esqueci a senha/i });
    await user.click(forgotBtn);

    expect(await screen.findByRole('heading', { name: /recuperar a senha/i })).toBeInTheDocument();
  });

  it('e-mail vazio mostra "Informe um e-mail válido." e não chama a API', async () => {
    const { user } = renderApp({ path: '/esqueci-senha' });

    const submitBtn = screen.getByRole('button', { name: /enviar código/i });
    await user.click(submitBtn);

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(calls().filter((c) => c.path.includes('/auth/senha/esqueci'))).toHaveLength(0);
  });

  it('"Enviar código" chama /auth/senha/esqueci e mostra a etapa do código', async () => {
    const { user } = renderApp({ path: '/esqueci-senha' });

    await user.type(screen.getByLabelText(/^e-mail$/i), 'carlos@vidaemdia.com.br');
    const submitBtn = screen.getByRole('button', { name: /enviar código/i });
    await user.click(submitBtn);

    const forgotCalls = calls().filter((c) => c.path.includes('/auth/senha/esqueci'));
    expect(forgotCalls).toHaveLength(1);
    expect(forgotCalls[0].body).toEqual({ email: 'carlos@vidaemdia.com.br' });

    expect(
      await screen.findByText(/código enviado para o telegram da conta carlos@vidaemdia\.com\.br/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^código$/i)).toBeInTheDocument();
  });

  it('código com 5 números mostra "O código tem 6 números."', async () => {
    const { user } = renderApp({ path: '/esqueci-senha' });

    await user.type(screen.getByLabelText(/^e-mail$/i), 'carlos@vidaemdia.com.br');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    expect(await screen.findByLabelText(/^código$/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^código$/i), '12345');
    await user.type(screen.getByLabelText(/^nova senha$/i), 'novaSenha123');
    await user.type(screen.getByLabelText(/^confirmar nova senha$/i), 'novaSenha123');

    await user.click(screen.getByRole('button', { name: /criar senha nova/i }));

    expect(await screen.findByText('O código tem 6 números.')).toBeInTheDocument();
    expect(calls().filter((c) => c.path.includes('/auth/senha/redefinir'))).toHaveLength(0);
  });

  it('código errado mostra a mensagem do servidor', async () => {
    const { user } = renderApp({ path: '/esqueci-senha' });

    await user.type(screen.getByLabelText(/^e-mail$/i), 'carlos@vidaemdia.com.br');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    expect(await screen.findByLabelText(/^código$/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^código$/i), '654321');
    await user.type(screen.getByLabelText(/^nova senha$/i), 'novaSenha123');
    await user.type(screen.getByLabelText(/^confirmar nova senha$/i), 'novaSenha123');

    await user.click(screen.getByRole('button', { name: /criar senha nova/i }));

    expect(
      await screen.findByText('Código inválido ou expirado. Peça um novo código.'),
    ).toBeInTheDocument();
  });

  it('código "123456" + senha válida volta ao login com o e-mail preenchido, e entrar com a senha nova funciona', async () => {
    const { user } = renderApp({ path: '/esqueci-senha' });

    await user.type(screen.getByLabelText(/^e-mail$/i), 'carlos@vidaemdia.com.br');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    expect(await screen.findByLabelText(/^código$/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^código$/i), '123456');
    await user.type(screen.getByLabelText(/^nova senha$/i), 'novaSenha123');
    await user.type(screen.getByLabelText(/^confirmar nova senha$/i), 'novaSenha123');

    await user.click(screen.getByRole('button', { name: /criar senha nova/i }));

    // Deve voltar para o login com o e-mail preenchido
    const emailInput = (await screen.findByLabelText(/^e-mail$/i)) as HTMLInputElement;
    expect(emailInput.value).toBe('carlos@vidaemdia.com.br');

    // Preenche a nova senha e faz login
    await user.type(screen.getByLabelText(/^senha$/i), 'novaSenha123');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    // Deve acessar o sistema
    expect(await screen.findByText(/\+ novo compromisso/i)).toBeInTheDocument();
  });

  it('"Usar outro e-mail" volta à etapa 1', async () => {
    const { user } = renderApp({ path: '/esqueci-senha' });

    await user.type(screen.getByLabelText(/^e-mail$/i), 'carlos@vidaemdia.com.br');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    expect(await screen.findByRole('button', { name: /usar outro e-mail/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /usar outro e-mail/i }));

    expect(
      await screen.findByText('Enviaremos um código pelo Telegram vinculado à sua conta.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar código/i })).toBeInTheDocument();
  });
});
