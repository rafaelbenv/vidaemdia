import { AuditLogEntry, AuditLogMetadata } from '../types';

export interface HistorySentenceResult {
  time: string;
  text: string;
  tone: 'normal' | 'alert';
}

function formatWhen(val?: unknown): string | null {
  if (!val) return null;
  const d = val instanceof Date ? val : typeof val === 'string' ? new Date(val) : null;
  if (!d || isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} às ${hours}:${minutes}`;
}

function formatTimeHHMM(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '--:--';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function resolveActor(actorUser?: { id?: string; name?: string | null } | null, meId?: string): string {
  if (actorUser?.id && meId && actorUser.id === meId) {
    return 'Você';
  }
  if (actorUser?.name && actorUser.name.trim()) {
    return actorUser.name.trim();
  }
  return 'Alguém';
}

export function historySentence(
  entry: AuditLogEntry,
  me: { id: string },
): HistorySentenceResult | null {
  if (!entry || !entry.entityType) {
    return null;
  }

  const time = formatTimeHHMM(entry.createdAt);
  const actor = resolveActor(entry.actorUser, me.id);

  // Compromissos
  if (entry.entityType === 'APPOINTMENT') {
    const metadata = (entry.metadata as AuditLogMetadata) || {};
    const before = metadata.before || {};
    const after = metadata.after || {};

    if (entry.action === 'CREATE') {
      const t =
        (typeof metadata.title === 'string' && metadata.title.trim()) ||
        (typeof after.title === 'string' && after.title.trim()) ||
        null;
      const startTime = metadata.startTime || after.startTime;
      const q = formatWhen(startTime);

      if (t && q) {
        return {
          time,
          text: `${actor} marcou "${t}" para ${q}`,
          tone: 'normal',
        };
      }
      return {
        time,
        text: `${actor} mexeu em um compromisso`,
        tone: 'normal',
      };
    }

    if (entry.action === 'UPDATE') {
      const t =
        (typeof after.title === 'string' && after.title.trim()) ||
        (typeof before.title === 'string' && before.title.trim()) ||
        (typeof metadata.title === 'string' && metadata.title.trim()) ||
        null;

      if (!t) {
        return {
          time,
          text: `${actor} mexeu em um compromisso`,
          tone: 'normal',
        };
      }

      const beforeStartTime = before.startTime;
      const afterStartTime = after.startTime;

      const bTime = beforeStartTime ? new Date(beforeStartTime).getTime() : NaN;
      const aTime = afterStartTime ? new Date(afterStartTime).getTime() : NaN;
      const isTimeChanged =
        !isNaN(bTime) && !isNaN(aTime)
          ? bTime !== aTime
          : beforeStartTime !== afterStartTime;

      if (isTimeChanged && afterStartTime) {
        const q = formatWhen(afterStartTime);
        if (q) {
          return {
            time,
            text: `${actor} alterou "${t}" para ${q}`,
            tone: 'normal',
          };
        }
      }

      return {
        time,
        text: `${actor} alterou "${t}"`,
        tone: 'normal',
      };
    }

    if (entry.action === 'CANCEL') {
      const t =
        (typeof before.title === 'string' && before.title.trim()) ||
        (typeof after.title === 'string' && after.title.trim()) ||
        (typeof metadata.title === 'string' && metadata.title.trim()) ||
        null;
      const startTime = before.startTime || metadata.startTime || after.startTime;
      const q = formatWhen(startTime);

      if (t && q) {
        return {
          time,
          text: `${actor} cancelou "${t}" de ${q}`,
          tone: 'normal',
        };
      }

      return {
        time,
        text: `${actor} mexeu em um compromisso`,
        tone: 'normal',
      };
    }

    return {
      time,
      text: `${actor} mexeu em um compromisso`,
      tone: 'normal',
    };
  }

  // Permissões / Acesso
  if (entry.entityType === 'PERMISSION') {
    const metadata = (entry.metadata as AuditLogMetadata) || {};
    const p =
      typeof metadata.granteeName === 'string' && metadata.granteeName.trim()
        ? metadata.granteeName.trim()
        : 'uma pessoa';

    if (entry.action === 'UPDATE' || entry.action === 'CREATE') {
      return {
        time,
        text: `${actor} deu acesso a ${p}`,
        tone: 'normal',
      };
    }

    if (entry.action === 'CANCEL' || entry.action === 'DELETE') {
      return {
        time,
        text: `${actor} removeu o acesso de ${p}`,
        tone: 'normal',
      };
    }

    return null;
  }

  // Acesso negado RBAC
  if (entry.entityType === 'RBAC' && (entry.action === 'ACCESS_DENIED' || entry.action === 'DENIED')) {
    const whoTried =
      (entry.actorUser?.name && entry.actorUser.name.trim()) ||
      (entry.actorUser?.id && me.id && entry.actorUser.id === me.id ? 'Você' : 'Alguém');

    return {
      time,
      text: `Tentativa de acesso negada: ${whoTried}`,
      tone: 'alert',
    };
  }

  // AUTH, CHATBOT e outros não aparecem no histórico da agenda
  return null;
}
