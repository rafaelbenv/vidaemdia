import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TelegramLinkService } from './telegram-link.service';

@ApiTags('Telegram Vínculo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramLinkController {
  constructor(private readonly telegramLinkService: TelegramLinkService) {}

  @Post('link')
  @ApiOperation({ summary: 'Gera link com código temporário para vincular Telegram' })
  @ApiResponse({ status: 201, description: 'Link gerado com sucesso' })
  @ApiResponse({ status: 503, description: 'Bot do Telegram não configurado' })
  async createLink(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.telegramLinkService.createLink(userId);
  }

  @Delete('link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove o vínculo da conta com o Telegram' })
  @ApiResponse({ status: 200, description: 'Vínculo removido com sucesso' })
  async unlink(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.telegramLinkService.unlink(userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Retorna status do vínculo com o Telegram' })
  @ApiResponse({ status: 200, description: 'Status retornado com sucesso' })
  async getStatus(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    return this.telegramLinkService.getStatus(userId);
  }
}
