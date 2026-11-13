export interface GoogleConfig {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
  frontendUrl: string;
  encKey: Buffer | null;
}

export function googleConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleConfig {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() || undefined;
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() || undefined;
  const configured = Boolean(clientId && clientSecret);

  const redirectUri =
    env.GOOGLE_REDIRECT_URI?.trim() ||
    'http://localhost:8080/api/google/callback';
  const frontendUrl =
    env.FRONTEND_URL?.trim() || 'http://localhost:8080';

  if (!configured) {
    return {
      configured: false,
      clientId,
      clientSecret,
      redirectUri,
      frontendUrl,
      encKey: null,
    };
  }

  const rawKey = env.GOOGLE_TOKEN_ENC_KEY?.trim();
  const hex64Regex = /^[0-9a-fA-F]{64}$/;
  if (!rawKey || !hex64Regex.test(rawKey)) {
    throw new Error(
      'GOOGLE_TOKEN_ENC_KEY inválida: use 64 caracteres hexadecimais (openssl rand -hex 32).',
    );
  }

  return {
    configured: true,
    clientId,
    clientSecret,
    redirectUri,
    frontendUrl,
    encKey: Buffer.from(rawKey, 'hex'),
  };
}
