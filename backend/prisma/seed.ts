import { PrismaClient, UserRole, CalendarType, NotificationChannel, AppointmentStatus, ReminderStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados VidaEmDia...');

  const passwordHash = await bcrypt.hash('123456', 10);

  // 1. Usuário Comum (Agenda Pessoal)
  const userCarlos = await prisma.user.upsert({
    where: { email: 'carlos@vidaemdia.com.br' },
    update: {},
    create: {
      name: 'Carlos Silva (Usuário)',
      email: 'carlos@vidaemdia.com.br',
      passwordHash,
      telegramChatId: null,
      role: UserRole.USER,
      preferredChannel: NotificationChannel.TELEGRAM,
    },
  });

  // 2. Profissional 1: Dr. João (Autoriza a Secretária Maria)
  const drJoao = await prisma.user.upsert({
    where: { email: 'dr.joao@vidaemdia.com.br' },
    update: {},
    create: {
      name: 'Dr. João Mendes (Cardiologista)',
      email: 'dr.joao@vidaemdia.com.br',
      passwordHash,
      telegramChatId: null,
      role: UserRole.PROFESSIONAL,
      preferredChannel: NotificationChannel.TELEGRAM,
    },
  });

  // 3. Profissional 2: Dra. Ana (NÃO autoriza a Secretária Maria - útil para testar erro 403 RBAC!)
  const draAna = await prisma.user.upsert({
    where: { email: 'dra.ana@vidaemdia.com.br' },
    update: {},
    create: {
      name: 'Dra. Ana Costa (Dermatologista)',
      email: 'dra.ana@vidaemdia.com.br',
      passwordHash,
      telegramChatId: null,
      role: UserRole.PROFESSIONAL,
      preferredChannel: NotificationChannel.TELEGRAM,
    },
  });

  // 4. Secretária: Maria
  const secMaria = await prisma.user.upsert({
    where: { email: 'secretaria.maria@vidaemdia.com.br' },
    update: {},
    create: {
      name: 'Maria Oliveira (Secretária)',
      email: 'secretaria.maria@vidaemdia.com.br',
      passwordHash,
      telegramChatId: null,
      role: UserRole.SECRETARY,
      preferredChannel: NotificationChannel.TELEGRAM,
    },
  });

  await prisma.calendar.deleteMany({
    where: { ownerId: { in: [userCarlos.id, drJoao.id, draAna.id, secMaria.id] } },
  });

  // Criar Agendas
  const agendaPessoalCarlos = await prisma.calendar.create({
    data: {
      ownerId: userCarlos.id,
      type: CalendarType.PERSONAL,
      name: 'Agenda Pessoal - Carlos',
      description: 'Compromissos pessoais, academia e finanças',
      color: '#2563EB',
    },
  });

  const agendaProfDrJoao = await prisma.calendar.create({
    data: {
      ownerId: drJoao.id,
      type: CalendarType.PROFESSIONAL,
      name: 'Consultório Dr. João Mendes',
      description: 'Agenda médica de consultas e retornos cardiológicos',
      color: '#16A34A',
    },
  });

  const agendaPessoalDrJoao = await prisma.calendar.create({
    data: {
      ownerId: drJoao.id,
      type: CalendarType.PERSONAL,
      name: 'Agenda Pessoal - Dr. João',
      description: 'Compromissos particulares do Dr. João',
      color: '#4F46E5',
    },
  });

  const agendaProfDraAna = await prisma.calendar.create({
    data: {
      ownerId: draAna.id,
      type: CalendarType.PROFESSIONAL,
      name: 'Clínica Dra. Ana Costa',
      description: 'Agenda restrita - Secretária Maria NÃO possui autorização RBAC',
      color: '#DC2626',
    },
  });

  // Vínculo RBAC: Dr. João concede permissão à Secretária Maria APENAS na sua Agenda Profissional
  await prisma.calendarPermission.upsert({
    where: {
      calendarId_granteeUserId: {
        calendarId: agendaProfDrJoao.id,
        granteeUserId: secMaria.id,
      },
    },
    update: {},
    create: {
      calendarId: agendaProfDrJoao.id,
      granteeUserId: secMaria.id,
      canView: true,
      canCreate: true,
      canUpdate: true,
      canCancel: true,
    },
  });

  // Criar Compromissos de Exemplo + Lembretes Pendentes
  const now = new Date();
  const in10Minutes = new Date(now.getTime() + 10 * 60 * 1000);
  const in70Minutes = new Date(now.getTime() + 70 * 60 * 1000);
  const tomorrow8am = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0);
  const tomorrow9am = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);

  const appt1 = await prisma.appointment.create({
    data: {
      calendarId: agendaPessoalCarlos.id,
      createdById: userCarlos.id,
      title: 'Consulta médica de rotina',
      description: 'Levar exames laboratoriais recentes',
      startTime: in10Minutes,
      endTime: in70Minutes,
      reminderMinutesBefore: 15,
      status: AppointmentStatus.SCHEDULED,
      createdVia: 'WEB',
      reminders: {
        create: {
          remindAt: new Date(now.getTime() - 60 * 1000), // Já elegível para disparo imediato pelo Worker!
          channel: NotificationChannel.TELEGRAM,
          status: ReminderStatus.PENDING,
        },
      },
    },
  });

  const appt2 = await prisma.appointment.create({
    data: {
      calendarId: agendaProfDrJoao.id,
      createdById: secMaria.id,
      title: 'Paciente: Roberto Almeida (Check-up)',
      description: 'Agendado pela secretária Maria via fluxo RBAC',
      startTime: tomorrow8am,
      endTime: tomorrow9am,
      reminderMinutesBefore: 60,
      status: AppointmentStatus.SCHEDULED,
      createdVia: 'WEB',
      reminders: {
        create: {
          remindAt: new Date(tomorrow8am.getTime() - 60 * 60 * 1000),
          channel: NotificationChannel.TELEGRAM,
          status: ReminderStatus.PENDING,
        },
      },
    },
  });

  // Log de Auditoria inicial demonstrando o Fluxo RBAC
  await prisma.auditLog.create({
    data: {
      actorUserId: secMaria.id,
      targetCalendarId: agendaProfDrJoao.id,
      entityType: 'APPOINTMENT',
      entityId: appt2.id,
      action: 'CREATE',
      details: 'Secretária Maria Oliveira criou o compromisso "Paciente: Roberto Almeida (Check-up)" na agenda do Dr. João Mendes.',
      metadata: {
        title: appt2.title,
        role: 'SECRETARY',
        rbacVerified: true,
      },
      ipAddress: '127.0.0.1',
    },
  });

  console.log('✅ Seed concluído com sucesso!');
  console.log('Seed idempotente: dados de demonstração recriados');
  console.log('Contas de teste (senha padrão: 123456):');
  console.log('  - Usuário:      carlos@vidaemdia.com.br');
  console.log('  - Profissional: dr.joao@vidaemdia.com.br');
  console.log('  - Profissional: dra.ana@vidaemdia.com.br (sem delegação para Maria -> testa 403)');
  console.log('  - Secretária:   secretaria.maria@vidaemdia.com.br');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

