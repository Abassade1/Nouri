/**
 * Time helpers for bookings. A booking happens in the CITY's local time (Calgary is
 * America/Edmonton), not the phone's, so "Tuesday 9:00" means the same thing to the owner,
 * the carer and the database. Dates are plain "YYYY-MM-DD" strings, times are "HH:MM".
 */
import type { RateUnit } from '../types/db';

const pad = (n: number) => String(n).padStart(2, '0');

/** Offset of `tz` from UTC, in minutes, at the given instant. */
export function tzOffsetMinutes(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUtc - Math.floor(utcMs / 1000) * 1000) / 60000;
}

/** The instant when it is `date` `time` on the clocks of `tz`. Handles daylight saving. */
export function zonedTimeToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = tzOffsetMinutes(guess, tz);
  let utc = guess - first * 60000;
  const second = tzOffsetMinutes(utc, tz);
  if (second !== first) utc = guess - second * 60000;
  return new Date(utc);
}

/** Today's date as seen in `tz`. */
export function todayInZone(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Sunday ... 6 = Saturday (same numbering as the database). */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function upcomingDates(tz: string, count: number, now: Date = new Date()): string[] {
  const today = todayInZone(tz, now);
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

export const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
export const minutesToTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** "09:00:00" -> "09:00" */
export const trimTime = (t: string) => t.slice(0, 5);

/** How long a booking lasts. Visits, walks and trips are one slot; overnight stays run 24 h per night. */
export function durationMinutes(unit: RateUnit, quantity = 1): number {
  switch (unit) {
    case 'per_walk': return 60;
    case 'per_trip': return 60;
    case 'per_visit': return 30;
    case 'per_night': return quantity * 24 * 60;
  }
}

export type Window = { start_time: string; end_time: string };

/**
 * Start times a carer can be booked on `date`: inside a weekly window, far enough in the future,
 * and (except overnight stays) finishing before the window closes. Mirrors the database rule.
 */
export function generateSlots(
  windows: Window[],
  opts: { date: string; tz: string; unit: RateUnit; quantity?: number; stepMin?: number; minNoticeMin?: number; now?: Date },
): string[] {
  const { date, tz, unit, quantity = 1, stepMin = 30, minNoticeMin = 120, now = new Date() } = opts;
  const dur = unit === 'per_night' ? 0 : durationMinutes(unit, quantity);
  const earliest = now.getTime() + minNoticeMin * 60000;
  const out = new Set<string>();
  for (const w of windows) {
    const start = timeToMinutes(trimTime(w.start_time));
    const end = timeToMinutes(trimTime(w.end_time));
    for (let t = start; t < end; t += stepMin) {
      if (unit !== 'per_night' && t + dur > end) break;
      const time = minutesToTime(t);
      if (zonedTimeToUtc(date, time, tz).getTime() >= earliest) out.add(time);
    }
  }
  return [...out].sort();
}
