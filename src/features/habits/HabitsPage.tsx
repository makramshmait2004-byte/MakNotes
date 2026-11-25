import { useMemo, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, Flame, MoreHorizontal, Plus, Repeat } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { insert, remove, update } from '@/data/repo';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { confirmDialog, EmptyState, PageHeader } from '@/components/ui/misc';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { useLocale, useT } from '@/i18n';
import { useSettings, useToday } from '@/stores/settings';
import { addDays, addMonths, eachDay, endOfMonth, formatDate, startOfMonth, weekdayNames } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { completionRate, currentStreak, cycleHabit, isDue, longestStreak } from './habitLogic';
import type { Habit, Row } from '@/types/models';

type Draft = { name: string; description: string; frequency: Habit['frequency']; weekdays: number[]; target_per_week: number };

function HabitDialog({ open, onOpenChange, habit }: { open: boolean; onOpenChange: (o: boolean) => void; habit?: Row<'habits'> }) {
  const t = useT();
  const locale = useLocale();
  const [d, setD] = useState<Draft>(() => ({ name: habit?.name ?? '', description: habit?.description ?? '', frequency: habit?.frequency ?? 'daily', weekdays: habit?.weekdays ?? [1, 2, 3, 4, 5], target_per_week: habit?.target_per_week ?? 3 }));
  const days = weekdayNames(locale, 0, 'short');
  const save = async () => {
    if (!d.name.trim()) return;
    const data = { ...d, name: d.name.trim(), description: d.description || null, target_per_week: d.frequency === 'weekly' ? d.target_per_week : 7 };
    if (habit) await update('habits', habit.id, data);
    else await insert('habits', { ...data, position: Date.now() });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={habit ? t('Edit habit') : t('New habit')}>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder={t('e.g. Read 20 pages')} data-testid="habit-name" />
          <Input value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder={t('Why it matters (optional)')} />
          <Field label={t('Frequency')}>
            <NativeSelect value={d.frequency} onChange={(e) => setD({ ...d, frequency: e.target.value as Habit['frequency'] })}>
              <option value="daily">{t('Every day')}</option>
              <option value="weekdays">{t('Specific days')}</option>
              <option value="weekly">{t('Times per week')}</option>
            </NativeSelect>
          </Field>
          {d.frequency === 'weekdays' && (
            <div className="flex flex-wrap gap-1">
              {days.map((n, i) => (
                <button type="button" key={i} onClick={() => setD({ ...d, weekdays: d.weekdays.includes(i) ? d.weekdays.filter((x) => x !== i) : [...d.weekdays, i] })} className={cn('h-9 min-w-10 rounded-md border px-2 text-xs', d.weekdays.includes(i) && 'border-bronze bg-bronze text-bronze-foreground')}>
                  {n}
                </button>
              ))}
            </div>
          )}
          {d.frequency === 'weekly' && (
            <Field label={t('Target per week')}>
              <Input type="number" min={1} max={7} value={d.target_per_week} onChange={(e) => setD({ ...d, target_per_week: Math.min(7, Math.max(1, Number(e.target.value) || 1)) })} />
            </Field>
          )}
          <Button type="submit" variant="bronze" className="justify-self-end" data-testid="habit-save">
            {t('Save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function HabitsPage() {
  const t = useT();
  const locale = useLocale();
  const today = useToday();
  const { week_start } = useSettings();
  const habits = useAll('habits');
  const logs = useAll('habit_logs');
  const [dialog, setDialog] = useState<{ open: boolean; habit?: Row<'habits'> }>({ open: false });
  const [month, setMonth] = useState(startOfMonth(today));
  const [showArchived, setShowArchived] = useState(false);

  const last7 = eachDay(addDays(today, -6), today);
  const monthDays = eachDay(month, endOfMonth(month));
  const active = useMemo(() => habits.filter((h) => (showArchived ? !!h.archived_at : !h.archived_at)).sort((a, b) => a.position - b.position), [habits, showArchived]);
  const logsBy = useMemo(() => {
    const m = new Map<string, Row<'habit_logs'>[]>();
    for (const l of logs) m.set(l.habit_id, [...(m.get(l.habit_id) ?? []), l]);
    return m;
  }, [logs]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('Habits')}
        actions={
          <>
            <Button variant={showArchived ? 'secondary' : 'ghost'} size="icon" onClick={() => setShowArchived((v) => !v)} aria-label={t('Show archived')}>
              <Archive />
            </Button>
            <Button variant="bronze" onClick={() => setDialog({ open: true })} data-testid="new-habit">
              <Plus /> {t('New habit')}
            </Button>
          </>
        }
      />
      {active.length === 0 ? (
        <EmptyState icon={Repeat} title={t('No habits yet')} description={t('Track what you want to do consistently. Tap a day to mark it done; tap again to mark it skipped.')} action={<Button onClick={() => setDialog({ open: true })}>{t('New habit')}</Button>} />
      ) : (
        <>
          <div className="space-y-2">
            {active.map((h) => {
              const hl = logsBy.get(h.id) ?? [];
              const status = new Map(hl.map((l) => [l.date, l.status]));
              const streak = currentStreak(h, hl, today, week_start);
              const best = longestStreak(h, hl);
              const m = completionRate(h, hl, month, endOfMonth(month) < today ? endOfMonth(month) : today);
              return (
                <div key={h.id} className="rounded-lg border bg-card p-3" data-testid="habit-row">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.frequency === 'daily' ? t('Every day') : h.frequency === 'weekly' ? t('{n}× per week', { n: h.target_per_week }) : weekdayNames(locale, 0, 'short').filter((_, i) => h.weekdays.includes(i)).join(' · ')}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm tabular-nums" title={t('Current streak')}>
                      <Flame className={cn('size-4', streak > 0 ? 'text-bronze' : 'text-muted-foreground')} /> {streak}
                    </span>
                    <Menu>
                      <MenuTrigger asChild>
                        <button className="rounded p-1.5 text-muted-foreground hover:bg-accent" aria-label={t('Habit actions')}>
                          <MoreHorizontal className="size-4" />
                        </button>
                      </MenuTrigger>
                      <MenuContent align="end">
                        <MenuItem onSelect={() => setDialog({ open: true, habit: h })}>{t('Edit')}</MenuItem>
                        <MenuItem onSelect={() => void update('habits', h.id, { archived_at: h.archived_at ? null : new Date().toISOString() })}>{h.archived_at ? t('Unarchive') : t('Archive')}</MenuItem>
                        <MenuItem destructive onSelect={async () => (await confirmDialog({ title: t('Delete "{s}" and its history?', { s: h.name }), destructive: true, confirmLabel: t('Delete') })) && void remove('habits', h.id)}>
                          {t('Delete')}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {last7.map((d) => {
                      const s = status.get(d);
                      const due = isDue(h, d);
                      return (
                        <button
                          key={d}
                          onClick={() => void cycleHabit(h.id, d)}
                          className={cn(
                            'flex h-12 flex-col items-center justify-center rounded-md border text-[11px]',
                            s === 'done' && 'border-bronze bg-bronze text-bronze-foreground',
                            s === 'skipped' && 'border-dashed text-muted-foreground',
                            !s && !due && 'opacity-40',
                          )}
                          aria-label={`${h.name} ${d} ${s ?? 'not done'}`}
                          aria-pressed={s === 'done'}
                        >
                          <span>{formatDate(d, locale, { weekday: 'narrow' })}</span>
                          <span className="font-medium tabular-nums">{s === 'skipped' ? '–' : Number(d.slice(8))}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span>{t('Best streak')}: {best}</span>
                    <span>{t('This month')}: {m.due ? `${Math.round(m.rate * 100)}% (${m.done}/${m.due})` : '—'}</span>
                    <span>{t('Total')}: {hl.filter((l) => l.status === 'done').length}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold">{t('Monthly overview')}</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="iconSm" onClick={() => setMonth(addMonths(month, -1))} aria-label={t('Previous month')}>
                  <ChevronLeft className="rtl:rotate-180" />
                </Button>
                <span className="w-32 text-center text-sm">{formatDate(month, locale, { month: 'long', year: 'numeric' })}</span>
                <Button variant="ghost" size="iconSm" onClick={() => setMonth(addMonths(month, 1))} aria-label={t('Next month')}>
                  <ChevronRight className="rtl:rotate-180" />
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border bg-card p-3">
              <table className="w-full border-separate border-spacing-0.5 text-xs">
                <thead>
                  <tr>
                    <th className="sticky start-0 bg-card pe-2 text-start font-medium text-muted-foreground">{t('Habit')}</th>
                    {monthDays.map((d) => (
                      <th key={d} className="w-5 font-normal tabular-nums text-muted-foreground">
                        {Number(d.slice(8))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {active.map((h) => {
                    const status = new Map((logsBy.get(h.id) ?? []).map((l) => [l.date, l.status]));
                    return (
                      <tr key={h.id}>
                        <td className="sticky start-0 max-w-[8rem] truncate bg-card pe-2">{h.name}</td>
                        {monthDays.map((d) => (
                          <td key={d}>
                            <div className={cn('size-5 rounded-sm', status.get(d) === 'done' ? 'bg-bronze' : status.get(d) === 'skipped' ? 'bg-muted-foreground/30' : isDue(h, d) && d <= today ? 'bg-muted' : 'bg-transparent')} title={`${d}: ${status.get(d) ?? '—'}`} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {dialog.open && <HabitDialog open={dialog.open} onOpenChange={(o) => setDialog({ open: o })} habit={dialog.habit} />}
    </div>
  );
}
