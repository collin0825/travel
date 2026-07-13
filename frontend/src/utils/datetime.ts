/**
 * The backend stores and returns timestamps in UTC but without a timezone
 * marker (e.g. "2026-07-13T15:32:35.725541"). `new Date()` would parse that
 * as local time, so we append "Z" first, then render in the viewer's locale
 * and timezone.
 */
export const formatDateTime = (value: string): string => {
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`).toLocaleString();
};
