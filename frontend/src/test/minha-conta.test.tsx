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

  it('ao clicar em Cancelar, esconde o campo de confirmação de senha de exclusão', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const openDeleteBtn = await screen.findByRole('button', { name: /^excluir minha conta$/i });
    await user.click(openDeleteBtn);

    expect(await screen.findByLabelText(/confirme com a sua senha/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /^cancelar$/i });
    await user.click(cancelBtn);

    expect(screen.queryByLabelText(/confirme com a sua senha/i)).not.toBeInTheDocument();
  });

  it('excluir conta com senha errada mostra "Senha incorreta."', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const openDeleteBtn = await screen.findByRole('button', { name: /^excluir minha conta$/i });
    await user.click(openDeleteBtn);

    const pwdInput = await screen.findByLabelText(/confirme com a sua senha/i);
    await user.type(pwdInput, 'senha-errada');

    const confirmBtn = screen.getByRole('button', { name: /^excluir definitivamente$/i });
    await user.click(confirmBtn);

    expect(await screen.findByText('Senha incorreta.')).toBeInTheDocument();
  });

  it('excluir conta com senha certa volta à tela de login com "Sua conta foi excluída."', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const openDeleteBtn = await screen.findByRole('button', { name: /^excluir minha conta$/i });
    await user.click(openDeleteBtn);

    const pwdInput = await screen.findByLabelText(/confirme com a sua senha/i);
    await user.type(pwdInput, '123456');

    const confirmBtn = screen.getByRole('button', { name: /^excluir definitivamente$/i });
    await user.click(confirmBtn);

    expect(await screen.findByText('Sua conta foi excluída.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();

    const deleteCalls = calls().filter((c) => c.method === 'DELETE' && c.path.includes('/auth/me'));
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].body).toEqual({ password: '123456' });
  });

  it('seção Resumo diário mostra título, checkbox marcado, horário 7 e botão desabilitado', async () => {
    renderApp({ path: '/conta', token: 'token-carlos' });

    expect(await screen.findByRole('heading', { name: /^resumo diário$/i, level: 2 })).toBeInTheDocument();
    const checkbox = screen.getByLabelText(/^receber o resumo diário$/i);
    expect(checkbox).toBeChecked();

    const select = screen.getByLabelText(/^horário$/i);
    expect(select).toHaveValue('7');

    const saveBtn = screen.getByRole('button', { name: /^salvar resumo$/i });
    expect(saveBtn).toBeDisabled();
  });

  it('ao mudar o horário para 08:00 e salvar, envia PATCH /auth/me/resumo-diario com { enabled: true, hour: 8 } e mostra "Resumo diário salvo."', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const select = await screen.findByLabelText(/^horário$/i);
    await user.selectOptions(select, '08:00');

    const saveBtn = screen.getByRole('button', { name: /^salvar resumo$/i });
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    expect(await screen.findByText('Resumo diário salvo.')).toBeInTheDocument();
    const patchCalls = calls().filter(
      (c) => c.method === 'PATCH' && c.path.includes('/auth/me/resumo-diario'),
    );
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].body).toEqual({ enabled: true, hour: 8 });
  });

  it('ao desmarcar o checkbox, desabilita o select e envia { enabled: false, hour: 7 } ao salvar', async () => {
    const { user } = renderApp({ path: '/conta', token: 'token-carlos' });

    const checkbox = await screen.findByLabelText(/^receber o resumo diário$/i);
    const select = screen.getByLabelText(/^horário$/i);

    expect(checkbox).toBeChecked();
    expect(select).toBeEnabled();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(select).toBeDisabled();

    const saveBtn = screen.getByRole('button', { name: /^salvar resumo$/i });
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    expect(await screen.findByText('Resumo diário salvo.')).toBeInTheDocument();
    const patchCalls = calls().filter(
      (c) => c.method === 'PATCH' && c.path.includes('/auth/me/resumo-diario'),
    );
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].body).toEqual({ enabled: false, hour: 7 });
  });
});
