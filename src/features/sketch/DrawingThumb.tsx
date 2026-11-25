import { useEffect, useRef } from 'react';
import { useWhere } from '@/data/hooks';
import type { Drawing } from '@/types/models';
import { drawPaper, drawStroke } from './engine/render';

/** Lightweight offline thumbnail rendered straight from the vector strokes. */
export function DrawingThumb({ drawing, className }: { drawing: Drawing; className?: string }) {
  const strokes = useWhere('drawing_strokes', 'drawing_id', drawing.id);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = c.clientWidth || 200;
    const viewH = Math.min(drawing.height, drawing.width * 1.3);
    const scale = w / drawing.width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * dpr;
    c.height = viewH * scale * dpr;
    const ctx = c.getContext('2d')!;
    const dark = document.documentElement.classList.contains('dark');
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    drawPaper(ctx, drawing.paper, drawing.width, viewH, dark, scale);
    [...strokes].sort((a, b) => a.seq - b.seq).forEach((s) => drawStroke(ctx, s, dark));
  }, [strokes, drawing.paper, drawing.width, drawing.height]);
  return <canvas ref={ref} className={className} style={{ width: '100%', aspectRatio: `${drawing.width} / ${Math.min(drawing.height, drawing.width * 1.3)}` }} />;
}
