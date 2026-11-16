import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ChangePasswordDto,
  RegisterDto,
  UpdateDailySummaryDto,
  UpdateProfileDto,
} from './auth.dto';

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

describe('UpdateProfileDto', () => {
  it('recusa nome vazio e com 81 caracteres', async () => {
    const dtoVazio = plainToInstance(UpdateProfileDto, { name: '' });
    const errorsVazio = await validate(dtoVazio);
    expect(errorsVazio.some((e) => e.property === 'name')).toBe(true);

    const dtoEspacos = plainToInstance(UpdateProfileDto, { name: '     ' });
    const errorsEspacos = await validate(dtoEspacos);
    expect(errorsEspacos.some((e) => e.property === 'name')).toBe(true);

    const dtoLongo = plainToInstance(UpdateProfileDto, { name: 'a'.repeat(81) });
    const errorsLongo = await validate(dtoLongo);
    expect(errorsLongo.some((e) => e.property === 'name')).toBe(true);
  });

  it('limpa espaços do nome ao transformar', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: '  Carlos   Silva  ' });
    expect(dto.name).toBe('Carlos Silva');
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('ChangePasswordDto', () => {
  it('recusa currentPassword vazia', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: '',
      newPassword: 'senhaForte1',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'currentPassword')).toBe(true);
  });

  it('recusa newPassword fraca (apenas letras)', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: '123456',
      newPassword: 'abcdefgh',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('aceita currentPassword e newPassword válidas', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: '123456',
      newPassword: 'senhaForte1',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateDailySummaryDto', () => {
  it('recusa hour 24, -1 e 7.5', async () => {
    const dto24 = plainToInstance(UpdateDailySummaryDto, { enabled: true, hour: 24 });
    const errors24 = await validate(dto24);
    expect(errors24.some((e) => e.property === 'hour')).toBe(true);

    const dtoNeg = plainToInstance(UpdateDailySummaryDto, { enabled: true, hour: -1 });
    const errorsNeg = await validate(dtoNeg);
    expect(errorsNeg.some((e) => e.property === 'hour')).toBe(true);

    const dtoFloat = plainToInstance(UpdateDailySummaryDto, { enabled: true, hour: 7.5 });
    const errorsFloat = await validate(dtoFloat);
    expect(errorsFloat.some((e) => e.property === 'hour')).toBe(true);
  });

  it('recusa enabled como string "sim"', async () => {
    const dto = plainToInstance(UpdateDailySummaryDto, { enabled: 'sim', hour: 7 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'enabled')).toBe(true);
  });

  it('aceita { enabled: false, hour: 0 }', async () => {
    const dto = plainToInstance(UpdateDailySummaryDto, { enabled: false, hour: 0 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
