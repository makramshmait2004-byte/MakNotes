import { filterView, isOverdue, nextOccurrence } from './taskLogic';
import type { Row } from '@/types/models';

const rule = (r: Partial<Parameters<typeof nextOccurrence>[0]>) => ({ freq: 'daily' as const, interval: 1, weekdays: [], end_date: null, ...r });

describe('recurrence', () => {
  it('daily / monthly / yearly', () => {
    expect(nextOccurrence(rule({}), '2026-11-25')).toBe('2026-11-26');
    expect(nextOccurrence(rule({ interval: 3 }), '2026-11-25')).toBe('2026-11-28');
    expect(nextOccurrence(rule({ freq: 'monthly' }), '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence(rule({ freq: 'yearly' }), '2026-11-25')).toBe('2027-11-25');
  });
  it('weekly on chosen weekdays', () => {
    // Mon(1) & Thu(4); from Wed Nov 25 → Thu Nov 26, then → Mon Nov 30
    expect(nextOccurrence(rule({ freq: 'weekly', weekdays: [1, 4] }), '2026-11-25')).toBe('2026-11-26');
    expect(nextOccurrence(rule({ freq: 'weekly', weekdays: [1, 4] }), '2026-11-26')).toBe('2026-11-30');
    expect(nextOccurrence(rule({ freq: 'weekly' }), '2026-11-25')).toBe('2026-12-02');
  });
  it('stops after the end date', () => {
    expect(nextOccurrence(rule({ end_date: '2026-11-25' }), '2026-11-25')).toBeNull();
  });
});

const task = (p: Partial<Row<'tasks'>>) => ({ status: 'todo', scheduled_date: null, due_date: null, completed_date: null, ...p }) as Row<'tasks'>;

describe('task views', () => {
  const today = '2026-11-25';
  const list = [
    task({ id: 'a', scheduled_date: '2026-11-25' }),
    task({ id: 'b', scheduled_date: '2026-11-26' }),
    task({ id: 'c', scheduled_date: '2026-11-20' }),
    task({ id: 'd', status: 'done', scheduled_date: '2026-11-25', completed_date: '2026-11-25' }),
    task({ id: 'e' }),
    task({ id: 'f', due_date: '2026-11-30' }),
  ];
  const ids = (v: Parameters<typeof filterView>[1]) => filterView(list, v, today).map((x) => x.id).sort();
  it('splits into views', () => {
    expect(ids('today')).toEqual(['a', 'c', 'd']);
    expect(ids('tomorrow')).toEqual(['b']);
    expect(ids('upcoming')).toEqual(['b', 'f']);
    expect(ids('overdue')).toEqual(['c']);
    expect(ids('completed')).toEqual(['d']);
    expect(ids('all')).toHaveLength(6);
  });
  it('detects overdue only for open tasks', () => {
    expect(isOverdue(task({ due_date: '2026-11-24' }), today)).toBe(true);
    expect(isOverdue(task({ status: 'done', due_date: '2026-11-24' }), today)).toBe(false);
  });
});
