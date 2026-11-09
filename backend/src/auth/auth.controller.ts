import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Autenticação (JWT & OAuth)')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Autentica usuário (e-mail + senha) e retorna token JWT' })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req.ip);
  }

  @Post('register')
  @ApiOperation({ summary: 'Cadastra novo Usuário, Profissional ou Secretária e cria suas agendas padrão' })
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.authService.register(dto, req.ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna perfil do usuário autenticado via JWT' })
  async me(@Req() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @Get('demo-accounts')
  @ApiOperation({ summary: 'Lista contas de demonstração para facilitar o teste dos 3 fluxos (Usuário, Profissional, Secretária)' })
  async demoAccounts() {
    return this.authService.listDemoAccounts();
  }
}

