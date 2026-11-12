import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';

export interface RenderAppOptions {
  path?: string;
  token?: string | null;
}

export function renderApp({ path = '/', token }: RenderAppOptions = {}) {
  if (token) {
    localStorage.setItem('vidaemdia_jwt', token);
  }
  const user = userEvent.setup();
  const renderResult = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return {
    user,
    ...renderResult,
  };
}
