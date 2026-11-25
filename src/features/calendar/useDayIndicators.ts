import { useDb } from '@/data/hooks';

export interface DayIndicators {
  journal: number;
  tasks: number;
  tasksDone: number;
  events: number;
  habits: number;
  notes: number;
  sketches: number;
}

const empty = (): DayIndicators => ({ journal: 0, tasks: 0, tasksDone: 0, events: 0, habits: 0, notes: 0, sketches: 0 });

/** Per-day activity counts for calendar indicators, computed from local data for [from, to]. */
export function useDayIndicators(from: string, to: string): Map<string, DayIndicators> {
  return useDb(
    async (db) => {
      const m = new Map<string, DayIndicators>();
      const get = (d: string) => {
        let v = m.get(d);
        if (!v) m.set(d, (v = empty()));
        return v;
      };
      const [journal, tasksSched, tasksDone, events, logs, pages, drawings] = await Promise.all([
        db.journal_entries.where('entry_date').between(from, to, true, true).toArray(),
        db.tasks.where('scheduled_date').between(from, to, true, true).toArray(),
        db.tasks.where('completed_date').between(from, to, true, true).toArray(),
        db.calendar_events.where('start_date').belowOrEqual(to).toArray(),
        db.habit_logs.where('date').between(from, to, true, true).toArray(),
        db.daily_pages.where('date').between(from, to, true, true).toArray(),
        db.drawings.where('date').between(from, to, true, true).toArray(),
      ]);
      journal.filter((x) => !x.deleted_at).forEach((x) => get(x.entry_date).journal++);
      tasksSched.filter((x) => !x.deleted_at && x.scheduled_date).forEach((x) => get(x.scheduled_date!).tasks++);
      tasksDone.filter((x) => !x.deleted_at && x.completed_date).forEach((x) => get(x.completed_date!).tasksDone++);
      for (const e of events) {
        if (e.deleted_at) continue;
        const end = e.end_date ?? e.start_date;
        if (end < from) continue;
        let d = e.start_date < from ? from : e.start_date;
        const last = end > to ? to : end;
        // multi-day events mark every day they cover
        for (let i = 0; d <= last && i < 400; i++) {
          get(d).events++;
          const [y, mo, da] = d.split('-').map(Number);
          const n = new Date(Date.UTC(y, mo - 1, da + 1));
          d = n.toISOString().slice(0, 10);
        }
      }
      logs.filter((x) => !x.deleted_at && x.status === 'done').forEach((x) => get(x.date).habits++);
      pages.filter((x) => !x.deleted_at && (x.quick_notes || x.morning_plan)).forEach((x) => get(x.date).notes++);
      drawings.filter((x) => !x.deleted_at && x.kind !== 'block' && x.date).forEach((x) => get(x.date!).sketches++);
      return m;
    },
    [from, to],
    new Map<string, DayIndicators>(),
  );
}
