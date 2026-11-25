import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Eraser,
  Hand,
  Highlighter,
  Lasso,
  Maximize,
  Minimize,
  Minus,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Scan,
  Download,
  Fingerprint,
  Expand,
} from 'lucide-react';
import { useWhere } from '@/data/hooks';
import { insert, remove, restore, update } from '@/data/repo';
import { newId } from '@/lib/ids';
import { cn, downloadBlob } from '@/lib/utils';
import { useT } from '@/i18n';
import type { Drawing, Paper, Row, StrokeTool } from '@/types/models';
import {
  addPoint,
  hitStroke,
  normalizePressure,
  strokeBounds,
  strokeInLasso,
  toFlat,
  translate,
  unionBounds,
  type Bounds,
  type Pt,
} from './engine/geometry';
import { drawPaper, drawStroke, renderDrawing, type RenderStroke } from './engine/render';

type Tool = StrokeTool | 'eraser' | 'select' | 'hand';

const COLORS = ['#111111', '#5b5b5b', '#1e3a5f', '#2563eb', '#b91c1c', '#15803d', '#a0743c', '#7c3aed'];
const HIGHLIGHTS = ['#facc15', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'];
const DEFAULT_WIDTH: Record<StrokeTool | 'eraser', number> = { pen: 5, pencil: 4, highlighter: 24, eraser: 18 };

type UndoEntry =
  | { type: 'add'; strokes: RenderStroke[] }
  | { type: 'erase'; strokes: RenderStroke[] }
  | { type: 'move'; ids: string[]; dx: number; dy: number };

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const PEN_KEY = 'maknotes-pen-detected';
let seqCounter = 0;
const nextSeq = () => Date.now() + (seqCounter = (seqCounter + 1) % 1000) / 1000;

export interface DrawingCanvasProps {
  drawing: Row<'drawings'> | Drawing;
  mode: 'embed' | 'full';
  defaultPenOnly?: boolean;
  onExpand?: () => void;
  className?: string;
}

export function DrawingCanvas({ drawing, mode, defaultPenOnly = false, onExpand, className }: DrawingCanvasProps) {
  const t = useT();
  const dark = useIsDark();
  const full = mode === 'full';

  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState<Tool>('pen');
  const [colors, setColors] = useState<Record<StrokeTool, string>>({ pen: '#111111', pencil: '#5b5b5b', highlighter: '#facc15' });
  const [widths, setWidths] = useState<Record<StrokeTool | 'eraser', number>>(DEFAULT_WIDTH);
  const [penOnly, setPenOnly] = useState<boolean>(() => {
    try {
      return defaultPenOnly || localStorage.getItem(PEN_KEY) === '1';
    } catch {
      return defaultPenOnly;
    }
  });
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [selection, setSelection] = useState<string[]>([]);
  const [undoStack, setUndo] = useState<UndoEntry[]>([]);
  const [redoStack, setRedo] = useState<UndoEntry[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ---------------------------------------------------------------- strokes (DB + optimistic overrides)
  const dbStrokes = useWhere('drawing_strokes', 'drawing_id', drawing.id);
  const [adds, setAdds] = useState<Map<string, RenderStroke>>(new Map());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [moved, setMoved] = useState<Map<string, number[]>>(new Map());

  useEffect(() => {
    // Drop optimistic state once IndexedDB reflects it.
    const ids = new Set(dbStrokes.map((s) => s.id));
    setAdds((m) => {
      let changed = false;
      const n = new Map(m);
      for (const id of m.keys()) if (ids.has(id)) (n.delete(id), (changed = true));
      return changed ? n : m;
    });
    setHidden((h) => {
      let changed = false;
      const n = new Set(h);
      for (const id of h) if (!ids.has(id)) (n.delete(id), (changed = true));
      return changed ? n : h;
    });
    setMoved((m) => {
      if (!m.size) return m;
      const n = new Map(m);
      for (const s of dbStrokes) {
        const p = m.get(s.id);
        if (p && p.length === s.points.length && p[0] === s.points[0] && p[1] === s.points[1]) n.delete(s.id);
      }
      return n.size === m.size ? m : n;
    });
  }, [dbStrokes]);

  const strokes: RenderStroke[] = useMemo(() => {
    const list: (RenderStroke & { seq: number })[] = dbStrokes
      .filter((s) => !hidden.has(s.id))
      .map((s) => ({ id: s.id, tool: s.tool, color: s.color, width: s.width, points: moved.get(s.id) ?? s.points, seq: s.seq }));
    const present = new Set(list.map((s) => s.id));
    for (const [id, s] of adds) if (!present.has(id) && !hidden.has(id)) list.push({ ...s, seq: Number.MAX_SAFE_INTEGER });
    return list.sort((a, b) => a.seq - b.seq);
  }, [dbStrokes, adds, hidden, moved]);

  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const boundsCache = useMemo(() => new Map(strokes.map((s) => [s.id, strokeBounds(s.points, s.width)])), [strokes]);

  // ---------------------------------------------------------------- geometry / view
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const base = size.w ? Math.min(size.w / drawing.width, full ? 1.25 : 10) : 1;
  const k = base * (full ? view.scale : 1);
  const contentW = drawing.width * k;
  const ox = (full ? view.x : 0) + (contentW < size.w ? (size.w - contentW) / 2 : 0);
  const oy = full ? view.y : 0;
  const cssH = full ? size.h : Math.round(drawing.height * base);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = liveRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - ox) / k, y: (clientY - rect.top - oy) / k };
  }, [ox, oy, k]);

  // ---------------------------------------------------------------- rendering
  const erasing = useRef<Set<string>>(new Set());
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);

  const renderMain = useCallback(() => {
    const c = mainRef.current;
    if (!c || !size.w) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    drawPaper(ctx, drawing.paper, drawing.width, drawing.height, dark, k);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, drawing.width, drawing.height);
    ctx.clip();
    const sel = new Set(selection);
    const vx0 = -ox / k,
      vy0 = -oy / k,
      vx1 = vx0 + size.w / k,
      vy1 = vy0 + cssH / k;
    for (const s of strokesRef.current) {
      if (erasing.current.has(s.id)) continue;
      if (dragOffset.current && sel.has(s.id)) continue;
      const b = boundsCache.get(s.id);
      if (b && (b.maxX < vx0 || b.minX > vx1 || b.maxY < vy0 || b.minY > vy1)) continue; // off-screen
      drawStroke(ctx, s, dark);
    }
    ctx.restore();
  }, [size.w, cssH, dpr, k, ox, oy, drawing.paper, drawing.width, drawing.height, dark, selection, boundsCache]);

  useEffect(() => {
    renderMain();
  }, [renderMain, strokes]);

  // live layer
  const cur = useRef<{ stroke: RenderStroke; pts: Pt[] } | null>(null);
  const lasso = useRef<{ x: number; y: number }[] | null>(null);
  const eraserPos = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef(0);

  const selectionBounds: Bounds | null = useMemo(
    () => unionBounds(selection.map((id) => boundsCache.get(id)).filter(Boolean) as Bounds[]),
    [selection, boundsCache],
  );

  const renderLive = useCallback(() => {
    raf.current = 0;
    const c = liveRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    if (cur.current) drawStroke(ctx, { ...cur.current.stroke, points: toFlat(cur.current.pts) }, dark, true);
    if (dragOffset.current) {
      const { dx, dy } = dragOffset.current;
      const sel = new Set(selection);
      for (const s of strokesRef.current) if (sel.has(s.id)) drawStroke(ctx, { ...s, points: translate(s.points, dx, dy) }, dark, true);
    }
    if (lasso.current && lasso.current.length > 1) {
      ctx.save();
      ctx.setLineDash([6 / k, 5 / k]);
      ctx.strokeStyle = '#b08d57';
      ctx.lineWidth = 1.5 / k;
      ctx.beginPath();
      lasso.current.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    if (selectionBounds && !lasso.current) {
      const d = dragOffset.current ?? { dx: 0, dy: 0 };
      ctx.save();
      ctx.setLineDash([6 / k, 5 / k]);
      ctx.strokeStyle = '#b08d57';
      ctx.lineWidth = 1.5 / k;
      ctx.strokeRect(selectionBounds.minX + d.dx - 6, selectionBounds.minY + d.dy - 6, selectionBounds.maxX - selectionBounds.minX + 12, selectionBounds.maxY - selectionBounds.minY + 12);
      ctx.restore();
    }
    if (eraserPos.current) {
      ctx.save();
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1 / k;
      ctx.beginPath();
      ctx.arc(eraserPos.current.x, eraserPos.current.y, widths.eraser / 2 / (full ? view.scale : 1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [dpr, k, ox, oy, dark, selection, selectionBounds, widths.eraser, full, view.scale]);

  const scheduleLive = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(renderLive);
  }, [renderLive]);

  useEffect(() => {
    renderLive();
  }, [renderLive]);

  // canvas pixel sizes
  useEffect(() => {
    for (const c of [mainRef.current, liveRef.current]) {
      if (!c) continue;
      c.width = Math.max(1, Math.round(size.w * dpr));
      c.height = Math.max(1, Math.round(cssH * dpr));
    }
    renderMain();
    renderLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, cssH, dpr]);

  // ---------------------------------------------------------------- history
  const pushUndo = (e: UndoEntry) => {
    setUndo((u) => [...u.slice(-99), e]);
    setRedo([]);
  };

  const touchDrawing = useRef<ReturnType<typeof setTimeout>>();
  const bumpDrawing = () => {
    if (touchDrawing.current) clearTimeout(touchDrawing.current);
    touchDrawing.current = setTimeout(() => void update('drawings', drawing.id, {}), 4000);
  };

  const removeStrokes = async (list: RenderStroke[]) => {
    setHidden((h) => new Set([...h, ...list.map((s) => s.id)]));
    for (const s of list) await remove('drawing_strokes', s.id);
    bumpDrawing();
  };
  const restoreStrokes = async (list: RenderStroke[]) => {
    setHidden((h) => {
      const n = new Set(h);
      list.forEach((s) => n.delete(s.id));
      return n;
    });
    setAdds((m) => new Map([...m, ...list.map((s) => [s.id, s] as const)]));
    for (const s of list) await restore('drawing_strokes', s.id);
    bumpDrawing();
  };
  const moveStrokes = async (ids: string[], dx: number, dy: number) => {
    const map = new Map(strokesRef.current.map((s) => [s.id, s]));
    const next = new Map(moved);
    const writes: Promise<void>[] = [];
    for (const id of ids) {
      const s = map.get(id);
      if (!s) continue;
      const pts = translate(s.points, dx, dy);
      next.set(id, pts);
      writes.push(update('drawing_strokes', id, { points: pts }));
    }
    setMoved(next);
    await Promise.all(writes);
    bumpDrawing();
  };

  const undo = async () => {
    const e = undoStack[undoStack.length - 1];
    if (!e) return;
    setUndo((u) => u.slice(0, -1));
    setRedo((r) => [...r, e]);
    if (e.type === 'add') await removeStrokes(e.strokes);
    else if (e.type === 'erase') await restoreStrokes(e.strokes);
    else await moveStrokes(e.ids, -e.dx, -e.dy);
  };
  const redo = async () => {
    const e = redoStack[redoStack.length - 1];
    if (!e) return;
    setRedo((r) => r.slice(0, -1));
    setUndo((u) => [...u, e]);
    if (e.type === 'add') await restoreStrokes(e.strokes);
    else if (e.type === 'erase') await removeStrokes(e.strokes);
    else await moveStrokes(e.ids, e.dx, e.dy);
  };

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) (e.preventDefault(), void undo());
      else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) (e.preventDefault(), void redo());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------------------------------------------------------------- input
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; view: typeof view } | null>(null);
  const pan = useRef<{ x: number; y: number; view: typeof view; id: number } | null>(null);
  const penDown = useRef(false);
  const lastPen = useRef(0);
  const activePointer = useRef<number | null>(null);
  const mode2 = useRef<'draw' | 'erase' | 'lasso' | 'drag' | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const erasedNow = useRef<RenderStroke[]>([]);

  const capture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released or synthetic — drawing still works without capture */
    }
  };

  const effectiveTool = (e: React.PointerEvent): Tool => {
    if (e.pointerType === 'pen' && (e.buttons & 32 || e.buttons & 2)) return 'eraser'; // S Pen button / eraser tip
    return tool;
  };

  const startPinch = () => {
    const pts = [...touches.current.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view };
  };

  const cancelCurrent = () => {
    cur.current = null;
    lasso.current = null;
    mode2.current = null;
    activePointer.current = null;
    erasing.current.clear();
    erasedNow.current = [];
    renderMain();
    scheduleLive();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const isTouch = e.pointerType === 'touch';
    if (e.pointerType === 'pen') {
      penDown.current = true;
      lastPen.current = Date.now();
      try {
        if (localStorage.getItem(PEN_KEY) !== '1') {
          localStorage.setItem(PEN_KEY, '1');
          setPenOnly(true);
        }
      } catch {
        /* ignore */
      }
    }
    if (isTouch) {
      // best-effort palm rejection: ignore touches while / right after the pen is used, and very large contacts
      if (penDown.current || Date.now() - lastPen.current < 600) return;
      if (e.width > 40 && e.height > 40) return;
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size >= 2) {
        if (mode2.current === 'draw' && cur.current && cur.current.pts.length < 12) cancelCurrent();
        if (full) startPinch();
        return;
      }
      if (penOnly || tool === 'hand') {
        if (full) pan.current = { x: e.clientX, y: e.clientY, view, id: e.pointerId };
        return;
      }
    }
    if (e.pointerType === 'mouse' && (e.button === 1 || tool === 'hand')) {
      if (full) pan.current = { x: e.clientX, y: e.clientY, view, id: e.pointerId };
      capture(e);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (activePointer.current !== null) return;
    if (tool === 'hand') return;

    capture(e);
    activePointer.current = e.pointerId;
    const w = toWorld(e.clientX, e.clientY);
    const tl = effectiveTool(e);

    if (tl === 'eraser') {
      mode2.current = 'erase';
      erasedNow.current = [];
      eraserPos.current = w;
      eraseAt(w.x, w.y);
      return;
    }
    if (tl === 'select') {
      if (selectionBounds && w.x >= selectionBounds.minX - 8 && w.x <= selectionBounds.maxX + 8 && w.y >= selectionBounds.minY - 8 && w.y <= selectionBounds.maxY + 8) {
        mode2.current = 'drag';
        dragStart.current = w;
        dragOffset.current = { dx: 0, dy: 0 };
        renderMain();
      } else {
        mode2.current = 'lasso';
        setSelection([]);
        lasso.current = [w];
      }
      scheduleLive();
      return;
    }
    const st = tl as StrokeTool;
    mode2.current = 'draw';
    setSelection([]);
    cur.current = {
      stroke: { id: newId(), tool: st, color: colors[st], width: widths[st], points: [] },
      pts: [{ x: w.x, y: w.y, p: normalizePressure(e.pressure, e.pointerType) }],
    };
    scheduleLive();
  };

  const eraseAt = (x: number, y: number) => {
    const r = widths.eraser / 2 / (full ? view.scale : 1);
    let hit = false;
    for (const s of strokesRef.current) {
      if (erasing.current.has(s.id)) continue;
      const b = boundsCache.get(s.id);
      if (b && (x < b.minX - r || x > b.maxX + r || y < b.minY - r || y > b.maxY + r)) continue;
      if (hitStroke(s.points, s.width, x, y, r)) {
        erasing.current.add(s.id);
        erasedNow.current.push(s);
        hit = true;
      }
    }
    if (hit) renderMain();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const p0 = pinch.current;
        const scale = Math.min(6, Math.max(0.4, p0.view.scale * (dist / p0.dist)));
        const ratio = scale / p0.view.scale;
        const rect = liveRef.current!.getBoundingClientRect();
        const mx = p0.mid.x - rect.left,
          my = p0.mid.y - rect.top;
        setView({
          scale,
          x: mx - (mx - p0.view.x) * ratio + (mid.x - p0.mid.x),
          y: my - (my - p0.view.y) * ratio + (mid.y - p0.mid.y),
        });
        return;
      }
    }
    if (pan.current && pan.current.id === e.pointerId) {
      const p = pan.current;
      setView({ ...p.view, x: p.view.x + e.clientX - p.x, y: p.view.y + e.clientY - p.y });
      return;
    }
    if (activePointer.current !== e.pointerId) {
      if (tool === 'eraser' && e.pointerType !== 'touch') {
        eraserPos.current = toWorld(e.clientX, e.clientY);
        scheduleLive();
      }
      return;
    }
    const events = (e.nativeEvent.getCoalescedEvents?.() ?? []) as PointerEvent[];
    const list = events.length ? events : [e.nativeEvent];
    if (mode2.current === 'draw' && cur.current) {
      const st = cur.current.stroke.tool;
      const streamline = e.pointerType === 'mouse' ? 0.4 : st === 'highlighter' ? 0.45 : 0.22;
      const minDist = 0.9 / k;
      for (const ev of list) {
        const w = toWorld(ev.clientX, ev.clientY);
        addPoint(cur.current.pts, { x: w.x, y: w.y, p: normalizePressure(ev.pressure, e.pointerType) }, minDist, streamline);
      }
      scheduleLive();
    } else if (mode2.current === 'erase') {
      for (const ev of list) {
        const w = toWorld(ev.clientX, ev.clientY);
        eraserPos.current = w;
        eraseAt(w.x, w.y);
      }
      scheduleLive();
    } else if (mode2.current === 'lasso' && lasso.current) {
      const w = toWorld(e.clientX, e.clientY);
      lasso.current.push(w);
      scheduleLive();
    } else if (mode2.current === 'drag' && dragStart.current) {
      const w = toWorld(e.clientX, e.clientY);
      dragOffset.current = { dx: w.x - dragStart.current.x, dy: w.y - dragStart.current.y };
      scheduleLive();
    }
  };

  const finish = async (e: React.PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    if (e.pointerType === 'pen') {
      penDown.current = false;
      lastPen.current = Date.now();
    }
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      if (touches.current.size < 2) pinch.current = null;
    }
    if (pan.current?.id === e.pointerId) pan.current = null;
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    const m = mode2.current;
    mode2.current = null;

    if (m === 'draw' && cur.current) {
      const c = cur.current;
      cur.current = null;
      if (cancelled) return scheduleLive();
      const stroke: RenderStroke = { ...c.stroke, points: toFlat(c.pts) };
      setAdds((map) => new Map(map).set(stroke.id, stroke));
      scheduleLive();
      pushUndo({ type: 'add', strokes: [stroke] });
      await insert('drawing_strokes', { id: stroke.id, drawing_id: drawing.id, tool: stroke.tool, color: stroke.color, width: stroke.width, points: stroke.points, seq: nextSeq() });
      bumpDrawing();
      // grow the page when writing near the bottom
      const maxY = strokeBounds(stroke.points).maxY;
      if (full && maxY > drawing.height - 220) void update('drawings', drawing.id, { height: Math.min(50000, drawing.height + 700) });
    } else if (m === 'erase') {
      eraserPos.current = null;
      const list = erasedNow.current;
      erasedNow.current = [];
      if (list.length) {
        pushUndo({ type: 'erase', strokes: list });
        await removeStrokes(list);
      }
      erasing.current.clear();
      scheduleLive();
    } else if (m === 'lasso' && lasso.current) {
      const poly = lasso.current;
      lasso.current = null;
      setSelection(strokesRef.current.filter((s) => strokeInLasso(s.points, poly)).map((s) => s.id));
      scheduleLive();
    } else if (m === 'drag' && dragOffset.current) {
      const { dx, dy } = dragOffset.current;
      dragOffset.current = null;
      dragStart.current = null;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        pushUndo({ type: 'move', ids: selection, dx, dy });
        await moveStrokes(selection, dx, dy);
      }
      renderMain();
      scheduleLive();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!full) return;
    if (e.ctrlKey || e.metaKey) {
      const rect = liveRef.current!.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    } else {
      setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
  };

  // keep wheel from scrolling the page in full mode (React wheel listeners are passive)
  useEffect(() => {
    const el = liveRef.current;
    if (!el || !full) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, [full]);

  const zoomAt = (sx: number, sy: number, factor: number) => {
    setView((v) => {
      const scale = Math.min(6, Math.max(0.4, v.scale * factor));
      const r = scale / v.scale;
      return { scale, x: sx - (sx - v.x) * r, y: sy - (sy - v.y) * r };
    });
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* not supported (e.g. iOS) — the editor is already full-window */
    }
  };

  const exportPng = async () => {
    const canvas = renderDrawing(strokes, { width: drawing.width, height: drawing.height, paper: drawing.paper, scale: 2 });
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (blob) downloadBlob(blob, `${(drawing.title || 'drawing').replace(/[^\w-]+/g, '_')}.png`);
  };

  const deleteSelection = async () => {
    const sel = new Set(selection);
    const list = strokesRef.current.filter((s) => sel.has(s.id));
    pushUndo({ type: 'erase', strokes: list });
    setSelection([]);
    await removeStrokes(list);
  };

  const recolorSelection = async (color: string) => {
    for (const id of selection) await update('drawing_strokes', id, { color });
  };

  const strokeTool: StrokeTool | null = tool === 'pen' || tool === 'pencil' || tool === 'highlighter' ? tool : null;
  const palette = strokeTool === 'highlighter' ? HIGHLIGHTS : COLORS;

  const touchAction = full ? 'none' : penOnly ? 'pan-y pinch-zoom' : 'none';

  const toolBtn = (id: Tool, Icon: React.ComponentType<{ className?: string }>, label: string) => (
    <button
      key={id}
      onClick={() => {
        setTool(id);
        if (id !== 'select') setSelection([]);
      }}
      className={cn('grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent', tool === id && 'bg-bronze/15 text-bronze ring-1 ring-bronze/40')}
      aria-label={t(label)}
      aria-pressed={tool === id}
      title={t(label)}
    >
      <Icon className="size-5" />
    </button>
  );

  const iconBtn = (Icon: React.ComponentType<{ className?: string }>, label: string, onClick: () => void, disabled = false, pressed?: boolean) => (
    <button
      key={label}
      onClick={onClick}
      disabled={disabled}
      className={cn('grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-30', pressed && 'bg-accent text-foreground')}
      aria-label={t(label)}
      title={t(label)}
      aria-pressed={pressed}
    >
      <Icon className="size-5" />
    </button>
  );

  const toolbar = (
    <div className={cn('flex items-center gap-1 overflow-x-auto no-scrollbar', full ? 'border-b bg-card/95 px-2 py-1.5 backdrop-blur' : 'border-b px-1 py-1')} data-testid="drawing-toolbar">
      {toolBtn('pen', PenLine, 'Pen')}
      {toolBtn('pencil', Pencil, 'Pencil')}
      {toolBtn('highlighter', Highlighter, 'Highlighter')}
      {toolBtn('eraser', Eraser, 'Eraser')}
      {toolBtn('select', Lasso, 'Select')}
      {full && toolBtn('hand', Hand, 'Pan')}
      <span className="mx-1 h-6 w-px shrink-0 bg-border" />
      {strokeTool &&
        palette.map((c) => (
          <button
            key={c}
            onClick={() => setColors((s) => ({ ...s, [strokeTool]: c }))}
            className={cn('size-7 shrink-0 rounded-full border-2', colors[strokeTool] === c ? 'border-bronze' : 'border-transparent')}
            style={{ background: c }}
            aria-label={`${t('Color')} ${c}`}
          />
        ))}
      {strokeTool && (
        <input
          type="color"
          value={colors[strokeTool]}
          onChange={(e) => setColors((s) => ({ ...s, [strokeTool]: e.target.value }))}
          className="size-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={t('Custom color')}
        />
      )}
      {(strokeTool || tool === 'eraser') && (
        <label className="flex shrink-0 items-center gap-1 px-1 text-xs text-muted-foreground">
          <span className="sr-only">{t('Thickness')}</span>
          <input
            type="range"
            min={tool === 'highlighter' ? 8 : tool === 'eraser' ? 6 : 1}
            max={tool === 'highlighter' ? 48 : tool === 'eraser' ? 60 : 16}
            step={0.5}
            value={widths[(strokeTool ?? 'eraser') as StrokeTool | 'eraser']}
            onChange={(e) => setWidths((w) => ({ ...w, [(strokeTool ?? 'eraser') as string]: Number(e.target.value) }))}
            className="w-20 accent-[hsl(var(--bronze))]"
            aria-label={t('Thickness')}
          />
        </label>
      )}
      {selection.length > 0 && (
        <>
          {COLORS.slice(0, 5).map((c) => (
            <button key={`sel${c}`} onClick={() => void recolorSelection(c)} className="size-6 shrink-0 rounded-full border" style={{ background: c }} aria-label={`${t('Recolor selection')} ${c}`} />
          ))}
          {iconBtn(Trash2, 'Delete selection', () => void deleteSelection())}
        </>
      )}
      <span className="mx-1 h-6 w-px shrink-0 bg-border" />
      {iconBtn(Undo2, 'Undo', () => void undo(), !undoStack.length)}
      {iconBtn(Redo2, 'Redo', () => void redo(), !redoStack.length)}
      {iconBtn(Fingerprint, penOnly ? 'Pen-only mode on (finger scrolls)' : 'Pen-only mode off (finger draws)', () => setPenOnly((v) => !v), false, penOnly)}
      {full && (
        <>
          {iconBtn(Minus, 'Zoom out', () => zoomAt(size.w / 2, size.h / 2, 1 / 1.25))}
          <span className="w-10 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{Math.round(view.scale * 100)}%</span>
          {iconBtn(Plus, 'Zoom in', () => zoomAt(size.w / 2, size.h / 2, 1.25))}
          {iconBtn(Scan, 'Fit to width', () => setView({ scale: 1, x: 0, y: 0 }))}
          <select
            value={drawing.paper}
            onChange={(e) => void update('drawings', drawing.id, { paper: e.target.value as Paper })}
            className="h-9 shrink-0 rounded-md border bg-background px-2 text-sm"
            aria-label={t('Paper')}
          >
            <option value="blank">{t('Blank')}</option>
            <option value="lined">{t('Lined')}</option>
            <option value="grid">{t('Grid')}</option>
            <option value="dotted">{t('Dotted')}</option>
          </select>
          {iconBtn(Download, 'Export PNG', () => void exportPng())}
          {iconBtn(isFullscreen ? Minimize : Maximize, 'Full screen', () => void toggleFullscreen())}
        </>
      )}
      {!full && onExpand && iconBtn(Expand, 'Open full screen', onExpand)}
    </div>
  );

  return (
    <div className={cn('flex flex-col', full ? 'h-full' : 'overflow-hidden rounded-md border', className)}>
      {toolbar}
      <div
        ref={containerRef}
        className={cn('relative w-full select-none overflow-hidden', full ? 'flex-1 bg-muted/40' : '')}
        style={{ height: full ? undefined : cssH || 200 }}
      >
        <canvas ref={mainRef} className="absolute inset-0" style={{ width: size.w, height: cssH }} />
        <canvas
          ref={liveRef}
          className="absolute inset-0"
          style={{ width: size.w, height: cssH, touchAction, cursor: tool === 'hand' ? 'grab' : tool === 'eraser' ? 'none' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => void finish(e)}
          onPointerCancel={(e) => void finish(e, true)}
          onPointerLeave={() => {
            if (tool === 'eraser' && activePointer.current === null) {
              eraserPos.current = null;
              scheduleLive();
            }
          }}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
          data-testid="drawing-canvas"
          data-stroke-count={strokes.length}
          aria-label={t('Drawing canvas')}
          role="img"
        />
        {!full && strokes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">{t(penOnly ? 'Write with your pen' : 'Write or sketch here')}</div>
        )}
      </div>
    </div>
  );
}
