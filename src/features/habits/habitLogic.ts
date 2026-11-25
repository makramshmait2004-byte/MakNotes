import { addDays, eachDay, startOfWeek, weekday, type ISODate } from '@/lib/dates';
import type { Habit, HabitLog } from '@/types/models';
import { stableId } from '@/lib/ids';
import { remove, upsert } from '@/data/repo';
import { getDb } from '@/data/db';

type H = Pick<Habit, 'frequency' | 'weekdays' | 'target_per_week' | 'created_at'>;

/** Is the habit scheduled on this date? Weekly habits can be done any day. */
export function isDue(h: H, date: ISODate): boolean {
  if (h.frequency === 'weekdays') return (h.weekdays ?? []).includes(weekday(date));
  return true;
}

export const habitLogId = (habitId: string, date: ISODate) => stableId(habitId, date);

/** Toggle done for a date: none → done → skipped → none. */
export async function cycleHabit(habitId: string, date: ISODate) {
  const id = habitLogId(habitId, date);
  const cur = await getDb().habit_logs.get(id);
  if (!cur || cur.deleted_at) return upsert('habit_logs', id, { habit_id: habitId, date, status: 'done' }, { status: 'done' });
  if (cur.status === 'done') return upsert('habit_logs', id, { habit_id: habitId, date }, { status: 'skipped' });
  return remove('habit_logs', id);
}

export async function setHabit(habitId: string, date: ISODate, done: boolean) {
  const id = habitLogId(habitId, date);
  if (done) return upsert('habit_logs', id, { habit_id: habitId, date, status: 'done' }, { status: 'done' });
  const cur = await getDb().habit_logs.get(id);
  if (cur && !cur.deleted_at) await remove('habit_logs', id);
}

/**
 * Current streak in "due periods":
 *  - daily / weekdays: consecutive due days completed (skipped days don't break, today may be pending)
 *  - weekly: consecutive weeks reaching target_per_week (current week counts if already reached)
 */
export function currentStreak(h: H, logs: Pick<HabitLog, 'date' | 'status'>[], today: ISODate, weekStart = 1): number {
  const status = new Map(logs.map((l) => [l.date, l.status]));
  if (h.frequency === 'weekly') {
    let streak = 0;
    let ws = startOfWeek(today, weekStart);
    const count = (s: ISODate) => eachDay(s, addDays(s, 6)).filter((d) => status.get(d) === 'done').length;
    if (count(ws) >= h.target_per_week) streak++;
    ws = addDays(ws, -7);
    for (let i = 0; i < 520; i++) {
      if (count(ws) >= h.target_per_week) streak++;
      else break;
      ws = addDays(ws, -7);
    }
    return streak;
  }
  let streak = 0;
  let d = today;
  const created = h.created_at.slice(0, 10);
  for (let i = 0; i < 3660; i++) {
    if (isDue(h, d)) {
      const s = status.get(d);
      if (s === 'done') streak++;
      else if (s === 'skipped') {
        /* neutral */
      } else if (d !== today) break;
    }
    d = addDays(d, -1);
    if (d < created && !status.has(d)) break;
  }
  return streak;
}

export function longestStreak(h: H, logs: Pick<HabitLog, 'date' | 'status'>[]): number {
  if (!logs.length || h.frequency === 'weekly') return 0;
  const done = new Set(logs.filter((l) => l.status === 'done').map((l) => l.date));
  const skipped = new Set(logs.filter((l) => l.status === 'skipped').map((l) => l.date));
  const dates = [...done].sort();
  let best = 0,
    run = 0;
  for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDays(d, 1)) {
    if (!isDue(h, d) || skipped.has(d)) continue;
    if (done.has(d)) best = Math.max(best, ++run);
    else run = 0;
  }
  return best;
}

/** Completion rate over a range = done / due days (weekly: done / expected). */
export function completionRate(h: H, logs: Pick<HabitLog, 'date' | 'status'>[], from: ISODate, to: ISODate): { done: number; due: number; rate: number } {
  const start = h.created_at.slice(0, 10) > from ? h.created_at.slice(0, 10) : from;
  if (start > to) return { done: 0, due: 0, rate: 0 };
  const days = eachDay(start, to);
  const doneSet = new Set(logs.filter((l) => l.status === 'done' && l.date >= start && l.date <= to).map((l) => l.date));
  const skipped = new Set(logs.filter((l) => l.status === 'skipped').map((l) => l.date));
  let due: number;
  if (h.frequency === 'weekly') due = Math.max(1, Math.round((days.length / 7) * h.target_per_week));
  else due = days.filter((d) => isDue(h, d) && !skipped.has(d)).length;
  const done = doneSet.size;
  return { done, due, rate: due ? Math.min(1, done / due) : 0 };
}
