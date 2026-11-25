import { addDays, eachDay, type ISODate } from '@/lib/dates';
import { completionRate } from '@/features/habits/habitLogic';
import type { DailyPage, FocusSession, Goal, Habit, HabitLog, JournalEntry, Task } from '@/types/models';

export interface InsightInput {
  tasks: Task[];
  journal: JournalEntry[];
  pages: DailyPage[];
  habits: Habit[];
  logs: HabitLog[];
  focus: FocusSession[];
  goals: Goal[];
}

export interface Bucket {
  key: string; // first day of bucket
  from: ISODate;
  to: ISODate;
}

/** Days for week/month ranges, months for year ranges. */
export function buckets(from: ISODate, to: ISODate, byMonth: boolean): Bucket[] {
  if (!byMonth) return eachDay(from, to).map((d) => ({ key: d, from: d, to: d }));
  const out: Bucket[] = [];
  for (let m = 0; m < 12; m++) {
    const start = `${from.slice(0, 4)}-${String(m + 1).padStart(2, '0')}-01`;
    const next = m === 11 ? `${Number(from.slice(0, 4)) + 1}-01-01` : `${from.slice(0, 4)}-${String(m + 2).padStart(2, '0')}-01`;
    out.push({ key: start, from: start, to: addDays(next, -1) });
  }
  return out;
}

const inRange = (d: string | null | undefined, from: ISODate, to: ISODate) => !!d && d >= from && d <= to;

/** All metrics computed only from stored data. `to` should be clamped to today by the caller. */
export function computeInsights(input: InsightInput, from: ISODate, to: ISODate) {
  const planned = input.tasks.filter((t) => inRange(t.scheduled_date ?? t.due_date, from, to));
  const plannedDone = planned.filter((t) => t.status === 'done');
  const completed = input.tasks.filter((t) => inRange(t.completed_date, from, to));
  const entries = input.journal.filter((j) => inRange(j.entry_date, from, to));
  const journalDays = new Set(entries.map((j) => j.entry_date));
  const days = to >= from ? eachDay(from, to).length : 0;

  const activeHabits = input.habits.filter((h) => !h.archived_at || h.archived_at.slice(0, 10) > from);
  const habitRates = activeHabits.map((h) => ({ habit: h, ...completionRate(h, input.logs.filter((l) => l.habit_id === h.id), from, to) })).filter((r) => r.due > 0);
  const habitConsistency = habitRates.length ? habitRates.reduce((s, r) => s + r.rate, 0) / habitRates.length : null;

  // mood per day: daily page mood, else mean of journal moods
  const moodByDay = new Map<string, number>();
  for (const p of input.pages) if (inRange(p.date, from, to) && p.mood) moodByDay.set(p.date, p.mood);
  const jm = new Map<string, number[]>();
  for (const j of entries) if (j.mood) jm.set(j.entry_date, [...(jm.get(j.entry_date) ?? []), j.mood]);
  for (const [d, list] of jm) if (!moodByDay.has(d)) moodByDay.set(d, list.reduce((a, b) => a + b, 0) / list.length);
  const moods = [...moodByDay.values()];

  const focus = input.focus.filter((f) => f.kind === 'focus' && inRange(f.date, from, to));
  const focusMinutes = Math.round(focus.reduce((s, f) => s + f.duration_seconds, 0) / 60);

  const goalsActive = input.goals.filter((g) => g.status === 'active');
  const goalsCompleted = input.goals.filter((g) => g.status === 'completed' && g.completed_at && inRange(g.completed_at.slice(0, 10), from, to));

  return {
    days,
    tasks: { planned: planned.length, plannedDone: plannedDone.length, completed: completed.length, rate: planned.length ? plannedDone.length / planned.length : null },
    journal: { entries: entries.length, days: journalDays.size, words: entries.reduce((s, e) => s + e.word_count, 0), frequency: days ? journalDays.size / days : null },
    habits: { consistency: habitConsistency, rates: habitRates },
    mood: { byDay: moodByDay, average: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null },
    focus: { minutes: focusMinutes, sessions: focus.filter((f) => f.completed).length },
    goals: { active: goalsActive, completed: goalsCompleted, avgProgress: goalsActive.length ? goalsActive.reduce((s, g) => s + g.progress, 0) / goalsActive.length : null },
    perBucket: (bs: Bucket[]) =>
      bs.map((b) => ({
        ...b,
        completed: completed.filter((t) => inRange(t.completed_date, b.from, b.to)).length,
        focus: Math.round(focus.filter((f) => inRange(f.date, b.from, b.to)).reduce((s, f) => s + f.duration_seconds, 0) / 60),
        journal: entries.filter((j) => inRange(j.entry_date, b.from, b.to)).length,
        mood: (() => {
          const v = [...moodByDay.entries()].filter(([d]) => inRange(d, b.from, b.to)).map(([, m]) => m);
          return v.length ? Math.round((v.reduce((a, c) => a + c, 0) / v.length) * 10) / 10 : null;
        })(),
      })),
  };
}
