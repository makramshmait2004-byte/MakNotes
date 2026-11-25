import { computeInsights, buckets } from './stats';

const base = { created_at: '2026-11-01T00:00:00Z', deleted_at: null };

describe('insights', () => {
  it('returns empty (null) metrics without data — no invented numbers', () => {
    const s = computeInsights({ tasks: [], journal: [], pages: [], habits: [], logs: [], focus: [], goals: [] }, '2026-11-23', '2026-11-25');
    expect(s.tasks.rate).toBeNull();
    expect(s.habits.consistency).toBeNull();
    expect(s.mood.average).toBeNull();
    expect(s.focus.minutes).toBe(0);
  });
  it('computes rates from stored rows', () => {
    const s = computeInsights(
      {
        tasks: [
          { ...base, scheduled_date: '2026-11-24', due_date: null, status: 'done', completed_date: '2026-11-24' },
          { ...base, scheduled_date: '2026-11-25', due_date: null, status: 'todo', completed_date: null },
        ] as never,
        journal: [{ ...base, entry_date: '2026-11-24', mood: 4, word_count: 120 }] as never,
        pages: [{ ...base, date: '2026-11-25', mood: 2 }] as never,
        habits: [],
        logs: [],
        focus: [{ ...base, kind: 'focus', date: '2026-11-25', duration_seconds: 1500, completed: true }] as never,
        goals: [],
      },
      '2026-11-23',
      '2026-11-25',
    );
    expect(s.tasks.rate).toBe(0.5);
    expect(s.journal).toMatchObject({ entries: 1, days: 1, words: 120 });
    expect(s.mood.average).toBe(3);
    expect(s.focus.minutes).toBe(25);
  });
  it('buckets a year by month', () => {
    expect(buckets('2026-01-01', '2026-12-31', true)).toHaveLength(12);
    expect(buckets('2026-11-23', '2026-11-29', false)).toHaveLength(7);
  });
});
