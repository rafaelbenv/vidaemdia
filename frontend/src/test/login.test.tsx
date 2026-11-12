import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { installMockApi, calls } from './mockApi';
import { renderApp } from './renderApp';

describe('Login', () => {
  beforeEach(() => {
    installMockApi();
  });

  it('campos vazios ao abrir; enviar vazio mostra "Informe o e-mail e a senha."', async () => {
    const { user } = renderApp({ path: '/login' });

    const emailInput = screen.getByLabelText(/e-mail/i);
    const passwordInput = screen.getByLabelText(/senha/i);
    expect(emailInput).toHaveValue('');
    expect(passwordInput).toHaveValue('');

    const submitBtn = screen.getByRole('button', { name: /^entrar$/i });
    await user.click(submitBtn);

    expect(await screen.findByText('Informe o e-mail e a senha.')).toBeInTheDocument();
    expect(calls().filter((c) => c.path.includes('/auth/login'))).toHaveLength(0);
  });

  it('senha errada mostra o erro do servidor', async () => {
    const { user } = renderApp({ path: '/login' });

    await user.type(screen.getByLabelText(/e-mail/i), 'dr.joao@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/senha/i), 'senhaerrada');

    const submitBtn = screen.getByRole('button', { name: /^entrar$/i });
    await user.click(submitBtn);

    expect(await screen.findByText('E-mail ou senha incorretos')).toBeInTheDocument();
  });

  it('entrar pelo formulário leva à agenda (aparece o botão "+ Novo compromisso")', async () => {
    const { user } = renderApp({ path: '/login' });

    await user.type(screen.getByLabelText(/e-mail/i), 'dr.joao@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/senha/i), '123456');

    const submitBtn = screen.getByRole('button', { name: /^entrar$/i });
    await user.click(submitBtn);

    expect(
      await screen.findByRole('button', { name: /\+ novo compromisso/i }),
    ).toBeInTheDocument();
  });

  it('entrar pelo botão de demonstração "Dr. João Mendes — Profissional" funciona sem preencher a senha', async () => {
    const { user } = renderApp({ path: '/login' });

    const summary = screen.getByText('Entrar com uma conta de demonstração');
    await user.click(summary);

    const demoBtn = await screen.findByRole('button', {
      name: /dr\. joão mendes — profissional/i,
    });
    await user.click(demoBtn);

    expect(
      await screen.findByRole('button', { name: /\+ novo compromisso/i }),
    ).toBeInTheDocument();
  });
});
