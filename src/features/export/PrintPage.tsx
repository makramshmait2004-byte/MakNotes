import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useDb } from '@/data/hooks';
import { getDb, type MakDB } from '@/data/db';
import { docToHtml } from '@/components/shared/RichText';
import { AttachmentFile, AttachmentImage } from '@/components/shared/Attachments';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/misc';
import { useLocale, useT } from '@/i18n';
import { formatDate } from '@/lib/dates';
import { renderDrawing } from '@/features/sketch/engine/render';
import type { ContentBlock, Row } from '@/types/models';

function DrawingImage({ drawingId }: { drawingId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const db = getDb();
      const d = await db.drawings.get(drawingId);
      if (!d) return;
      const strokes = (await db.drawing_strokes.where('drawing_id').equals(drawingId).toArray()).filter((s) => !s.deleted_at).sort((a, b) => a.seq - b.seq);
      // crop to the written area so blank paper doesn't fill pages
      let maxY = 200;
      for (const s of strokes) for (let i = 1; i < s.points.length; i += 3) maxY = Math.max(maxY, s.points[i] + 40);
      setSrc(renderDrawing(strokes, { width: d.width, height: Math.min(d.height, maxY), paper: d.paper, scale: 1.5 }).toDataURL('image/png'));
    })();
  }, [drawingId]);
  return src ? <img src={src} alt="" className="w-full rounded border" /> : null;
}

function Blocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((b) => (
        <div key={b.id} className="break-inside-avoid">
          {(b.kind === 'text' || b.kind === 'checklist') && <div className="ProseMirror" dir="auto" dangerouslySetInnerHTML={{ __html: docToHtml(b.content) }} />}
          {b.kind === 'drawing' && b.drawing_id && <DrawingImage drawingId={b.drawing_id} />}
          {b.kind === 'image' && <AttachmentImage attachmentId={b.attachment_id} className="max-h-[60vh] w-full object-contain" />}
          {b.kind === 'file' && <AttachmentFile attachmentId={b.attachment_id} />}
        </div>
      ))}
    </div>
  );
}

const alive = <T extends { deleted_at: string | null }>(xs: T[]) => xs.filter((x) => !x.deleted_at);
const sortBlocks = <T extends { position: number }>(xs: T[]) => [...xs].sort((a, b) => a.position - b.position);

async function journalBlocks(db: MakDB, entryId: string) {
  return sortBlocks(alive(await db.journal_blocks.where('journal_entry_id').equals(entryId).toArray()));
}

function JournalEntryView({ entry }: { entry: Row<'journal_entries'> }) {
  const locale = useLocale();
  const t = useT();
  const blocks = useDb((db) => journalBlocks(db, entry.id), [entry.id], [] as Row<'journal_blocks'>[]);
  return (
    <article className="mb-8 break-inside-avoid-page">
      <p className="text-xs uppercase tracking-wider text-neutral-500">{formatDate(entry.entry_date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <h2 className="mb-2 font-serif text-2xl font-semibold">{entry.title || t('Untitled entry')}</h2>
      {(entry.mood || entry.tags.length > 0) && (
        <p className="mb-3 text-xs text-neutral-500">
          {entry.mood ? `${t('Mood')} ${entry.mood}/5 ` : ''}
          {entry.tags.map((x) => `#${x}`).join(' ')}
        </p>
      )}
      <Blocks blocks={blocks} />
    </article>
  );
}

function DayView({ date }: { date: string }) {
  const t = useT();
  const locale = useLocale();
  const data = useDb(
    async (db) => {
      const page = await db.daily_pages.where('date').equals(date).first();
      const prios = page ? sortBlocks(alive(await db.daily_priorities.where('daily_page_id').equals(page.id).toArray())) : [];
      const refl = page ? alive(await db.daily_reflections.where('daily_page_id').equals(page.id).toArray()) : [];
      const tasks = alive(await db.tasks.where('scheduled_date').equals(date).toArray());
      const events = alive(await db.calendar_events.toArray()).filter((e) => e.start_date <= date && (e.end_date ?? e.start_date) >= date);
      const entries = alive(await db.journal_entries.where('entry_date').equals(date).toArray());
      const habits = alive(await db.habits.toArray());
      const logs = alive(await db.habit_logs.where('date').equals(date).toArray());
      return { page, prios, refl, tasks, events, entries, habits, logs };
    },
    [date],
    null,
  );
  if (!data) return <Spinner />;
  const { page } = data;
  const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 mt-6 border-b pb-1 text-sm font-semibold uppercase tracking-wider">{children}</h3>;
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">{formatDate(date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h1>
      {(page?.mood || page?.energy) && <p className="text-sm text-neutral-500">{page?.mood ? `${t('Mood')} ${page.mood}/5  ` : ''}{page?.energy ? `${t('Energy')} ${page.energy}/5` : ''}</p>}
      {data.prios.some((p) => p.text) && (
        <>
          <H>{t('Top 3 priorities')}</H>
          <ol className="list-decimal ps-6">{data.prios.filter((p) => p.text).map((p) => <li key={p.id} className={p.done ? 'line-through' : ''}>{p.text}</li>)}</ol>
        </>
      )}
      {(data.events.length > 0 || data.tasks.length > 0) && (
        <>
          <H>{t('Schedule & tasks')}</H>
          <ul className="space-y-1">
            {data.events.map((e) => <li key={e.id}>{e.all_day ? t('All day') : `${e.start_time ?? ''}${e.end_time ? `–${e.end_time}` : ''}`} — {e.title}</li>)}
            {data.tasks.map((x) => <li key={x.id}>{x.status === 'done' ? '☑' : '☐'} {x.scheduled_time ? `${x.scheduled_time} ` : ''}{x.title}</li>)}
          </ul>
        </>
      )}
      {page?.morning_plan && (
        <>
          <H>{t('Morning planning')}</H>
          <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: docToHtml(page.morning_plan) }} />
        </>
      )}
      {page?.quick_notes && (
        <>
          <H>{t('Quick notes')}</H>
          <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: docToHtml(page.quick_notes) }} />
        </>
      )}
      {page?.handwriting_id && (
        <>
          <H>{t('Handwriting')}</H>
          <DrawingImage drawingId={page.handwriting_id} />
        </>
      )}
      {data.logs.length > 0 && (
        <>
          <H>{t('Habits')}</H>
          <p>{data.logs.map((l) => `${data.habits.find((h) => h.id === l.habit_id)?.name ?? ''} (${t(l.status)})`).join(' · ')}</p>
        </>
      )}
      {data.refl.map((r) => (
        <div key={r.id}>
          <H>{t(r.kind === 'morning' ? 'Morning reflection' : r.kind === 'weekly' ? 'Sunday review' : 'Evening reflection')}</H>
          {Object.entries(r.answers).filter(([, a]) => a).map(([q, a]) => (
            <div key={q} className="mb-2">
              <p className="text-sm font-medium">{t(q)}</p>
              <p className="whitespace-pre-wrap" dir="auto">{a}</p>
            </div>
          ))}
        </div>
      ))}
      {data.entries.length > 0 && (
        <>
          <H>{t('Journal')}</H>
          {data.entries.map((e) => <JournalEntryView key={e.id} entry={e} />)}
        </>
      )}
    </div>
  );
}

function PageView({ pageId, heading }: { pageId: string; heading?: number }) {
  const t = useT();
  const data = useDb(async (db) => ({ page: await db.notebook_pages.get(pageId), notes: sortBlocks(alive(await db.notes.where('page_id').equals(pageId).toArray())) }), [pageId], null);
  if (!data?.page) return null;
  const Tag = heading === 3 ? 'h3' : 'h2';
  return (
    <section className="mb-8">
      <Tag className="mb-3 font-serif text-2xl font-semibold">{data.page.title || t('Untitled page')}</Tag>
      <Blocks blocks={data.notes} />
    </section>
  );
}

function NotebookView({ id }: { id: string }) {
  const t = useT();
  const data = useDb(
    async (db) => ({
      nb: await db.notebooks.get(id),
      sections: sortBlocks(alive(await db.notebook_sections.where('notebook_id').equals(id).toArray())),
      pages: alive(await db.notebook_pages.where('notebook_id').equals(id).toArray()).filter((p) => !p.archived_at),
    }),
    [id],
    null,
  );
  const ordered = useMemo(() => {
    if (!data) return [];
    const out: { section: string; page: Row<'notebook_pages'>; depth: number }[] = [];
    const walk = (sectionId: string, parent: string | null, depth: number) => sortBlocks(data.pages.filter((p) => p.section_id === sectionId && p.parent_page_id === parent)).forEach((p) => (out.push({ section: sectionId, page: p, depth }), walk(sectionId, p.id, depth + 1)));
    data.sections.forEach((s) => walk(s.id, null, 0));
    return out;
  }, [data]);
  if (!data?.nb) return <Spinner />;
  return (
    <div>
      <h1 className="mb-1 font-serif text-4xl font-semibold">{data.nb.title}</h1>
      {data.nb.description && <p className="mb-6 text-neutral-500">{data.nb.description}</p>}
      {data.sections.map((s) => (
        <div key={s.id}>
          <h2 className="mb-4 mt-8 border-b pb-1 text-sm font-semibold uppercase tracking-widest">{s.title}</h2>
          {ordered.filter((o) => o.section === s.id).map((o) => <PageView key={o.page.id} pageId={o.page.id} heading={o.depth ? 3 : 2} />)}
        </div>
      ))}
      {ordered.length === 0 && <p>{t('This notebook is empty.')}</p>}
    </div>
  );
}

/** Print-optimized view; "Save as PDF" in the system print dialog produces the PDF (works on Android Chrome). */
export default function PrintPage() {
  const { kind, id } = useParams();
  const t = useT();
  const nav = useNavigate();
  const entry = useDb(async (db) => (kind === 'journal' && id ? db.journal_entries.get(id) : undefined), [kind, id], undefined);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    return () => {
      try {
        const cached = JSON.parse(localStorage.getItem('maknotes-settings') || '{}');
        if (cached.theme !== 'light') document.documentElement.classList.add('dark');
      } catch {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b bg-white/95 px-4 py-2">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label={t('Back')} className="text-neutral-900 hover:bg-neutral-100">
          <ArrowLeft className="rtl:rotate-180" />
        </Button>
        <span className="flex-1 text-sm text-neutral-600">{t('Use "Save as PDF" as the printer to download a PDF.')}</span>
        <Button onClick={() => window.print()} className="bg-neutral-900 text-white hover:bg-neutral-800" data-testid="print-button">
          <Printer /> {t('Save as PDF')}
        </Button>
      </div>
      <main className="mx-auto max-w-3xl px-6 py-8 [&_.ProseMirror]:min-h-0">
        {kind === 'day' && id && <DayView date={id} />}
        {kind === 'journal' && entry && <JournalEntryView entry={entry} />}
        {kind === 'page' && id && <PageView pageId={id} />}
        {kind === 'notebook' && id && <NotebookView id={id} />}
        <p className="mt-12 text-center text-[10px] text-neutral-400">MakNotes · {new Date().toLocaleDateString()}</p>
      </main>
    </div>
  );
}
