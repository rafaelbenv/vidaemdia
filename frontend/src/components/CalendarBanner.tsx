import React from 'react';
import { Calendar } from '../types';

export interface CalendarBannerProps {
  calendar: Calendar;
}

export function CalendarBanner({ calendar }: CalendarBannerProps) {
  const ownerName = calendar.owner?.name || calendar.name;

  return (
    <div
      className="border-b border-stone-200"
      style={{ backgroundColor: calendar.color + '1A' }}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 text-sm text-stone-800 flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: calendar.color }}
          aria-hidden="true"
        />
        <span>
          Você está na agenda de <strong>{ownerName}</strong>
        </span>
      </div>
    </div>
  );
}
