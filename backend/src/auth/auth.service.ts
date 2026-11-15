import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CalendarType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { MetricsService } from '../monitoring/metrics.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly metricsService: MetricsService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      this.metricsService.incrementAuthFailure();
      throw new UnauthorizedException('Credenciais inválidas (e-mail ou senha incorretos)');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.metricsService.incrementAuthFailure();
      throw new UnauthorizedException('Credenciais inválidas (e-mail ou senha incorretos)');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    await this.auditService.log({
      actorUserId: user.id,
      entityType: 'AUTH',
      entityId: user.id,
      action: 'LOGIN',
      details: `Login realizado com sucesso por ${user.name} (${user.role}). JWT emitido.`,
      ipAddress,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        telegramChatId: user.telegramChatId,
        preferredChannel: user.preferredChannel,
      },
    };
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException(
        'Não foi possível criar a conta com este e-mail. Se você já tem conta, entre ou recupere a senha.',
      );
    }

    const name = typeof dto.name === 'string' ? dto.name.trim().replace(/\s+/g, ' ') : dto.name;
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role = UserRole.USER;

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        preferredChannel: dto.preferredChannel,
      },
    });

    // Cria automaticamente a Agenda Pessoal do novo usuário
    await this.prisma.calendar.create({
      data: {
        ownerId: user.id,
        type: CalendarType.PERSONAL,
        name: 'Minha agenda',
        description: 'Compromissos pessoais',
        color: '#2563EB',
      },
    });

    await this.auditService.log({
      actorUserId: user.id,
      entityType: 'AUTH',
      entityId: user.id,
      action: 'CREATE',
      details: `Novo usuário registrado: ${user.name} (${user.role}).`,
      ipAddress,
    });

    return this.login({ email, password: dto.password }, ipAddress);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        telegramChatId: true,
        preferredChannel: true,
        createdAt: true,
      },
    });

    if (!user) {
      return null;
    }

    const { telegramChatId, ...rest } = user;
    return {
      ...rest,
      telegramLinked: Boolean(telegramChatId),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, ipAddress?: string) {
    const name = typeof dto.name === 'string' ? dto.name.trim().replace(/\s+/g, ' ') : dto.name;
    await this.prisma.user.update({
      where: { id: userId },
      data: { name },
    });

    await this.auditService.log({
      actorUserId: userId,
      entityType: 'AUTH',
      entityId: userId,
      action: 'UPDATE',
      details: `Nome alterado para ${name}.`,
      ipAddress,
    });

    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      this.metricsService.incrementAuthFailure();
      throw new BadRequestException('A senha atual está incorreta.');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('A senha nova precisa ser diferente da atual.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.auditService.log({
      actorUserId: userId,
      entityType: 'AUTH',
      entityId: userId,
      action: 'UPDATE',
      details: 'Senha alterada.',
      ipAddress,
    });

    return { ok: true, message: 'Senha alterada.' };
  }
}
