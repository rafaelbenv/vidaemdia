export type UserRole = 'USER' | 'PROFESSIONAL' | 'SECRETARY' | 'ADMIN';
export type NotificationChannel = 'TELEGRAM';
export type CalendarType = 'PERSONAL' | 'PROFESSIONAL';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
export type ReminderStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
  googleCalendarId?: string | null;
  googleCalendarName?: string | null;
  googleLinkedAt?: string | null;
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
  claimedAt?: string | null;
  claimedBy?: string | null;
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
  createdVia: 'WEB' | 'TELEGRAM';
  createdBy?: User;
  calendar?: {
    id: string;
    name?: string;
    ownerId?: string;
    owner?: { id: string; name: string; telegramChatId?: string | null };
  };
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

export interface AuditLogMetadataAppointmentSnapshot {
  title?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
}

export interface AuditLogMetadata {
  title?: string;
  startTime?: string;
  endTime?: string;
  reminderChannel?: string;
  reminderMinutesBefore?: number;
  isDelegated?: boolean;
  createdVia?: string;
  before?: AuditLogMetadataAppointmentSnapshot;
  after?: AuditLogMetadataAppointmentSnapshot;
  granteeUserId?: string;
  granteeName?: string;
  granteeEmail?: string;
  operation?: string;
  userRole?: string;
  calendarOwner?: string;
  [key: string]: unknown;
}

export interface AuditLogEntry {
  id: string;
  actorUserId?: string;
  targetCalendarId?: string;
  entityType: string;
  entityId?: string;
  action: string;
  details: string;
  metadata?: AuditLogMetadata | Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  actorUser?: User;
  targetCalendar?: { id: string; name: string; type: CalendarType };
}

export interface DispatchedMessageLog {
  id: string;
  channel: 'TELEGRAM';
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

export interface WorkerStats {
  isRunning: boolean;
  lastRunAt: string | null;
  totalCycles: number;
  maxRetries: number;
}

export interface NotificationsStatus {
  worker: WorkerStats;
  reminders: Reminder[];
  dispatchedMessages: DispatchedMessageLog[];
}

export interface HealthServices {
  backend: string;
  postgresql: string;
  notificationWorker: string;
}

export interface HealthDatabaseStats {
  usersCount?: number;
  calendarsCount?: number;
  appointmentsCount?: number;
  pendingRemindersCount?: number;
  auditLogsCount?: number;
}

export interface HealthMetrics {
  appointmentsCreatedWeb?: number;
  appointmentsCreatedTelegram?: number;
  remindersSentTelegram?: number;
  remindersFailed?: number;
  rbacAccessDenied?: number;
  authFailures?: number;
  telegramUpdatesReceived?: number;
  telegramApiErrors?: number;
  uptimeSeconds?: number;
}

export interface HealthData {
  status: string;
  timestamp: string;
  services: HealthServices;
  databaseStats: HealthDatabaseStats;
  metrics: HealthMetrics;
}

export interface VerifyAccessResponse {
  authorized: boolean;
  isDelegated: boolean;
  calendar: Calendar;
}

export interface GrantPermissionBody {
  secretaryEmail: string;
  canView?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canCancel?: boolean;
}

export interface GrantPermissionResponse extends CalendarPermission {
  calendarId: string;
  granteeUserId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RunWorkerResponse {
  cycle?: number;
  processed: number;
  sent?: number;
  retried?: number;
  failedPermanently?: number;
  skipped?: number;
  message: string;
}

export interface SimulateFailureBody {
  failCount?: number;
}

export interface SimulateFailureResponse {
  simulateFailureNextCount: number;
}

export interface CreateAppointmentBody {
  calendarId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  reminderMinutesBefore?: number;
  reminderEnabled?: boolean;
  reminderChannel?: NotificationChannel;
}

export interface UpdateAppointmentBody {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  reminderMinutesBefore?: number;
  reminderEnabled?: boolean;
  reminderChannel?: NotificationChannel;
}

export interface BotMessageBody {
  text: string;
  channel?: string;
  senderIdentifier?: string;
}



