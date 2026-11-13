import { parseCorsOrigins } from './cors';

describe('parseCorsOrigins', () => {
  it('retorna lista vazia para valor indefinido ou vazio', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('')).toEqual([]);
    expect(parseCorsOrigins('   ')).toEqual([]);
  });

  it('faz parse de origens separadas por vírgula com trim', () => {
    expect(parseCorsOrigins('a, b')).toEqual(['a', 'b']);
    expect(parseCorsOrigins('http://localhost:5173, https://meusite.com')).toEqual([
      'http://localhost:5173',
      'https://meusite.com',
    ]);
  });

  it('ignora o caractere coringa "*"', () => {
    expect(parseCorsOrigins('*')).toEqual([]);
    expect(parseCorsOrigins('*, http://localhost:5173, *')).toEqual(['http://localhost:5173']);
  });
});
