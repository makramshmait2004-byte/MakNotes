import type { TableName } from '@/types/models';

/**
 * Every synced table, ordered parents-before-children. The order is used for the initial pull,
 * for JSON import, and to break ties in the outbox.
 */
export const TABLES: TableName[] = [
  'profiles',
  'user_settings',
  'projects',
  'goals',
  'milestones',
  'task_recurrences',
  'tasks',
  'subtasks',
  'calendar_events',
  'drawings',
  'drawing_strokes',
  'daily_pages',
  'daily_priorities',
  'daily_reflections',
  'journal_entries',
  'journal_blocks',
  'notebooks',
  'notebook_sections',
  'notebook_pages',
  'notes',
  'habits',
  'habit_logs',
  'attachments',
  'tags',
  'reminders',
  'focus_sessions',
];

/** Dexie secondary indexes per table (id is always the primary key). */
export const INDEXES: Record<TableName, string> = {
  profiles: 'user_id',
  user_settings: 'user_id',
  projects: 'status',
  goals: 'project_id, horizon, status',
  milestones: 'goal_id',
  task_recurrences: '',
  tasks: 'scheduled_date, due_date, project_id, goal_id, status, completed_date, recurrence_id',
  subtasks: 'task_id',
  calendar_events: 'start_date, project_id',
  drawings: 'kind, date',
  drawing_strokes: 'drawing_id',
  daily_pages: '&date',
  daily_priorities: 'daily_page_id',
  daily_reflections: 'daily_page_id',
  journal_entries: 'entry_date',
  journal_blocks: 'journal_entry_id',
  notebooks: 'category',
  notebook_sections: 'notebook_id',
  notebook_pages: 'section_id, notebook_id, parent_page_id, project_id',
  notes: 'page_id',
  habits: '',
  habit_logs: 'habit_id, date',
  attachments: 'parent_id',
  tags: 'name',
  reminders: 'remind_at, task_id',
  focus_sessions: 'date',
};

export const TABLE_ORDER: Record<string, number> = Object.fromEntries(TABLES.map((t, i) => [t, i]));
