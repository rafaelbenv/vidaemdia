import React, { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { errorStatus, getCalendarHistory } from '../api';
import { AuditLogEntry, Calendar, User } from '../types';
import { getErrorMessageByStatus } from '../lib/format';
import { addDays, formatLongDate, isSameDay, toDateKey } from '../lib/dates';
import { historySentence } from '../lib/historySentence';

export interface HistoricoPageProps {
  token: string;
  calendar: Calendar;
  me: User;
  onBack: () => void;
}

export function HistoricoPage({ token, calendar, me, onBack }: HistoricoPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getCalendarHistory(token, calendar.id)
      .then((data) => {
        if (isMounted) {
          setEntries(data || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          const status = errorStatus(err);
          setError(getErrorMessageByStatus(status));
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, calendar.id]);

  const groups = useMemo(() => {
    const list: Array<{
      dateKey: string;
      title: string;
      items: Array<{
        id: string;
        time: string;
        text: string;
        tone: 'normal' | 'alert';
      }>;
    }> = [];
    const groupMap = new Map<string, (typeof list)[0]>();

    for (const entry of entries) {
      const sentence = historySentence(entry, me);
      if (!sentence) continue;

      const date = new Date(entry.createdAt);
      const dateKey = toDateKey(date);

      let group = groupMap.get(dateKey);
      if (!group) {
        let title: string;
        const now = new Date();
        if (isSameDay(date, now)) {
          title = 'Hoje';
        } else if (isSameDay(date, addDays(now, -1))) {
          title = 'Ontem';
        } else {
          title = formatLongDate(date);
        }

        group = {
          dateKey,
          title,
          items: [],
        };
        groupMap.set(dateKey, group);
        list.push(group);
      }

      group.items.push({
        id: entry.id,
        time: sentence.time,
        text: sentence.text,
        tone: sentence.tone,
      });
    }

    return list;
  }, [entries, me]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Topo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 min-h-[44px] py-2 pr-2"
        >
          <span aria-hidden="true" className="text-base font-semibold leading-none">
            ‹
          </span>
          Agenda
        </button>
        <h1 className="text-lg font-semibold text-stone-900 truncate">
          Histórico de &quot;{calendar.name}&quot;
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500 py-6" role="status">
          Carregando…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-4 mt-4"
        >
          {error}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-stone-500 py-6">
          Nada aconteceu nesta agenda ainda.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.dateKey}>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mt-6 mb-2">
                {group.title}
              </h2>
              <div>
                {group.items.map((item) => (
                  <div key={item.id} className="flex gap-4 py-2 text-sm">
                    <span className="w-12 tabular-nums text-stone-500 shrink-0">
                      {item.time}
                    </span>
                    <span className="text-stone-800 flex items-center gap-1.5 min-w-0">
                      {item.tone === 'alert' && (
                        <ShieldAlert
                          className="w-4 h-4 text-amber-600 shrink-0"
                          aria-label="Alerta"
                        />
                      )}
                      <span>{item.text}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
