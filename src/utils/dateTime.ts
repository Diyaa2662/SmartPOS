// src/utils/dateTime.ts
// Date utilities for SQLite timestamps and local time conversion.

export const parseSqliteDateAsUtc = (dateStr: string): Date => {
  if (!dateStr) {
    return new Date(NaN);
  }

  // SQLite default `datetime('now')` returns UTC strings like "YYYY-MM-DD HH:MM:SS".
  // Convert that to a proper ISO UTC timestamp for consistent local display.
  const hasExplicitTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(dateStr);
  if (hasExplicitTimezone) {
    return new Date(dateStr);
  }

  const normalized = dateStr.replace(' ', 'T') + 'Z';
  return new Date(normalized);
};
