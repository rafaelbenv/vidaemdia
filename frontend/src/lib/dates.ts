/**
 * Funções puras de manipulação e formatação de datas locais.
 */

/**
 * Converte Date para string 'YYYY-MM-DD' em horário local.
 */
export function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte string 'YYYY-MM-DD' para Date às 00:00 local. Se inválida, retorna hoje às 00:00 local.
 */
export function fromDateKey(key: string): Date {
  if (typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d, 0, 0, 0, 0);
    if (
      !isNaN(date.getTime()) &&
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d
    ) {
      return date;
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * Adiciona n dias a uma data.
 */
export function addDays(d: Date, n: number): Date {
  const result = new Date(d.getTime());
  result.setDate(result.getDate() + n);
  return result;
}

/**
 * Retorna a segunda-feira da semana de d, às 00:00 local.
 */
export function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  const diff = day === 0 ? 6 : day - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff, 0, 0, 0, 0);
}

/**
 * Verifica se duas datas caem no mesmo dia local.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Formata data por extenso: "Terça, 10 de novembro".
 * Primeira letra maiúscula, sem "-feira".
 */
export function formatLongDate(d: Date): string {
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  let formatted = formatter.format(d);
  formatted = formatted.replace(/\s*-feira/gi, '');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Dia da semana curto em minúsculas e sem ponto: "seg", "ter", "qua", "qui", "sex", "sáb", "dom".
 */
export function formatWeekdayShort(d: Date): string {
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
  return formatter.format(d).replace(/\./g, '').trim().toLowerCase();
}

/**
 * Formata horário para "HH:MM" (ex.: "08:00").
 */
export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '--:--';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formata dia e mês como "dd/mm" (ex.: "10/11").
 */
export function formatDayMonth(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '--/--';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}
