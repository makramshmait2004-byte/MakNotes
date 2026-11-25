import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Square, Timer } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { useLocale, useT } from '@/i18n';
import { useSettings, useToday } from '@/stores/settings';
import { addDays, timeInTz } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { configure, pause, remainingMs, setPhase, start, stop, useFocus, type Phase } from './focusStore';

const fmt = (msLeft: number) => {
  const s = Math.ceil(msLeft / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function FocusPage() {
  const t = useT();
  useLocale();
  const settings = useSettings();
  const today = useToday();
  const state = useFocus();
  const [, tick] = useState(0);
  const tasks = useAll('tasks', (x) => x.status === 'todo');
  const sessions = useAll('focus_sessions', (f) => f.date >= addDays(today, -6));

  useEffect(() => configure(settings.pomodoro, settings.timezone), [settings.pomodoro, settings.timezone]);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  const left = remainingMs(state);
  const total = (state.phase === 'focus' ? state.durations.focus : state.phase === 'short_break' ? state.durations.short : state.durations.long) * 60_000;
  const pct = total ? 1 - left / total : 0;
  useEffect(() => {
    document.title = state.running ? `${fmt(left)} · MakNotes` : 'MakNotes';
    return () => {
      document.title = 'MakNotes';
    };
  }, [left, state.running]);

  const todayFocus = sessions.filter((f) => f.date === today && f.kind === 'focus');
  const weekMin = Math.round(sessions.filter((f) => f.kind === 'focus').reduce((s, f) => s + f.duration_seconds, 0) / 60);
  const recent = useMemo(() => [...sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 15), [sessions]);
  const R = 110,
    C = 2 * Math.PI * R;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('Focus')} subtitle={t('Pomodoro timer — sessions are saved to your history.')} />
      <div className="mb-6 flex justify-center gap-1">
        {(['focus', 'short_break', 'long_break'] as Phase[]).map((p) => (
          <button key={p} onClick={() => setPhase(p)} disabled={state.running} className={cn('h-9 rounded-md px-3 text-sm disabled:opacity-50', state.phase === p ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-accent')}>
            {t(p === 'focus' ? 'Focus' : p === 'short_break' ? 'Short break' : 'Long break')}
          </button>
        ))}
      </div>
      <div className="relative mx-auto mb-6 size-64">
        <svg viewBox="0 0 240 240" className="size-full -rotate-90">
          <circle cx="120" cy="120" r={R} className="fill-none stroke-muted" strokeWidth="6" />
          <circle cx="120" cy="120" r={R} className="fill-none stroke-bronze transition-[stroke-dashoffset] duration-500" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-6xl tabular-nums" data-testid="focus-time">
            {fmt(left)}
          </span>
          <span className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            {t('Round {n}', { n: state.round })}
          </span>
        </div>
      </div>
      <div className="mb-6 flex justify-center gap-2">
        {state.running ? (
          <Button size="lg" variant="secondary" onClick={pause}>
            <Pause /> {t('Pause')}
          </Button>
        ) : (
          <Button size="lg" variant="bronze" onClick={start} data-testid="focus-start">
            <Play /> {state.startedAt ? t('Resume') : t('Start')}
          </Button>
        )}
        {state.startedAt && (
          <Button size="lg" variant="outline" onClick={() => void stop()}>
            <Square /> {t('Stop')}
          </Button>
        )}
      </div>
      <div className="mx-auto mb-8 max-w-sm">
        <NativeSelect value={state.taskId ?? ''} onChange={(e) => useFocus.setState({ taskId: e.target.value || null })} aria-label={t('Working on')}>
          <option value="">{t('Not linked to a task')}</option>
          {tasks.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border bg-card p-3">
          <div className="text-2xl font-semibold tabular-nums">{todayFocus.filter((f) => f.completed).length}</div>
          <div className="text-xs text-muted-foreground">{t('Sessions today')}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-2xl font-semibold tabular-nums">{Math.round(todayFocus.reduce((s, f) => s + f.duration_seconds, 0) / 60)}</div>
          <div className="text-xs text-muted-foreground">{t('Minutes today')}</div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="text-2xl font-semibold tabular-nums">{weekMin}</div>
          <div className="text-xs text-muted-foreground">{t('Minutes, 7 days')}</div>
        </div>
      </div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('History')}</h2>
      {recent.length === 0 ? (
        <EmptyState icon={Timer} title={t('No sessions yet')} />
      ) : (
        <div className="rounded-lg border bg-card">
          {recent.map((f) => (
            <div key={f.id} className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0">
              <span>
                {t(f.kind === 'focus' ? 'Focus' : f.kind === 'short_break' ? 'Short break' : 'Long break')}
                {!f.completed && <span className="text-muted-foreground"> · {t('stopped early')}</span>}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {f.date} {timeInTz(new Date(f.started_at), settings.timezone)} · {Math.round(f.duration_seconds / 60)} {t('min')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
