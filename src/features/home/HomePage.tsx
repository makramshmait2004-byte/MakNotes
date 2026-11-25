import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarDays, ListPlus, NotebookPen, PenTool, Sun, Timer, Flame, ArrowRight } from 'lucide-react';
import { useAll, useDb } from '@/data/hooks';
import { useLocale, useT } from '@/i18n';
import { useSettings, useToday } from '@/stores/settings';
import { openTaskDialog } from '@/stores/ui';
import { addDays, diffDays, formatDate, timeInTz } from '@/lib/dates';
import { TaskItem } from '@/features/tasks/TaskItem';
import { isOverdue } from '@/features/tasks/taskLogic';
import { currentStreak, isDue, setHabit } from '@/features/habits/habitLogic';
import { createJournalEntry } from '@/features/journal/journalActions';
import { createSketch } from '@/features/sketch/sketchActions';
import { cn } from '@/lib/utils';

function Panel({ title, to, children }: { title: string; to?: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-xs text-bronze hover:underline">
            {t('View all')} <ArrowRight className="size-3 rtl:rotate-180" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Home dashboard: an overview of today and what's coming, with quick actions. */
export default function HomePage() {
  const t = useT();
  const locale = useLocale();
  const nav = useNavigate();
  const today = useToday();
  const settings = useSettings();
  const profile = useDb(async (db) => (await db.profiles.toArray()).find((p) => !p.deleted_at), [], undefined);

  const tasks = useAll('tasks', (x) => (x.status === 'todo' && ((x.scheduled_date ?? x.due_date) === today || isOverdue(x, today))) || x.completed_date === today, [today]);
  const events = useAll('calendar_events', (e) => (e.end_date ?? e.start_date) >= today && e.start_date <= addDays(today, 7), [today]);
  const habits = useAll('habits', (h) => !h.archived_at);
  const logs = useAll('habit_logs', (l) => l.date >= addDays(today, -400));
  const goals = useAll('goals', (g) => g.status === 'active');
  const allGoals = useAll('goals');
  const projects = useAll('projects');
  const journal = useAll('journal_entries');
  const pages = useAll('notebook_pages', (p) => !p.archived_at);
  const focus = useAll('focus_sessions', (f) => f.date === today && f.kind === 'focus', [today]);

  const hour = Number(timeInTz(new Date(), settings.timezone).slice(0, 2));
  const greeting = hour < 12 ? t('Good morning') : hour < 18 ? t('Good afternoon') : t('Good evening');
  const name = profile?.display_name?.split(' ')[0];

  const open = tasks.filter((x) => x.status === 'todo').sort((a, b) => b.priority - a.priority || a.position - b.position);
  const doneToday = tasks.filter((x) => x.status === 'done').length;
  const dueHabits = habits.filter((h) => isDue(h, today));
  const doneHabits = dueHabits.filter((h) => logs.some((l) => l.habit_id === h.id && l.date === today && l.status === 'done'));
  const focusMin = Math.round(focus.reduce((s, f) => s + f.duration_seconds, 0) / 60);
  const recentJournal = useMemo(() => [...journal].sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.updated_at.localeCompare(a.updated_at)).slice(0, 3), [journal]);
  const recentPages = useMemo(() => [...pages].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4), [pages]);
  const streaks = useMemo(
    () => habits.map((h) => ({ h, s: currentStreak(h, logs.filter((l) => l.habit_id === h.id), today, settings.week_start) })).filter((x) => x.s > 1).sort((a, b) => b.s - a.s).slice(0, 3),
    [habits, logs, today, settings.week_start],
  );

  // Progress — real data only: next active goal deadline, and GymFlow goals done / total.
  const nextGoal = useMemo(
    () => goals.filter((g) => g.target_date && g.target_date >= today).sort((a, b) => (a.target_date as string).localeCompare(b.target_date as string))[0],
    [goals, today],
  );
  const gymflow = projects.find((p) => p.title.trim().toLowerCase() === 'gymflow');
  const gymGoals = gymflow ? allGoals.filter((g) => g.project_id === gymflow.id && g.status !== 'abandoned') : [];
  const gymDone = gymGoals.filter((g) => g.status === 'completed').length;

  const actions = [
    { label: 'Open today', icon: Sun, onClick: () => nav('/today') },
    { label: 'New task', icon: ListPlus, onClick: () => openTaskDialog(undefined, { scheduled_date: today }) },
    { label: 'Write journal', icon: BookOpen, onClick: async () => nav(`/journal/${(await createJournalEntry(today)).id}`) },
    { label: 'Handwrite', icon: PenTool, onClick: async () => nav(`/sketchbook/${(await createSketch({ date: today, paper: settings.default_paper })).id}`) },
    { label: 'Focus', icon: Timer, onClick: () => nav('/focus') },
    { label: 'Calendar', icon: CalendarDays, onClick: () => nav('/calendar') },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bronze">{formatDate(today, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl" data-testid="home-greeting">
          {greeting}
          {name ? `, ${name}` : ''}.
        </h1>
      </div>

      {(nextGoal || gymGoals.length > 0) && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2" data-testid="home-progress">
          {nextGoal && (
            <Link to={`/goals/${nextGoal.id}`} className="rounded-lg border bg-card p-4 hover:border-bronze/60" data-testid="next-deadline">
              <div className="text-xs text-muted-foreground">{t('Next goal deadline')}</div>
              <div className="mt-1 font-serif text-2xl font-semibold tabular-nums">
                {(() => {
                  const d = diffDays(nextGoal.target_date as string, today);
                  return d === 0 ? t('Due today') : d === 1 ? t('1 day left') : t('{n} days left', { n: d });
                })()}
              </div>
              <div className="mt-1 truncate text-sm">{nextGoal.title}</div>
              <div className="text-xs text-muted-foreground">{formatDate(nextGoal.target_date as string, locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </Link>
          )}
          {gymflow && gymGoals.length > 0 && (
            <Link to={`/projects/${gymflow.id}`} className="rounded-lg border bg-card p-4 hover:border-bronze/60" data-testid="gymflow-progress">
              <div className="text-xs text-muted-foreground">{t('GymFlow goals done')}</div>
              <div className="mt-1 font-serif text-2xl font-semibold tabular-nums">
                {gymDone}/{gymGoals.length}
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={gymGoals.length} aria-valuenow={gymDone} aria-label={t('GymFlow goals done')}>
                <div className="h-full rounded-full bg-bronze" style={{ width: `${(gymDone / gymGoals.length) * 100}%` }} />
              </div>
            </Link>
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: 'Tasks done today', v: `${doneToday}/${doneToday + open.length}` },
          { l: 'Habits', v: dueHabits.length ? `${doneHabits.length}/${dueHabits.length}` : '—' },
          { l: 'Focus today', v: `${focusMin} ${t('min')}` },
          { l: 'Active goals', v: String(goals.length) },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">{t(s.l)}</div>
            <div className="mt-1 font-serif text-2xl font-semibold tabular-nums">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {actions.map((a) => (
          <button key={a.label} onClick={() => void a.onClick()} className="flex flex-col items-center gap-2 rounded-lg border bg-card px-2 py-4 text-xs hover:border-bronze/60">
            <a.icon className="size-5 text-bronze" />
            {t(a.label)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t('Focus for today')} to="/tasks">
          {open.length === 0 ? <p className="text-sm text-muted-foreground">{t('Nothing left for today.')}</p> : open.slice(0, 6).map((x) => <TaskItem key={x.id} task={x} />)}
        </Panel>
        <Panel title={t('Habits today')} to="/habits">
          {dueHabits.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No habits due today.')}</p>
          ) : (
            <div className="grid gap-1">
              {dueHabits.map((h) => {
                const done = doneHabits.includes(h);
                return (
                  <button key={h.id} onClick={() => void setHabit(h.id, today, !done)} className={cn('flex h-10 items-center gap-3 rounded-md border px-3 text-start text-sm', done && 'border-bronze/50 bg-bronze/10')} aria-pressed={done}>
                    <span className={cn('size-4 rounded-full border', done && 'border-bronze bg-bronze')} />
                    {h.name}
                  </button>
                );
              })}
            </div>
          )}
          {streaks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {streaks.map(({ h, s }) => (
                <span key={h.id} className="inline-flex items-center gap-1">
                  <Flame className="size-3.5 text-bronze" /> {h.name}: {s}
                </span>
              ))}
            </div>
          )}
        </Panel>
        <Panel title={t('Coming up')} to="/calendar">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No events in the next 7 days.')}</p>
          ) : (
            events
              .sort((a, b) => (a.start_date + (a.start_time ?? '')).localeCompare(b.start_date + (b.start_time ?? '')))
              .slice(0, 6)
              .map((e) => (
                <Link key={e.id} to={`/day/${e.start_date < today ? today : e.start_date}`} className="flex gap-3 rounded px-1 py-1.5 text-sm hover:bg-accent">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                    {formatDate(e.start_date, locale, { weekday: 'short', day: 'numeric' })} {e.start_time ?? ''}
                  </span>
                  <span className="truncate">{e.title}</span>
                </Link>
              ))
          )}
        </Panel>
        <Panel title={t('Goals')} to="/goals">
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No active goals.')}</p>
          ) : (
            goals.slice(0, 5).map((g) => (
              <Link key={g.id} to={`/goals/${g.id}`} className="mb-2 block">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{g.title}</span>
                  <span className="text-muted-foreground">{g.progress}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-bronze" style={{ width: `${g.progress}%` }} />
                </div>
              </Link>
            ))
          )}
        </Panel>
        <Panel title={t('Recent journal')} to="/journal">
          {recentJournal.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No entries yet.')}</p>
          ) : (
            recentJournal.map((e) => (
              <Link key={e.id} to={`/journal/${e.id}`} className="block rounded px-1 py-1.5 hover:bg-accent">
                <p className="text-sm font-medium">{e.title || t('Untitled entry')}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground" dir="auto">
                  {e.entry_date} · {e.plain_text}
                </p>
              </Link>
            ))
          )}
        </Panel>
        <Panel title={t('Recent notes')} to="/notebooks">
          {recentPages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('No notebook pages yet.')}</p>
          ) : (
            recentPages.map((p) => (
              <Link key={p.id} to={`/notebooks/${p.notebook_id}/${p.id}`} className="flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-accent">
                <NotebookPen className="size-4 text-muted-foreground" />
                <span className="truncate">{p.title || t('Untitled page')}</span>
              </Link>
            ))
          )}
        </Panel>
      </div>
    </div>
  );
}
