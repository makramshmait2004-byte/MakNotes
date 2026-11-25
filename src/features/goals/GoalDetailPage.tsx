import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { byPosition, useAll, useRow, useWhere } from '@/data/hooks';
import { insert, remove, update } from '@/data/repo';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/controls';
import { confirmDialog, EmptyState, Spinner } from '@/components/ui/misc';
import { RichText } from '@/components/shared/RichText';
import { TaskItem } from '@/features/tasks/TaskItem';
import { openTaskDialog } from '@/stores/ui';
import { useT } from '@/i18n';
import { HORIZONS } from './GoalsPage';
import type { Goal } from '@/types/models';

export default function GoalDetailPage() {
  const { id } = useParams();
  const t = useT();
  const nav = useNavigate();
  const goal = useRow('goals', id);
  const milestones = useWhere('milestones', 'goal_id', id);
  const tasks = useWhere('tasks', 'goal_id', id);
  const projects = useAll('projects');
  const [ms, setMs] = useState('');
  const sorted = useMemo(() => [...milestones].sort(byPosition), [milestones]);

  if (!goal) return <div className="grid min-h-[40vh] place-items-center">{id ? <Spinner /> : <EmptyState title={t('Goal not found')} />}</div>;

  // progress is derived from milestones + linked tasks when there are any; otherwise set manually
  const items = [...milestones.map((m) => m.done), ...tasks.map((x) => x.status === 'done')];
  const derived = items.length ? Math.round((items.filter(Boolean).length / items.length) * 100) : null;
  const syncProgress = async (next: boolean[]) => {
    if (!next.length) return;
    const p = Math.round((next.filter(Boolean).length / next.length) * 100);
    if (p !== goal.progress) await update('goals', goal.id, { progress: p });
  };

  const set = (patch: Partial<Goal>) => void update('goals', goal.id, patch);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav('/goals')} aria-label={t('Back')}>
          <ArrowLeft className="rtl:rotate-180" />
        </Button>
        <input key={goal.id} defaultValue={goal.title} onBlur={(e) => e.target.value.trim() && e.target.value !== goal.title && set({ title: e.target.value.trim() })} className="min-w-0 flex-1 bg-transparent font-serif text-2xl font-semibold outline-none" aria-label={t('Title')} />
        <Button variant="ghost" size="icon" aria-label={t('Delete')} onClick={async () => (await confirmDialog({ title: t('Delete this goal?'), destructive: true, confirmLabel: t('Delete') })) && (await remove('goals', goal.id), nav('/goals'))}>
          <Trash2 />
        </Button>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <Field label={t('Horizon')}>
          <NativeSelect value={goal.horizon} onChange={(e) => set({ horizon: e.target.value as Goal['horizon'] })}>
            {HORIZONS.map((h) => (
              <option key={h.id} value={h.id}>
                {t(h.label)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('Status')}>
          <NativeSelect value={goal.status} onChange={(e) => set({ status: e.target.value as Goal['status'], completed_at: e.target.value === 'completed' ? new Date().toISOString() : null, ...(e.target.value === 'completed' ? { progress: 100 } : {}) })}>
            <option value="active">{t('Active')}</option>
            <option value="completed">{t('Completed')}</option>
            <option value="abandoned">{t('Abandoned')}</option>
          </NativeSelect>
        </Field>
        <Field label={t('Deadline')}>
          <Input type="date" value={goal.target_date ?? ''} onChange={(e) => set({ target_date: e.target.value || null })} />
        </Field>
        <Field label={t('Project')}>
          <NativeSelect value={goal.project_id ?? ''} onChange={(e) => set({ project_id: e.target.value || null })}>
            <option value="">{t('None')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="sm:col-span-2">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">{t('Progress')}</span>
            <span className="tabular-nums">{goal.progress}%</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={goal.progress} disabled={derived !== null} onChange={(e) => set({ progress: Number(e.target.value) })} className="w-full accent-[hsl(var(--bronze))]" aria-label={t('Progress')} />
          {derived !== null && <p className="text-xs text-muted-foreground">{t('Calculated from milestones and linked tasks.')}</p>}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Milestones')}</h2>
      <div className="mb-6 rounded-lg border bg-card p-3">
        {sorted.map((m) => (
          <div key={m.id} className="flex items-center gap-2 py-1.5">
            <Checkbox
              checked={m.done}
              onCheckedChange={async (v) => {
                await update('milestones', m.id, { done: v === true });
                await syncProgress([...sorted.map((x) => (x.id === m.id ? v === true : x.done)), ...tasks.map((x) => x.status === 'done')]);
              }}
              aria-label={m.title}
            />
            <span className={`flex-1 text-sm ${m.done ? 'text-muted-foreground line-through' : ''}`}>{m.title}</span>
            <input type="date" value={m.due_date ?? ''} onChange={(e) => void update('milestones', m.id, { due_date: e.target.value || null })} className="h-8 rounded border bg-transparent px-1 text-xs" aria-label={t('Milestone date')} />
            <button onClick={() => void remove('milestones', m.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label={t('Delete milestone')}>
              <X className="size-4" />
            </button>
          </div>
        ))}
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ms.trim()) return;
            await insert('milestones', { goal_id: goal.id, title: ms.trim(), position: (sorted[sorted.length - 1]?.position ?? 0) + 1000 });
            setMs('');
            await syncProgress([...sorted.map((x) => x.done), false, ...tasks.map((x) => x.status === 'done')]);
          }}
        >
          <Input value={ms} onChange={(e) => setMs(e.target.value)} placeholder={t('Add milestone')} data-testid="milestone-input" />
          <Button type="submit" size="icon" variant="secondary" aria-label={t('Add milestone')}>
            <Plus />
          </Button>
        </form>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Tasks')}</h2>
        <Button variant="ghost" size="sm" onClick={() => openTaskDialog(undefined, { goal_id: goal.id, project_id: goal.project_id })}>
          <Plus /> {t('Add task')}
        </Button>
      </div>
      <div className="mb-6 rounded-lg border bg-card p-2">{tasks.length ? tasks.map((x) => <TaskItem key={x.id} task={x} />) : <p className="p-2 text-sm text-muted-foreground">{t('No linked tasks.')}</p>}</div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Notes')}</h2>
      <RichText value={goal.notes} onChange={(doc) => set({ notes: doc })} placeholder={t('Why this goal matters, plan, notes…')} />
    </div>
  );
}
