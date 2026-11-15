import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { installMockApi } from './mockApi';
import { renderApp } from './renderApp';

describe('Primeiros Passos', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    installMockApi();
  });

  it('criar conta pela tela mostra a região Primeiros passos com Conectar o Telegram e Criar o primeiro compromisso, e não mostra o TelegramCard', async () => {
    const { user } = renderApp({ path: '/criar-conta' });

    await user.type(screen.getByLabelText(/^nome$/i), 'Novo Usuário');
    await user.type(screen.getByLabelText(/^e-mail$/i), 'novo@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/^senha$/i), 'senha1234');
    await user.type(screen.getByLabelText(/^confirmar senha$/i), 'senha1234');

    const submitBtn = screen.getByRole('button', { name: /^criar conta$/i });
    await user.click(submitBtn);

    const region = await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(region).toBeInTheDocument();
    expect(within(region).getByText('Conectar o Telegram')).toBeInTheDocument();
    expect(within(region).getByText('Criar o primeiro compromisso')).toBeInTheDocument();

    expect(screen.queryByRole('region', { name: 'Conectar o Telegram' })).not.toBeInTheDocument();
    expect(screen.queryByText('Receba seus lembretes no Telegram')).not.toBeInTheDocument();
  });

  it('Dispensar esconde o cartão, e ele não volta ao renderizar de novo com o mesmo usuário', async () => {
    const { user } = renderApp({ path: '/criar-conta' });

    await user.type(screen.getByLabelText(/^nome$/i), 'Novo Usuário');
    await user.type(screen.getByLabelText(/^e-mail$/i), 'novo@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/^senha$/i), 'senha1234');
    await user.type(screen.getByLabelText(/^confirmar senha$/i), 'senha1234');

    const submitBtn = screen.getByRole('button', { name: /^criar conta$/i });
    await user.click(submitBtn);

    const region = await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(region).toBeInTheDocument();

    const dismissBtn = within(region).getByRole('button', { name: /^dispensar$/i });
    await user.click(dismissBtn);

    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();

    // Renderizar de novo com o mesmo usuário (mantendo o token gravado)
    renderApp({ path: '/agenda' });
    expect(await screen.findByRole('button', { name: /\+ novo compromisso/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
  });

  it('conta do seed (dr.joao@vidaemdia.com.br) não vê Primeiros passos', async () => {
    const { user } = renderApp({ path: '/entrar' });

    await user.type(screen.getByLabelText(/e-mail/i), 'dr.joao@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/senha/i), '123456');

    const submitBtn = screen.getByRole('button', { name: /^entrar$/i });
    await user.click(submitBtn);

    expect(await screen.findByRole('button', { name: /\+ novo compromisso/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
  });

  it('Novo compromisso no cartão abre o painel de novo compromisso', async () => {
    const { user } = renderApp({ path: '/criar-conta' });

    await user.type(screen.getByLabelText(/^nome$/i), 'Novo Usuário');
    await user.type(screen.getByLabelText(/^e-mail$/i), 'novo@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/^senha$/i), 'senha1234');
    await user.type(screen.getByLabelText(/^confirmar senha$/i), 'senha1234');

    const submitBtn = screen.getByRole('button', { name: /^criar conta$/i });
    await user.click(submitBtn);

    const region = await screen.findByRole('region', { name: 'Primeiros passos' });
    const novoCompromissoBtn = within(region).getByRole('button', { name: /^novo compromisso$/i });
    await user.click(novoCompromissoBtn);

    expect(await screen.findByRole('heading', { name: 'Novo compromisso' })).toBeInTheDocument();
  });
});
