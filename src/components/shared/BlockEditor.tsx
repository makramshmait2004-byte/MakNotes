import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ImagePlus, ListChecks, Paperclip, PenLine, Trash2, Type } from 'lucide-react';
import type { JSONContent } from '@tiptap/react';
import { byPosition, useDb } from '@/data/hooks';
import { insert, remove, update } from '@/data/repo';
import { saveFile } from '@/data/files';
import { getDb } from '@/data/db';
import { useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/misc';
import { DrawingCanvas } from '@/features/sketch/DrawingCanvas';
import { createSketch } from '@/features/sketch/sketchActions';
import { RichText, docToText } from './RichText';
import { AttachmentFile, AttachmentImage } from './Attachments';
import type { BlockKind, JournalBlock, Note, Row } from '@/types/models';

type BlockTable = 'journal_blocks' | 'notes';
type Block = (Row<'journal_blocks'> | Row<'notes'>) & Partial<JournalBlock & Note>;

const EMPTY_CHECKLIST: JSONContent = { type: 'doc', content: [{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] }] };

function DrawingBlock({ drawingId }: { drawingId: string }) {
  const drawing = useDb(async (db) => db.drawings.get(drawingId), [drawingId], undefined);
  const settings = useSettings();
  const nav = useNavigate();
  if (!drawing) return <div className="h-40 animate-pulse rounded-md bg-muted" />;
  return <DrawingCanvas drawing={drawing} mode="embed" defaultPenOnly={settings.pen_only} onExpand={() => nav(`/sketchbook/${drawing.id}`)} />;
}

export function BlockEditor({
  table,
  parentKey,
  parentId,
  onTextChange,
  autoFocusFirst,
}: {
  table: BlockTable;
  parentKey: 'journal_entry_id' | 'page_id';
  parentId: string;
  onTextChange?: (text: string) => void;
  autoFocusFirst?: boolean;
}) {
  const t = useT();
  const settings = useSettings();
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const rows = useDb(
    async (db) => ((await db.table(table).where(parentKey).equals(parentId).toArray()) as Block[]).filter((b) => !b.deleted_at),
    [table, parentKey, parentId],
    [] as Block[],
  );
  const blocks = useMemo(() => [...rows].sort(byPosition), [rows]);

  const recomputeText = async () => {
    if (!onTextChange) return;
    const all = ((await getDb().table(table).where(parentKey).equals(parentId).toArray()) as Block[]).filter((b) => !b.deleted_at).sort(byPosition);
    onTextChange(all.map((b) => docToText(b.content)).filter(Boolean).join('\n\n'));
  };

  const add = async (kind: BlockKind, extra: Partial<Block> = {}) => {
    const position = (blocks[blocks.length - 1]?.position ?? 0) + 1000;
    await insert(table, { [parentKey]: parentId, kind, position, content: kind === 'checklist' ? EMPTY_CHECKLIST : null, ...extra } as never);
  };

  const addDrawing = async () => {
    const d = await createSketch({ kind: 'block', paper: settings.default_paper, height: 700 });
    await add('drawing', { drawing_id: d.id });
  };

  const addFile = async (files: FileList | null, kind: 'image' | 'file') => {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        const att = await saveFile(f, { parentTable: table, parentId });
        await add(kind === 'image' && f.type.startsWith('image/') ? 'image' : 'file', { attachment_id: att.id });
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const a = blocks[i],
      b = blocks[j];
    await update(table, a.id, { position: b.position } as never);
    await update(table, b.id, { position: a.position } as never);
  };

  return (
    <div className="space-y-3">
      {blocks.length === 0 && (
        <RichText
          value={null}
          autoFocus={autoFocusFirst}
          placeholder={t('Start writing…')}
          onChange={async (doc) => {
            await add('text', { content: doc });
            void recomputeText();
          }}
          testId="block-first-text"
        />
      )}
      {blocks.map((b, i) => (
        <div key={b.id} className="group relative" data-block-kind={b.kind}>
          {(b.kind === 'text' || b.kind === 'checklist') && (
            <RichText
              value={b.content}
              placeholder={t('Write…')}
              onChange={async (doc) => {
                await update(table, b.id, { content: doc } as never);
                void recomputeText();
              }}
            />
          )}
          {b.kind === 'drawing' && b.drawing_id && <DrawingBlock drawingId={b.drawing_id} />}
          {b.kind === 'image' && <AttachmentImage attachmentId={b.attachment_id ?? null} />}
          {b.kind === 'file' && <AttachmentFile attachmentId={b.attachment_id ?? null} />}
          <div className="mt-1 flex justify-end gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 md:opacity-0">
            <button onClick={() => void move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label={t('Move up')}>
              <ArrowUp className="size-3.5" />
            </button>
            <button onClick={() => void move(i, 1)} disabled={i === blocks.length - 1} className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label={t('Move down')}>
              <ArrowDown className="size-3.5" />
            </button>
            <button
              onClick={async () => {
                await remove(table, b.id);
                if (b.drawing_id) await remove('drawings', b.drawing_id);
                void recomputeText();
              }}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              aria-label={t('Delete block')}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={() => void add('text')}>
          <Type /> {t('Text')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void addDrawing()} data-testid="add-handwriting">
          <PenLine /> {t('Handwriting')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void add('checklist')}>
          <ListChecks /> {t('Checklist')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => imageInput.current?.click()}>
          <ImagePlus /> {t('Image')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Paperclip /> {t('File')}
        </Button>
        <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => (void addFile(e.target.files, 'image'), (e.target.value = ''))} />
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => (void addFile(e.target.files, 'file'), (e.target.value = ''))} />
      </div>
    </div>
  );
}
