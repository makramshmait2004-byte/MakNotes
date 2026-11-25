import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { insert } from '@/data/repo';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useLocale, useT } from '@/i18n';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/models';

export const PROJECT_STATUSES: Project['status'][] = ['active', 'paused', 'completed', 'archived'];

export default function ProjectsPage() {
  const t = useT();
  const locale = useLocale();
  const nav = useNavigate();
  const projects = useAll('projects');
  const tasks = useAll('tasks', (x) => !!x.project_id);
  const [status, setStatus] = useState<Project['status']>('active');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', description: '', due_date: '' });

  const list = useMemo(() => projects.filter((p) => p.status === status).sort((a, b) => a.position - b.position), [projects, status]);

  const create = async () => {
    if (!f.title.trim()) return;
    const p = await insert('projects', { title: f.title.trim(), description: f.description || null, due_date: f.due_date || null, position: Date.now() });
    setOpen(false);
    setF({ title: '', description: '', due_date: '' });
    nav(`/projects/${p.id}`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('Projects')}
        actions={
          <Button variant="bronze" onClick={() => setOpen(true)} data-testid="new-project">
            <Plus /> {t('New project')}
          </Button>
        }
      />
      <div className="mb-4 flex gap-1 overflow-x-auto no-scrollbar">
        {PROJECT_STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cn('h-9 shrink-0 rounded-md px-3 text-sm', status === s ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-accent')}>
            {t(s[0].toUpperCase() + s.slice(1))} <span className="text-xs text-muted-foreground">{projects.filter((p) => p.status === s).length}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={FolderKanban} title={t('No projects')} description={t('Projects connect related tasks, notes, goals and events.')} action={<Button onClick={() => setOpen(true)}>{t('New project')}</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const pt = tasks.filter((x) => x.project_id === p.id);
            const done = pt.filter((x) => x.status === 'done').length;
            const pct = pt.length ? Math.round((done / pt.length) * 100) : 0;
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="rounded-lg border bg-card p-4 hover:border-bronze/50">
                <p className="font-medium">{p.title}</p>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-3 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-bronze" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{t('{d}/{n} tasks', { d: done, n: pt.length })}</span>
                  {p.due_date && <span>{formatDate(p.due_date, locale, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('New project')}>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t('Project name')} data-testid="project-title" />
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={t('Description')} rows={2} />
            <Field label={t('Deadline')}>
              <Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
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
