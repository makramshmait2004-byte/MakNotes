import { addDays, addMonths, addYears, weekday, type ISODate, dateInTz } from '@/lib/dates';
import { getDb } from '@/data/db';
import { insert, update } from '@/data/repo';
import type { Row, Task, TaskRecurrence } from '@/types/models';

export type RecurrenceRule = Pick<TaskRecurrence, 'freq' | 'interval' | 'weekdays' | 'end_date'>;

/** Next occurrence strictly after `from`, or null if the series has ended. */
export function nextOccurrence(rule: RecurrenceRule, from: ISODate): ISODate | null {
  const interval = Math.max(1, rule.interval || 1);
  let next: ISODate;
  if (rule.freq === 'daily') next = addDays(from, interval);
  else if (rule.freq === 'weekly') {
    if (rule.weekdays && rule.weekdays.length) {
      const days = [...rule.weekdays].sort();
      next = addDays(from, 1);
      // search up to `interval` weeks ahead for the next selected weekday
      for (let i = 0; i < 7 * interval + 7; i++) {
        if (days.includes(weekday(next))) break;
        next = addDays(next, 1);
      }
      if (interval > 1 && weekday(next) <= weekday(from)) next = addDays(next, 7 * (interval - 1));
    } else next = addDays(from, 7 * interval);
  } else if (rule.freq === 'monthly') next = addMonths(from, interval);
  else next = addYears(from, interval);
  if (rule.end_date && next > rule.end_date) return null;
  return next;
}

export function isOverdue(t: Pick<Task, 'status' | 'scheduled_date' | 'due_date'>, today: ISODate): boolean {
  if (t.status === 'done') return false;
  const d = t.due_date ?? t.scheduled_date;
  return !!d && d < today;
}

export type TaskView = 'today' | 'tomorrow' | 'upcoming' | 'overdue' | 'completed' | 'all';

export function filterView(tasks: Row<'tasks'>[], view: TaskView, today: ISODate): Row<'tasks'>[] {
  const tomorrow = addDays(today, 1);
  const eff = (t: Task) => t.scheduled_date ?? t.due_date;
  switch (view) {
    case 'today':
      return tasks.filter((t) => (t.status === 'todo' && eff(t) !== null && (eff(t) as string) <= today) || (t.status === 'done' && t.completed_date === today));
    case 'tomorrow':
      return tasks.filter((t) => t.status === 'todo' && eff(t) === tomorrow);
    case 'upcoming':
      return tasks.filter((t) => t.status === 'todo' && eff(t) !== null && (eff(t) as string) > today);
    case 'overdue':
      return tasks.filter((t) => isOverdue(t, today));
    case 'completed':
      return tasks.filter((t) => t.status === 'done');
    default:
      return tasks;
  }
}

/** Complete (or un-complete) a task. Completing a recurring task schedules the next instance. */
export async function toggleTask(task: Row<'tasks'>, tz: string) {
  if (task.status === 'done') {
    await update('tasks', task.id, { status: 'todo', completed_at: null, completed_date: null });
    return;
  }
  const now = new Date();
  await update('tasks', task.id, { status: 'done', completed_at: now.toISOString(), completed_date: dateInTz(now, tz) });
  if (task.recurrence_id) {
    const rule = await getDb().task_recurrences.get(task.recurrence_id);
    const from = task.scheduled_date ?? task.due_date ?? dateInTz(now, tz);
    if (rule && !rule.deleted_at) {
      const next = nextOccurrence(rule, from);
      // avoid creating the same occurrence twice (e.g. toggled on two devices)
      const exists = next && (await getDb().tasks.where('recurrence_id').equals(task.recurrence_id).toArray()).some((x) => !x.deleted_at && x.scheduled_date === next);
      if (next && !exists) {
        const subtasks = (await getDb().subtasks.where('task_id').equals(task.id).toArray()).filter((s) => !s.deleted_at);
        const shift = task.due_date && task.scheduled_date ? (Date.parse(task.due_date) - Date.parse(task.scheduled_date)) / 86_400_000 : 0;
        const created = await insert('tasks', {
          title: task.title,
          description: task.description,
          priority: task.priority,
          category: task.category,
          tags: task.tags,
          project_id: task.project_id,
          goal_id: task.goal_id,
          recurrence_id: task.recurrence_id,
          scheduled_date: next,
          scheduled_time: task.scheduled_time,
          due_date: task.due_date ? addDays(next, shift) : null,
          original_date: next,
          position: task.position,
        });
        for (const s of subtasks) await insert('subtasks', { task_id: created.id, title: s.title, position: s.position });
      }
    }
  }
}

/** Move a task to a new date, keeping the original date and a history of every reschedule. */
export async function rescheduleTask(task: Row<'tasks'>, to: ISODate | null) {
  const from = task.scheduled_date;
  if (from === to) return;
  await update('tasks', task.id, {
    scheduled_date: to,
    original_date: task.original_date ?? from ?? to,
    reschedule_history: [...(task.reschedule_history ?? []), { from, to, at: new Date().toISOString() }],
  });
}

export const PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High'] as const;
export const PRIORITY_COLORS = ['text-muted-foreground', 'text-sky-500', 'text-amber-500', 'text-red-500'];
