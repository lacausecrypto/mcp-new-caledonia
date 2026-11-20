const NC_TIMEZONE = 'Pacific/Noumea';

/** Today's date (YYYY-MM-DD) in New Caledonia, not in the host timezone. */
export function todayInNewCaledonia(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: NC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Whole days between two YYYY-MM-DD dates (to - from). */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid date range ${from} → ${to}`);
  }
  return Math.round(ms / 86_400_000);
}

/** Keep only the YYYY-MM-DD part of an ODS date/datetime value. */
export function isoDay(value: string): string {
  return value.slice(0, 10);
}
