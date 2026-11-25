// Row types mirroring supabase/migrations/*.sql (see src/types/database.ts for generated types).
import type { JSONContent } from '@tiptap/react';

export interface BaseRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Local-only sync bookkeeping fields stored next to each row in IndexedDB. Never sent to the server. */
export interface LocalMeta {
  _base?: string | null; // server updated_at this local copy is based on (null = never synced)
  _dirty?: 0 | 1;
  _rev?: number; // local revision counter
}

export type Paper = 'blank' | 'lined' | 'grid' | 'dotted';
export type BlockKind = 'text' | 'drawing' | 'image' | 'file' | 'checklist';

export interface SectionLayout {
  order?: string[];
  hidden?: string[];
  collapsed?: string[];
}

export interface Profile extends BaseRow {
  display_name: string | null;
  avatar_path: string | null;
}

export interface UserSettings extends BaseRow {
  timezone: string;
  language: 'en' | 'ar';
  theme: 'dark' | 'light' | 'system';
  start_page: 'today' | 'home';
  week_start: number;
  section_layout: SectionLayout;
  reflection_prompts: boolean;
  pen_only: boolean;
  default_paper: Paper;
  pomodoro: { focus: number; short: number; long: number; rounds: number };
}

export interface Project extends BaseRow {
  title: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  color: string | null;
  due_date: string | null;
  notes: JSONContent | null;
  position: number;
}

export interface Goal extends BaseRow {
  project_id: string | null;
  title: string;
  description: string | null;
  horizon: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'long_term';
  period_start: string | null;
  target_date: string | null;
  status: 'active' | 'completed' | 'abandoned';
  progress: number;
  notes: JSONContent | null;
  position: number;
  completed_at: string | null;
}

export interface Milestone extends BaseRow {
  goal_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  position: number;
}

export interface TaskRecurrence extends BaseRow {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  weekdays: number[];
  end_date: string | null;
}

export interface RescheduleEvent {
  from: string | null;
  to: string | null;
  at: string;
}

export interface Task extends BaseRow {
  project_id: string | null;
  goal_id: string | null;
  recurrence_id: string | null;
  title: string;
  description: string | null;
  priority: 0 | 1 | 2 | 3;
  category: string | null;
  tags: string[];
  scheduled_date: string | null;
  scheduled_time: string | null;
  due_date: string | null;
  original_date: string | null;
  reschedule_history: RescheduleEvent[];
  status: 'todo' | 'done';
  completed_at: string | null;
  completed_date: string | null;
  position: number;
}

export interface Subtask extends BaseRow {
  task_id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface CalendarEvent extends BaseRow {
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  project_id: string | null;
}

export interface Drawing extends BaseRow {
  title: string | null;
  kind: 'sketch' | 'handwriting' | 'block';
  date: string | null;
  paper: Paper;
  width: number;
  height: number;
  tags: string[];
  is_favorite: boolean;
  preview_path: string | null;
}

export type StrokeTool = 'pen' | 'pencil' | 'highlighter';

export interface DrawingStroke extends BaseRow {
  drawing_id: string;
  tool: StrokeTool;
  color: string;
  width: number;
  points: number[]; // flat [x, y, pressure, ...]
  seq: number;
}

export interface DailyPage extends BaseRow {
  date: string;
  morning_plan: JSONContent | null;
  quick_notes: JSONContent | null;
  mood: number | null;
  energy: number | null;
  handwriting_id: string | null;
}

export interface DailyPriority extends BaseRow {
  daily_page_id: string;
  position: 1 | 2 | 3;
  text: string;
  done: boolean;
}

export interface DailyReflection extends BaseRow {
  daily_page_id: string;
  kind: 'morning' | 'evening' | 'weekly';
  answers: Record<string, string>;
}

export interface JournalEntry extends BaseRow {
  entry_date: string;
  title: string | null;
  mood: number | null;
  category: string | null;
  tags: string[];
  is_favorite: boolean;
  plain_text: string;
  word_count: number;
}

export interface ContentBlock extends BaseRow {
  position: number;
  kind: BlockKind;
  content: JSONContent | null;
  drawing_id: string | null;
  attachment_id: string | null;
}

export interface JournalBlock extends ContentBlock {
  journal_entry_id: string;
}

export interface Note extends ContentBlock {
  page_id: string;
}

export interface Notebook extends BaseRow {
  title: string;
  description: string | null;
  category: 'work' | 'business' | 'programming' | 'learning' | 'personal' | 'meetings' | 'ideas' | 'other';
  color: string | null;
  is_favorite: boolean;
  archived_at: string | null;
  position: number;
}

export interface NotebookSection extends BaseRow {
  notebook_id: string;
  title: string;
  position: number;
}

export interface NotebookPage extends BaseRow {
  notebook_id: string;
  section_id: string;
  parent_page_id: string | null;
  project_id: string | null;
  title: string;
  tags: string[];
  is_favorite: boolean;
  archived_at: string | null;
  plain_text: string;
  position: number;
}

export interface Habit extends BaseRow {
  name: string;
  description: string | null;
  frequency: 'daily' | 'weekdays' | 'weekly';
  weekdays: number[];
  target_per_week: number;
  color: string | null;
  archived_at: string | null;
  position: number;
}

export interface HabitLog extends BaseRow {
  habit_id: string;
  date: string;
  status: 'done' | 'skipped' | 'missed';
}

export type Bucket = 'journal-images' | 'attachments' | 'documents' | 'drawing-previews' | 'profile-images';

export interface Attachment extends BaseRow {
  bucket: Bucket;
  path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  parent_table: string | null;
  parent_id: string | null;
}

export interface Tag extends BaseRow {
  name: string;
  color: string | null;
}

export interface Reminder extends BaseRow {
  task_id: string | null;
  event_id: string | null;
  title: string;
  remind_at: string;
  fired_at: string | null;
  dismissed: boolean;
}

export interface FocusSession extends BaseRow {
  task_id: string | null;
  kind: 'focus' | 'short_break' | 'long_break';
  date: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  completed: boolean;
}

export interface TableRowMap {
  profiles: Profile;
  user_settings: UserSettings;
  projects: Project;
  goals: Goal;
  milestones: Milestone;
  task_recurrences: TaskRecurrence;
  tasks: Task;
  subtasks: Subtask;
  calendar_events: CalendarEvent;
  drawings: Drawing;
  drawing_strokes: DrawingStroke;
  daily_pages: DailyPage;
  daily_priorities: DailyPriority;
  daily_reflections: DailyReflection;
  journal_entries: JournalEntry;
  journal_blocks: JournalBlock;
  notebooks: Notebook;
  notebook_sections: NotebookSection;
  notebook_pages: NotebookPage;
  notes: Note;
  habits: Habit;
  habit_logs: HabitLog;
  attachments: Attachment;
  tags: Tag;
  reminders: Reminder;
  focus_sessions: FocusSession;
}

export type TableName = keyof TableRowMap;
export type Row<T extends TableName> = TableRowMap[T] & LocalMeta;
