import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarsService } from './calendars.service';
import { CalendarAccessService } from './calendar-access.service';
import { CreateCalendarDto, GrantPermissionDto } from './dto/calendar.dto';

@ApiTags('Agendas & Delegação RBAC (Secretária ↔ Profissional)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agendas')
export class CalendarsController {
  constructor(
    private readonly calendarsService: CalendarsService,
    private readonly calendarAccess: CalendarAccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista as agendas próprias (Pessoal/Profissional) e agendas delegadas via RBAC' })
  async findAll(@Req() req: any) {
    return this.calendarsService.findAllAccessible(req.user.sub);
  }

  @Get('profissionais')
  @ApiOperation({ summary: 'Lista diretório de profissionais para seleção no Fluxo RBAC da Secretária' })
  async listProfessionals(@Req() req: any) {
    return this.calendarsService.listProfessionalsDirectory(req.user.sub);
  }

  @Get(':id/verificar-acesso')
  @ApiOperation({ summary: 'Verifica se o usuário/secretária tem autorização RBAC para acessar a agenda (retorna 200 ou 403)' })
  async verifyAccess(@Param('id') id: string, @Req() req: any) {
    const access = await this.calendarAccess.verifyAccessOrThrow(
      req.user.sub,
      req.user.role,
      id,
      'VIEW',
      req.ip,
    );
    return {
      authorized: true,
      isDelegated: access.isDelegated,
      calendar: access.calendar,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma nova agenda (Pessoal ou Profissional)' })
  async create(@Body() dto: CreateCalendarDto, @Req() req: any) {
    return this.calendarsService.create(req.user.sub, dto);
  }

  @Post(':id/permissoes')
  @ApiOperation({ summary: 'Concede ou atualiza permissão RBAC para uma Secretária gerenciar esta agenda' })
  async grantPermission(@Param('id') id: string, @Body() dto: GrantPermissionDto, @Req() req: any) {
    return this.calendarsService.grantPermission(req.user.sub, id, dto, req.ip);
  }

  @Delete(':id/permissoes/:granteeUserId')
  @ApiOperation({ summary: 'Revoga permissão RBAC de uma Secretária nesta agenda' })
  async revokePermission(
    @Param('id') id: string,
    @Param('granteeUserId') granteeUserId: string,
    @Req() req: any,
  ) {
    return this.calendarsService.revokePermission(req.user.sub, id, granteeUserId, req.ip);
  }
}

