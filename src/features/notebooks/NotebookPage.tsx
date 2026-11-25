import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, ChevronRight, FilePlus, FileDown, FolderPlus, MoreHorizontal, Star, Trash2, CornerDownRight } from 'lucide-react';
import { byPosition, useAll, useRow, useWhere } from '@/data/hooks';
import { insert, remove, update } from '@/data/repo';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { confirmDialog, EmptyState, Spinner } from '@/components/ui/misc';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { TagInput } from '@/components/shared/TagInput';
import { BlockEditor } from '@/components/shared/BlockEditor';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { NOTEBOOK_CATEGORIES } from './NotebooksPage';
import type { Notebook, Row } from '@/types/models';

function PageTree({ notebookId, activePage }: { notebookId: string; activePage?: string }) {
  const t = useT();
  const nav = useNavigate();
  const sections = useWhere('notebook_sections', 'notebook_id', notebookId);
  const pages = useWhere('notebook_pages', 'notebook_id', notebookId);
  const sortedSections = useMemo(() => [...sections].sort(byPosition), [sections]);
  const [showArchived, setShowArchived] = useState(false);

  const addPage = async (sectionId: string, parent: string | null = null) => {
    const siblings = pages.filter((p) => p.section_id === sectionId && p.parent_page_id === parent);
    const p = await insert('notebook_pages', { notebook_id: notebookId, section_id: sectionId, parent_page_id: parent, title: '', position: (Math.max(0, ...siblings.map((s) => s.position)) || 0) + 1000 });
    nav(`/notebooks/${notebookId}/${p.id}`);
  };
  const addSection = async () => {
    const title = window.prompt(t('Section name'));
    if (!title?.trim()) return;
    await insert('notebook_sections', { notebook_id: notebookId, title: title.trim(), position: (sortedSections[sortedSections.length - 1]?.position ?? 0) + 1000 });
  };

  const renderPages = (sectionId: string, parent: string | null, depth: number): React.ReactNode =>
    pages
      .filter((p) => p.section_id === sectionId && p.parent_page_id === parent && (showArchived || !p.archived_at))
      .sort(byPosition)
      .map((p) => (
        <div key={p.id}>
          <div className={cn('group flex items-center rounded-md hover:bg-accent', activePage === p.id && 'bg-accent')} style={{ paddingInlineStart: depth * 14 }}>
            <Link to={`/notebooks/${notebookId}/${p.id}`} className={cn('flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-sm', p.archived_at && 'text-muted-foreground')}>
              {depth > 0 && <CornerDownRight className="size-3 shrink-0 text-muted-foreground" />}
              <span className="truncate">{p.title || t('Untitled page')}</span>
              {p.is_favorite && <Star className="size-3 shrink-0 fill-bronze text-bronze" />}
            </Link>
            {depth < 3 && (
              <button onClick={() => void addPage(sectionId, p.id)} className="rounded p-1.5 text-muted-foreground opacity-60 hover:bg-background md:opacity-0 md:group-hover:opacity-100" aria-label={t('Add subpage')}>
                <FilePlus className="size-3.5" />
              </button>
            )}
          </div>
          {renderPages(sectionId, p.id, depth + 1)}
        </div>
      ));

  return (
    <div className="space-y-3">
      {sortedSections.map((s) => (
        <div key={s.id}>
          <div className="group flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground rtl:rotate-180" />
            <span className="flex-1 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.title}</span>
            <button onClick={() => void addPage(s.id)} className="rounded p-1.5 text-muted-foreground hover:bg-accent" aria-label={t('Add page')} data-testid="add-page">
              <FilePlus className="size-3.5" />
            </button>
            <Menu>
              <MenuTrigger asChild>
                <button className="rounded p-1.5 text-muted-foreground hover:bg-accent" aria-label={t('Section actions')}>
                  <MoreHorizontal className="size-3.5" />
                </button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem
                  onSelect={() => {
                    const title = window.prompt(t('Rename section'), s.title);
                    if (title?.trim()) void update('notebook_sections', s.id, { title: title.trim() });
                  }}
                >
                  {t('Rename')}
                </MenuItem>
                <MenuItem
                  destructive
                  onSelect={async () => {
                    if (await confirmDialog({ title: t('Delete section "{s}" and its pages?', { s: s.title }), destructive: true, confirmLabel: t('Delete') })) {
                      for (const p of pages.filter((x) => x.section_id === s.id)) await remove('notebook_pages', p.id);
                      await remove('notebook_sections', s.id);
                    }
                  }}
                >
                  {t('Delete')}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
          <div className="mt-1">{renderPages(s.id, null, 0)}</div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={() => void addSection()}>
          <FolderPlus /> {t('Section')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
          <Archive /> {showArchived ? t('Hide archived') : t('Show archived')}
        </Button>
      </div>
    </div>
  );
}

function PageEditor({ page }: { page: Row<'notebook_pages'> }) {
  const t = useT();
  const nav = useNavigate();
  const projects = useAll('projects');
  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <input
          key={page.id}
          defaultValue={page.title}
          onBlur={(e) => e.target.value !== page.title && void update('notebook_pages', page.id, { title: e.target.value })}
          placeholder={t('Untitled page')}
          className="min-w-0 flex-1 bg-transparent font-serif text-2xl font-semibold outline-none md:text-3xl"
          dir="auto"
          data-testid="page-title"
        />
        <Button variant="ghost" size="icon" onClick={() => void update('notebook_pages', page.id, { is_favorite: !page.is_favorite })} aria-label={t('Favorite')} aria-pressed={page.is_favorite}>
          <Star className={cn(page.is_favorite && 'fill-bronze text-bronze')} />
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('Page actions')}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => nav(`/print/page/${page.id}`)}>
              <FileDown /> {t('Export page PDF')}
            </MenuItem>
            <MenuItem onSelect={() => void update('notebook_pages', page.id, { archived_at: page.archived_at ? null : new Date().toISOString() })}>
              {page.archived_at ? <ArchiveRestore /> : <Archive />} {page.archived_at ? t('Unarchive') : t('Archive')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              destructive
              onSelect={async () => {
                if (await confirmDialog({ title: t('Delete this page?'), destructive: true, confirmLabel: t('Delete') })) {
                  await remove('notebook_pages', page.id);
                  nav(`/notebooks/${page.notebook_id}`);
                }
              }}
            >
              <Trash2 /> {t('Delete page')}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_12rem]">
        <TagInput value={page.tags} onChange={(tags) => void update('notebook_pages', page.id, { tags })} />
        <NativeSelect value={page.project_id ?? ''} onChange={(e) => void update('notebook_pages', page.id, { project_id: e.target.value || null })} aria-label={t('Project')}>
          <option value="">{t('No project')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      {page.archived_at && <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t('This page is archived.')}</p>}
      <BlockEditor table="notes" parentKey="page_id" parentId={page.id} onTextChange={(text) => void update('notebook_pages', page.id, { plain_text: text.slice(0, 20000) })} />
    </div>
  );
}

export default function NotebookPage() {
  const { id, pageId } = useParams();
  const t = useT();
  const nav = useNavigate();
  const nb = useRow('notebooks', id);
  const page = useRow('notebook_pages', pageId);

  if (!nb) return <div className="grid min-h-[40vh] place-items-center">{id ? <Spinner /> : <EmptyState title={t('Notebook not found')} />}</div>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => (pageId ? nav(`/notebooks/${nb.id}`) : nav('/notebooks'))} aria-label={t('Back')} className={cn(pageId && 'md:hidden')}>
          <ArrowLeft className="rtl:rotate-180" />
        </Button>
        <Link to="/notebooks" className="hidden text-sm text-muted-foreground hover:text-foreground md:inline">
          {t('Notebooks')} /
        </Link>
        <input
          key={nb.id}
          defaultValue={nb.title}
          onBlur={(e) => e.target.value.trim() && e.target.value !== nb.title && void update('notebooks', nb.id, { title: e.target.value.trim() })}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
          aria-label={t('Notebook title')}
        />
        <NativeSelect value={nb.category} onChange={(e) => void update('notebooks', nb.id, { category: e.target.value as Notebook['category'] })} className="h-9 w-36" aria-label={t('Category')}>
          {NOTEBOOK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </NativeSelect>
        <Button variant="ghost" size="icon" onClick={() => void update('notebooks', nb.id, { is_favorite: !nb.is_favorite })} aria-label={t('Favorite')}>
          <Star className={cn(nb.is_favorite && 'fill-bronze text-bronze')} />
        </Button>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('Notebook actions')}>
              <MoreHorizontal />
            </Button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => nav(`/print/notebook/${nb.id}`)}>
              <FileDown /> {t('Export notebook PDF')}
            </MenuItem>
            <MenuItem onSelect={() => void update('notebooks', nb.id, { archived_at: nb.archived_at ? null : new Date().toISOString() })}>
              {nb.archived_at ? t('Unarchive notebook') : t('Archive notebook')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              destructive
              onSelect={async () => {
                if (await confirmDialog({ title: t('Delete notebook "{s}"?', { s: nb.title }), body: t('All sections and pages will be deleted.'), destructive: true, confirmLabel: t('Delete') })) {
                  await remove('notebooks', nb.id);
                  nav('/notebooks');
                }
              }}
            >
              {t('Delete notebook')}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
        <div className={cn('md:block', pageId && 'hidden')}>
          <PageTree notebookId={nb.id} activePage={pageId} />
        </div>
        <div className={cn(!pageId && 'hidden md:block')}>
          {page ? <PageEditor page={page} /> : <EmptyState title={t('Select or create a page')} />}
        </div>
      </div>
    </div>
  );
}
