import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Target } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { insert } from '@/data/repo';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useLocale, useT } from '@/i18n';
import { useToday } from '@/stores/settings';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Goal } from '@/types/models';

export const HORIZONS: { id: Goal['horizon']; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'long_term', label: 'Long-term' },
];

export default function GoalsPage() {
  const t = useT();
  const locale = useLocale();
  const today = useToday();
  const goals = useAll('goals');
  const milestones = useAll('milestones');
  const projects = useAll('projects');
  const [tab, setTab] = useState<Goal['horizon'] | 'all'>('all');
  const [status, setStatus] = useState<Goal['status']>('active');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', horizon: 'monthly' as Goal['horizon'], target_date: '', project_id: '' });

  const list = useMemo(() => goals.filter((g) => g.status === status && (tab === 'all' || g.horizon === tab)).sort((a, b) => (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999')), [goals, tab, status]);

  const create = async () => {
    if (!f.title.trim()) return;
    await insert('goals', { title: f.title.trim(), horizon: f.horizon, target_date: f.target_date || null, period_start: today, project_id: f.project_id || null, position: Date.now() });
    setOpen(false);
    setF({ title: '', horizon: 'monthly', target_date: '', project_id: '' });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('Goals')}
        actions={
          <Button variant="bronze" onClick={() => setOpen(true)} data-testid="new-goal">
            <Plus /> {t('New goal')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {[{ id: 'all' as const, label: 'All' }, ...HORIZONS].map((h) => (
            <button key={h.id} onClick={() => setTab(h.id)} className={cn('h-9 shrink-0 rounded-md px-3 text-sm', tab === h.id ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-accent')}>
              {t(h.label)}
            </button>
          ))}
        </div>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as Goal['status'])} className="w-36" aria-label={t('Status')}>
          <option value="active">{t('Active')}</option>
          <option value="completed">{t('Completed')}</option>
          <option value="abandoned">{t('Abandoned')}</option>
        </NativeSelect>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Target} title={t('No goals here')} description={t('Set daily, weekly, monthly, yearly and long-term goals with milestones.')} action={<Button onClick={() => setOpen(true)}>{t('New goal')}</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((g) => {
            const ms = milestones.filter((m) => m.goal_id === g.id);
            return (
              <Link key={g.id} to={`/goals/${g.id}`} className="rounded-lg border bg-card p-4 hover:border-bronze/50">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{g.title}</p>
                  <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground">{t(HORIZONS.find((h) => h.id === g.horizon)!.label)}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-bronze" style={{ width: `${g.progress}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{g.progress}%{ms.length ? ` · ${ms.filter((m) => m.done).length}/${ms.length} ${t('milestones')}` : ''}</span>
                  {g.target_date && <span className={cn(g.target_date < today && g.status === 'active' && 'text-destructive')}>{formatDate(g.target_date, locale, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </div>
                {g.project_id && <p className="mt-1 text-xs text-muted-foreground">{projects.find((p) => p.id === g.project_id)?.title}</p>}
              </Link>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('New goal')}>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t('What do you want to achieve?')} data-testid="goal-title" />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('Horizon')}>
                <NativeSelect value={f.horizon} onChange={(e) => setF({ ...f, horizon: e.target.value as Goal['horizon'] })}>
                  {HORIZONS.map((h) => (
                    <option key={h.id} value={h.id}>
                      {t(h.label)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t('Deadline')}>
                <Input type="date" value={f.target_date} onChange={(e) => setF({ ...f, target_date: e.target.value })} />
              </Field>
            </div>
            <Field label={t('Project')}>
              <NativeSelect value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
                <option value="">{t('None')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button type="submit" variant="bronze" className="justify-self-end">
              {t('Create')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
