import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Criptografa um texto usando AES-256-GCM.
 * Formato retornado: base64(iv(12) | tag(16) | ciphertext)
 */
export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64');
}

/**
 * Descriptografa um token no formato base64(iv(12) | tag(16) | ciphertext) com AES-256-GCM.
 * Lança erro caso o conteúdo tenha sido adulterado ou a chave seja incorreta.
 */
export function decryptToken(enc: string, key: Buffer): string {
  const combined = Buffer.from(enc, 'base64');
  if (combined.length < 28) {
    throw new Error('Token criptografado inválido: tamanho insuficiente.');
  }
  const iv = combined.subarray(0, 12);
  const tag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
