import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NotificationChannel } from '@prisma/client';

export class LoginDto {
  @ApiProperty({ example: 'dr.joao@vidaemdia.com.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'Carlos Silva' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  @MaxLength(80, { message: 'O nome pode ter no máximo 80 caracteres' })
  name: string;

  @ApiProperty({ example: 'carlos@vidaemdia.com.br' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'senhaForte1' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  @MaxLength(72, { message: 'A senha pode ter no máximo 72 caracteres' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'A senha precisa ter pelo menos uma letra e um número',
  })
  password: string;

  @ApiPropertyOptional({ enum: NotificationChannel, default: NotificationChannel.TELEGRAM })
  @IsOptional()
  @IsEnum(NotificationChannel)
  preferredChannel?: NotificationChannel;
}

