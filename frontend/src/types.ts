export type UserRole = 'USER' | 'PROFESSIONAL' | 'SECRETARY' | 'ADMIN';
export type NotificationChannel = 'WHATSAPP' | 'TELEGRAM' | 'BOTH';
export type CalendarType = 'PERSONAL' | 'PROFESSIONAL';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phoneWhatsapp?: string;
  telegramChatId?: string;
  telegramLinked?: boolean;
  preferredChannel: NotificationChannel;
}

export interface TelegramStatus {
  linked: boolean;
  botUsername: string | null;
}

export interface TelegramLinkResponse {
  url: string;
  expiresAt: string;
}

export interface TelegramUnlinkResponse {
  ok: boolean;
  message: string;
}

export interface CalendarPermission {
  id?: string;
  granteeUser?: User;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canCancel: boolean;
}

export interface Calendar {
  id: string;
  ownerId: string;
  type: CalendarType;
  name: string;
  description?: string;
  color: string;
  owner?: User;
  permissions?: CalendarPermission[];
  myPermissions?: CalendarPermission;
  _count?: { appointments: number };
}

export interface Reminder {
  id: string;
  appointmentId: string;
  remindAt: string;
  channel: NotificationChannel;
  status: ReminderStatus;
  retryCount: number;
  nextRetryAt?: string | null;
  lastError?: string | null;
  sentAt?: string | null;
  appointment?: {
    id: string;
    title: string;
    startTime: string;
    calendar: { id: string; name: string; type: CalendarType };
  };
}

export interface Appointment {
  id: string;
  calendarId: string;
  createdById: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  reminderMinutesBefore: number;
  status: AppointmentStatus;
  createdVia: 'WEB' | 'WHATSAPP' | 'TELEGRAM';
  createdBy?: User;
  reminders: Reminder[];
}

export interface ProfessionalDirectoryEntry {
  id: string;
  name: string;
  email: string;
  calendars: Array<{
    id: string;
    name: string;
    description?: string;
    color: string;
    hasRbacAuthorization: boolean;
    permissions: CalendarPermission | null;
  }>;
}

export interface AuditLogEntry {
  id: string;
  actorUserId?: string;
  targetCalendarId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  details: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
  actorUser?: User;
  targetCalendar?: { id: string; name: string; type: CalendarType };
}

export interface DispatchedMessageLog {
  id: string;
  channel: 'WHATSAPP' | 'TELEGRAM';
  recipient: string;
  recipientName: string;
  message: string;
  appointmentId: string;
  reminderId: string;
  success: boolean;
  providerMode: 'MOCK' | 'LIVE_API';
  error?: string;
  timestamp: string;
}

export interface ChatMessage {
  sender: 'USER' | 'BOT';
  text: string;
  time: string;
  channel: string;
}


