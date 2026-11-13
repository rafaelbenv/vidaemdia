export const PUBLIC_EXAMPLE_JWT_SECRET = 'vidaemdia_jwt_super_secret_key_2026';

export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const s = env.JWT_SECRET;
  if (!s) {
    throw new Error(
      'JWT_SECRET não definido. Defina no .env (ex.: gere com "openssl rand -hex 32").',
    );
  }
  if (s.length < 32) {
    throw new Error('JWT_SECRET muito curto: use pelo menos 32 caracteres.');
  }
  return s;
}

export function isPublicExampleSecret(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.JWT_SECRET === PUBLIC_EXAMPLE_JWT_SECRET;
}
