import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { openEventDialog, openTaskDialog } from '@/stores/ui';
import { useT } from '@/i18n';

export default function SearchPage() {
  const t = useT();
  const [q, setQ] = useState('');
  const journal = useAll('journal_entries');
  const tasks = useAll('tasks');
  const pages = useAll('notebook_pages');
  const drawings = useAll('drawings', (d) => d.kind !== 'block');
  const events = useAll('calendar_events');
  const goals = useAll('goals');
  const projects = useAll('projects');
  const dayPages = useAll('daily_pages');

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    const has = (...s: (string | null | undefined)[]) => s.some((x) => x?.toLowerCase().includes(n));
    const json = (v: unknown) => (v ? JSON.stringify(v).toLowerCase() : '');
    type R = { key: string; kind: string; title: string; sub?: string; to?: string; onClick?: () => void };
    const out: R[] = [];
    journal.filter((e) => has(e.title, e.plain_text, e.tags.join(' '))).forEach((e) => out.push({ key: e.id, kind: 'Journal', title: e.title || t('Untitled entry'), sub: e.entry_date, to: `/journal/${e.id}` }));
    tasks.filter((x) => has(x.title, x.description, x.tags.join(' '))).forEach((x) => out.push({ key: x.id, kind: 'Task', title: x.title, sub: x.scheduled_date ?? '', onClick: () => openTaskDialog(x.id) }));
    pages.filter((p) => has(p.title, p.plain_text, p.tags.join(' '))).forEach((p) => out.push({ key: p.id, kind: 'Note', title: p.title || t('Untitled page'), to: `/notebooks/${p.notebook_id}/${p.id}` }));
    dayPages.filter((p) => json(p.quick_notes).includes(n) || json(p.morning_plan).includes(n)).forEach((p) => out.push({ key: p.id, kind: 'Day', title: p.date, to: `/day/${p.date}` }));
    drawings.filter((d) => has(d.title, d.tags.join(' '))).forEach((d) => out.push({ key: d.id, kind: 'Sketch', title: d.title || t('Untitled'), to: `/sketchbook/${d.id}` }));
    events.filter((e) => has(e.title, e.description, e.location)).forEach((e) => out.push({ key: e.id, kind: 'Event', title: e.title, sub: e.start_date, onClick: () => openEventDialog(e.id) }));
    goals.filter((g) => has(g.title, g.description)).forEach((g) => out.push({ key: g.id, kind: 'Goal', title: g.title, to: `/goals/${g.id}` }));
    projects.filter((p) => has(p.title, p.description)).forEach((p) => out.push({ key: p.id, kind: 'Project', title: p.title, to: `/projects/${p.id}` }));
    return out.slice(0, 200);
  }, [q, journal, tasks, pages, drawings, events, goals, projects, dayPages, t]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('Search')} />
      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search everything…')} className="mb-4 h-12 text-base" data-testid="global-search" dir="auto" />
      {q.trim().length < 2 ? (
        <EmptyState icon={Search} title={t('Search journal, tasks, notes, sketches, events, goals and projects')} description={t('Works offline — results come from this device.')} />
      ) : results.length === 0 ? (
        <EmptyState title={t('No results')} />
      ) : (
        <div className="rounded-lg border bg-card">
          {results.map((r) => {
            const inner = (
              <>
                <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">{t(r.kind)}</span>
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
              </>
            );
            const cls = 'flex w-full items-center gap-3 border-b px-3 py-2.5 text-start text-sm last:border-0 hover:bg-accent';
            return r.to ? (
              <Link key={r.key} to={r.to} className={cls}>
                {inner}
              </Link>
            ) : (
              <button key={r.key} onClick={r.onClick} className={cls}>
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
