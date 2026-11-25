import { addDays, addMonths, dateInTz, diffDays, eachDay, isISODate, monthGrid, startOfWeek, weekday, zonedToUtc, todayISO } from './dates';

describe('dates', () => {
  it('uses the Beirut calendar day, not UTC', () => {
    // 22:30 UTC on Nov 25 is already Nov 26 in Beirut (UTC+2)
    expect(dateInTz(new Date('2026-11-25T22:30:00Z'), 'Asia/Beirut')).toBe('2026-11-26');
    expect(dateInTz(new Date('2026-11-25T22:30:00Z'), 'UTC')).toBe('2026-11-25');
    expect(dateInTz(new Date('2026-11-25T03:00:00Z'), 'America/New_York')).toBe('2026-11-24');
  });
  it('falls back to Beirut for invalid timezones', () => {
    expect(todayISO('Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('does day arithmetic across month/year/DST without shifting', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // Beirut DST change weekend
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(diffDays('2026-11-26', '2026-11-25')).toBe(1);
  });
  it('validates ISO dates', () => {
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-13-01')).toBe(false);
  });
  it('builds weeks and month grids', () => {
    expect(weekday('2026-11-25')).toBe(3); // Wednesday
    expect(startOfWeek('2026-11-25', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-25', 0)).toBe('2026-11-22');
    const g = monthGrid('2026-11-10', 1);
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-10-26');
    expect(eachDay('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  });
  it('converts Beirut wall time to UTC', () => {
    expect(zonedToUtc('2026-11-25', '09:00', 'Asia/Beirut').toISOString()).toBe('2026-11-25T07:00:00.000Z');
    expect(zonedToUtc('2026-07-01', '09:00', 'Asia/Beirut').toISOString()).toBe('2026-07-01T06:00:00.000Z'); // summer time
  });
});
