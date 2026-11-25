import { getDb } from '@/data/db';
import { currentUserId, update } from '@/data/repo';
import { renderDrawing } from './engine/render';

/** Render a small PNG preview and queue it for upload to the private drawing-previews bucket. */
export async function uploadPreview(drawingId: string) {
  try {
    const db = getDb();
    const d = await db.drawings.get(drawingId);
    if (!d || d.deleted_at) return;
    const strokes = (await db.drawing_strokes.where('drawing_id').equals(drawingId).toArray()).filter((s) => !s.deleted_at).sort((a, b) => a.seq - b.seq);
    const h = Math.min(d.height, d.width * 1.4);
    const canvas = renderDrawing(strokes, { width: d.width, height: h, paper: d.paper, scale: 0.4 });
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return;
    const path = `${currentUserId()}/${drawingId}.png`;
    await db.files.put({ id: `preview-${drawingId}`, bucket: 'drawing-previews', path, blob, uploaded: 0, attempts: 0 });
    if (d.preview_path !== path) await update('drawings', drawingId, { preview_path: path });
  } catch {
    /* previews are optional */
  }
}
