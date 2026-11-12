import React from 'react';
import {
  formatLongDate,
  isSameDay,
  monthGridDays,
  toDateKey,
} from '../../lib/dates';

export interface MonthGridProps {
  month: Date;
  selected: Date;
  today: Date;
  counts: Record<string, number>;
  failed: Set<string>;
  onSelect: (d: Date) => void;
}

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export function MonthGrid({
  month,
  selected,
  today,
  counts,
  failed,
  onSelect,
}: MonthGridProps) {
  const days = monthGridDays(month);

  return (
    <div>
      {/* Cabeçalho de dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-xs text-stone-500 text-center py-1"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((item, idx) => {
          if (!item) {
            return <div key={`empty-${idx}`} aria-hidden="true" />;
          }

          const key = toDateKey(item);
          const count = counts[key] ?? 0;
          const hasFailed = failed.has(key);
          const isSelected = isSameDay(item, selected);
          const isToday = isSameDay(item, today);
          const isPast = toDateKey(item) < toDateKey(today);

          const countLabel = `${count} ${count === 1 ? 'compromisso' : 'compromissos'}`;
          const failedLabel = hasFailed ? ', lembrete falhou' : '';
          const ariaLabel = `${formatLongDate(item)}, ${countLabel}${failedLabel}`;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(item)}
              aria-pressed={isSelected}
              aria-label={ariaLabel}
              className={`relative flex flex-col justify-between h-14 sm:h-20 rounded-md text-left p-1.5 sm:p-2 border transition select-none hover:bg-stone-100 ${
                isToday ? 'border-brand-600' : 'border-transparent'
              } ${isSelected ? 'bg-brand-50' : 'bg-white'}`}
            >
              <span
                className={`text-xs sm:text-sm font-semibold tabular-nums ${
                  isPast ? 'text-stone-400' : 'text-stone-900'
                }`}
              >
                {item.getDate()}
              </span>

              {hasFailed && (
                <span
                  className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-1.5 h-1.5 rounded-full bg-red-500"
                  aria-hidden="true"
                />
              )}

              {count > 0 && (
                <span
                  className={`text-[11px] sm:text-xs ${
                    isPast ? 'text-stone-400' : 'text-stone-600'
                  }`}
                >
                  <span className="sm:hidden">{count}</span>
                  <span className="hidden sm:inline">
                    {count} {count === 1 ? 'compromisso' : 'compromissos'}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
