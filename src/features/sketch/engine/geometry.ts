// Pure geometry for vector ink. Points are stored flat: [x, y, pressure, x, y, pressure, ...] in page units.

export interface Pt {
  x: number;
  y: number;
  p: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const toPts = (flat: number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 3) out.push({ x: flat[i], y: flat[i + 1], p: flat[i + 2] ?? 0.5 });
  return out;
};

export const toFlat = (pts: Pt[]): number[] => {
  const out: number[] = [];
  for (const p of pts) out.push(round(p.x), round(p.y), Math.round(p.p * 100) / 100);
  return out;
};

const round = (n: number) => Math.round(n * 10) / 10;

/** Normalize device pressure: mouse/touch without pressure get a neutral 0.5. */
export function normalizePressure(pressure: number, pointerType: string): number {
  if (pointerType === 'pen') return Math.min(1, Math.max(0.05, pressure || 0.5));
  if (pressure === 0 || pressure === 1 || pressure === 0.5) return 0.5;
  return Math.min(1, Math.max(0.05, pressure));
}

/**
 * Add a point with streamlining (exponential smoothing) and distance-based decimation.
 * Returns true if the point was appended.
 */
export function addPoint(pts: Pt[], raw: Pt, minDist: number, streamline: number): boolean {
  const last = pts[pts.length - 1];
  if (!last) {
    pts.push(raw);
    return true;
  }
  const x = last.x + (raw.x - last.x) * (1 - streamline);
  const y = last.y + (raw.y - last.y) * (1 - streamline);
  const d = Math.hypot(x - last.x, y - last.y);
  if (d < minDist) {
    // still track pressure changes on the last point so the tail is accurate
    last.p = (last.p + raw.p) / 2;
    return false;
  }
  pts.push({ x, y, p: raw.p });
  return true;
}

export function strokeBounds(flat: number[], pad = 0): Bounds {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < flat.length; i += 3) {
    const x = flat[i],
      y = flat[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

export function unionBounds(list: Bounds[]): Bounds | null {
  if (!list.length) return null;
  return list.reduce((a, b) => ({ minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }));
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Does a circle at (x, y) with radius r touch the stroke? */
export function hitStroke(flat: number[], width: number, x: number, y: number, r: number): boolean {
  const reach = r + width / 2;
  if (flat.length === 3) return Math.hypot(flat[0] - x, flat[1] - y) <= reach;
  for (let i = 0; i + 4 < flat.length; i += 3) {
    if (distToSegment(x, y, flat[i], flat[i + 1], flat[i + 3], flat[i + 4]) <= reach) return true;
  }
  return false;
}

export function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y,
      xj = poly[j].x,
      yj = poly[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A stroke is lasso-selected when at least 60% of its points are inside the polygon. */
export function strokeInLasso(flat: number[], poly: { x: number; y: number }[]): boolean {
  if (poly.length < 3) return false;
  let inside = 0,
    total = 0;
  for (let i = 0; i < flat.length; i += 3) {
    total++;
    if (pointInPolygon(flat[i], flat[i + 1], poly)) inside++;
  }
  return total > 0 && inside / total >= 0.6;
}

export function translate(flat: number[], dx: number, dy: number): number[] {
  const out = flat.slice();
  for (let i = 0; i < out.length; i += 3) {
    out[i] = round(out[i] + dx);
    out[i + 1] = round(out[i + 1] + dy);
  }
  return out;
}

export function strokeRadius(base: number, pressure: number, tool: string): number {
  if (tool === 'highlighter') return base / 2;
  const curve = tool === 'pencil' ? 0.55 + pressure * 0.6 : 0.35 + pressure * 1.1;
  return Math.max(0.4, (base / 2) * curve);
}

/**
 * Outline polygon for a pressure-sensitive stroke: offset each point along the normal by its radius,
 * then walk left side forward and right side backward. Rendered with a single fill (fast, smooth).
 */
export function strokeOutline(pts: Pt[], base: number, tool: string): { x: number; y: number }[] {
  const n = pts.length;
  if (n === 0) return [];
  // smooth pressure to avoid width jitter
  const radii = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)].p,
      b = pts[i].p,
      c = pts[Math.min(n - 1, i + 1)].p;
    return strokeRadius(base, (a + 2 * b + c) / 4, tool);
  });
  // taper ends for pens
  if (tool === 'pen' && n > 4) {
    for (let i = 0; i < Math.min(3, n); i++) {
      const f = 0.55 + 0.15 * i;
      radii[i] *= f;
      radii[n - 1 - i] *= f;
    }
  }
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)],
      next = pts[Math.min(n - 1, i + 1)];
    let dx = next.x - prev.x,
      dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const r = radii[i];
    left.push({ x: pts[i].x - dy * r, y: pts[i].y + dx * r });
    right.push({ x: pts[i].x + dy * r, y: pts[i].y - dx * r });
  }
  return [...left, ...right.reverse()];
}

/** Relative luminance (0..1) of #rrggbb. */
export function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 255) / 255,
    g = ((v >> 8) & 255) / 255,
    b = (v & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Dark ink is shown light on dark paper (and vice-versa) so writing stays readable in both themes. */
export function displayColor(hex: string, darkPaper: boolean): string {
  const l = luminance(hex);
  if (darkPaper && l < 0.2) return '#e9e6df';
  if (!darkPaper && l > 0.92) return '#1a1a1a';
  return hex;
}
