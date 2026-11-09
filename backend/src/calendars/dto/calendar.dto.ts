import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarType } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCalendarDto {
  @ApiProperty({ example: 'Consultório Cardiologia' })
  @IsString()
  @IsNotEmpty({ message: 'O nome da agenda é obrigatório' })
  name: string;

  @ApiProperty({ enum: CalendarType, default: CalendarType.PERSONAL })
  @IsEnum(CalendarType)
  type: CalendarType;

  @ApiPropertyOptional({ example: 'Agenda de atendimentos clínicos' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#16A34A' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class GrantPermissionDto {
  @ApiProperty({ example: 'secretaria.maria@vidaemdia.com.br', description: 'E-mail da secretária que receberá permissão RBAC' })
  @IsEmail({}, { message: 'Informe um e-mail válido da secretária' })
  secretaryEmail: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canView?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canUpdate?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canCancel?: boolean;
}

