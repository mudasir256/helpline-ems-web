import { TZ } from "./constants";

export function todayPK(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00+05:00`)
    : new Date(value);

  return new Intl.DateTimeFormat("en-PK", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date) {
  return `${formatDate(value)} · ${formatTime(value)}`;
}

export function durationBetween(start: Date | string, end: Date | string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function daysAgoPK(days: number) {
  const now = new Date();
  const shifted = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return todayPK(shifted);
}

// Moves a Pakistan calendar date ("YYYY-MM-DD") by whole days. Pakistan has no daylight saving.
export function shiftDatePK(date: string, days: number) {
  const noon = new Date(`${date}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon.toISOString().slice(0, 10);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Rejects shapes like 2026-02-30 or 2026-13-01 instead of letting them roll over.
export function isCalendarDate(date: string) {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
