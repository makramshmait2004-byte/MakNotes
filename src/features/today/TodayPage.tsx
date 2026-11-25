import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PenLine,
  Plus,
  Settings2,
  FileDown,
  Check,
} from 'lucide-react';
import { useDb, useAll } from '@/data/hooks';
import { insert, update, upsert, currentUserId } from '@/data/repo';
import { getDb } from '@/data/db';
import { stableId } from '@/lib/ids';
import { addDays, formatDate, isISODate, diffDays, weekday } from '@/lib/dates';
import { useLocale, useT } from '@/i18n';
import { updateSettings, useSettings, useToday } from '@/stores/settings';
import { openEventDialog, openTaskDialog } from '@/stores/ui';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/controls';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Section } from '@/components/shared/Section';
import { RichText } from '@/components/shared/RichText';
import { MoodPicker } from '@/components/shared/MoodPicker';
import { TaskItem } from '@/features/tasks/TaskItem';
import { isOverdue } from '@/features/tasks/taskLogic';
import { createJournalEntry, EVENING_PROMPTS, MORNING_PROMPTS } from '@/features/journal/journalActions';
import { DrawingCanvas } from '@/features/sketch/DrawingCanvas';
import { DrawingThumb } from '@/features/sketch/DrawingThumb';
import { createSketch } from '@/features/sketch/sketchActions';
import { isDue, setHabit } from '@/features/habits/habitLogic';
import { cn, debounce } from '@/lib/utils';
import type { DailyPage, Row } from '@/types/models';
import { resolveLayout, SECTIONS, SUNDAY_PROMPTS, type SectionId } from './sections';

export { SECTIONS } from './sections';

/** Get-or-create the unique page for a date (deterministic id → no duplicates across devices). */
export async function ensureDailyPage(date: string): Promise<Row<'daily_pages'>> {
  const db = getDb();
  const existing = await db.daily_pages.where('date').equals(date).first();
  if (existing) {
    if (existing.deleted_at) await update('daily_pages', existing.id, { deleted_at: null });
    return existing;
  }
  return insert('daily_pages', { id: stableId(currentUserId(), 'day', date), date });
}

function usePage(date: string) {
  return useDb(async (db) => db.daily_pages.where('date').equals(date).first(), [date], undefined as Row<'daily_pages'> | undefined);
}

async function patchPage(date: string, patch: Partial<DailyPage>) {
  const page = await ensureDailyPage(date);
  await update('daily_pages', page.id, patch);
}

// ------------------------------------------------------------------ sections
function Priorities({ date, page }: { date: string; page?: Row<'daily_pages'> }) {
  const t = useT();
  const rows = useDb(async (db) => (page ? (await db.daily_priorities.where('daily_page_id').equals(page.id).toArray()).filter((r) => !r.deleted_at) : []), [page?.id], [] as Row<'daily_priorities'>[]);
  const save = useMemo(
    () =>
      debounce(async (position: 1 | 2 | 3, patch: { text?: string; done?: boolean }) => {
        const p = await ensureDailyPage(date);
        await upsert('daily_priorities', stableId(p.id, 'priority', String(position)), { daily_page_id: p.id, position, text: '' }, patch);
      }, 400),
    [date],
  );
  return (
    <div className="space-y-2">
      {([1, 2, 3] as const).map((n) => {
        const r = rows.find((x) => x.position === n);
        return (
          <div key={`${date}-${n}`} className="flex items-center gap-3">
            <span className="w-5 font-serif text-lg text-bronze">{n}</span>
            {n === 1 && <span className="shrink-0 rounded border border-bronze/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-bronze" data-testid="gymflow-step">{t('GymFlow step')}</span>}
            <Checkbox checked={r?.done ?? false} disabled={!r?.text} onCheckedChange={(v) => void save.flush(n, { done: v === true })} aria-label={t('Priority {n} done', { n })} />
            <input
              key={`${r?.id ?? 'new'}-${r?.updated_at ?? ''}`}
              defaultValue={r?.text ?? ''}
              onChange={(e) => save(n, { text: e.target.value })}
              onBlur={(e) => save.flush(n, { text: e.target.value })}
              placeholder={t('Priority {n}', { n })}
              className={cn('h-10 min-w-0 flex-1 border-b bg-transparent text-[15px] outline-none focus:border-bronze', r?.done && 'text-muted-foreground line-through')}
              dir="auto"
              data-testid={`priority-${n}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function DayTasks({ date, isToday }: { date: string; isToday: boolean }) {
  const t = useT();
  const today = useToday();
  const tasks = useAll('tasks', (x) => x.scheduled_date === date || (x.scheduled_date === null && x.due_date === date) || (isToday && isOverdue(x, today)) || (x.status === 'done' && x.completed_date === date && x.scheduled_date !== date), [date, isToday, today]);
  const [title, setTitle] = useState('');
  const sorted = [...tasks].sort((a, b) => (a.status === b.status ? a.position - b.position : a.status === 'done' ? 1 : -1));
  return (
    <div>
      {sorted.length === 0 && <p className="py-2 text-sm text-muted-foreground">{t('No tasks for this day.')}</p>}
      {sorted.map((task) => (
        <TaskItem key={task.id} task={task} compact={false} />
      ))}
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          await insert('tasks', { title: title.trim(), scheduled_date: date, original_date: date, position: Date.now() });
          setTitle('');
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Add a task for this day')} data-testid="day-task-input" dir="auto" />
        <Button type="submit" size="icon" variant="secondary" aria-label={t('Add task')}>
          <Plus />
        </Button>
      </form>
    </div>
  );
}

function Schedule({ date }: { date: string }) {
  const t = useT();
  const events = useAll('calendar_events', (e) => e.start_date <= date && (e.end_date ?? e.start_date) >= date, [date]);
  const timed = useAll('tasks', (x) => x.scheduled_date === date && !!x.scheduled_time, [date]);
  const items = [
    ...events.map((e) => ({ key: e.id, time: e.all_day ? '' : (e.start_time ?? ''), end: e.end_time, title: e.title, sub: e.location, kind: 'event' as const, id: e.id, done: false })),
    ...timed.map((x) => ({ key: x.id, time: x.scheduled_time ?? '', end: null, title: x.title, sub: null, kind: 'task' as const, id: x.id, done: x.status === 'done' })),
  ].sort((a, b) => a.time.localeCompare(b.time));
  return (
    <div>
      {items.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{t('Nothing scheduled.')}</p>
      ) : (
        <ol className="relative space-y-1 border-s ps-4">
          {items.map((i) => (
            <li key={i.key}>
              <button onClick={() => (i.kind === 'event' ? openEventDialog(i.id) : openTaskDialog(i.id))} className="flex w-full items-baseline gap-3 rounded px-1 py-1.5 text-start hover:bg-accent/50">
                <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">{i.time ? `${i.time}${i.end ? `–${i.end}` : ''}` : t('All day')}</span>
                <span className={cn('min-w-0 flex-1 text-[15px]', i.done && 'text-muted-foreground line-through')}>
                  {i.title}
                  {i.sub && <span className="block text-xs text-muted-foreground">{i.sub}</span>}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t(i.kind === 'event' ? 'Event' : 'Task')}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => openEventDialog(undefined, { start_date: date })}>
        <Plus /> {t('Add event')}
      </Button>
    </div>
  );
}

function Reflection({ date, page, kind }: { date: string; page?: Row<'daily_pages'>; kind: 'morning' | 'evening' | 'weekly' }) {
  const t = useT();
  const settings = useSettings();
  const row = useDb(async (db) => (page ? (await db.daily_reflections.where('daily_page_id').equals(page.id).toArray()).find((r) => r.kind === kind && !r.deleted_at) : undefined), [page?.id, kind], undefined as Row<'daily_reflections'> | undefined);
  const prompts = kind === 'morning' ? MORNING_PROMPTS.slice(0, 3) : kind === 'weekly' ? SUNDAY_PROMPTS : EVENING_PROMPTS.slice(0, 4);
  const save = useMemo(
    () =>
      debounce(async (q: string, a: string) => {
        const p = await ensureDailyPage(date);
        const id = stableId(p.id, 'reflection', kind);
        const cur = await getDb().daily_reflections.get(id);
        await upsert('daily_reflections', id, { daily_page_id: p.id, kind, answers: {} }, { answers: { ...(cur?.answers ?? {}), [q]: a } });
      }, 500),
    [date, kind],
  );
  return (
    <div className="space-y-3">
      {kind === 'morning' && (
        <>
          <MoodPicker value={page?.mood ?? null} onChange={(v) => void patchPage(date, { mood: v })} />
          <MoodPicker label="Energy" value={page?.energy ?? null} onChange={(v) => void patchPage(date, { energy: v })} />
          <RichText value={page?.morning_plan} onChange={(doc) => void patchPage(date, { morning_plan: doc })} placeholder={t('Plan your day…')} toolbar={false} />
        </>
      )}
      {(kind !== 'morning' || settings.reflection_prompts) &&
        prompts.map((q) => (
          <label key={`${date}-${q}`} className="block">
            <span className="mb-1 block text-sm text-muted-foreground">{t(q)}</span>
            <Textarea
              key={`${row?.id ?? 'new'}-${q}`}
              defaultValue={row?.answers?.[q] ?? ''}
              onChange={(e) => save(q, e.target.value)}
              onBlur={(e) => save.flush(q, e.target.value)}
              rows={2}
              dir="auto"
            />
          </label>
        ))}
    </div>
  );
}

function DayJournal({ date }: { date: string }) {
  const t = useT();
  const nav = useNavigate();
  const entries = useAll('journal_entries', (e) => e.entry_date === date, [date]);
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <Link key={e.id} to={`/journal/${e.id}`} className="block rounded-md border p-3 hover:border-bronze/50">
          <p className="font-medium">{e.title || t('Untitled entry')}</p>
          {e.plain_text && <p className="line-clamp-2 text-sm text-muted-foreground" dir="auto">{e.plain_text}</p>}
        </Link>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          const e = await createJournalEntry(date);
          nav(`/journal/${e.id}`);
        }}
      >
        <Plus /> {t('New journal entry')}
      </Button>
    </div>
  );
}

function Handwriting({ date, page }: { date: string; page?: Row<'daily_pages'> }) {
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();
  const drawing = useDb(async (db) => (page?.handwriting_id ? db.drawings.get(page.handwriting_id) : undefined), [page?.handwriting_id], undefined as Row<'drawings'> | undefined);
  if (!drawing || drawing.deleted_at) {
    return (
      <Button
        variant="outline"
        onClick={async () => {
          const d = await createSketch({ kind: 'handwriting', date, paper: settings.default_paper === 'blank' ? 'lined' : settings.default_paper, height: 900, title: date });
          await patchPage(date, { handwriting_id: d.id });
        }}
        data-testid="start-handwriting"
      >
        <PenLine /> {t('Start handwriting')}
      </Button>
    );
  }
  return <DrawingCanvas drawing={drawing} mode="embed" defaultPenOnly={settings.pen_only} onExpand={() => nav(`/sketchbook/${drawing.id}`)} />;
}

function Sketches({ date }: { date: string }) {
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();
  const list = useAll('drawings', (d) => d.kind === 'sketch' && d.date === date, [date]);
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {list.map((d) => (
        <Link key={d.id} to={`/sketchbook/${d.id}`} className="overflow-hidden rounded-md border hover:border-bronze/60">
          <DrawingThumb drawing={d} />
        </Link>
      ))}
      <button
        onClick={async () => {
          const d = await createSketch({ date, paper: settings.default_paper });
          nav(`/sketchbook/${d.id}`);
        }}
        className="grid aspect-[3/4] place-items-center rounded-md border border-dashed text-muted-foreground hover:border-bronze hover:text-bronze"
        aria-label={t('New sketch')}
      >
        <Plus />
      </button>
    </div>
  );
}

function DayHabits({ date }: { date: string }) {
  const t = useT();
  const habits = useAll('habits', (h) => !h.archived_at && isDue(h, date) && h.created_at.slice(0, 10) <= date, [date]);
  const logs = useAll('habit_logs', (l) => l.date === date, [date]);
  if (!habits.length)
    return (
      <p className="text-sm text-muted-foreground">
        {t('No habits yet.')}{' '}
        <Link to="/habits" className="text-bronze underline">
          {t('Create one')}
        </Link>
      </p>
    );
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      {habits
        .sort((a, b) => a.position - b.position)
        .map((h) => {
          const log = logs.find((l) => l.habit_id === h.id);
          const done = log?.status === 'done';
          return (
            <button
              key={h.id}
              onClick={() => void setHabit(h.id, date, !done)}
              className={cn('flex h-12 items-center gap-3 rounded-md border px-3 text-start text-[15px]', done && 'border-bronze/50 bg-bronze/10')}
              aria-pressed={done}
            >
              <span className={cn('grid size-6 place-items-center rounded-full border', done && 'border-bronze bg-bronze text-bronze-foreground')}>{done && <Check className="size-4" />}</span>
              <span className="truncate">{h.name}</span>
              {log?.status === 'skipped' && <span className="ms-auto text-xs text-muted-foreground">{t('skipped')}</span>}
            </button>
          );
        })}
    </div>
  );
}

function DayGoals({ date }: { date: string }) {
  const t = useT();
  const goals = useAll('goals', (g) => g.status === 'active' && (g.horizon !== 'daily' || g.period_start === date), [date]);
  const [title, setTitle] = useState('');
  return (
    <div className="space-y-2">
      {goals.slice(0, 8).map((g) => (
        <Link key={g.id} to={`/goals/${g.id}`} className="block rounded-md border p-2.5 hover:border-bronze/50">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium">{g.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{t(g.horizon === 'long_term' ? 'Long-term' : g.horizon[0].toUpperCase() + g.horizon.slice(1))} · {g.progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-bronze" style={{ width: `${g.progress}%` }} />
          </div>
        </Link>
      ))}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          await insert('goals', { title: title.trim(), horizon: 'daily', period_start: date, target_date: date });
          setTitle('');
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Add a goal for today')} />
        <Button type="submit" variant="secondary" size="icon" aria-label={t('Add goal')}>
          <Plus />
        </Button>
      </form>
    </div>
  );
}

function Progress({ date, page }: { date: string; page?: Row<'daily_pages'> }) {
  const t = useT();
  const tasks = useAll('tasks', (x) => x.scheduled_date === date || (x.scheduled_date === null && x.due_date === date), [date]);
  const prios = useDb(async (db) => (page ? (await db.daily_priorities.where('daily_page_id').equals(page.id).toArray()).filter((r) => !r.deleted_at && r.text) : []), [page?.id], [] as Row<'daily_priorities'>[]);
  const habits = useAll('habits', (h) => !h.archived_at && isDue(h, date) && h.created_at.slice(0, 10) <= date, [date]);
  const logs = useAll('habit_logs', (l) => l.date === date && l.status === 'done', [date]);
  const journal = useAll('journal_entries', (e) => e.entry_date === date, [date]);
  const focus = useAll('focus_sessions', (f) => f.date === date && f.kind === 'focus', [date]);
  const metrics = [
    { label: 'Tasks', done: tasks.filter((x) => x.status === 'done').length, total: tasks.length },
    { label: 'Priorities', done: prios.filter((p) => p.done).length, total: prios.length },
    { label: 'Habits', done: logs.filter((l) => habits.some((h) => h.id === l.habit_id)).length, total: habits.length },
    { label: 'Journal', done: journal.length ? 1 : 0, total: 1 },
  ];
  const counted = metrics.filter((m) => m.total > 0);
  const score = counted.length ? Math.round((counted.reduce((s, m) => s + m.done / m.total, 0) / counted.length) * 100) : 0;
  const focusMin = Math.round(focus.reduce((s, f) => s + f.duration_seconds, 0) / 60);
  return (
    <div>
      <div className="mb-3 flex items-end gap-3">
        <span className="font-serif text-4xl font-semibold tabular-nums" data-testid="daily-score">
          {score}%
        </span>
        <span className="pb-1 text-sm text-muted-foreground">{t('of what you planned')}</span>
      </div>
      <div className="mb-3 h-2 rounded-full bg-muted">
        <div className="h-full rounded-full bg-bronze transition-all" style={{ width: `${score}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-md bg-muted/50 px-3 py-2">
            <div className="text-xs text-muted-foreground">{t(m.label)}</div>
            <div className="font-medium tabular-nums">{m.total ? `${m.done}/${m.total}` : '—'}</div>
          </div>
        ))}
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <div className="text-xs text-muted-foreground">{t('Focus')}</div>
          <div className="font-medium tabular-nums">{focusMin} {t('min')}</div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page
export default function TodayPage() {
  const params = useParams();
  const [search, setSearch] = useSearchParams();
  const nav = useNavigate();
  const t = useT();
  const locale = useLocale();
  const today = useToday();
  const settings = useSettings();
  const date = params.date && isISODate(params.date) ? params.date : today;
  const isToday = date === today;
  const page = usePage(date);

  const layout = settings.section_layout ?? {};
  const { order, hidden, collapsed } = resolveLayout(layout);
  const isSunday = weekday(date) === 0;
  const applies = (id: SectionId) => id !== 'sunday_review' || isSunday;

  const setLayout = (patch: Partial<typeof layout>) => void updateSettings({ section_layout: { ...layout, ...patch } });
  const move = (id: SectionId, dir: -1 | 1) => {
    const visible = order.filter((x) => !hidden.has(x) && applies(x));
    const i = visible.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= visible.length) return;
    const swap = visible[j];
    const next = [...order];
    const a = next.indexOf(id),
      b = next.indexOf(swap);
    [next[a], next[b]] = [next[b], next[a]];
    setLayout({ order: next });
  };

  useEffect(() => {
    const focus = search.get('focus');
    if (!focus) return;
    if (collapsed.has(focus)) setLayout({ collapsed: [...collapsed].filter((x) => x !== focus) });
    if (hidden.has(focus)) setLayout({ hidden: [...hidden].filter((x) => x !== focus) });
    setTimeout(() => {
      const el = document.getElementById(`section-${focus}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      (el?.querySelector('.ProseMirror') as HTMLElement | null)?.focus();
    }, 150);
    search.delete('focus');
    setSearch(search, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // The Sunday review is created automatically the first time a Sunday's page is opened.
  useEffect(() => {
    if (!isSunday || date > today) return;
    void (async () => {
      const p = await ensureDailyPage(date);
      await upsert('daily_reflections', stableId(p.id, 'reflection', 'weekly'), { daily_page_id: p.id, kind: 'weekly', answers: {} });
    })();
  }, [date, isSunday, today]);

  const goto = (d: string) => nav(d === today ? '/today' : `/day/${d}`);
  const rel = diffDays(date, today);

  const render = (id: SectionId) => {
    switch (id) {
      case 'schedule':
        return <Schedule date={date} />;
      case 'priorities':
        return <Priorities date={date} page={page} />;
      case 'tasks':
        return <DayTasks date={date} isToday={isToday} />;
      case 'morning':
        return <Reflection date={date} page={page} kind="morning" />;
      case 'quick_notes':
        return <RichText value={page?.quick_notes} onChange={(doc) => void patchPage(date, { quick_notes: doc })} placeholder={t('Capture anything…')} testId="quick-notes" />;
      case 'journal':
        return <DayJournal date={date} />;
      case 'handwriting':
        return <Handwriting date={date} page={page} />;
      case 'sketches':
        return <Sketches date={date} />;
      case 'habits':
        return <DayHabits date={date} />;
      case 'goals':
        return <DayGoals date={date} />;
      case 'evening':
        return <Reflection date={date} page={page} kind="evening" />;
      case 'sunday_review':
        return <Reflection date={date} page={page} kind="weekly" />;
      case 'progress':
        return <Progress date={date} page={page} />;
    }
  };

  const visible = order.filter((id) => !hidden.has(id) && applies(id));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bronze">
            {isToday ? t('Today') : rel === 1 ? t('Tomorrow') : rel === -1 ? t('Yesterday') : formatDate(date, locale, { weekday: 'long' })}
          </p>
          <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-3xl" data-testid="day-title" data-date={date}>
            {formatDate(date, locale, { weekday: isToday ? 'long' : undefined, day: 'numeric', month: 'long', year: 'numeric' })}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => goto(addDays(date, -1))} aria-label={t('Previous day')} data-testid="prev-day">
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          {!isToday && (
            <Button variant="outline" size="sm" onClick={() => goto(today)} data-testid="go-today">
              {t('Today')}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => goto(addDays(date, 1))} aria-label={t('Next day')} data-testid="next-day">
            <ChevronRight className="rtl:rotate-180" />
          </Button>
          <label className="relative grid size-10 cursor-pointer place-items-center rounded-md hover:bg-accent" aria-label={t('Pick a date')}>
            <CalendarDays className="size-4" />
            <input type="date" value={date} onChange={(e) => e.target.value && goto(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('Customize sections')}>
                <Settings2 />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>{t('Show sections')}</MenuLabel>
              {SECTIONS.map((s) => (
                <MenuItem
                  key={s.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    setLayout({ hidden: hidden.has(s.id) ? [...hidden].filter((x) => x !== s.id) : [...hidden, s.id] });
                  }}
                >
                  <Checkbox checked={!hidden.has(s.id)} tabIndex={-1} aria-hidden /> {t(s.label)}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem onSelect={() => void updateSettings({ section_layout: {} })}>{t('Reset layout')}</MenuItem>
              <MenuItem onSelect={() => nav(`/print/day/${date}`)}>
                <FileDown /> {t('Export PDF')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      <div className="space-y-3">
        {visible.map((id, i) => {
          const s = SECTIONS.find((x) => x.id === id)!;
          return (
            <Section
              key={id}
              id={id}
              title={t(s.label)}
              icon={s.icon}
              collapsed={collapsed.has(id)}
              onToggle={() => setLayout({ collapsed: collapsed.has(id) ? [...collapsed].filter((x) => x !== id) : [...collapsed, id] })}
              onHide={() => setLayout({ hidden: [...hidden, id] })}
              onMoveUp={i > 0 ? () => move(id, -1) : undefined}
              onMoveDown={i < visible.length - 1 ? () => move(id, 1) : undefined}
            >
              {render(id)}
            </Section>
          );
        })}
        {hidden.size > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {t('{n} hidden sections', { n: hidden.size })} ·{' '}
            <button className="underline" onClick={() => setLayout({ hidden: [] })}>
              {t('Show all')}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
