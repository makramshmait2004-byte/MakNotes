import { completionRate, currentStreak, isDue, longestStreak } from './habitLogic';

const daily = { frequency: 'daily' as const, weekdays: [], target_per_week: 7, created_at: '2026-11-01T00:00:00Z' };
const log = (date: string, status: 'done' | 'skipped' = 'done') => ({ date, status });

describe('habits', () => {
  it('counts streaks, allowing today to be pending and skips to be neutral', () => {
    const logs = [log('2026-11-22'), log('2026-11-23', 'skipped'), log('2026-11-24')];
    expect(currentStreak(daily, logs, '2026-11-25')).toBe(2);
    expect(currentStreak(daily, [...logs, log('2026-11-25')], '2026-11-25')).toBe(3);
    expect(currentStreak(daily, [log('2026-11-20')], '2026-11-25')).toBe(0);
  });
  it('respects specific weekdays', () => {
    const mwf = { ...daily, frequency: 'weekdays' as const, weekdays: [1, 3, 5] };
    expect(isDue(mwf, '2026-11-25')).toBe(true); // Wed
    expect(isDue(mwf, '2026-11-24')).toBe(false); // Tue
    expect(currentStreak(mwf, [log('2026-11-20'), log('2026-11-23'), log('2026-11-25')], '2026-11-25')).toBe(3);
  });
  it('computes longest streak and completion rate', () => {
    const logs = [log('2026-11-01'), log('2026-11-02'), log('2026-11-03'), log('2026-11-05')];
    expect(longestStreak(daily, logs)).toBe(3);
    const r = completionRate(daily, logs, '2026-11-01', '2026-11-10');
    expect(r).toMatchObject({ done: 4, due: 10 });
    expect(r.rate).toBeCloseTo(0.4);
  });
  it('handles weekly targets', () => {
    const weekly = { ...daily, frequency: 'weekly' as const, target_per_week: 2 };
    const logs = [log('2026-11-16'), log('2026-11-18'), log('2026-11-23'), log('2026-11-24')];
    expect(currentStreak(weekly, logs, '2026-11-25', 1)).toBe(2);
  });
});
