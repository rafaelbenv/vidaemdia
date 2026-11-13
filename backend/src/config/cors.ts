export function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0 && s !== '*');
}
