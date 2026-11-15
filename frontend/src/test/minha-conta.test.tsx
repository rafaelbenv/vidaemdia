import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { installMockApi, calls } from './mockApi';
import { renderApp } from './renderApp';

describe('Minha Conta', () => {
  beforeEach(() => {
    installMockApi();
  });

  it('pelo menu do usuário, Minha conta abre a tela com o título Minha conta e o e-mail do usuário', async () => {
    const { user } = renderApp({ path: '/agenda', token: 'token-carlos' });

    const menuBtn = await screen.findByRole('button', { name: /menu do usuário/i });
    await user.click(menuBtn);

    const accountBtn = await screen.findByRole('button', { name: /^minha conta$/i });
    await user.click(accountBtn);

    expect(await screen.findByRole('heading', { name: /^minha conta$/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText('carlos@vidaemdia.com.br')).toBeInTheDocument();
  });

  it('mudar o nome e salvar chama PATCH /auth/me com o nome novo e mostra "Nome atualizado."', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const nameInput = await screen.findByLabelText(/^nome$/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Carlos Atualizado');

    const saveBtn = screen.getByRole('button', { name: /^salvar nome$/i });
    await user.click(saveBtn);

    expect(await screen.findByText('Nome atualizado.')).toBeInTheDocument();
    const patchCalls = calls().filter((c) => c.method === 'PATCH' && c.path.includes('/auth/me'));
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].body).toEqual({ name: 'Carlos Atualizado' });
  });

  it('senha atual errada mostra "A senha atual está incorreta."', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const currentPwdInput = await screen.findByLabelText(/^senha atual$/i);
    await user.type(currentPwdInput, 'errada123');
    await user.type(screen.getByLabelText(/^nova senha$/i), 'novaSenha123');
    await user.type(screen.getByLabelText(/^confirmar nova senha$/i), 'novaSenha123');

    const changeBtn = screen.getByRole('button', { name: /^trocar senha$/i });
    await user.click(changeBtn);

    expect(await screen.findByText('A senha atual está incorreta.')).toBeInTheDocument();
  });

  it('senha nova fraca não chama a API e mostra a regra', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const currentPwdInput = await screen.findByLabelText(/^senha atual$/i);
    await user.type(currentPwdInput, '123456');
    await user.type(screen.getByLabelText(/^nova senha$/i), 'fraca');
    await user.type(screen.getByLabelText(/^confirmar nova senha$/i), 'fraca');

    const changeBtn = screen.getByRole('button', { name: /^trocar senha$/i });
    await user.click(changeBtn);

    expect(
      await screen.findByText(
        'A senha precisa ter de 8 a 72 caracteres, com pelo menos uma letra e um número.',
      ),
    ).toBeInTheDocument();
    expect(calls().filter((c) => c.path.includes('/auth/me/senha'))).toHaveLength(0);
  });

  it('troca válida chama POST /auth/me/senha com currentPassword e newPassword e mostra "Senha alterada."', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const currentPwdInput = await screen.findByLabelText(/^senha atual$/i);
    await user.type(currentPwdInput, '123456');
    await user.type(screen.getByLabelText(/^nova senha$/i), 'novaSenha123');
    await user.type(screen.getByLabelText(/^confirmar nova senha$/i), 'novaSenha123');

    const changeBtn = screen.getByRole('button', { name: /^trocar senha$/i });
    await user.click(changeBtn);

    expect(await screen.findByText('Senha alterada.')).toBeInTheDocument();
    const pwdCalls = calls().filter((c) => c.method === 'POST' && c.path.includes('/auth/me/senha'));
    expect(pwdCalls).toHaveLength(1);
    expect(pwdCalls[0].body).toEqual({
      currentPassword: '123456',
      newPassword: 'novaSenha123',
    });
    expect(screen.getByLabelText(/^senha atual$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^nova senha$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^confirmar nova senha$/i)).toHaveValue('');
  });

  it('← Voltar para a agenda volta à agenda', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const backBtn = await screen.findByRole('button', { name: /voltar para a agenda/i });
    await user.click(backBtn);

    expect(await screen.findByRole('button', { name: /\+ novo compromisso/i })).toBeInTheDocument();
  });
});
