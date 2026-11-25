import Dexie from 'dexie';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FakeServer } from '@/test/fakeSupabase';
import { openUserDb, getDb, closeDb } from './db';
import { insert, setRepoUser, update, remove } from './repo';
import { SyncEngine } from './sync';

const USER = '11111111-1111-4111-8111-111111111111';

/** Two "devices" for the same user: separate IndexedDB databases, same fake server. */
async function device(server: FakeServer, name: string) {
  closeDb();
  await Dexie.delete(`maknotes-${USER}`);
  // each device gets its own IndexedDB by deleting/reopening around operations
  return { name, engine: new SyncEngine(server.client(USER) as unknown as SupabaseClient, USER) };
}

async function snapshot() {
  const db = getDb();
  const out: Record<string, unknown[]> = {};
  for (const t of db.tables) out[t.name] = await t.toArray();
  return out;
}
async function restoreSnapshot(s: Record<string, unknown[]>) {
  const db = getDb();
  for (const t of db.tables) {
    await t.clear();
    if (s[t.name]?.length) await t.bulkPut(s[t.name] as never[]);
  }
}

describe('sync engine', () => {
  let server: FakeServer;
  beforeEach(async () => {
    server = new FakeServer();
    closeDb();
    await Dexie.delete(`maknotes-${USER}`);
    openUserDb(USER);
    setRepoUser(USER);
  });

  it('pushes offline edits when the network returns', async () => {
    const { engine } = await device(server, 'phone');
    openUserDb(USER);
    server.failNetwork = true;
    await insert('tasks', { title: 'Buy ink' });
    await engine.push().catch(() => undefined);
    expect(await getDb().outbox.count()).toBe(1);
    expect(server.table('tasks').size).toBe(0);
    server.failNetwork = false;
    await engine.push();
    expect(await getDb().outbox.count()).toBe(0);
    const [row] = [...server.table('tasks').values()];
    expect(row.title).toBe('Buy ink');
    const local = await getDb().tasks.get(row.id);
    expect(local?._base).toBe(row.updated_at);
    expect(local?._dirty).toBe(0);
  });

  it('pulls changes from another device and soft deletions', async () => {
    const phone = server.client(USER);
    await phone.from('journal_entries').insert({ id: '22222222-2222-4222-8222-222222222222', user_id: USER, entry_date: '2026-11-25', title: 'From phone', deleted_at: null });
    const engine = new SyncEngine(phone as unknown as SupabaseClient, USER);
    await engine.pull();
    expect((await getDb().journal_entries.get('22222222-2222-4222-8222-222222222222'))?.title).toBe('From phone');
    await phone.from('journal_entries').update({ deleted_at: new Date().toISOString() }).eq('id', '22222222-2222-4222-8222-222222222222');
    await engine.pull();
    expect((await getDb().journal_entries.get('22222222-2222-4222-8222-222222222222'))?.deleted_at).toBeTruthy();
  });

  it('merges non-overlapping edits from two devices (three-way merge)', async () => {
    const engine = new SyncEngine(server.client(USER) as unknown as SupabaseClient, USER);
    const t = await insert('tasks', { title: 'Write report', priority: 0 });
    await engine.push();
    // other device changes the priority
    await server.client(USER).from('tasks').update({ priority: 3 }).eq('id', t.id);
    // this device (without pulling) changes the title
    await update('tasks', t.id, { title: 'Write final report' });
    await engine.syncNow();
    const s = server.table('tasks').get(t.id)!;
    expect(s.title).toBe('Write final report');
    expect(s.priority).toBe(3);
    expect(await getDb().conflicts.count()).toBe(0);
  });

  it('detects a real conflict instead of silently overwriting', async () => {
    const engine = new SyncEngine(server.client(USER) as unknown as SupabaseClient, USER);
    const t = await insert('tasks', { title: 'Original' });
    await engine.push();
    await server.client(USER).from('tasks').update({ title: 'Laptop version' }).eq('id', t.id);
    await update('tasks', t.id, { title: 'Phone version' });
    await engine.push();
    expect(server.table('tasks').get(t.id)!.title).toBe('Laptop version'); // newer data not overwritten
    const conflicts = await getDb().conflicts.toArray();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].local.title).toBe('Phone version');
    // user chooses to keep this device's version
    await engine.resolveConflict(conflicts[0].key, 'local');
    await engine.push();
    expect(server.table('tasks').get(t.id)!.title).toBe('Phone version');
  });

  it('never duplicates the daily page created offline on two devices', async () => {
    const { stableId } = await import('@/lib/ids');
    const id = stableId(USER, 'day', '2026-11-25');
    // laptop created it first
    await server.client(USER).from('daily_pages').insert({ id, user_id: USER, date: '2026-11-25', mood: 4, quick_notes: null, deleted_at: null });
    // phone created the same page offline with notes
    await insert('daily_pages', { id, date: '2026-11-25', quick_notes: { type: 'doc' } });
    const engine = new SyncEngine(server.client(USER) as unknown as SupabaseClient, USER);
    await engine.syncNow();
    expect(server.table('daily_pages').size).toBe(1);
    const row = server.table('daily_pages').get(id)!;
    expect(row.mood).toBe(4);
    expect(row.quick_notes).toEqual({ type: 'doc' });
  });

  it('persists drawing strokes and their deletion', async () => {
    const engine = new SyncEngine(server.client(USER) as unknown as SupabaseClient, USER);
    const d = await insert('drawings', { kind: 'sketch' });
    const s1 = await insert('drawing_strokes', { drawing_id: d.id, tool: 'pen', color: '#111111', width: 3, points: [0, 0, 0.5, 10, 10, 0.7], seq: 1 });
    await insert('drawing_strokes', { drawing_id: d.id, tool: 'highlighter', color: '#facc15', width: 20, points: [5, 5, 0.5], seq: 2 });
    await engine.push();
    expect(server.table('drawing_strokes').size).toBe(2);
    expect(server.table('drawing_strokes').get(s1.id)!.points).toEqual([0, 0, 0.5, 10, 10, 0.7]);
    await remove('drawing_strokes', s1.id);
    await engine.push();
    expect(server.table('drawing_strokes').get(s1.id)!.deleted_at).toBeTruthy();
    // a fresh device restores the vector strokes exactly
    const snap = await snapshot();
    await restoreSnapshot({});
    await engine.pull();
    const strokes = (await getDb().drawing_strokes.toArray()).filter((s) => !s.deleted_at);
    expect(strokes).toHaveLength(1);
    expect(strokes[0].tool).toBe('highlighter');
    void snap;
  });

  it('keeps users isolated (simulated RLS)', async () => {
    const other = '99999999-9999-4999-8999-999999999999';
    await server.client(other).from('tasks').insert({ id: '33333333-3333-4333-8333-333333333333', user_id: other, title: 'Secret', deleted_at: null });
    const engine = new SyncEngine(server.client(USER) as unknown as SupabaseClient, USER);
    await engine.pull();
    expect(await getDb().tasks.count()).toBe(0);
  });
});
