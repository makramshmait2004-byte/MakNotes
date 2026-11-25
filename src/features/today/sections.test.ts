import { DEFAULT_HIDDEN, resolveLayout } from './sections';

describe('today layout', () => {
  it('uses the GymFlow defaults when never customized', () => {
    const { order, hidden } = resolveLayout({});
    const visible = order.filter((id) => !hidden.has(id));
    expect(visible).toEqual(['priorities', 'tasks', 'habits', 'schedule', 'evening', 'sunday_review']);
    expect([...hidden].sort()).toEqual([...DEFAULT_HIDDEN].sort());
  });
  it('keeps a saved layout (including showing everything)', () => {
    const { order, hidden } = resolveLayout({ order: ['schedule', 'tasks'], hidden: [] });
    expect(order.slice(0, 2)).toEqual(['schedule', 'tasks']);
    expect(order).toHaveLength(13);
    expect(hidden.size).toBe(0);
  });
});
