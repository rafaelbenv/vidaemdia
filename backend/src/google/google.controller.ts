import {
  Controller,
  Get,
  Delete,
  Query,
  Req,
  Res,
  UseGuards,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GoogleAccountService } from './google-account.service';
import { googleConfig } from './google.config';

@ApiTags('Google Agenda')
@Controller('google')
export class GoogleController {
  private readonly logger = new Logger(GoogleController.name);

  constructor(private readonly googleAccountService: GoogleAccountService) {}

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
}
