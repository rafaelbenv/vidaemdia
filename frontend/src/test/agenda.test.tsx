import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { installMockApi, calls } from './mockApi';
import { renderApp } from './renderApp';

describe('Agenda', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T07:00:00-03:00'));
    installMockApi();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra os dois compromissos ativos e esconde o cancelado; "Mostrar 1 cancelado" revela', async () => {
    const { user } = renderApp({
      path: '/agenda?dia=2026-11-10',
      token: 'token-user-dr-joao',
    });

    expect(await screen.findByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('10:30')).toBeInTheDocument();
    expect(screen.getByText('Consulta inicial')).toBeInTheDocument();
    expect(screen.getByText('Retorno cardiológico')).toBeInTheDocument();

    expect(screen.queryByText('Exame cancelado')).not.toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /mostrar 1 cancelado/i });
    expect(toggleBtn).toBeInTheDocument();

    await user.click(toggleBtn);

    expect(screen.getByText('Exame cancelado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /esconder cancelados/i })).toBeInTheDocument();
  });

  it('criar: "+ Novo compromisso" → título, horário 15:00, lembrete "30 minutos antes" → "Salvar" salva com lembrete e mostra linha', async () => {
    const { user } = renderApp({
      path: '/agenda?dia=2026-11-10',
      token: 'token-user-dr-joao',
    });

    const newBtn = await screen.findByRole('button', { name: /\+ novo compromisso/i });
    await user.click(newBtn);

    expect(await screen.findByRole('heading', { name: 'Novo compromisso' })).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/o que é\?/i);
    await user.type(titleInput, 'Reunião de Equipe');

    const timeInput = screen.getByLabelText(/horário/i);
    await user.clear(timeInput);
    await user.type(timeInput, '15:00');
    if ((timeInput as HTMLInputElement).value !== '15:00') {
      fireEvent.change(timeInput, { target: { value: '15:00' } });
    }

    const reminderSelect = screen.getByLabelText(/lembrete no telegram/i);
    await user.selectOptions(reminderSelect, '30');

    const saveBtn = screen.getByRole('button', { name: /^salvar$/i });
    await user.click(saveBtn);

    const postCall = calls().find(
      (c) => c.method === 'POST' && c.path.includes('/compromissos'),
    );
    expect(postCall).toBeDefined();
    expect(postCall?.body.title).toBe('Reunião de Equipe');
    expect(postCall?.body.reminderMinutesBefore).toBe(30);

    const startTimeDate = new Date(postCall?.body.startTime);
    expect(startTimeDate.getHours()).toBe(15);

    expect(
      await screen.findByText('Compromisso salvo. Lembrete às 14:30.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Reunião de Equipe')).toBeInTheDocument();
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('validação: salvar sem título mostra "Diga o que é o compromisso." e não chama a API', async () => {
    const { user } = renderApp({
      path: '/agenda?dia=2026-11-10',
      token: 'token-user-dr-joao',
    });

    const newBtn = await screen.findByRole('button', { name: /\+ novo compromisso/i });
    await user.click(newBtn);

    expect(await screen.findByRole('heading', { name: 'Novo compromisso' })).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /^salvar$/i });
    await user.click(saveBtn);

    expect(await screen.findByText('Diga o que é o compromisso.')).toBeInTheDocument();

    const postCalls = calls().filter(
      (c) => c.method === 'POST' && c.path.includes('/compromissos'),
    );
    expect(postCalls).toHaveLength(0);
  });

  it('editar: clicar na linha de 08:00 abre "Editar compromisso" preenchido; mudar o horário para 09:00 e salvar → PATCH com novo startTime; linha mostra 09:00', async () => {
    const { user } = renderApp({
      path: '/agenda?dia=2026-11-10',
      token: 'token-user-dr-joao',
    });

    await user.click(await screen.findByText('Consulta inicial'));

    expect(await screen.findByRole('heading', { name: 'Editar compromisso' })).toBeInTheDocument();
    expect(screen.getByLabelText(/o que é\?/i)).toHaveValue('Consulta inicial');
    expect(screen.getByLabelText(/horário/i)).toHaveValue('08:00');

    const timeInput = screen.getByLabelText(/horário/i);
    await user.clear(timeInput);
    await user.type(timeInput, '09:00');
    if ((timeInput as HTMLInputElement).value !== '09:00') {
      fireEvent.change(timeInput, { target: { value: '09:00' } });
    }

    const saveBtn = screen.getByRole('button', { name: /^salvar$/i });
    await user.click(saveBtn);

    const patchCall = calls().find(
      (c) => c.method === 'PATCH' && c.path.includes('/compromissos/'),
    );
    expect(patchCall).toBeDefined();
    const updatedDate = new Date(patchCall?.body.startTime);
    expect(updatedDate.getHours()).toBe(9);

    expect(await screen.findByText('09:00')).toBeInTheDocument();
  });

  it('cancelar: abrir a linha, "Cancelar compromisso", confirmar → DELETE; a linha some e o link passa a "Mostrar 2 cancelados"', async () => {
    const { user } = renderApp({
      path: '/agenda?dia=2026-11-10',
      token: 'token-user-dr-joao',
    });

    await user.click(await screen.findByText('Consulta inicial'));

    const cancelBtn = await screen.findByRole('button', {
      name: /^cancelar compromisso$/i,
    });
    await user.click(cancelBtn);

    const dialog = await screen.findByRole('alertdialog');
    const confirmBtn = within(dialog).getByRole('button', {
      name: /^cancelar compromisso$/i,
    });
    await user.click(confirmBtn);

    const deleteCall = calls().find(
      (c) => c.method === 'DELETE' && c.path.includes('/compromissos/'),
    );
    expect(deleteCall).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByText('Consulta inicial')).not.toBeInTheDocument();
    });

    expect(
      await screen.findByRole('button', { name: /mostrar 2 cancelados/i }),
    ).toBeInTheDocument();
  });

  it('troca de agenda: abrir o menu de agendas, escolher "Agenda Pessoal - Dr. João" → a API recebe GET /compromissos?calendarId=<da pessoal> e a lista do dia fica vazia', async () => {
    const { user } = renderApp({
      path: '/agenda?dia=2026-11-10',
      token: 'token-user-dr-joao',
    });

    const menuBtn = await screen.findByRole('button', { name: /menu de agendas/i });
    await user.click(menuBtn);

    const personalOption = await screen.findByRole('menuitemradio', {
      name: /agenda pessoal - dr\. joão/i,
    });
    await user.click(personalOption);

    await waitFor(() => {
      const getCall = calls().find(
        (c) => c.method === 'GET' && c.path.includes('calendarId=cal-dr-joao-pessoal'),
      );
      expect(getCall).toBeDefined();
    });

    expect(await screen.findByText(/nada marcado para/i)).toBeInTheDocument();
  });

  it('visão de mês: clicar em "Mês" → título "Novembro de 2026"; a célula do dia 10 diz "2 compromissos"; clicar nela volta à visão de dia em 10/11', async () => {
    const { user } = renderApp({
      path: '/agenda?dia=2026-11-10',
      token: 'token-user-dr-joao',
    });

    const mesBtn = await screen.findByRole('button', { name: /^mês$/i });
    await user.click(mesBtn);

    expect(await screen.findByRole('heading', { name: 'Novembro de 2026' })).toBeInTheDocument();

    const day10Btn = screen.getByRole('button', {
      name: /10 de novembro.*2 compromissos/i,
    });
    expect(day10Btn).toBeInTheDocument();
    expect(day10Btn).toHaveTextContent('2 compromissos');

    await user.click(day10Btn);

    expect(await screen.findByRole('heading', { name: 'Terça, 10 de novembro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^dia$/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
