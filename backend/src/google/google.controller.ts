import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { IsNotEmpty, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GoogleAccountService } from './google-account.service';
import { GoogleCalendarLinkService } from './google-calendar-link.service';
import { GooglePullService } from './google-pull.service';
import { googleConfig } from './google.config';

export class LinkGoogleCalendarDto {
  @ApiProperty({ description: 'ID da agenda no Google Calendar' })
  @IsString()
  @IsNotEmpty()
  googleCalendarId: string;
}

@ApiTags('Google Agenda')
@Controller('google')
export class GoogleController {
  private readonly logger = new Logger(GoogleController.name);

  constructor(
    private readonly googleAccountService: GoogleAccountService,
    private readonly googleCalendarLinkService: GoogleCalendarLinkService,
  ) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retorna o status de conexão com o Google Agenda',
  })
  @ApiResponse({ status: 200, description: 'Status retornado com sucesso' })
  async getStatus(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.googleAccountService.status(userId);
  }

  @Get('connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Gera URL para autorização OAuth 2.0 com o Google Agenda',
  })
  @ApiResponse({ status: 200, description: 'URL gerada com sucesso' })
  @ApiResponse({
    status: 503,
    description: 'Integração com o Google Agenda não configurada',
  })
  async connect(@Req() req: any) {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }
    const userId = req.user?.id || req.user?.sub;
    return this.googleAccountService.startConnect(userId);
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Redirecionamento de callback OAuth 2.0 pelo Google',
  })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const cfg = googleConfig();
    const frontendUrl = cfg.frontendUrl;

    if (!cfg.configured) {
      this.logger.warn('Callback do Google acionado com integração desativada');
      return res.redirect(`${frontendUrl}/agenda?google=erro`);
    }

    if (error) {
      this.logger.warn(`Erro no callback do Google OAuth: ${error}`);
      return res.redirect(`${frontendUrl}/agenda?google=erro`);
    }

    if (!code || !state) {
      this.logger.warn('Callback do Google recebido sem code ou state');
      return res.redirect(`${frontendUrl}/agenda?google=erro`);
    }

    try {
      await this.googleAccountService.finishConnect(code, state);
      return res.redirect(`${frontendUrl}/agenda?google=conectado`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Falha no callback do Google: ${msg}`);
      return res.redirect(`${frontendUrl}/agenda?google=erro`);
    }
  }

  @Delete('link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Desconecta o vínculo da conta com o Google Agenda',
  })
  @ApiResponse({ status: 200, description: 'Desconectado com sucesso' })
  @ApiResponse({
    status: 503,
    description: 'Integração com o Google Agenda não configurada',
  })
  async disconnect(@Req() req: any) {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }
    const userId = req.user?.id || req.user?.sub;
    await this.googleAccountService.disconnect(userId);
    return { disconnected: true };
  }

  @Get('calendars')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lista as agendas do Google com permissão de escrita',
  })
  @ApiResponse({ status: 200, description: 'Agendas listadas com sucesso' })
  @ApiResponse({
    status: 503,
    description: 'Integração com o Google Agenda não configurada',
  })
  async listCalendars(@Req() req: any) {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }
    const userId = req.user?.id || req.user?.sub;
    return this.googleCalendarLinkService.listCalendars(userId);
  }
}

@ApiTags('Agendas & Integração Google')
@Controller('agendas')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoogleAgendaLinkController {
  constructor(
    private readonly linkService: GoogleCalendarLinkService,
    private readonly pullService: GooglePullService,
  ) {}

  @Put(':id/google')
  @ApiOperation({
    summary: 'Liga uma agenda do VidaEmDia a uma agenda do Google',
  })
  @ApiResponse({ status: 200, description: 'Agenda ligada com sucesso' })
  @ApiResponse({
    status: 503,
    description: 'Integração com o Google Agenda não configurada',
  })
  async link(
    @Param('id') calendarId: string,
    @Body() dto: LinkGoogleCalendarDto,
    @Req() req: any,
  ) {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }
    const userId = req.user?.id || req.user?.sub;
    return this.linkService.link(userId, calendarId, dto.googleCalendarId);
  }

  @Delete(':id/google')
  @ApiOperation({
    summary: 'Desliga uma agenda do VidaEmDia da agenda do Google',
  })
  @ApiResponse({ status: 200, description: 'Agenda desligada com sucesso' })
  @ApiResponse({
    status: 503,
    description: 'Integração com o Google Agenda não configurada',
  })
  async unlink(
    @Param('id') calendarId: string,
    @Req() req: any,
  ) {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }
    const userId = req.user?.id || req.user?.sub;
    return this.linkService.unlink(userId, calendarId);
  }

  @Post(':id/google/sincronizar')
  @ApiOperation({
    summary: 'Sincroniza imediatamente os eventos da agenda com o Google Agenda',
  })
  @ApiResponse({
    status: 200,
    description: 'Sincronização concluída com sucesso',
  })
  @ApiResponse({
    status: 503,
    description: 'Integração com o Google Agenda não configurada',
  })
  @ApiResponse({ status: 404, description: 'Agenda não encontrada' })
  @ApiResponse({
    status: 403,
    description: 'Só o dono da agenda pode sincronizá-la',
  })
  @ApiResponse({
    status: 400,
    description: 'Agenda não está ligada ao Google Agenda',
  })
  async syncNow(
    @Param('id') calendarId: string,
    @Req() req: any,
  ) {
    const cfg = googleConfig();
    if (!cfg.configured) {
      throw new ServiceUnavailableException(
        'Integração com o Google Agenda não configurada',
      );
    }
    const userId = req.user?.id || req.user?.sub;
    return this.pullService.pullCalendarForOwner(userId, calendarId);
  }
}
