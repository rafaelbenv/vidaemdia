import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus, NotificationChannel } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'ID da Agenda (Pessoal ou Profissional)' })
  @IsUUID('4', { message: 'Selecione uma agenda válida' })
  calendarId: string;

  @ApiProperty({ example: 'Consulta médica hoje às 08:00' })
  @IsString()
  @IsNotEmpty({ message: 'O título do compromisso é obrigatório' })
  title: string;

  @ApiPropertyOptional({ example: 'Trazer exames laboratoriais anteriores' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-10-28T08:00:00.000Z' })
  @IsDateString({}, { message: 'Informe uma data/hora de início válida (ISO 8601)' })
  startTime: string;

  @ApiPropertyOptional({ example: '2026-10-28T09:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'Informe uma data/hora de término válida (ISO 8601)' })
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Dia inteiro: ignora a hora; endTime é o último dia (inclusive)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiPropertyOptional({
    example: 30,
    default: 30,
    description: 'Minutos de antecedência do lembrete (0 = na hora do compromisso; máx. 10080 = 7 dias)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  reminderMinutesBefore?: number;

  @ApiPropertyOptional({ enum: NotificationChannel, default: NotificationChannel.TELEGRAM })
  @IsOptional()
  @IsEnum(NotificationChannel)
  reminderChannel?: NotificationChannel;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ example: 'Consulta médica (Reagendada)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Dia inteiro: ignora a hora; endTime é o último dia (inclusive)',
  })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Minutos de antecedência do lembrete (0 = na hora do compromisso; máx. 10080 = 7 dias)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  reminderMinutesBefore?: number;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  reminderChannel?: NotificationChannel;
}

