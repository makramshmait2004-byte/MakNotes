import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useRow, useWhere } from '@/data/hooks';
import { remove, update } from '@/data/repo';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { confirmDialog, EmptyState, Spinner } from '@/components/ui/misc';
import { RichText } from '@/components/shared/RichText';
import { TaskItem } from '@/features/tasks/TaskItem';
import { openEventDialog, openTaskDialog } from '@/stores/ui';
import { useLocale, useT } from '@/i18n';
import { formatDate } from '@/lib/dates';
import { PROJECT_STATUSES } from './ProjectsPage';
import type { Project } from '@/types/models';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const t = useT();
  const locale = useLocale();
  const nav = useNavigate();
  const project = useRow('projects', id);
  const tasks = useWhere('tasks', 'project_id', id);
  const goals = useWhere('goals', 'project_id', id);
  const pages = useWhere('notebook_pages', 'project_id', id);
  const events = useWhere('calendar_events', 'project_id', id);

  if (!project) return <div className="grid min-h-[40vh] place-items-center">{id ? <Spinner /> : <EmptyState title={t('Project not found')} />}</div>;
  const set = (patch: Partial<Project>) => void update('projects', project.id, patch);
  const open = tasks.filter((x) => x.status === 'todo').sort((a, b) => a.position - b.position);
  const done = tasks.filter((x) => x.status === 'done');

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav('/projects')} aria-label={t('Back')}>
          <ArrowLeft className="rtl:rotate-180" />
        </Button>
        <input key={project.id} defaultValue={project.title} onBlur={(e) => e.target.value.trim() && e.target.value !== project.title && set({ title: e.target.value.trim() })} className="min-w-0 flex-1 bg-transparent font-serif text-2xl font-semibold outline-none" aria-label={t('Title')} />
        <Button variant="ghost" size="icon" aria-label={t('Delete')} onClick={async () => (await confirmDialog({ title: t('Delete this project?'), body: t('Tasks and pages stay, but are unlinked.'), destructive: true, confirmLabel: t('Delete') })) && (await remove('projects', project.id), nav('/projects'))}>
          <Trash2 />
        </Button>
      </div>
      <div className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <Field label={t('Status')}>
          <NativeSelect value={project.status} onChange={(e) => set({ status: e.target.value as Project['status'] })}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(s[0].toUpperCase() + s.slice(1))}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('Deadline')}>
          <Input type="date" value={project.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value || null })} />
        </Field>
        <Field label={t('Progress')}>
          <p className="py-2 text-sm tabular-nums">{tasks.length ? `${Math.round((done.length / tasks.length) * 100)}% · ${done.length}/${tasks.length}` : '—'}</p>
        </Field>
        <Field label={t('Description')} className="sm:col-span-3">
          <Input key={project.id} defaultValue={project.description ?? ''} onBlur={(e) => e.target.value !== (project.description ?? '') && set({ description: e.target.value || null })} />
        </Field>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Tasks')}</h2>
            <Button variant="ghost" size="sm" onClick={() => openTaskDialog(undefined, { project_id: project.id })}>
              <Plus /> {t('Add task')}
            </Button>
          </div>
          <div className="rounded-lg border bg-card p-2">
            {open.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t('No open tasks.')}</p>}
            {open.map((x) => (
              <TaskItem key={x.id} task={x} />
            ))}
            {done.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer px-2 text-xs text-muted-foreground">{t('{n} completed', { n: done.length })}</summary>
                {done.map((x) => (
                  <TaskItem key={x.id} task={x} />
                ))}
              </details>
            )}
          </div>
        </section>
        <section className="space-y-6">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Goals')}</h2>
            <div className="rounded-lg border bg-card p-2">
              {goals.length === 0 ? <p className="p-2 text-sm text-muted-foreground">{t('Link goals to this project from the goal page.')}</p> : goals.map((g) => (
                <Link key={g.id} to={`/goals/${g.id}`} className="flex justify-between rounded px-2 py-1.5 text-sm hover:bg-accent">
                  <span>{g.title}</span>
                  <span className="text-muted-foreground">{g.progress}%</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Notes')}</h2>
            <div className="rounded-lg border bg-card p-2">
              {pages.length === 0 ? <p className="p-2 text-sm text-muted-foreground">{t('Link notebook pages to this project from the page header.')}</p> : pages.map((p) => (
                <Link key={p.id} to={`/notebooks/${p.notebook_id}/${p.id}`} className="block rounded px-2 py-1.5 text-sm hover:bg-accent">
                  {p.title || t('Untitled page')}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Events')}</h2>
              <Button variant="ghost" size="sm" onClick={() => openEventDialog(undefined, { project_id: project.id })}>
                <Plus /> {t('Event')}
              </Button>
            </div>
            <div className="rounded-lg border bg-card p-2">
              {events.length === 0 ? <p className="p-2 text-sm text-muted-foreground">—</p> : events.sort((a, b) => a.start_date.localeCompare(b.start_date)).map((e) => (
                <button key={e.id} onClick={() => openEventDialog(e.id)} className="flex w-full justify-between rounded px-2 py-1.5 text-start text-sm hover:bg-accent">
                  <span>{e.title}</span>
                  <span className="text-muted-foreground">{formatDate(e.start_date, locale, { day: 'numeric', month: 'short' })}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Project notes')}</h2>
      <RichText value={project.notes} onChange={(doc) => set({ notes: doc })} placeholder={t('Plan, decisions, links…')} />
    </div>
  );
}
