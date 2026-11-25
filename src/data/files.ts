// File attachments: stored locally first (works offline), uploaded to private Supabase Storage by the sync engine.
import { getDb } from './db';
import { currentUserId, insert, remove } from './repo';
import { newId } from '@/lib/ids';
import { supabase } from '@/lib/supabase';
import type { Attachment, Bucket } from '@/types/models';

const MAX_BYTES: Record<Bucket, number> = {
  'journal-images': 10 * 1024 * 1024,
  attachments: 25 * 1024 * 1024,
  documents: 25 * 1024 * 1024,
  'drawing-previews': 5 * 1024 * 1024,
  'profile-images': 5 * 1024 * 1024,
};

export function bucketFor(file: File | Blob): Bucket {
  const type = file.type || '';
  if (type.startsWith('image/')) return 'journal-images';
  if (type === 'application/pdf' || type.includes('word') || type.includes('sheet') || type.includes('presentation') || type.startsWith('text/'))
    return 'documents';
  return 'attachments';
}

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';

export async function saveFile(
  file: File | Blob,
  opts: { bucket?: Bucket; fileName?: string; parentTable?: string; parentId?: string } = {},
): Promise<Attachment> {
  const bucket = opts.bucket ?? bucketFor(file);
  if (file.size > MAX_BYTES[bucket]) throw new Error(`File is too large (max ${Math.round(MAX_BYTES[bucket] / 1024 / 1024)} MB)`);
  const id = newId();
  const name = opts.fileName ?? (file instanceof File ? file.name : 'file');
  const path = `${currentUserId()}/${id}-${safeName(name)}`;
  const db = getDb();
  await db.files.put({ id, bucket, path, blob: file, uploaded: 0, attempts: 0 });
  return insert('attachments', {
    id,
    bucket,
    path,
    file_name: name,
    mime_type: file.type || null,
    size_bytes: file.size,
    parent_table: opts.parentTable ?? null,
    parent_id: opts.parentId ?? null,
  });
}

const urlCache = new Map<string, { url: string; exp: number }>();

/** Resolve a displayable URL: local blob if present, otherwise a short-lived signed URL. */
export async function fileUrl(att: Pick<Attachment, 'id' | 'bucket' | 'path'>): Promise<string | null> {
  const cached = urlCache.get(att.id);
  if (cached && cached.exp > Date.now()) return cached.url;
  const db = getDb();
  const local = await db.files.get(att.id);
  if (local) {
    const url = URL.createObjectURL(local.blob);
    urlCache.set(att.id, { url, exp: Number.MAX_SAFE_INTEGER });
    return url;
  }
  const { data, error } = await supabase.storage.from(att.bucket).createSignedUrl(att.path, 3600);
  if (error || !data) return null;
  urlCache.set(att.id, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

/** Download the file content (for offline caching / export). */
export async function fileBlob(att: Pick<Attachment, 'id' | 'bucket' | 'path'>): Promise<Blob | null> {
  const db = getDb();
  const local = await db.files.get(att.id);
  if (local) return local.blob;
  const { data, error } = await supabase.storage.from(att.bucket).download(att.path);
  if (error || !data) return null;
  await db.files.put({ id: att.id, bucket: att.bucket, path: att.path, blob: data, uploaded: 1, attempts: 0 });
  return data;
}

export async function deleteFile(att: Attachment) {
  await remove('attachments', att.id);
  const db = getDb();
  await db.files.delete(att.id);
  urlCache.delete(att.id);
  // best effort; the object is in the user's private folder either way
  void supabase.storage.from(att.bucket).remove([att.path]);
}

/** Remove every object in the user's folders (used before account deletion). */
export async function deleteAllUserFiles(userId: string) {
  const buckets: Bucket[] = ['journal-images', 'attachments', 'documents', 'drawing-previews', 'profile-images'];
  for (const b of buckets) {
    for (;;) {
      const { data, error } = await supabase.storage.from(b).list(userId, { limit: 100 });
      if (error || !data || data.length === 0) break;
      const { error: rmErr } = await supabase.storage.from(b).remove(data.map((o) => `${userId}/${o.name}`));
      if (rmErr) break;
    }
  }
}
