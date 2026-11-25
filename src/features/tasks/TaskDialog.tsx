import { useEffect, useMemo, useState } from 'react';
import { Bell, Plus, Trash2, X } from 'lucide-react';
import { useUi, closeTaskDialog } from '@/stores/ui';
import { byPosition, useAll, useRow, useWhere } from '@/data/hooks';
import { insert, remove, update } from '@/data/repo';
import { getDb } from '@/data/db';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/controls';
import { TagInput } from '@/components/shared/TagInput';
import { confirmDialog, toast } from '@/components/ui/misc';
import { useT, useLocale } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { formatDate, timeInTz, dateInTz, weekdayNames, zonedToUtc } from '@/lib/dates';
import { PRIORITY_LABELS } from './taskLogic';
import type { Task, TaskRecurrence } from '@/types/models';

type Freq = 'none' | TaskRecurrence['freq'];

interface Draft {
  title: string;
  description: string;
  priority: Task['priority'];
  category: string;
  project_id: string;
  goal_id: string;
  scheduled_date: string;
  scheduled_time: string;
  due_date: string;
  tags: string[];
  freq: Freq;
  interval: number;
  weekdays: number[];
  end_date: string;
  reminder: string; // 'YYYY-MM-DDTHH:MM' wall time in user tz
}

const empty = (d?: Partial<Task>): Draft => ({
  title: d?.title ?? '',
  description: d?.description ?? '',
  priority: d?.priority ?? 0,
  category: d?.category ?? '',
  project_id: d?.project_id ?? '',
  goal_id: d?.goal_id ?? '',
  scheduled_date: d?.scheduled_date ?? '',
  scheduled_time: d?.scheduled_time ?? '',
  due_date: d?.due_date ?? '',
  tags: d?.tags ?? [],
  freq: 'none',
  interval: 1,
  weekdays: [],
  end_date: '',
  reminder: '',
});

export const TASK_CATEGORIES = ['work', 'personal', 'health', 'learning', 'finance', 'home', 'errands'];

export function TaskDialog() {
  const { open, taskId, defaults } = useUi((s) => s.taskDialog);
  const t = useT();
  const locale = useLocale();
  const settings = useSettings();
  const task = useRow('tasks', taskId);
  const projects = useAll('projects', (p) => p.status !== 'archived');
  const goals = useAll('goals', (g) => g.status === 'active');
  const subtasks = useWhere('subtasks', 'task_id', taskId);
  const reminders = useWhere('reminders', 'task_id', taskId);
  const [draft, setDraft] = useState<Draft>(empty(defaults));
  const [newSub, setNewSub] = useState('');
  const [pendingSubs, setPendingSubs] = useState<string[]>([]);
  const sortedSubs = useMemo(() => [...subtasks].sort(byPosition), [subtasks]);

  useEffect(() => {
    if (!open) return;
    if (taskId && task) {
      void (async () => {
        const rule = task.recurrence_id ? await getDb().task_recurrences.get(task.recurrence_id) : undefined;
        const rem = (await getDb().reminders.where('task_id').equals(task.id).toArray()).find((r) => !r.deleted_at && !r.fired_at);
        setDraft({
          ...empty(task),
          freq: rule && !rule.deleted_at ? rule.freq : 'none',
          interval: rule?.interval ?? 1,
          weekdays: rule?.weekdays ?? [],
          end_date: rule?.end_date ?? '',
          reminder: rem ? `${dateInTz(rem.remind_at, settings.timezone)}T${timeInTz(new Date(rem.remind_at), settings.timezone)}` : '',
        });
      })();
    } else if (!taskId) {
      setDraft(empty(defaults));
      setPendingSubs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId, task?.id]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    const title = draft.title.trim();
    if (!title) return toast(t('Title is required'), 'error');
    let recurrence_id: string | null = task?.recurrence_id ?? null;
    if (draft.freq !== 'none') {
      const rule = { freq: draft.freq, interval: Math.max(1, draft.interval), weekdays: draft.freq === 'weekly' ? draft.weekdays : [], end_date: draft.end_date || null };
      if (recurrence_id) await update('task_recurrences', recurrence_id, rule);
      else recurrence_id = (await insert('task_recurrences', rule)).id;
    } else if (recurrence_id) {
      await remove('task_recurrences', recurrence_id);
      recurrence_id = null;
    }
    const fields: Partial<Task> = {
      title,
      description: draft.description || null,
      priority: draft.priority,
      category: draft.category || null,
      project_id: draft.project_id || null,
      goal_id: draft.goal_id || null,
      scheduled_time: draft.scheduled_time || null,
      due_date: draft.due_date || null,
      tags: draft.tags,
      recurrence_id,
    };
    let id = task?.id;
    if (task) {
      const newDate = draft.scheduled_date || null;
      if (newDate !== task.scheduled_date) {
        fields.scheduled_date = newDate;
        fields.original_date = task.original_date ?? task.scheduled_date ?? newDate;
        fields.reschedule_history = [...(task.reschedule_history ?? []), { from: task.scheduled_date, to: newDate, at: new Date().toISOString() }];
      }
      await update('tasks', task.id, fields);
    } else {
      const created = await insert('tasks', { ...fields, scheduled_date: draft.scheduled_date || null, original_date: draft.scheduled_date || null, position: Date.now() });
      id = created.id;
      for (const [i, s] of pendingSubs.entries()) await insert('subtasks', { task_id: id, title: s, position: (i + 1) * 1000 });
    }
    // reminder
    const existing = id ? (await getDb().reminders.where('task_id').equals(id).toArray()).filter((r) => !r.deleted_at && !r.fired_at) : [];
    for (const r of existing) await remove('reminders', r.id);
    if (draft.reminder && id) {
      const [d, tm] = draft.reminder.split('T');
      await insert('reminders', { task_id: id, title, remind_at: zonedToUtc(d, tm, settings.timezone).toISOString() });
      if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    }
    closeTaskDialog();
    toast(task ? t('Task updated') : t('Task added'), 'success');
  };

  const addSub = async () => {
    const title = newSub.trim();
    if (!title) return;
    if (task) await insert('subtasks', { task_id: task.id, title, position: (sortedSubs[sortedSubs.length - 1]?.position ?? 0) + 1000 });
    else setPendingSubs((s) => [...s, title]);
    setNewSub('');
  };

  const days = weekdayNames(locale, 0, 'short');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeTaskDialog()}>
      <DialogContent title={task ? t('Edit task') : t('New task')} className="sm:max-w-xl">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input autoFocus value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder={t('What needs to be done?')} className="text-base font-medium" data-testid="task-title-input" dir="auto" />
          <Textarea value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder={t('Description')} rows={2} dir="auto" />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Scheduled')}>
              <Input type="date" value={draft.scheduled_date} onChange={(e) => set('scheduled_date', e.target.value)} />
            </Field>
            <Field label={t('Time')}>
              <Input type="time" value={draft.scheduled_time} onChange={(e) => set('scheduled_time', e.target.value)} />
            </Field>
            <Field label={t('Deadline')}>
              <Input type="date" value={draft.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </Field>
            <Field label={t('Priority')}>
              <NativeSelect value={draft.priority} onChange={(e) => set('priority', Number(e.target.value) as Task['priority'])}>
                {PRIORITY_LABELS.map((l, i) => (
                  <option key={l} value={i}>
                    {t(l)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('Category')}>
              <NativeSelect value={draft.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">{t('None')}</option>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('Project')}>
              <NativeSelect value={draft.project_id} onChange={(e) => set('project_id', e.target.value)}>
                <option value="">{t('None')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('Goal')} className="col-span-2">
              <NativeSelect value={draft.goal_id} onChange={(e) => set('goal_id', e.target.value)}>
                <option value="">{t('None')}</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('Repeat')}>
                <NativeSelect value={draft.freq} onChange={(e) => set('freq', e.target.value as Freq)} data-testid="task-repeat">
                  <option value="none">{t('Does not repeat')}</option>
                  <option value="daily">{t('Daily')}</option>
                  <option value="weekly">{t('Weekly')}</option>
                  <option value="monthly">{t('Monthly')}</option>
                  <option value="yearly">{t('Yearly')}</option>
                </NativeSelect>
              </Field>
              {draft.freq !== 'none' && (
                <Field label={t('Every')}>
                  <Input type="number" min={1} max={365} value={draft.interval} onChange={(e) => set('interval', Number(e.target.value) || 1)} />
                </Field>
              )}
            </div>
            {draft.freq === 'weekly' && (
              <div className="flex flex-wrap gap-1">
                {days.map((d, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => set('weekdays', draft.weekdays.includes(i) ? draft.weekdays.filter((x) => x !== i) : [...draft.weekdays, i])}
                    className={`h-9 min-w-10 rounded-md border px-2 text-xs ${draft.weekdays.includes(i) ? 'border-bronze bg-bronze text-bronze-foreground' : ''}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
            {draft.freq !== 'none' && (
              <Field label={t('Ends on (optional)')}>
                <Input type="date" value={draft.end_date} onChange={(e) => set('end_date', e.target.value)} />
              </Field>
            )}
          </div>

          <Field label={t('Reminder')}>
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-muted-foreground" />
              <Input type="datetime-local" value={draft.reminder} onChange={(e) => set('reminder', e.target.value)} />
              {draft.reminder && (
                <Button type="button" variant="ghost" size="iconSm" onClick={() => set('reminder', '')} aria-label={t('Clear reminder')}>
                  <X />
                </Button>
              )}
            </div>
            {reminders.some((r) => r.fired_at) && <p className="text-xs text-muted-foreground">{t('Earlier reminders already fired.')}</p>}
          </Field>

          <Field label={t('Tags')}>
            <TagInput value={draft.tags} onChange={(v) => set('tags', v)} />
          </Field>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-muted-foreground">{t('Subtasks')}</span>
            {sortedSubs.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <Checkbox checked={s.done} onCheckedChange={(v) => void update('subtasks', s.id, { done: v === true })} aria-label={s.title} />
                <input
                  defaultValue={s.title}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== s.title && void update('subtasks', s.id, { title: e.target.value.trim() })}
                  className={`flex-1 bg-transparent text-sm outline-none ${s.done ? 'text-muted-foreground line-through' : ''}`}
                />
                <button type="button" onClick={() => void remove('subtasks', s.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label={t('Delete subtask')}>
                  <X className="size-4" />
                </button>
              </div>
            ))}
            {pendingSubs.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Checkbox disabled /> {s}
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addSub();
                  }
                }}
                placeholder={t('Add subtask')}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => void addSub()} aria-label={t('Add subtask')}>
                <Plus />
              </Button>
            </div>
          </div>

          {task && task.reschedule_history?.length > 0 && (
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium">{t('Reschedule history')}</p>
              {task.original_date && <p>{t('Originally planned for {d}', { d: formatDate(task.original_date, locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}</p>}
              {task.reschedule_history.map((h, i) => (
                <p key={i}>
                  {h.from ?? '—'} → {h.to ?? '—'}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {task ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  if (await confirmDialog({ title: t('Delete this task?'), destructive: true, confirmLabel: t('Delete') })) {
                    await remove('tasks', task.id);
                    closeTaskDialog();
                  }
                }}
              >
                <Trash2 /> {t('Delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={closeTaskDialog}>
                {t('Cancel')}
              </Button>
              <Button type="submit" variant="bronze" data-testid="task-save">
                {t('Save')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
