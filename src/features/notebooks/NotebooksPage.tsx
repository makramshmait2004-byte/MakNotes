import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, NotebookPen, Plus, Star } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { insert } from '@/data/repo';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Notebook } from '@/types/models';

export const NOTEBOOK_CATEGORIES: Notebook['category'][] = ['work', 'business', 'programming', 'learning', 'personal', 'meetings', 'ideas', 'other'];

export async function createNotebook(title: string, category: Notebook['category'], description?: string) {
  const nb = await insert('notebooks', { title, category, description: description || null, position: Date.now() });
  const section = await insert('notebook_sections', { notebook_id: nb.id, title: 'General', position: 1000 });
  const page = await insert('notebook_pages', { notebook_id: nb.id, section_id: section.id, title: '', position: 1000 });
  return { nb, section, page };
}

export default function NotebooksPage() {
  const t = useT();
  const nav = useNavigate();
  const notebooks = useAll('notebooks');
  const pages = useAll('notebook_pages');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'personal' as Notebook['category'], description: '' });

  const list = useMemo(
    () =>
      notebooks
        .filter((n) => (showArchived ? !!n.archived_at : !n.archived_at) && (!cat || n.category === cat) && (!q || n.title.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.position - b.position),
    [notebooks, q, cat, showArchived],
  );

  const pageMatches = useMemo(() => {
    if (q.length < 2) return [];
    const needle = q.toLowerCase();
    return pages.filter((p) => !p.archived_at && (`${p.title} ${p.plain_text} ${p.tags.join(' ')}`.toLowerCase().includes(needle))).slice(0, 20);
  }, [pages, q]);

  const create = async () => {
    if (!form.title.trim()) return;
    const { nb, page } = await createNotebook(form.title.trim(), form.category, form.description);
    setOpen(false);
    setForm({ title: '', category: 'personal', description: '' });
    nav(`/notebooks/${nb.id}/${page.id}`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('Notebooks')}
        actions={
          <Button variant="bronze" onClick={() => setOpen(true)} data-testid="new-notebook">
            <Plus /> {t('New notebook')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder={t('Search notebooks and pages…')} value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[12rem] flex-1" />
        <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)} className="w-40" aria-label={t('Category')}>
          <option value="">{t('All categories')}</option>
          {NOTEBOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </NativeSelect>
        <Button variant={showArchived ? 'secondary' : 'outline'} onClick={() => setShowArchived((v) => !v)}>
          <Archive /> {t('Archived')}
        </Button>
      </div>

      {pageMatches.length > 0 && (
        <div className="mb-6 rounded-lg border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Matching pages')}</p>
          {pageMatches.map((p) => (
            <Link key={p.id} to={`/notebooks/${p.notebook_id}/${p.id}`} className="block rounded px-2 py-1.5 text-sm hover:bg-accent">
              {p.title || t('Untitled page')} <span className="text-muted-foreground">— {notebooks.find((n) => n.id === p.notebook_id)?.title}</span>
            </Link>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState icon={NotebookPen} title={showArchived ? t('No archived notebooks') : t('No notebooks yet')} description={t('Organize notes into notebooks, sections, pages and subpages.')} action={!showArchived && <Button onClick={() => setOpen(true)}>{t('New notebook')}</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((n) => (
            <Link key={n.id} to={`/notebooks/${n.id}`} className="group flex gap-3 rounded-lg border bg-card p-4 hover:border-bronze/50" data-testid="notebook-card">
              <div className="w-1.5 shrink-0 rounded-full bg-bronze/70" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-serif text-lg font-medium">{n.title}</p>
                  {n.is_favorite && <Star className="size-4 shrink-0 fill-bronze text-bronze" />}
                </div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t(n.category)}</p>
                {n.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.description}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{t('{n} pages', { n: pages.filter((p) => p.notebook_id === n.id).length })}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('New notebook')}>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('Notebook title')} data-testid="notebook-title" />
            <Field label={t('Category')}>
              <NativeSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Notebook['category'] })}>
                {NOTEBOOK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('Description (optional)')} rows={2} />
            <Button type="submit" variant="bronze" className={cn('justify-self-end')}>
              {t('Create')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
