import React from 'react';
import {
  addDays,
  formatLongDate,
  formatWeekdayShort,
  isSameDay,
  startOfWeek,
  toDateKey,
} from '../../lib/dates';

export interface WeekStripProps {
  selected: Date;
  counts: Record<string, number>;
  onSelect: (d: Date) => void;
}

export function WeekStrip({ selected, counts, onSelect }: WeekStripProps) {
  const weekStart = startOfWeek(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const key = toDateKey(day);
        const count = counts[key] ?? 0;
        const isSelected = isSameDay(day, selected);
        const isToday = isSameDay(day, today);
        const weekdayShort = formatWeekdayShort(day);
        const dayNumber = day.getDate();
        const ariaLabel = `${formatLongDate(day)}, ${count} ${
          count === 1 ? 'compromisso' : 'compromissos'
        }`;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={isSelected}
            aria-label={ariaLabel}
            className={`min-h-[44px] py-2 px-1 rounded-md flex flex-col items-center justify-center transition select-none ${
              isSelected
                ? 'bg-brand-700 text-white'
                : isToday
                ? 'bg-white ring-1 ring-brand-600 hover:bg-stone-100 text-stone-900'
                : 'bg-white hover:bg-stone-100 text-stone-900'
            }`}
          >
            <span
              className={`text-xs ${
                isSelected ? 'text-white/80' : 'text-stone-500'
              }`}
            >
              {weekdayShort}
            </span>
            <span className="text-base font-semibold tabular-nums leading-tight my-0.5">
              {dayNumber}
            </span>
            <span
              className={`text-xs ${
                isSelected ? 'text-white/80' : 'text-stone-600'
              }`}
            >
              {count > 0 ? count : '·'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
