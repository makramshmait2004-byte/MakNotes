import { addPoint, displayColor, hitStroke, normalizePressure, strokeInLasso, strokeOutline, toFlat, toPts, translate, type Pt } from './geometry';

describe('ink geometry', () => {
  it('round-trips flat point arrays', () => {
    const pts = [{ x: 1.23, y: 4.56, p: 0.5 }, { x: 10, y: 20, p: 0.8 }];
    expect(toPts(toFlat(pts))).toEqual([{ x: 1.2, y: 4.6, p: 0.5 }, { x: 10, y: 20, p: 0.8 }]);
  });
  it('decimates points closer than the minimum distance', () => {
    const pts: Pt[] = [];
    expect(addPoint(pts, { x: 0, y: 0, p: 0.5 }, 1, 0)).toBe(true);
    expect(addPoint(pts, { x: 0.2, y: 0.2, p: 0.5 }, 1, 0)).toBe(false);
    expect(addPoint(pts, { x: 5, y: 0, p: 0.5 }, 1, 0)).toBe(true);
    expect(pts).toHaveLength(2);
  });
  it('smooths input with streamlining', () => {
    const pts: Pt[] = [{ x: 0, y: 0, p: 0.5 }];
    addPoint(pts, { x: 10, y: 0, p: 0.5 }, 0.1, 0.5);
    expect(pts[1].x).toBe(5);
  });
  it('normalizes pressure per pointer type', () => {
    expect(normalizePressure(0, 'touch')).toBe(0.5);
    expect(normalizePressure(0.9, 'pen')).toBe(0.9);
    expect(normalizePressure(0, 'pen')).toBe(0.5);
  });
  it('makes pressure-dependent outlines', () => {
    const light = strokeOutline([{ x: 0, y: 0, p: 0.1 }, { x: 10, y: 0, p: 0.1 }, { x: 20, y: 0, p: 0.1 }], 4, 'pencil');
    const heavy = strokeOutline([{ x: 0, y: 0, p: 1 }, { x: 10, y: 0, p: 1 }, { x: 20, y: 0, p: 1 }], 4, 'pencil');
    const width = (o: { y: number }[]) => Math.max(...o.map((p) => p.y)) - Math.min(...o.map((p) => p.y));
    expect(width(heavy)).toBeGreaterThan(width(light));
  });
  it('hit-tests strokes for the eraser', () => {
    const flat = toFlat([{ x: 0, y: 0, p: 0.5 }, { x: 100, y: 0, p: 0.5 }]);
    expect(hitStroke(flat, 2, 50, 3, 3)).toBe(true);
    expect(hitStroke(flat, 2, 50, 30, 3)).toBe(false);
  });
  it('selects strokes inside a lasso and moves them', () => {
    const flat = toFlat([{ x: 10, y: 10, p: 0.5 }, { x: 20, y: 20, p: 0.5 }]);
    const square = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }];
    expect(strokeInLasso(flat, square)).toBe(true);
    expect(strokeInLasso(translate(flat, 100, 0), square)).toBe(false);
  });
  it('keeps dark ink readable on dark paper', () => {
    expect(displayColor('#111111', true)).not.toBe('#111111');
    expect(displayColor('#111111', false)).toBe('#111111');
    expect(displayColor('#2563eb', true)).toBe('#2563eb');
  });
});
