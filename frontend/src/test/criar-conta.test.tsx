import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { installMockApi, calls } from './mockApi';
import { renderApp } from './renderApp';

describe('Criar Conta', () => {
  beforeEach(() => {
    installMockApi();
  });

  it('na tela de login, o botão Criar conta leva à tela com o título Criar conta', async () => {
    const { user } = renderApp({ path: '/entrar' });

    const goToRegisterBtn = screen.getByRole('button', { name: /^criar conta$/i });
    await user.click(goToRegisterBtn);

    expect(await screen.findByRole('heading', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('enviar vazio mostra "Informe o seu nome." e não chama /auth/register', async () => {
    const { user } = renderApp({ path: '/criar-conta' });

    const submitBtn = screen.getByRole('button', { name: /^criar conta$/i });
    await user.click(submitBtn);

    expect(await screen.findByText('Informe o seu nome.')).toBeInTheDocument();
    expect(calls().filter((c) => c.path.includes('/auth/register'))).toHaveLength(0);
  });

  it('senha "abcdefgh" mostra a mensagem da regra de senha', async () => {
    const { user } = renderApp({ path: '/criar-conta' });

    await user.type(screen.getByLabelText(/^nome$/i), 'Novo Usuário');
    await user.type(screen.getByLabelText(/^e-mail$/i), 'novo@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/^senha$/i), 'abcdefgh');
    await user.type(screen.getByLabelText(/^confirmar senha$/i), 'abcdefgh');

    const submitBtn = screen.getByRole('button', { name: /^criar conta$/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText(
        'A senha precisa ter de 8 a 72 caracteres, com pelo menos uma letra e um número.',
      ),
    ).toBeInTheDocument();
    expect(calls().filter((c) => c.path.includes('/auth/register'))).toHaveLength(0);
  });

  it('confirmação diferente mostra "As senhas não são iguais."', async () => {
    const { user } = renderApp({ path: '/criar-conta' });

    await user.type(screen.getByLabelText(/^nome$/i), 'Novo Usuário');
    await user.type(screen.getByLabelText(/^e-mail$/i), 'novo@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/^senha$/i), 'senha1234');
    await user.type(screen.getByLabelText(/^confirmar senha$/i), 'senhaDiferente');

    const submitBtn = screen.getByRole('button', { name: /^criar conta$/i });
    await user.click(submitBtn);

    expect(await screen.findByText('As senhas não são iguais.')).toBeInTheDocument();
    expect(calls().filter((c) => c.path.includes('/auth/register'))).toHaveLength(0);
  });

  it('e-mail já usado ("dr.joao@vidaemdia.com.br") mostra a mensagem do servidor', async () => {
    const { user } = renderApp({ path: '/criar-conta' });

    await user.type(screen.getByLabelText(/^nome$/i), 'Dr. João');
    await user.type(screen.getByLabelText(/^e-mail$/i), 'dr.joao@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/^senha$/i), 'senha1234');
    await user.type(screen.getByLabelText(/^confirmar senha$/i), 'senha1234');

    const submitBtn = screen.getByRole('button', { name: /^criar conta$/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText(
        'Não foi possível criar a conta com este e-mail. Se você já tem conta, entre ou recupere a senha.',
      ),
    ).toBeInTheDocument();
  });

  it('cadastro válido chama /auth/register com nome, e-mail e senha e leva à agenda (aparece o botão "+ Novo compromisso")', async () => {
    const { user } = renderApp({ path: '/criar-conta' });

    await user.type(screen.getByLabelText(/^nome$/i), 'Novo Usuário');
    await user.type(screen.getByLabelText(/^e-mail$/i), 'novo@vidaemdia.com.br');
    await user.type(screen.getByLabelText(/^senha$/i), 'senha1234');
    await user.type(screen.getByLabelText(/^confirmar senha$/i), 'senha1234');

    const submitBtn = screen.getByRole('button', { name: /^criar conta$/i });
    await user.click(submitBtn);

    const regCalls = calls().filter((c) => c.path.includes('/auth/register'));
    expect(regCalls).toHaveLength(1);
    expect(regCalls[0].body).toEqual({
      name: 'Novo Usuário',
      email: 'novo@vidaemdia.com.br',
      password: 'senha1234',
    });

    expect(
      await screen.findByRole('button', { name: /\+ novo compromisso/i }),
    ).toBeInTheDocument();
  });

  it('Entrar volta à tela de login', async () => {
    const { user } = renderApp({ path: '/criar-conta' });

    const goToLoginBtn = screen.getByRole('button', { name: /^entrar$/i });
    await user.click(goToLoginBtn);

    expect(await screen.findByText('Sua agenda com lembretes no Telegram')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
  });
});
