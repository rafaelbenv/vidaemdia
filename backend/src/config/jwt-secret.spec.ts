import {
  getJwtSecret,
  isPublicExampleSecret,
  PUBLIC_EXAMPLE_JWT_SECRET,
} from './jwt-secret';

describe('jwt-secret config', () => {
  describe('getJwtSecret', () => {
    it('deve lançar erro se JWT_SECRET não estiver definido', () => {
      expect(() => getJwtSecret({})).toThrow(
        'JWT_SECRET não definido. Defina no .env (ex.: gere com "openssl rand -hex 32").',
      );
    });

    it('deve lançar erro se JWT_SECRET for vazio', () => {
      expect(() => getJwtSecret({ JWT_SECRET: '' })).toThrow(
        'JWT_SECRET não definido. Defina no .env (ex.: gere com "openssl rand -hex 32").',
      );
    });

    it('deve lançar erro se JWT_SECRET for muito curto (< 32 caracteres)', () => {
      expect(() =>
        getJwtSecret({ JWT_SECRET: 'curto_com_menos_de_32_chars' }),
      ).toThrow('JWT_SECRET muito curto: use pelo menos 32 caracteres.');
    });

    it('deve retornar o segredo quando válido (>= 32 caracteres)', () => {
      const validSecret = '12345678901234567890123456789012';
      expect(getJwtSecret({ JWT_SECRET: validSecret })).toBe(validSecret);
    });
  });

  describe('isPublicExampleSecret', () => {
    it('deve retornar true quando JWT_SECRET for igual ao valor público antigo', () => {
      expect(
        isPublicExampleSecret({ JWT_SECRET: PUBLIC_EXAMPLE_JWT_SECRET }),
      ).toBe(true);
    });

    it('deve retornar false quando JWT_SECRET for diferente do valor público antigo', () => {
      expect(
        isPublicExampleSecret({
          JWT_SECRET: 'outro_segredo_muito_seguro_e_longo_1234567890',
        }),
      ).toBe(false);
    });

    it('deve retornar false quando JWT_SECRET não estiver definido', () => {
      expect(isPublicExampleSecret({})).toBe(false);
    });
  });
});
