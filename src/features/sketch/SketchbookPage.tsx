import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PenTool, Plus, Star } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Input, NativeSelect } from '@/components/ui/input';
import { useT, useLocale } from '@/i18n';
import { useSettings, useToday } from '@/stores/settings';
import { createSketch } from './sketchActions';
import { DrawingThumb } from './DrawingThumb';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Paper } from '@/types/models';

export default function SketchbookPage() {
  const t = useT();
  const locale = useLocale();
  const nav = useNavigate();
  const today = useToday();
  const settings = useSettings();
  const [paper, setPaper] = useState<Paper>(settings.default_paper);
  const [q, setQ] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const drawings = useAll('drawings', (d) => d.kind !== 'block');
  const list = useMemo(
    () =>
      drawings
        .filter((d) => (!favOnly || d.is_favorite) && (!q || (d.title ?? '').toLowerCase().includes(q.toLowerCase()) || d.tags.some((x) => x.includes(q.toLowerCase()))))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [drawings, q, favOnly],
  );

  const create = async () => {
    const d = await createSketch({ date: today, paper });
    nav(`/sketchbook/${d.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t('Sketchbook')}
        subtitle={t('Handwriting and sketches stored as editable vector ink.')}
        actions={
          <>
            <NativeSelect value={paper} onChange={(e) => setPaper(e.target.value as Paper)} className="w-28" aria-label={t('Paper')}>
              <option value="blank">{t('Blank')}</option>
              <option value="lined">{t('Lined')}</option>
              <option value="grid">{t('Grid')}</option>
              <option value="dotted">{t('Dotted')}</option>
            </NativeSelect>
            <Button variant="bronze" onClick={create} data-testid="new-sketch">
              <Plus /> {t('New page')}
            </Button>
          </>
        }
      />
      <div className="mb-4 flex gap-2">
        <Input placeholder={t('Search sketches…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant={favOnly ? 'secondary' : 'outline'} size="icon" onClick={() => setFavOnly((v) => !v)} aria-label={t('Favorites only')}>
          <Star className={cn(favOnly && 'fill-bronze text-bronze')} />
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={PenTool} title={t('No sketches yet')} description={t('Create a page and write with your S Pen, finger, or mouse.')} action={<Button onClick={create}>{t('New page')}</Button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((d) => (
            <Link key={d.id} to={`/sketchbook/${d.id}`} className="group overflow-hidden rounded-lg border bg-card hover:border-bronze/60">
              <DrawingThumb drawing={d} className="block" />
              <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.title || t('Untitled')}</p>
                  <p className="text-xs text-muted-foreground">{d.date ? formatDate(d.date, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : t(d.kind === 'handwriting' ? 'Handwriting' : 'Sketch')}</p>
                </div>
                {d.is_favorite && <Star className="size-4 shrink-0 fill-bronze text-bronze" />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
