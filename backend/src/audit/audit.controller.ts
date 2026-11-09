import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Auditoria & Segurança')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auditoria')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Lista logs de auditoria (quem criou/alterou/cancelou compromissos ou teve acesso negado RBAC)' })
  async listAuditLogs(@Req() req: any, @Query('calendarId') calendarId?: string) {
    return this.auditService.findAllForUser(req.user.sub, req.user.role, calendarId);
  }
}

