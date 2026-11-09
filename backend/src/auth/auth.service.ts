import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CalendarType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
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
        phoneWhatsapp: user.phoneWhatsapp,
        telegramChatId: user.telegramChatId,
        preferredChannel: user.preferredChannel,
      },
    };
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Já existe um usuário cadastrado com este e-mail');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role = dto.role || UserRole.USER;

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        passwordHash,
        role,
        phoneWhatsapp: dto.phoneWhatsapp,
        preferredChannel: dto.preferredChannel,
      },
    });

    // Cria automaticamente Agenda Pessoal para qualquer usuário e Agenda Profissional se for PROFESSIONAL
    await this.prisma.calendar.create({
      data: {
        ownerId: user.id,
        type: CalendarType.PERSONAL,
        name: `Agenda Pessoal - ${user.name}`,
        description: 'Compromissos pessoais',
        color: '#2563EB',
      },
    });

    if (role === UserRole.PROFESSIONAL) {
      await this.prisma.calendar.create({
        data: {
          ownerId: user.id,
          type: CalendarType.PROFESSIONAL,
          name: `Agenda Profissional - ${user.name}`,
          description: 'Atendimentos e compromissos profissionais',
          color: '#16A34A',
        },
      });
    }

    await this.auditService.log({
      actorUserId: user.id,
      entityType: 'AUTH',
      entityId: user.id,
      action: 'CREATE',
      details: `Novo usuário registrado: ${user.name} (${user.role}).`,
      ipAddress,
    });

    return this.login({ email: dto.email, password: dto.password }, ipAddress);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneWhatsapp: true,
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

  async listDemoAccounts() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneWhatsapp: true,
        telegramChatId: true,
        preferredChannel: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}

