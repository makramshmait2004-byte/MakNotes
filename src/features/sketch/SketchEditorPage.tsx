import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, Trash2 } from 'lucide-react';
import { useRow, useWhere } from '@/data/hooks';
import { remove, update } from '@/data/repo';
import { useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { confirmDialog, EmptyState, Spinner } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { DrawingCanvas } from './DrawingCanvas';
import { uploadPreview } from './preview';

export default function SketchEditorPage() {
  const { id } = useParams();
  const drawing = useRow('drawings', id);
  const strokes = useWhere('drawing_strokes', 'drawing_id', id);
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();

  // Save a PNG preview to private storage when leaving the editor.
  useEffect(() => {
    return () => {
      if (drawing) void uploadPreview(drawing.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing?.id]);

  if (drawing === undefined) {
    return (
      <div className="grid h-dvh place-items-center">
        {id ? <Spinner /> : <EmptyState title={t('Drawing not found')} />}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background md:static md:h-dvh">
      <header className="flex items-center gap-2 border-b px-2 py-1.5 pt-safe">
        <button onClick={() => (history.length > 1 ? nav(-1) : nav('/sketchbook'))} className="grid size-10 place-items-center rounded-md hover:bg-accent" aria-label={t('Back')}>
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </button>
        <input
          defaultValue={drawing.title ?? ''}
          key={drawing.id}
          onBlur={(e) => e.target.value !== (drawing.title ?? '') && void update('drawings', drawing.id, { title: e.target.value || null })}
          placeholder={t('Untitled')}
          className="min-w-0 flex-1 bg-transparent font-serif text-lg font-semibold outline-none"
          aria-label={t('Title')}
        />
        <span className="hidden text-xs text-muted-foreground sm:inline">{t('{n} strokes', { n: strokes.length })}</span>
        <button
          onClick={() => void update('drawings', drawing.id, { is_favorite: !drawing.is_favorite })}
          className="grid size-10 place-items-center rounded-md hover:bg-accent"
          aria-label={t('Favorite')}
          aria-pressed={drawing.is_favorite}
        >
          <Star className={cn('size-5', drawing.is_favorite && 'fill-bronze text-bronze')} />
        </button>
        <button
          onClick={async () => {
            if (await confirmDialog({ title: t('Delete this drawing?'), body: t('It will be removed from all your devices.'), destructive: true, confirmLabel: t('Delete') })) {
              await remove('drawings', drawing.id);
              nav('/sketchbook');
            }
          }}
          className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label={t('Delete')}
        >
          <Trash2 className="size-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <DrawingCanvas drawing={drawing} mode="full" defaultPenOnly={settings.pen_only} />
      </div>
    </div>
  );
}
