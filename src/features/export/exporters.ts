import { z } from 'zod';
import { getDb } from '@/data/db';
import { putMany, stripLocal } from '@/data/repo';
import { TABLES } from '@/data/tables';
import { downloadBlob } from '@/lib/utils';
import type { Row, TableName } from '@/types/models';

const BASE = ['id', 'user_id', 'created_at', 'updated_at', 'deleted_at'];

/** Columns per table (mirrors the SQL schema) — anything else in an import file is dropped. */
export const COLUMNS: Record<TableName, string[]> = {
  profiles: ['display_name', 'avatar_path'],
  user_settings: ['timezone', 'language', 'theme', 'start_page', 'week_start', 'section_layout', 'reflection_prompts', 'pen_only', 'default_paper', 'pomodoro'],
  projects: ['title', 'description', 'status', 'color', 'due_date', 'notes', 'position'],
  goals: ['project_id', 'title', 'description', 'horizon', 'period_start', 'target_date', 'status', 'progress', 'notes', 'position', 'completed_at'],
  milestones: ['goal_id', 'title', 'due_date', 'done', 'position'],
  task_recurrences: ['freq', 'interval', 'weekdays', 'end_date'],
  tasks: ['project_id', 'goal_id', 'recurrence_id', 'title', 'description', 'priority', 'category', 'tags', 'scheduled_date', 'scheduled_time', 'due_date', 'original_date', 'reschedule_history', 'status', 'completed_at', 'completed_date', 'position'],
  subtasks: ['task_id', 'title', 'done', 'position'],
  calendar_events: ['title', 'description', 'location', 'start_date', 'end_date', 'start_time', 'end_time', 'all_day', 'project_id'],
  drawings: ['title', 'kind', 'date', 'paper', 'width', 'height', 'tags', 'is_favorite', 'preview_path'],
  drawing_strokes: ['drawing_id', 'tool', 'color', 'width', 'points', 'seq'],
  daily_pages: ['date', 'morning_plan', 'quick_notes', 'mood', 'energy', 'handwriting_id'],
  daily_priorities: ['daily_page_id', 'position', 'text', 'done'],
  daily_reflections: ['daily_page_id', 'kind', 'answers'],
  journal_entries: ['entry_date', 'title', 'mood', 'category', 'tags', 'is_favorite', 'plain_text', 'word_count'],
  journal_blocks: ['journal_entry_id', 'position', 'kind', 'content', 'drawing_id', 'attachment_id'],
  notebooks: ['title', 'description', 'category', 'color', 'is_favorite', 'archived_at', 'position'],
  notebook_sections: ['notebook_id', 'title', 'position'],
  notebook_pages: ['notebook_id', 'section_id', 'parent_page_id', 'project_id', 'title', 'tags', 'is_favorite', 'archived_at', 'plain_text', 'position'],
  notes: ['page_id', 'position', 'kind', 'content', 'drawing_id', 'attachment_id'],
  habits: ['name', 'description', 'frequency', 'weekdays', 'target_per_week', 'color', 'archived_at', 'position'],
  habit_logs: ['habit_id', 'date', 'status'],
  attachments: ['bucket', 'path', 'file_name', 'mime_type', 'size_bytes', 'parent_table', 'parent_id'],
  tags: ['name', 'color'],
  reminders: ['task_id', 'event_id', 'title', 'remind_at', 'fired_at', 'dismissed'],
  focus_sessions: ['task_id', 'kind', 'date', 'started_at', 'ended_at', 'duration_seconds', 'completed'],
};

/** Required parent references: [column, parent table]. */
const PARENTS: Partial<Record<TableName, [string, TableName, boolean][]>> = {
  milestones: [['goal_id', 'goals', true]],
  subtasks: [['task_id', 'tasks', true]],
  drawing_strokes: [['drawing_id', 'drawings', true]],
  daily_priorities: [['daily_page_id', 'daily_pages', true]],
  daily_reflections: [['daily_page_id', 'daily_pages', true]],
  journal_blocks: [['journal_entry_id', 'journal_entries', true], ['drawing_id', 'drawings', false]],
  notebook_sections: [['notebook_id', 'notebooks', true]],
  notebook_pages: [['notebook_id', 'notebooks', true], ['section_id', 'notebook_sections', true], ['parent_page_id', 'notebook_pages', false], ['project_id', 'projects', false]],
  notes: [['page_id', 'notebook_pages', true], ['drawing_id', 'drawings', false]],
  habit_logs: [['habit_id', 'habits', true]],
  goals: [['project_id', 'projects', false]],
  tasks: [['project_id', 'projects', false], ['goal_id', 'goals', false], ['recurrence_id', 'task_recurrences', false]],
  calendar_events: [['project_id', 'projects', false]],
  reminders: [['task_id', 'tasks', false], ['event_id', 'calendar_events', false]],
  focus_sessions: [['task_id', 'tasks', false]],
  daily_pages: [['handwriting_id', 'drawings', false]],
};

/** Natural keys enforced unique by the database. */
const NATURAL: Partial<Record<TableName, string[]>> = {
  daily_pages: ['date'],
  daily_priorities: ['daily_page_id', 'position'],
  daily_reflections: ['daily_page_id', 'kind'],
  habit_logs: ['habit_id', 'date'],
  tags: ['name'],
  attachments: ['bucket', 'path'],
};

export const BACKUP_FORMAT = 'maknotes-backup';

const uuid = z.string().uuid();
const rowSchema = z.object({ id: uuid, created_at: z.string().min(10), updated_at: z.string().min(10) }).passthrough();
const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exported_at: z.string(),
  tables: z.record(z.string(), z.array(z.unknown())),
});

export async function buildBackup() {
  const db = getDb();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const rows = (await db.table(t).toArray()) as Row<TableName>[];
    tables[t] = rows.filter((r) => !r.deleted_at).map((r) => stripLocal(r as unknown as Record<string, unknown>));
  }
  return { format: BACKUP_FORMAT, version: 1 as const, exported_at: new Date().toISOString(), app: 'MakNotes', tables };
}

export async function exportJson() {
  const data = await buildBackup();
  downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `maknotes-backup-${data.exported_at.slice(0, 10)}.json`);
}

export interface ImportReport {
  imported: Record<string, number>;
  skippedExisting: number;
  skippedDuplicateKey: number;
  rejected: { table: string; id?: string; reason: string }[];
}

/** Validate and restore a backup. Existing rows (same id, same or newer version) are never duplicated. */
export async function importBackup(json: unknown, opts: { dryRun?: boolean } = {}): Promise<ImportReport> {
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) throw new Error('This file is not a MakNotes backup (format/version mismatch).');
  const db = getDb();
  const report: ImportReport = { imported: {}, skippedExisting: 0, skippedDuplicateKey: 0, rejected: [] };
  const known = new Map<TableName, Set<string>>();
  for (const t of TABLES) known.set(t, new Set((await db.table(t).toArray()).filter((r: { deleted_at: string | null }) => !r.deleted_at).map((r: { id: string }) => r.id)));
  // ids present in the file count as available parents
  for (const t of TABLES) for (const r of parsed.data.tables[t] ?? []) if (rowSchema.safeParse(r).success) known.get(t)!.add((r as { id: string }).id);

  for (const t of TABLES) {
    const incoming = parsed.data.tables[t] ?? [];
    const accepted: Record<string, unknown>[] = [];
    for (const raw of incoming) {
      const r = rowSchema.safeParse(raw);
      if (!r.success) {
        report.rejected.push({ table: t, reason: r.error.issues[0]?.message ?? 'invalid row' });
        continue;
      }
      const row: Record<string, unknown> = {};
      for (const k of [...BASE, ...COLUMNS[t]]) if (k in r.data) row[k] = (r.data as Record<string, unknown>)[k];
      row.deleted_at = null;
      const missingParent = (PARENTS[t] ?? []).find(([col, parent, required]) => {
        const v = row[col];
        if (v === null || v === undefined) return required;
        return !known.get(parent)!.has(String(v));
      });
      if (missingParent) {
        // optional links to missing rows are dropped; required ones reject the row
        if (missingParent[2]) {
          report.rejected.push({ table: t, id: String(row.id), reason: `missing ${missingParent[0]}` });
          continue;
        }
        for (const [col, parent, required] of PARENTS[t] ?? []) if (!required && row[col] && !known.get(parent)!.has(String(row[col]))) row[col] = null;
      }
      const existing = await db.table(t).get(String(row.id));
      if (existing && !existing.deleted_at && String(existing.updated_at) >= String(row.updated_at)) {
        report.skippedExisting++;
        continue;
      }
      const nk = NATURAL[t];
      if (nk && !existing) {
        const all = await db.table(t).toArray();
        if (all.some((x: Record<string, unknown>) => !x.deleted_at && nk.every((k) => x[k] === row[k]))) {
          report.skippedDuplicateKey++;
          continue;
        }
      }
      if (t === 'profiles' || t === 'user_settings') {
        // single-row tables: merge into the existing row instead of adding one
        const cur = (await db.table(t).toArray()).find((x: { deleted_at: string | null }) => !x.deleted_at);
        if (cur) {
          if (t === 'user_settings') accepted.push({ ...cur, ...Object.fromEntries(COLUMNS[t].filter((k) => k in row).map((k) => [k, row[k]])), id: cur.id });
          else report.skippedExisting++;
          continue;
        }
      }
      accepted.push(row);
    }
    if (accepted.length) {
      if (!opts.dryRun) await putMany(t, accepted as never);
      report.imported[t] = accepted.length;
    }
  }
  return report;
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v);
  // guard against spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function tasksToCsv(tasks: Row<'tasks'>[], projects: { id: string; title: string }[]): string {
  const head = ['Title', 'Description', 'Status', 'Priority', 'Category', 'Project', 'Tags', 'Scheduled date', 'Time', 'Deadline', 'Original date', 'Times rescheduled', 'Completed at', 'Created at'];
  const rows = tasks
    .slice()
    .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''))
    .map((t) => [t.title, t.description, t.status, t.priority, t.category, projects.find((p) => p.id === t.project_id)?.title ?? '', t.tags, t.scheduled_date, t.scheduled_time, t.due_date, t.original_date, t.reschedule_history?.length ?? 0, t.completed_at, t.created_at]);
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function exportTasksCsv(tasks: Row<'tasks'>[], projects: { id: string; title: string }[]) {
  downloadBlob(new Blob([tasksToCsv(tasks, projects)], { type: 'text/csv;charset=utf-8' }), `maknotes-tasks-${new Date().toISOString().slice(0, 10)}.csv`);
}
