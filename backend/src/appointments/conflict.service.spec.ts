import { AppointmentStatus } from '@prisma/client';
import { ConflictService } from './conflict.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ConflictService', () => {
  let service: ConflictService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      appointment: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    service = new ConflictService(mockPrisma as unknown as PrismaService);
  });

  it('sem sobreposição → nada marcado', async () => {
    const appts = [
      {
        id: 'a1',
        startTime: new Date('2026-11-20T10:00:00Z'),
        endTime: new Date('2026-11-20T11:00:00Z'),
        hasConflict: false,
      },
      {
        id: 'a2',
        startTime: new Date('2026-11-20T11:30:00Z'),
        endTime: new Date('2026-11-20T12:30:00Z'),
        hasConflict: false,
      },
    ];

    mockPrisma.appointment.findMany.mockResolvedValue(appts);

    await service.recalculateCalendar('cal-1');

    // Nenhuma chamada para hasConflict: true
    expect(mockPrisma.appointment.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        calendarId: 'cal-1',
        hasConflict: true,
      },
      data: {
        hasConflict: false,
      },
    });
  });

  it('A e B sobrepostos → os dois entram no conjunto e são marcados', async () => {
    const appts = [
      {
        id: 'a1',
        startTime: new Date('2026-11-20T10:00:00Z'),
        endTime: new Date('2026-11-20T11:00:00Z'),
        hasConflict: false,
      },
      {
        id: 'a2',
        startTime: new Date('2026-11-20T10:30:00Z'),
        endTime: new Date('2026-11-20T11:30:00Z'),
        hasConflict: false,
      },
    ];

    mockPrisma.appointment.findMany.mockResolvedValue(appts);

    await service.recalculateCalendar('cal-1');

    expect(mockPrisma.appointment.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.appointment.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        calendarId: 'cal-1',
        id: { in: expect.arrayContaining(['a1', 'a2']) },
        hasConflict: false,
      },
      data: {
        hasConflict: true,
      },
    });
    expect(mockPrisma.appointment.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        calendarId: 'cal-1',
        id: { notIn: expect.arrayContaining(['a1', 'a2']) },
        hasConflict: true,
      },
      data: {
        hasConflict: false,
      },
    });
  });

  it('A longo cobrindo B e C → os três entram no conjunto', async () => {
    const appts = [
      {
        id: 'a1',
        startTime: new Date('2026-11-20T10:00:00Z'),
        endTime: new Date('2026-11-20T13:00:00Z'),
        hasConflict: false,
      },
      {
        id: 'a2',
        startTime: new Date('2026-11-20T10:30:00Z'),
        endTime: new Date('2026-11-20T11:00:00Z'),
        hasConflict: false,
      },
      {
        id: 'a3',
        startTime: new Date('2026-11-20T11:30:00Z'),
        endTime: new Date('2026-11-20T12:00:00Z'),
        hasConflict: false,
      },
    ];

    mockPrisma.appointment.findMany.mockResolvedValue(appts);

    await service.recalculateCalendar('cal-1');

    expect(mockPrisma.appointment.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.appointment.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        calendarId: 'cal-1',
        id: { in: expect.arrayContaining(['a1', 'a2', 'a3']) },
        hasConflict: false,
      },
      data: {
        hasConflict: true,
      },
    });
    expect(mockPrisma.appointment.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        calendarId: 'cal-1',
        id: { notIn: expect.arrayContaining(['a1', 'a2', 'a3']) },
        hasConflict: true,
      },
      data: {
        hasConflict: false,
      },
    });
  });

  it('cancelado e dia inteiro não contam na busca e demais compromissos que estavam true são desmarcados', async () => {
    // A busca filtra por status SCHEDULED e allDay false, logo compromissos cancelados e dia inteiro
    // não são retornados pelo findMany e caem no updateMany de hasConflict: false.
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    await service.recalculateCalendar('cal-1');

    expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith({
      where: {
        calendarId: 'cal-1',
        status: AppointmentStatus.SCHEDULED,
        allDay: false,
        endTime: { gte: expect.any(Date) },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        hasConflict: true,
      },
      orderBy: { startTime: 'asc' },
    });

    expect(mockPrisma.appointment.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        calendarId: 'cal-1',
        hasConflict: true,
      },
      data: {
        hasConflict: false,
      },
    });
  });

  it('encostado (fim de A == início de B) não é conflito', async () => {
    const appts = [
      {
        id: 'a1',
        startTime: new Date('2026-11-20T10:00:00Z'),
        endTime: new Date('2026-11-20T11:00:00Z'),
        hasConflict: false,
      },
      {
        id: 'a2',
        startTime: new Date('2026-11-20T11:00:00Z'),
        endTime: new Date('2026-11-20T12:00:00Z'),
        hasConflict: false,
      },
    ];

    mockPrisma.appointment.findMany.mockResolvedValue(appts);

    await service.recalculateCalendar('cal-1');

    // Nenhuma marcação como true
    expect(mockPrisma.appointment.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.appointment.updateMany).toHaveBeenCalledWith({
      where: {
        calendarId: 'cal-1',
        hasConflict: true,
      },
      data: {
        hasConflict: false,
      },
    });
  });
});
