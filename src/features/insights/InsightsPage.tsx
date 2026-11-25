import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { useLocale, useT } from '@/i18n';
import { useSettings, useToday } from '@/stores/settings';
import { addDays, addMonths, addYears, endOfMonth, endOfYear, formatDate, startOfMonth, startOfWeek, startOfYear } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { BarChart, LineChart, Stat } from './charts';
import { buckets, computeInsights } from './stats';

type Period = 'day' | 'week' | 'month' | 'year';
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export default function InsightsPage() {
  const t = useT();
  const locale = useLocale();
  const today = useToday();
  const { week_start } = useSettings();
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(today);

  const input = {
    tasks: useAll('tasks'),
    journal: useAll('journal_entries'),
    pages: useAll('daily_pages'),
    habits: useAll('habits'),
    logs: useAll('habit_logs'),
    focus: useAll('focus_sessions'),
    goals: useAll('goals'),
  };

  const [from, toFull] = useMemo((): [string, string] => {
    if (period === 'day') return [anchor, anchor];
    if (period === 'week') {
      const s = startOfWeek(anchor, week_start);
      return [s, addDays(s, 6)];
    }
    if (period === 'month') return [startOfMonth(anchor), endOfMonth(anchor)];
    return [startOfYear(anchor), endOfYear(anchor)];
  }, [period, anchor, week_start]);
  const to = toFull > today ? today : toFull; // never count future days

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const s = useMemo(() => computeInsights(input, from, to), [from, to, ...Object.values(input)]);
  const bs = useMemo(() => s.perBucket(buckets(from, toFull, period === 'year')), [s, from, toFull, period]);

  const shift = (dir: 1 | -1) => setAnchor((a) => (period === 'day' ? addDays(a, dir) : period === 'week' ? addDays(a, 7 * dir) : period === 'month' ? addMonths(a, dir) : addYears(a, dir)));
  const label = (d: string) => (period === 'year' ? formatDate(d, locale, { month: 'short' }) : period === 'month' ? String(Number(d.slice(8))) : formatDate(d, locale, { weekday: 'short' }));
  const detail = (d: string) => (period === 'year' ? formatDate(d, locale, { month: 'long', year: 'numeric' }) : formatDate(d, locale, { weekday: 'short', day: 'numeric', month: 'short' }));

  const title = period === 'day' ? formatDate(anchor, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : period === 'week' ? `${formatDate(from, locale, { day: 'numeric', month: 'short' })} – ${formatDate(toFull, locale, { day: 'numeric', month: 'short', year: 'numeric' })}` : period === 'month' ? formatDate(anchor, locale, { month: 'long', year: 'numeric' }) : anchor.slice(0, 4);

  const hasAnyData = input.tasks.length + input.journal.length + input.logs.length + input.focus.length + input.goals.length > 0;
  const future = from > today;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t('Insights')} subtitle={t('Calculated only from what you have recorded.')} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md bg-muted p-1">
          {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={cn('rounded px-3 py-1.5 text-sm', period === p ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
              {t(p[0].toUpperCase() + p.slice(1))}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="iconSm" onClick={() => shift(-1)} aria-label={t('Previous')}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <span className="min-w-[10rem] text-center text-sm font-medium">{title}</span>
          <Button variant="ghost" size="iconSm" onClick={() => shift(1)} aria-label={t('Next')}>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
        </div>
      </div>

      {!hasAnyData ? (
        <EmptyState icon={BarChart3} title={t('Not enough data yet')} description={t('Complete tasks, journal, track habits or run a focus session — your statistics will appear here.')} action={<Button asChild><Link to="/today">{t('Go to Today')}</Link></Button>} />
      ) : future ? (
        <EmptyState icon={BarChart3} title={t('This period has not started yet')} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t('Task completion')} value={pct(s.tasks.rate)} sub={s.tasks.planned ? t('{d} of {n} planned', { d: s.tasks.plannedDone, n: s.tasks.planned }) : t('No tasks planned')} />
            <Stat label={t('Journaling')} value={s.journal.frequency === null ? '—' : `${s.journal.days}/${s.days}`} sub={t('{n} entries · {w} words', { n: s.journal.entries, w: s.journal.words })} />
            <Stat label={t('Habit consistency')} value={pct(s.habits.consistency)} sub={s.habits.rates.length ? t('{n} habits tracked', { n: s.habits.rates.length }) : t('No habits due')} />
            <Stat label={t('Focus time')} value={`${s.focus.minutes}m`} sub={t('{n} completed sessions', { n: s.focus.sessions })} />
            <Stat label={t('Average mood')} value={s.mood.average === null ? '—' : `${s.mood.average.toFixed(1)}/5`} sub={t('{n} days rated', { n: s.mood.byDay.size })} />
            <Stat label={t('Tasks completed')} value={String(s.tasks.completed)} />
            <Stat label={t('Active goals')} value={String(s.goals.active.length)} sub={s.goals.avgProgress === null ? undefined : t('avg {p}% progress', { p: Math.round(s.goals.avgProgress) })} />
            <Stat label={t('Goals achieved')} value={String(s.goals.completed.length)} />
          </div>

          {period !== 'day' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-2 text-sm font-semibold">{t('Tasks completed')}</h3>
                {s.tasks.completed ? <BarChart title={t('Tasks completed')} data={bs.map((b) => ({ label: label(b.key), detail: detail(b.key), value: b.from > today ? null : b.completed }))} /> : <p className="py-8 text-center text-sm text-muted-foreground">{t('No completed tasks in this period.')}</p>}
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-2 text-sm font-semibold">{t('Focus minutes')}</h3>
                {s.focus.minutes ? <BarChart title={t('Focus minutes')} unit="m" data={bs.map((b) => ({ label: label(b.key), detail: detail(b.key), value: b.from > today ? null : b.focus }))} /> : <p className="py-8 text-center text-sm text-muted-foreground">{t('No focus sessions in this period.')}</p>}
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-2 text-sm font-semibold">{t('Mood trend')}</h3>
                {s.mood.byDay.size >= 2 ? <LineChart title={t('Mood trend')} min={1} max={5} data={bs.map((b) => ({ label: label(b.key), detail: detail(b.key), value: b.mood }))} /> : <p className="py-8 text-center text-sm text-muted-foreground">{t('Rate your mood on at least two days to see a trend.')}</p>}
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-2 text-sm font-semibold">{t('Journal entries')}</h3>
                {s.journal.entries ? <BarChart title={t('Journal entries')} data={bs.map((b) => ({ label: label(b.key), detail: detail(b.key), value: b.from > today ? null : b.journal }))} /> : <p className="py-8 text-center text-sm text-muted-foreground">{t('No journal entries in this period.')}</p>}
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{t('Habit consistency')}</h3>
              {s.habits.rates.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('No habits were due in this period.')}</p>
              ) : (
                <div className="space-y-2">
                  {s.habits.rates.map((r) => (
                    <div key={r.habit.id}>
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{r.habit.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {Math.round(r.rate * 100)}% · {r.done}/{r.due}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-bronze" style={{ width: `${r.rate * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">{t('Goal progress')}</h3>
              {s.goals.active.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('No active goals.')}</p>
              ) : (
                <div className="space-y-2">
                  {s.goals.active.slice(0, 10).map((g) => (
                    <Link key={g.id} to={`/goals/${g.id}`} className="block">
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{g.title}</span>
                        <span className="tabular-nums text-muted-foreground">{g.progress}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-bronze" style={{ width: `${g.progress}%` }} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
