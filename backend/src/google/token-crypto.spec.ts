import { randomBytes } from 'crypto';
import { encryptToken, decryptToken } from './token-crypto';

describe('token-crypto', () => {
  const validKey = randomBytes(32);

  it('ida e volta recupera o texto original com sucesso', () => {
    const plain = '1//04fake_refresh_token_from_google_oauth_stream';
    const encrypted = encryptToken(plain, validKey);

    expect(encrypted).not.toBe(plain);
    const decrypted = decryptToken(encrypted, validKey);
    expect(decrypted).toBe(plain);
  });

  it('texto adulterado lança erro', () => {
    const plain = 'sample-secret-token';
    const encrypted = encryptToken(plain, validKey);

    const buf = Buffer.from(encrypted, 'base64');
    buf[buf.length - 1] ^= 0x01; // corrompe o último byte
    const tampered = buf.toString('base64');

    expect(() => decryptToken(tampered, validKey)).toThrow();
  });

  it('chave errada lança erro', () => {
    const plain = 'sample-secret-token';
    const encrypted = encryptToken(plain, validKey);
    const wrongKey = randomBytes(32);

    expect(() => decryptToken(encrypted, wrongKey)).toThrow();
  });

  it('tamanho insuficiente lança erro', () => {
    const invalid = Buffer.from('short-data').toString('base64');
    expect(() => decryptToken(invalid, validKey)).toThrow();
  });
});
