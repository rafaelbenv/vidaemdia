import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';

@ApiTags('Monitoramento, Healthcheck & Métricas (DevOps)')
@Controller()
export class MonitoringController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Healthcheck da aplicação e conectividade com o PostgreSQL' })
  async healthCheck() {
    let dbStatus = 'UP';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'DOWN';
    }

    const [usersCount, calendarsCount, appointmentsCount, pendingRemindersCount, auditLogsCount] =
      await Promise.all([
        this.prisma.user.count().catch(() => 0),
        this.prisma.calendar.count().catch(() => 0),
        this.prisma.appointment.count().catch(() => 0),
        this.prisma.reminder.count({ where: { status: 'PENDING' } }).catch(() => 0),
        this.prisma.auditLog.count().catch(() => 0),
      ]);

    return {
      status: dbStatus === 'UP' ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      services: {
        backend: 'UP',
        postgresql: dbStatus,
        notificationWorker: 'UP',
      },
      databaseStats: {
        usersCount,
        calendarsCount,
        appointmentsCount,
        pendingRemindersCount,
        auditLogsCount,
      },
      metrics: this.metricsService.getSummary(),
    };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({ summary: 'Exporta métricas no formato Prometheus para coleta e visualização no Grafana' })
  getPrometheusMetrics(): string {
    return this.metricsService.toPrometheusText();
  }
}

