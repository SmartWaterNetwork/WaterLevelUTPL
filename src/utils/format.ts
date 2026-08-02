/** Human-readable "hace N minutos" for a timestamp, in Spanish. */
export function relativeTime(tMs: number | null, now: number = Date.now()): string {
  if (tMs === null) return '—';
  const diff = Math.max(0, now - tMs);
  const minutes = Math.round(diff / 60_000);

  if (minutes < 1) return 'hace instantes';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;

  return new Date(tMs).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Clock time of a reading, e.g. "18:34". */
export function clockTime(tMs: number | null): string {
  if (tMs === null) return '—';
  return new Date(tMs).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
}

/** Short date + time for axis ticks, e.g. "31/07 18:34". */
export function axisDateTime(value: Date | number | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Full date + time for tooltips, e.g. "31/07/2026 18:34:57". */
export function fullDateTime(value: Date | number | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

/** Value formatted for display, with an em dash when there is nothing to show. */
export function num(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(decimals);
}

/** datetime-local input value for a Date. */
export function toDateTimeLocal(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
