/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOW_BASTIDORES?: string;
  readonly VITE_SHOW_DEMO_ACCOUNTS?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
