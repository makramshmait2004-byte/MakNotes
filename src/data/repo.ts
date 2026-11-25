// Local-first write API. Every change is written to IndexedDB immediately (works offline),
// recorded in a persistent outbox, and pushed to Supabase by the sync engine.
import { getDb } from './db';
import { newId } from '@/lib/ids';
import type { Row, TableName, TableRowMap } from '@/types/models';

let userId: string | null = null;
const listeners = new Set<() => void>();

export function setRepoUser(id: string | null) {
  userId = id;
}

export function currentUserId(): string {
  if (!userId) throw new Error('Not signed in');
  return userId;
}

/** Subscribe to "something local changed" (used to schedule a push). */
export function onLocalChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((fn) => fn());

const DEFAULTS: { [K in TableName]?: Partial<TableRowMap[K]> } = {
  profiles: { display_name: null, avatar_path: null },
  user_settings: {
    timezone: 'Asia/Beirut',
    language: 'en',
    theme: 'dark',
    start_page: 'today',
    week_start: 1,
    section_layout: {},
    reflection_prompts: true,
    pen_only: false,
    default_paper: 'lined',
    pomodoro: { focus: 25, short: 5, long: 15, rounds: 4 },
  },
  projects: { description: null, status: 'active', color: null, due_date: null, notes: null, position: 0 },
  goals: {
    project_id: null,
    description: null,
    horizon: 'monthly',
    period_start: null,
    target_date: null,
    status: 'active',
    progress: 0,
    notes: null,
    position: 0,
    completed_at: null,
  },
  milestones: { due_date: null, done: false, position: 0 },
  task_recurrences: { interval: 1, weekdays: [], end_date: null },
  tasks: {
    project_id: null,
    goal_id: null,
    recurrence_id: null,
    description: null,
    priority: 0,
    category: null,
    tags: [],
    scheduled_date: null,
    scheduled_time: null,
    due_date: null,
    original_date: null,
    reschedule_history: [],
    status: 'todo',
    completed_at: null,
    completed_date: null,
    position: 0,
  },
  subtasks: { done: false, position: 0 },
  calendar_events: { description: null, location: null, end_date: null, start_time: null, end_time: null, all_day: false, project_id: null },
  drawings: { title: null, kind: 'sketch', date: null, paper: 'blank', width: 1000, height: 1400, tags: [], is_favorite: false, preview_path: null },
  drawing_strokes: { seq: 0 },
  daily_pages: { morning_plan: null, quick_notes: null, mood: null, energy: null, handwriting_id: null },
  daily_priorities: { text: '', done: false },
  daily_reflections: { answers: {} },
  journal_entries: { title: null, mood: null, category: null, tags: [], is_favorite: false, plain_text: '', word_count: 0 },
  journal_blocks: { position: 0, content: null, drawing_id: null, attachment_id: null },
  notes: { position: 0, content: null, drawing_id: null, attachment_id: null },
  notebooks: { description: null, category: 'personal', color: null, is_favorite: false, archived_at: null, position: 0 },
  notebook_sections: { position: 0 },
  notebook_pages: { parent_page_id: null, project_id: null, title: '', tags: [], is_favorite: false, archived_at: null, plain_text: '', position: 0 },
  habits: { description: null, frequency: 'daily', weekdays: [], target_per_week: 7, color: null, archived_at: null, position: 0 },
  habit_logs: { status: 'done' },
  attachments: { mime_type: null, size_bytes: null, parent_table: null, parent_id: null },
  tags: { color: null },
  reminders: { task_id: null, event_id: null, fired_at: null, dismissed: false },
  focus_sessions: { task_id: null, kind: 'focus', ended_at: null, duration_seconds: 0, completed: false },
};

const nowIso = () => new Date().toISOString();

async function enqueue(table: TableName, rowId: string) {
  const db = getDb();
  const existing = await db.outbox.where('[table+rowId]').equals([table, rowId]).first();
  if (!existing) await db.outbox.add({ table, rowId, queuedAt: Date.now(), attempts: 0 });
}

/** Insert a new row. Pass `id` to use a deterministic id. */
export async function insert<T extends TableName>(table: T, values: Partial<TableRowMap[T]>): Promise<Row<T>> {
  const db = getDb();
  const t = nowIso();
  const row = {
    ...(DEFAULTS[table] as object),
    ...values,
    id: values.id ?? newId(),
    user_id: currentUserId(),
    created_at: values.created_at ?? t,
    updated_at: t,
    deleted_at: null,
    _base: null,
    _dirty: 1,
    _rev: 1,
    _orig: {},
  } as unknown as Row<T>;
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    await db.table(table).put(row);
    await enqueue(table, row.id);
  });
  emit();
  return row;
}

/**
 * Patch a row. Remembers the last-synced value of every changed field (`_orig`)
 * so the sync engine can do a three-way merge instead of silently overwriting.
 */
export async function update<T extends TableName>(table: T, id: string, patch: Partial<TableRowMap[T]>): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    const cur = (await db.table(table).get(id)) as (Row<T> & { _orig?: Record<string, unknown> }) | undefined;
    if (!cur) return;
    const orig = { ...(cur._orig ?? {}) };
    if (cur._base) {
      for (const k of Object.keys(patch)) {
        if (!(k in orig)) orig[k] = (cur as unknown as Record<string, unknown>)[k] ?? null;
      }
    }
    await db.table(table).put({ ...cur, ...patch, updated_at: nowIso(), _dirty: 1, _rev: (cur._rev ?? 0) + 1, _orig: orig });
    await enqueue(table, id);
  });
  emit();
}

/** Insert the row if missing (by id), otherwise apply `patch`. Used with deterministic ids. */
export async function upsert<T extends TableName>(
  table: T,
  id: string,
  create: Partial<TableRowMap[T]>,
  patch: Partial<TableRowMap[T]> = {},
): Promise<void> {
  const db = getDb();
  const cur = await db.table(table).get(id);
  if (!cur) {
    await insert(table, { ...create, ...patch, id } as Partial<TableRowMap[T]>);
  } else if (cur.deleted_at || Object.keys(patch).length) {
    await update(table, id, { ...patch, deleted_at: null } as Partial<TableRowMap[T]>);
  }
}

/** Soft delete so the deletion syncs to other devices. */
export async function remove(table: TableName, id: string): Promise<void> {
  await update(table, id, { deleted_at: nowIso() } as never);
}

export async function restore(table: TableName, id: string): Promise<void> {
  await update(table, id, { deleted_at: null } as never);
}

/** Bulk local write used by import: rows are re-owned by the current user and queued. */
export async function putMany<T extends TableName>(table: T, rows: Partial<TableRowMap[T]>[]) {
  const db = getDb();
  const uid = currentUserId();
  await db.transaction('rw', db.table(table), db.outbox, async () => {
    for (const r of rows) {
      const existing = await db.table(table).get(r.id as string);
      await db.table(table).put({
        ...(DEFAULTS[table] as object),
        ...r,
        user_id: uid,
        _base: existing?._base ?? null,
        _dirty: 1,
        _rev: (existing?._rev ?? 0) + 1,
        _orig: {},
      });
      await enqueue(table, r.id as string);
    }
  });
  emit();
}

export function stripLocal(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!k.startsWith('_')) out[k] = v;
  return out;
}

export const alive = <R extends { deleted_at: string | null }>(r: R | undefined): r is R => !!r && !r.deleted_at;
