/**
 * Centralised date/time formatting helpers.
 * All operational display uses the local timezone defined here.
 */

const OPERATIONAL_TZ = 'America/Campo_Grande';

/** Format a timestamp as dd/MM/yyyy HH:mm in the operational timezone */
export const formatLocalDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', {
    timeZone: OPERATIONAL_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Format a timestamp as dd/MM/yyyy in the operational timezone */
export const formatLocalDate = (value: string | Date | null | undefined): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', {
    timeZone: OPERATIONAL_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/** Format minutes as hh:mm */
export const formatDuration = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Classify permanence duration for visual styling */
export const permanenceLevel = (minutes: number | null | undefined): 'normal' | 'high' | 'critical' => {
  if (!minutes) return 'normal';
  if (minutes >= 480) return 'critical'; // 8h+
  if (minutes >= 240) return 'high';     // 4h+
  return 'normal';
};

/** Format a Date for export (CSV/Excel/PDF) in local timezone */
export const formatExportDateTime = (value: string | Date | null | undefined): string => {
  return formatLocalDateTime(value);
};

export const formatExportDate = (value: string | Date | null | undefined): string => {
  return formatLocalDate(value);
};

export { OPERATIONAL_TZ };
