import Dexie from 'dexie';
import { openUserDb, getDb, closeDb } from '@/data/db';
import { insert, setRepoUser } from '@/data/repo';
import { buildBackup, importBackup, tasksToCsv } from './exporters';
import type { Row } from '@/types/models';

const USER = '44444444-4444-4444-8444-444444444444';

describe('backup & restore', () => {
  beforeEach(async () => {
    closeDb();
    await Dexie.delete(`maknotes-${USER}`);
    openUserDb(USER);
    setRepoUser(USER);
  });

  it('round-trips without creating duplicates', async () => {
    const nb = await insert('notebooks', { title: 'Work', category: 'work' });
    const sec = await insert('notebook_sections', { notebook_id: nb.id, title: 'General' });
    await insert('notebook_pages', { notebook_id: nb.id, section_id: sec.id, title: 'Plan' });
    await insert('daily_pages', { id: '55555555-5555-4555-8555-555555555555', date: '2026-11-25' });
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    const again = await importBackup(backup);
    expect(Object.keys(again.imported)).toHaveLength(0);
    expect(again.skippedExisting).toBeGreaterThan(0);
    expect(await getDb().notebooks.count()).toBe(1);
  });

  it('restores into an empty device and rejects broken rows', async () => {
    const backup = {
      format: 'maknotes-backup',
      version: 1,
      exported_at: '2026-11-25T00:00:00Z',
      tables: {
        habits: [{ id: '66666666-6666-4666-8666-666666666666', name: 'Read', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z', evil_column: 'x' }],
        habit_logs: [
          { id: '77777777-7777-4777-8777-777777777777', habit_id: '66666666-6666-4666-8666-666666666666', date: '2026-11-02', created_at: '2026-11-02T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' },
          { id: '88888888-8888-4888-8888-888888888888', habit_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2026-11-02', created_at: '2026-11-02T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' },
          { id: 'not-a-uuid' },
        ],
      },
    };
    const r = await importBackup(backup);
    expect(r.imported).toEqual({ habits: 1, habit_logs: 1 });
    expect(r.rejected).toHaveLength(2);
    const h = await getDb().habits.get('66666666-6666-4666-8666-666666666666');
    expect(h?.user_id).toBe(USER);
    expect((h as unknown as Record<string, unknown>).evil_column).toBeUndefined();
    expect(await getDb().outbox.count()).toBe(2); // queued for upload
  });

  it('rejects files that are not MakNotes backups', async () => {
    await expect(importBackup({ hello: 'world' })).rejects.toThrow(/not a MakNotes backup/);
  });

  it('exports CSV safely', () => {
    const csv = tasksToCsv([{ title: '=HYPERLINK("x")', description: 'a, "b"', status: 'todo', priority: 2, tags: ['x', 'y'], reschedule_history: [] } as unknown as Row<'tasks'>], []);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"a, ""b"""');
    expect(csv).toContain('x; y');
  });
});
