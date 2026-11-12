import React from 'react';
import { Check, ChevronDown, History, Users } from 'lucide-react';
import { Calendar } from '../types';
import { useDropdown } from '../hooks/useDropdown';

export interface CalendarMenuProps {
  owned: Calendar[];
  delegated: Calendar[];
  selectedId: string;
  canShareSelected: boolean;
  onSelect: (id: string) => void;
  onShare: () => void;
  onHistory: () => void;
}

export function CalendarMenu({
  owned,
  delegated,
  selectedId,
  canShareSelected,
  onSelect,
  onShare,
  onHistory,
}: CalendarMenuProps) {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>();

  const allAccessible = [...owned, ...delegated];
  const activeCalendar =
    allAccessible.find((c) => c.id === selectedId) || allAccessible[0];
  const isDelegated = delegated.some((c) => c.id === activeCalendar?.id);
  const buttonLabel = isDelegated
    ? `Agenda de ${activeCalendar?.owner?.name || activeCalendar?.name || 'Outro'}`
    : (activeCalendar?.name ?? 'Agenda');

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const menu = e.currentTarget;
      const items = Array.from(
        menu.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]'),
      );
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown') {
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[nextIndex]?.focus();
      } else {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prevIndex]?.focus();
      }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/10 text-white min-h-[44px] transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus-visible:outline-white"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu de agendas"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: activeCalendar?.color ?? '#16a34a' }}
          aria-hidden="true"
        />
        <span className="truncate max-w-[45vw] sm:max-w-xs text-sm font-medium">
          {buttonLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-300 transition-transform shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute left-0 mt-2 w-72 bg-white text-stone-900 rounded-lg border border-stone-200 shadow-lg py-2 z-30"
        >
          {/* Minhas agendas */}
          {owned.length > 0 && (
            <>
              <div className="px-3 pt-1 pb-1 text-xs font-semibold text-stone-500">
                Minhas agendas
              </div>
              {owned.map((cal) => {
                const isSelected = cal.id === selectedId;
                return (
                  <button
                    key={cal.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => {
                      onSelect(cal.id);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 flex items-center gap-2 min-h-11 min-w-11 sm:min-h-[40px] sm:min-w-0 text-stone-900"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cal.color }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{cal.name}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-brand-700 shrink-0" />
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* Agendas que gerencio */}
          {delegated.length > 0 && (
            <>
              <div
                className={`px-3 pt-2 pb-1 text-xs font-semibold text-stone-500 ${
                  owned.length > 0 ? 'border-t border-stone-100 mt-1' : ''
                }`}
              >
                Agendas que gerencio
              </div>
              {delegated.map((cal) => {
                const isSelected = cal.id === selectedId;
                return (
                  <button
                    key={cal.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => {
                      onSelect(cal.id);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 flex items-center gap-2 min-h-11 min-w-11 sm:min-h-[40px] sm:min-w-0 text-stone-900"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cal.color }}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-stone-900">
                        {cal.owner?.name ?? cal.name}
                      </div>
                      <div className="truncate text-xs text-stone-500">
                        {cal.name}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-brand-700 shrink-0" />
                    )}
                  </button>
                );
              })}
            </>
          )}

          {/* Divisória e Compartilhar */}
          {canShareSelected && (
            <>
              <div className="border-t border-stone-100 my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onShare();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 flex items-center gap-2 min-h-11 min-w-11 sm:min-h-[40px] sm:min-w-0 text-stone-700"
              >
                <Users className="w-4 h-4 text-stone-500 shrink-0" />
                <span>Compartilhar esta agenda</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onHistory();
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-stone-100 flex items-center gap-2 min-h-11 min-w-11 sm:min-h-[40px] sm:min-w-0 text-stone-700"
              >
                <History className="w-4 h-4 text-stone-500 shrink-0" />
                <span>Histórico desta agenda</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
