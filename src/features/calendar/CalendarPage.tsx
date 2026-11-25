import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/misc';
import { useLocale, useT } from '@/i18n';
import { useSettings, useToday } from '@/stores/settings';
import { openEventDialog, openTaskDialog } from '@/stores/ui';
import { useAll } from '@/data/hooks';
import { addDays, addMonths, addYears, eachDay, endOfYear, formatDate, monthGrid, startOfWeek, startOfYear, weekdayNames } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useDayIndicators, type DayIndicators } from './useDayIndicators';

type View = 'day' | 'week' | 'month' | 'year';

const DOTS: { key: keyof DayIndicators; cls: string; label: string }[] = [
  { key: 'events', cls: 'bg-sky-500', label: 'Events' },
  { key: 'tasks', cls: 'bg-foreground/60', label: 'Tasks' },
  { key: 'tasksDone', cls: 'bg-emerald-500', label: 'Completed' },
  { key: 'journal', cls: 'bg-bronze', label: 'Journal' },
  { key: 'habits', cls: 'bg-violet-500', label: 'Habits' },
  { key: 'notes', cls: 'bg-amber-400', label: 'Notes' },
  { key: 'sketches', cls: 'bg-rose-400', label: 'Sketches' },
];

function Dots({ ind, max = 7 }: { ind?: DayIndicators; max?: number }) {
  if (!ind) return null;
  return (
    <div className="flex flex-wrap justify-center gap-0.5">
      {DOTS.filter((d) => ind[d.key] > 0)
        .slice(0, max)
        .map((d) => (
          <span key={d.key} className={cn('size-1.5 rounded-full', d.cls)} />
        ))}
    </div>
  );
}

export function MiniMonth({ month, selected, onPick, compact }: { month: string; selected?: string; onPick: (d: string) => void; compact?: boolean }) {
  const { week_start } = useSettings();
  const locale = useLocale();
  const today = useToday();
  const days = monthGrid(month, week_start);
  const ind = useDayIndicators(days[0], days[41]);
  const names = weekdayNames(locale, week_start, 'narrow');
  return (
    <div>
      <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">
        {names.map((n, i) => (
          <span key={i}>{n}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => onPick(d)}
            className={cn(
              'flex flex-col items-center rounded py-0.5 text-xs hover:bg-accent',
              d.slice(0, 7) !== month.slice(0, 7) && 'text-muted-foreground/40',
              d === today && 'font-bold text-bronze',
              d === selected && 'bg-secondary',
            )}
          >
            <span className={compact ? 'leading-5' : 'leading-6'}>{Number(d.slice(8))}</span>
            <span className="h-1.5">
              <Dots ind={ind.get(d)} max={3} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DayList({ date }: { date: string }) {
  const t = useT();
  const events = useAll('calendar_events', (e) => e.start_date <= date && (e.end_date ?? e.start_date) >= date, [date]);
  const tasks = useAll('tasks', (x) => x.scheduled_date === date, [date]);
  const journal = useAll('journal_entries', (e) => e.entry_date === date, [date]);
  const items = [...events.map((e) => ({ id: e.id, time: e.all_day ? '' : e.start_time ?? '', title: e.title, kind: 'event' as const, done: false })), ...tasks.map((x) => ({ id: x.id, time: x.scheduled_time ?? '', title: x.title, kind: 'task' as const, done: x.status === 'done' }))].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  return (
    <div className="space-y-1">
      {items.map((i) => (
        <button key={i.id} onClick={() => (i.kind === 'event' ? openEventDialog(i.id) : openTaskDialog(i.id))} className={cn('flex w-full gap-2 rounded px-2 py-1 text-start text-sm hover:bg-accent', i.kind === 'event' ? 'border-s-2 border-sky-500' : 'border-s-2 border-foreground/30', i.done && 'text-muted-foreground line-through')}>
          {i.time && <span className="tabular-nums text-muted-foreground">{i.time}</span>}
          <span className="truncate">{i.title}</span>
        </button>
      ))}
      {journal.length > 0 && <p className="px-2 text-xs text-bronze">{t('{n} journal entries', { n: journal.length })}</p>}
      {items.length === 0 && journal.length === 0 && <p className="px-2 text-xs text-muted-foreground">—</p>}
    </div>
  );
}

export default function CalendarPage() {
  const t = useT();
  const locale = useLocale();
  const nav = useNavigate();
  const today = useToday();
  const { week_start } = useSettings();
  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(today);

  const open = (d: string) => nav(d === today ? '/today' : `/day/${d}`);
  const shift = (dir: 1 | -1) => setAnchor((a) => (view === 'day' ? addDays(a, dir) : view === 'week' ? addDays(a, 7 * dir) : view === 'month' ? addMonths(a, dir) : addYears(a, dir)));

  const grid = useMemo(() => monthGrid(anchor, week_start), [anchor, week_start]);
  const weekDays = useMemo(() => eachDay(startOfWeek(anchor, week_start), addDays(startOfWeek(anchor, week_start), 6)), [anchor, week_start]);
  const range: [string, string] = view === 'month' ? [grid[0], grid[41]] : view === 'week' ? [weekDays[0], weekDays[6]] : view === 'year' ? [startOfYear(anchor), endOfYear(anchor)] : [anchor, anchor];
  const ind = useDayIndicators(range[0], range[1]);
  const names = weekdayNames(locale, week_start, 'short');

  const title =
    view === 'day'
      ? formatDate(anchor, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${formatDate(weekDays[0], locale, { day: 'numeric', month: 'short' })} – ${formatDate(weekDays[6], locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : view === 'month'
          ? formatDate(anchor, locale, { month: 'long', year: 'numeric' })
          : anchor.slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('Calendar')}
        actions={
          <Button variant="bronze" onClick={() => openEventDialog(undefined, { start_date: view === 'day' ? anchor : today })}>
            <Plus /> {t('Event')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label={t('Previous')}>
            <ChevronLeft className="rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(today)}>
            {t('Today')}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label={t('Next')}>
            <ChevronRight className="rtl:rotate-180" />
          </Button>
          <h2 className="ms-2 font-serif text-lg font-semibold" data-testid="calendar-title">
            {title}
          </h2>
        </div>
        <div className="inline-flex rounded-md bg-muted p-1" role="tablist">
          {(['day', 'week', 'month', 'year'] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('rounded px-3 py-1.5 text-sm', view === v ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
              {t(v[0].toUpperCase() + v.slice(1))}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {names.map((n) => (
              <div key={n} className="py-2">
                {n}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((d) => {
              const i = ind.get(d);
              const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
              return (
                <button
                  key={d}
                  onClick={() => open(d)}
                  className={cn('flex min-h-[64px] flex-col items-center gap-1 border-b border-e p-1 text-start hover:bg-accent md:min-h-[96px] md:items-stretch md:p-2', !inMonth && 'bg-muted/20 text-muted-foreground/50')}
                  data-testid={`cal-day-${d}`}
                >
                  <span className={cn('grid size-7 place-items-center rounded-full text-sm', d === today && 'bg-bronze font-semibold text-bronze-foreground')}>{Number(d.slice(8))}</span>
                  <Dots ind={i} />
                  {i && (i.tasks > 0 || i.events > 0) && (
                    <span className="hidden text-[11px] text-muted-foreground md:block">
                      {i.events > 0 && `${i.events} ${t('ev')} `}
                      {i.tasks > 0 && `${i.tasksDone}/${i.tasks} ${t('tasks')}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="grid gap-2 md:grid-cols-7">
          {weekDays.map((d) => (
            <div key={d} className={cn('rounded-lg border bg-card p-2', d === today && 'border-bronze/60')}>
              <button onClick={() => open(d)} className="mb-2 flex w-full items-center justify-between text-start">
                <span className="text-sm font-medium">{formatDate(d, locale, { weekday: 'short', day: 'numeric' })}</span>
                <Dots ind={ind.get(d)} />
              </button>
              <DayList date={d} />
            </div>
          ))}
        </div>
      )}

      {view === 'day' && (
        <div className="rounded-lg border bg-card p-4">
          <DayList date={anchor} />
          <Button className="mt-4" variant="outline" onClick={() => open(anchor)}>
            {t('Open full day workspace')}
          </Button>
        </div>
      )}

      {view === 'year' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, m) => `${anchor.slice(0, 4)}-${String(m + 1).padStart(2, '0')}-01`).map((m) => (
            <div key={m} className="rounded-lg border bg-card p-3">
              <button onClick={() => (setAnchor(m), setView('month'))} className="mb-2 text-sm font-semibold hover:text-bronze">
                {formatDate(m, locale, { month: 'long' })}
              </button>
              <MiniMonth month={m} onPick={open} compact />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {DOTS.map((d) => (
          <span key={d.key} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', d.cls)} /> {t(d.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
