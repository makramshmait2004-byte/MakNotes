import type { Paper, StrokeTool } from '@/types/models';
import { displayColor, strokeOutline, toPts, type Pt } from './geometry';

export interface RenderStroke {
  id: string;
  tool: StrokeTool;
  color: string;
  width: number;
  points: number[];
}

const pathCache = new Map<string, { key: string; path: Path2D }>();

function outlinePath(pts: Pt[], width: number, tool: string): Path2D {
  const path = new Path2D();
  if (pts.length === 1) {
    path.arc(pts[0].x, pts[0].y, Math.max(0.6, (width / 2) * (0.35 + pts[0].p * 1.1)), 0, Math.PI * 2);
    return path;
  }
  if (tool === 'highlighter') {
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2,
        my = (pts[i].y + pts[i + 1].y) / 2;
      path.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    path.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    return path;
  }
  const poly = strokeOutline(pts, width, tool);
  // quadratic smoothing through midpoints of the outline
  path.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length - 1; i++) {
    const mx = (poly[i].x + poly[i + 1].x) / 2,
      my = (poly[i].y + poly[i + 1].y) / 2;
    path.quadraticCurveTo(poly[i].x, poly[i].y, mx, my);
  }
  path.closePath();
  // round caps
  const a = pts[0],
    b = pts[pts.length - 1];
  const capR = (p: Pt) => Math.max(0.4, (width / 2) * (tool === 'pencil' ? 0.55 + p.p * 0.6 : 0.35 + p.p * 1.1) * (tool === 'pen' ? 0.55 : 1));
  path.moveTo(a.x + capR(a), a.y);
  path.arc(a.x, a.y, capR(a), 0, Math.PI * 2);
  path.moveTo(b.x + capR(b), b.y);
  path.arc(b.x, b.y, capR(b), 0, Math.PI * 2);
  return path;
}

export function strokePath(s: RenderStroke): Path2D {
  const key = `${s.points.length}:${s.points[0]}:${s.points[1]}:${s.points[s.points.length - 2]}:${s.width}:${s.tool}`;
  const hit = pathCache.get(s.id);
  if (hit && hit.key === key) return hit.path;
  const path = outlinePath(toPts(s.points), s.width, s.tool);
  pathCache.set(s.id, { key, path });
  if (pathCache.size > 20000) pathCache.clear();
  return path;
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: RenderStroke, darkPaper: boolean, live = false) {
  const color = displayColor(s.color, darkPaper);
  const path = live ? outlinePath(toPts(s.points), s.width, s.tool) : strokePath(s);
  ctx.save();
  if (s.tool === 'highlighter') {
    ctx.globalAlpha = darkPaper ? 0.4 : 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  } else {
    ctx.globalAlpha = s.tool === 'pencil' ? 0.82 : 1;
    ctx.fillStyle = color;
    ctx.fill(path, 'nonzero');
  }
  ctx.restore();
}

export const PAPER_STEP = 36;

export function drawPaper(ctx: CanvasRenderingContext2D, paper: Paper, w: number, h: number, darkPaper: boolean, scale: number) {
  ctx.save();
  ctx.fillStyle = darkPaper ? '#17171a' : '#fdfcf9';
  ctx.fillRect(0, 0, w, h);
  const line = darkPaper ? 'rgba(255,255,255,0.09)' : 'rgba(30,40,60,0.13)';
  ctx.strokeStyle = line;
  ctx.fillStyle = line;
  ctx.lineWidth = 1 / scale;
  const step = PAPER_STEP;
  if (paper === 'lined') {
    ctx.beginPath();
    for (let y = step * 2; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.strokeStyle = darkPaper ? 'rgba(201,152,98,0.25)' : 'rgba(176,120,70,0.3)';
    ctx.beginPath();
    ctx.moveTo(step * 2.2, 0);
    ctx.lineTo(step * 2.2, h);
    ctx.stroke();
  } else if (paper === 'grid') {
    ctx.beginPath();
    for (let y = step; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    for (let x = step; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    ctx.stroke();
  } else if (paper === 'dotted') {
    const r = Math.max(1.1, 1.4 / Math.sqrt(scale));
    for (let y = step; y < h; y += step) for (let x = step; x < w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Render a drawing to a standalone canvas (PNG export, thumbnails, PDF). Always light paper. */
export function renderDrawing(
  strokes: RenderStroke[],
  opts: { width: number; height: number; paper: Paper; scale?: number; transparent?: boolean; dark?: boolean },
): HTMLCanvasElement {
  const scale = opts.scale ?? 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(opts.width * scale));
  canvas.height = Math.max(1, Math.round(opts.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  const dark = !!opts.dark;
  if (!opts.transparent) drawPaper(ctx, opts.paper, opts.width, opts.height, dark, scale);
  for (const s of strokes) drawStroke(ctx, s, dark);
  return canvas;
}
