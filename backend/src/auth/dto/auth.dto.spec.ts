import { ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './auth.dto';

describe('RegisterDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  });

  it('descarta role no registro via whitelist do ValidationPipe', async () => {
    const result = (await pipe.transform(
      { name: 'Ana', email: 'ana@x.com', password: '123456', role: 'ADMIN' },
      { type: 'body', metatype: RegisterDto },
    )) as Record<string, any>;

    expect(result).not.toHaveProperty('role');
    expect(result.email).toBe('ana@x.com');
  });

  it('rejeita senha com menos de 6 caracteres', async () => {
    await expect(
      pipe.transform(
        { name: 'Ana', email: 'ana@x.com', password: '12345' },
        { type: 'body', metatype: RegisterDto },
      ),
    ).rejects.toBeDefined();
  });
});
