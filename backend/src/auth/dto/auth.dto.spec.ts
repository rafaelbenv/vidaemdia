import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './auth.dto';

describe('RegisterDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  });

  it('descarta role no registro via whitelist do ValidationPipe', async () => {
    const result = (await pipe.transform(
      { name: 'Ana', email: 'ana@x.com', password: 'senhaForte1', role: 'ADMIN' },
      { type: 'body', metatype: RegisterDto },
    )) as Record<string, any>;

    expect(result).not.toHaveProperty('role');
    expect(result.email).toBe('ana@x.com');
  });

  it('rejeita senha com menos de 8 caracteres', async () => {
    await expect(
      pipe.transform(
        { name: 'Ana', email: 'ana@x.com', password: 'Senha1' },
        { type: 'body', metatype: RegisterDto },
      ),
    ).rejects.toBeDefined();
  });

  it('recusa senha com 7 caracteres', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Ana',
      email: 'ana@x.com',
      password: 'Senha12',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('recusa senha só com letras e só com números', async () => {
    const dtoLetras = plainToInstance(RegisterDto, {
      name: 'Ana',
      email: 'ana@x.com',
      password: 'abcdefgh',
    });
    const errorsLetras = await validate(dtoLetras);
    expect(errorsLetras.some((e) => e.property === 'password')).toBe(true);

    const dtoNumeros = plainToInstance(RegisterDto, {
      name: 'Ana',
      email: 'ana@x.com',
      password: '12345678',
    });
    const errorsNumeros = await validate(dtoNumeros);
    expect(errorsNumeros.some((e) => e.property === 'password')).toBe(true);
  });

  it('aceita senhaForte1', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Ana',
      email: 'ana@x.com',
      password: 'senhaForte1',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('recusa senha com 73 caracteres', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Ana',
      email: 'ana@x.com',
      password: 'A1' + 'a'.repeat(71),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('recusa nome com 81 caracteres e nome só com espaços', async () => {
    const dtoNomeLongo = plainToInstance(RegisterDto, {
      name: 'a'.repeat(81),
      email: 'ana@x.com',
      password: 'senhaForte1',
    });
    const errorsNomeLongo = await validate(dtoNomeLongo);
    expect(errorsNomeLongo.some((e) => e.property === 'name')).toBe(true);

    const dtoNomeEspacos = plainToInstance(RegisterDto, {
      name: '     ',
      email: 'ana@x.com',
      password: 'senhaForte1',
    });
    const errorsNomeEspacos = await validate(dtoNomeEspacos);
    expect(errorsNomeEspacos.some((e) => e.property === 'name')).toBe(true);
  });

  it('o e-mail vira normalizado depois do plainToInstance', () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Ana',
      email: '  Ana@Exemplo.COM ',
      password: 'senhaForte1',
    });
    expect(dto.email).toBe('ana@exemplo.com');
  });
});
