import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

@ApiTags('Compromissos (Fluxo Principal & Fluxo RBAC)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('compromissos')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista compromissos de uma agenda específica (valida JWT + RBAC)' })
  async findAll(@Query('calendarId') calendarId: string, @Req() req: any) {
    return this.appointmentsService.findAllForCalendar(
      req.user.sub,
      req.user.role,
      calendarId,
      req.ip,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria um novo compromisso na agenda e agenda o lembrete para o Worker (retorna 201)' })
  async create(@Body() dto: CreateAppointmentDto, @Req() req: any) {
    return this.appointmentsService.create(
      req.user.sub,
      req.user.role,
      dto,
      'WEB',
      req.ip,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Altera dados ou status de um compromisso (dupla checagem RBAC + Log de Auditoria)' })
  async update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto, @Req() req: any) {
    return this.appointmentsService.update(
      req.user.sub,
      req.user.role,
      id,
      dto,
      req.ip,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancela um compromisso na agenda (dupla checagem RBAC + Log de Auditoria)' })
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.appointmentsService.cancel(
      req.user.sub,
      req.user.role,
      id,
      req.ip,
    );
  }
}

