import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    pool: 'forks',
    css: false,
    restoreMocks: true,
  },
});
