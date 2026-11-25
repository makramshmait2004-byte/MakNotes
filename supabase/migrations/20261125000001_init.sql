-- MakNotes — initial schema
-- Every private table carries user_id and is protected by Row Level Security.
-- Child tables use composite foreign keys (parent_id, user_id) -> parent(id, user_id)
-- so a row can never point at another user's parent, even if RLS were misconfigured.
-- Rows are soft-deleted (deleted_at) so deletions sync to every device; a scheduled job purges them later.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper: updated_at is always assigned by the server clock (used for sync conflict detection)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  if tg_op = 'INSERT' and new.created_at is null then
    new.created_at := clock_timestamp();
  end if;
  return new;
end;
$$;

-- Helper: user_id can never be changed after insert
create or replace function public.protect_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade default auth.uid(),
  display_name text check (char_length(display_name) <= 120),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade default auth.uid(),
  timezone text not null default 'Asia/Beirut',
  language text not null default 'en' check (language in ('en', 'ar')),
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  start_page text not null default 'today' check (start_page in ('today', 'home')),
  week_start smallint not null default 1 check (week_start between 0 and 6),
  section_layout jsonb not null default '{}'::jsonb,
  reflection_prompts boolean not null default true,
  pen_only boolean not null default false,
  default_paper text not null default 'lined' check (default_paper in ('blank', 'lined', 'grid', 'dotted')),
  pomodoro jsonb not null default '{"focus":25,"short":5,"long":15,"rounds":4}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 300),
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  color text,
  due_date date,
  notes jsonb,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  project_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  horizon text not null default 'monthly' check (horizon in ('daily', 'weekly', 'monthly', 'yearly', 'long_term')),
  period_start date,
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  progress smallint not null default 0 check (progress between 0 and 100),
  notes jsonb,
  position double precision not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  goal_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  due_date date,
  done boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);

create table public.task_recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  freq text not null check (freq in ('daily', 'weekly', 'monthly', 'yearly')),
  interval smallint not null default 1 check (interval between 1 and 365),
  weekdays smallint[] not null default '{}',
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  project_id uuid,
  goal_id uuid,
  recurrence_id uuid,
  title text not null check (char_length(title) between 1 and 500),
  description text,
  priority smallint not null default 0 check (priority between 0 and 3),
  category text,
  tags text[] not null default '{}',
  scheduled_date date,
  scheduled_time text check (scheduled_time is null or scheduled_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  due_date date,
  original_date date,
  reschedule_history jsonb not null default '[]'::jsonb,
  status text not null default 'todo' check (status in ('todo', 'done')),
  completed_at timestamptz,
  completed_date date,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id),
  foreign key (recurrence_id, user_id) references public.task_recurrences (id, user_id) on delete set null (recurrence_id)
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  task_id uuid not null,
  title text not null check (char_length(title) between 1 and 500),
  done boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 300),
  description text,
  location text,
  start_date date not null,
  end_date date,
  start_time text check (start_time is null or start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time text check (end_time is null or end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  all_day boolean not null default false,
  project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id)
);

create table public.drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text,
  kind text not null default 'sketch' check (kind in ('sketch', 'handwriting', 'block')),
  date date,
  paper text not null default 'blank' check (paper in ('blank', 'lined', 'grid', 'dotted')),
  width integer not null default 1000 check (width between 100 and 20000),
  height integer not null default 1400 check (height between 100 and 50000),
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  preview_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.drawing_strokes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  drawing_id uuid not null,
  tool text not null check (tool in ('pen', 'pencil', 'highlighter')),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  width real not null check (width > 0 and width <= 200),
  -- flat array [x0, y0, p0, x1, y1, p1, ...] in page units
  points jsonb not null check (jsonb_typeof(points) = 'array'),
  seq double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (drawing_id, user_id) references public.drawings (id, user_id) on delete cascade
);

create table public.daily_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date date not null,
  morning_plan jsonb,
  quick_notes jsonb,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  handwriting_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, date),
  unique (id, user_id),
  foreign key (handwriting_id, user_id) references public.drawings (id, user_id) on delete set null (handwriting_id)
);

create table public.daily_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  daily_page_id uuid not null,
  position smallint not null check (position between 1 and 3),
  text text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (daily_page_id, position),
  foreign key (daily_page_id, user_id) references public.daily_pages (id, user_id) on delete cascade
);

create table public.daily_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  daily_page_id uuid not null,
  kind text not null check (kind in ('morning', 'evening')),
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (daily_page_id, kind),
  foreign key (daily_page_id, user_id) references public.daily_pages (id, user_id) on delete cascade
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  entry_date date not null,
  title text,
  mood smallint check (mood between 1 and 5),
  category text,
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  plain_text text not null default '',
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.journal_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  journal_entry_id uuid not null,
  position double precision not null default 0,
  kind text not null check (kind in ('text', 'drawing', 'image', 'file', 'checklist')),
  content jsonb,
  drawing_id uuid,
  attachment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (journal_entry_id, user_id) references public.journal_entries (id, user_id) on delete cascade,
  foreign key (drawing_id, user_id) references public.drawings (id, user_id) on delete set null (drawing_id)
);

create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 200),
  description text,
  category text not null default 'personal' check (category in ('work', 'business', 'programming', 'learning', 'personal', 'meetings', 'ideas', 'other')),
  color text,
  is_favorite boolean not null default false,
  archived_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.notebook_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  notebook_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (notebook_id, user_id) references public.notebooks (id, user_id) on delete cascade
);

create table public.notebook_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  notebook_id uuid not null,
  section_id uuid not null,
  parent_page_id uuid,
  project_id uuid,
  title text not null default '',
  tags text[] not null default '{}',
  is_favorite boolean not null default false,
  archived_at timestamptz,
  plain_text text not null default '',
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (notebook_id, user_id) references public.notebooks (id, user_id) on delete cascade,
  foreign key (section_id, user_id) references public.notebook_sections (id, user_id) on delete cascade,
  foreign key (parent_page_id, user_id) references public.notebook_pages (id, user_id) on delete cascade,
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id)
);

-- Content blocks of a notebook page (typed text, checklists, handwriting, images, files)
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  page_id uuid not null,
  position double precision not null default 0,
  kind text not null check (kind in ('text', 'drawing', 'image', 'file', 'checklist')),
  content jsonb,
  drawing_id uuid,
  attachment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (page_id, user_id) references public.notebook_pages (id, user_id) on delete cascade,
  foreign key (drawing_id, user_id) references public.drawings (id, user_id) on delete set null (drawing_id)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 200),
  description text,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekdays', 'weekly')),
  weekdays smallint[] not null default '{}',
  target_per_week smallint not null default 7 check (target_per_week between 1 and 7),
  color text,
  archived_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id)
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  habit_id uuid not null,
  date date not null,
  status text not null default 'done' check (status in ('done', 'skipped', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (habit_id, date),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  bucket text not null check (bucket in ('journal-images', 'attachments', 'documents', 'drawing-previews', 'profile-images')),
  path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  parent_table text,
  parent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, path),
  -- object path must live in the owner's folder
  check (split_part(path, '/', 1) = user_id::text)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 60),
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  task_id uuid,
  event_id uuid,
  title text not null,
  remind_at timestamptz not null,
  fired_at timestamptz,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (event_id, user_id) references public.calendar_events (id, user_id) on delete cascade
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  task_id uuid,
  kind text not null default 'focus' check (kind in ('focus', 'short_break', 'long_break')),
  date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0 and duration_seconds <= 86400),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id)
);

-- ---------------------------------------------------------------------------
-- Indexes (sync pulls by user_id + updated_at; UI queries by date / parent)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_settings','daily_pages','daily_priorities','daily_reflections','journal_entries',
    'journal_blocks','tasks','subtasks','task_recurrences','calendar_events','notebooks','notebook_sections',
    'notebook_pages','notes','drawings','drawing_strokes','habits','habit_logs','goals','milestones',
    'projects','attachments','tags','reminders','focus_sessions'
  ] loop
    execute format('create index if not exists %I on public.%I (user_id, updated_at)', t || '_sync_idx', t);
  end loop;
end $$;

create index journal_entries_date_idx on public.journal_entries (user_id, entry_date);
create index journal_blocks_entry_idx on public.journal_blocks (journal_entry_id);
create index tasks_scheduled_idx on public.tasks (user_id, scheduled_date);
create index tasks_due_idx on public.tasks (user_id, due_date);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_goal_idx on public.tasks (goal_id);
create index subtasks_task_idx on public.subtasks (task_id);
create index calendar_events_date_idx on public.calendar_events (user_id, start_date);
create index notebook_sections_nb_idx on public.notebook_sections (notebook_id);
create index notebook_pages_section_idx on public.notebook_pages (section_id);
create index notebook_pages_parent_idx on public.notebook_pages (parent_page_id);
create index notes_page_idx on public.notes (page_id);
create index drawing_strokes_drawing_idx on public.drawing_strokes (drawing_id, seq);
create index drawings_date_idx on public.drawings (user_id, date);
create index habit_logs_date_idx on public.habit_logs (user_id, date);
create index milestones_goal_idx on public.milestones (goal_id);
create index goals_project_idx on public.goals (project_id);
create index reminders_due_idx on public.reminders (user_id, remind_at) where fired_at is null and deleted_at is null;
create index focus_sessions_date_idx on public.focus_sessions (user_id, date);
create index daily_priorities_page_idx on public.daily_priorities (daily_page_id);
create index daily_reflections_page_idx on public.daily_reflections (daily_page_id);

-- ---------------------------------------------------------------------------
-- Triggers, RLS policies and realtime for every private table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_settings','daily_pages','daily_priorities','daily_reflections','journal_entries',
    'journal_blocks','tasks','subtasks','task_recurrences','calendar_events','notebooks','notebook_sections',
    'notebook_pages','notes','drawings','drawing_strokes','habits','habit_logs','goals','milestones',
    'projects','attachments','tags','reminders','focus_sessions'
  ] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.protect_user_id()', t || '_protect_user', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('create policy "owner_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "owner_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "owner_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "owner_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile + settings
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Account deletion: a user may delete only their own auth account.
-- All rows cascade through user_id foreign keys. Storage objects are removed by the client first.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Server time helps clients detect clock skew
create or replace function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select clock_timestamp(); $$;

grant execute on function public.server_now() to authenticated;

-- ---------------------------------------------------------------------------
-- Private storage buckets — objects must live under "<user_id>/..."
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('journal-images', 'journal-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif']),
  ('attachments', 'attachments', false, 26214400, null),
  ('documents', 'documents', false, 26214400, null),
  ('drawing-previews', 'drawing-previews', false, 5242880, array['image/png', 'image/webp']),
  ('profile-images', 'profile-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false;

create policy "maknotes_owner_read" on storage.objects for select to authenticated
  using (bucket_id in ('journal-images', 'attachments', 'documents', 'drawing-previews', 'profile-images')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "maknotes_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('journal-images', 'attachments', 'documents', 'drawing-previews', 'profile-images')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "maknotes_owner_update" on storage.objects for update to authenticated
  using (bucket_id in ('journal-images', 'attachments', 'documents', 'drawing-previews', 'profile-images')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check ((storage.foldername(name))[1] = (select auth.uid())::text);

create policy "maknotes_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('journal-images', 'attachments', 'documents', 'drawing-previews', 'profile-images')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
