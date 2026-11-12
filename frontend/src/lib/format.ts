export function sanitizeTelegramHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return rawHtml.replace(/<[^>]*>/g, (tag) => {
    const lower = tag.toLowerCase();
    if (
      lower === '<b>' ||
      lower === '</b>' ||
      lower === '<i>' ||
      lower === '</i>' ||
      lower === '<code>' ||
      lower === '</code>'
    ) {
      return lower;
    }
    return '';
  });
}

export function getErrorMessageByStatus(status?: number | string): string {
  const code = Number(status);
  if (code === 400) return 'Confira os campos do compromisso.';
  if (code === 401) return 'Sua sessão expirou. Entre de novo.';
  if (code === 403) return 'Você não tem acesso a esta agenda. Peça ao profissional responsável.';
  return 'O servidor não respondeu. Tente de novo em instantes.';
}

export const todayStr = (() => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
})();

export function checkIsPast(dateStr: string, timeStr: string): boolean {
  if (!dateStr || !timeStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (!year || !month || !day || hours === undefined || minutes === undefined) return false;
  const targetDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return targetDate.getTime() < Date.now();
}

export function formatApptDateTime(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return { date: `${day}/${month}`, time: `${hours}:${minutes}` };
}
