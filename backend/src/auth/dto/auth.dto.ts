import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
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
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  name: string;

  @ApiProperty({ example: 'carlos@vidaemdia.com.br' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password: string;

  @ApiPropertyOptional({ example: '5511999991111' })
  @IsOptional()
  @IsString()
  phoneWhatsapp?: string;

  @ApiPropertyOptional({ enum: NotificationChannel, default: NotificationChannel.TELEGRAM })
  @IsOptional()
  @IsEnum(NotificationChannel)
  preferredChannel?: NotificationChannel;
}

