import { insert } from '@/data/repo';
import type { Paper } from '@/types/models';

export async function createSketch(opts: { date?: string | null; paper?: Paper; title?: string; kind?: 'sketch' | 'handwriting' | 'block'; height?: number } = {}) {
  return insert('drawings', {
    kind: opts.kind ?? 'sketch',
    date: opts.date ?? null,
    paper: opts.paper ?? 'blank',
    title: opts.title ?? null,
    width: 1000,
    height: opts.height ?? 1400,
  });
}
