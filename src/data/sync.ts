// Synchronization engine: pushes the persistent outbox to Supabase, pulls remote changes,
// listens to Realtime, and detects conflicts using the server-assigned updated_at as a version.
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import { getDb, hasDb, type ConflictItem } from './db';
import { onLocalChange, stripLocal } from './repo';
import { TABLES } from './tables';
import type { TableName } from '@/types/models';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface SyncStatus {
  state: SyncState;
  pending: number;
  pendingFiles: number;
  conflicts: number;
  lastSyncedAt: number | null;
  lastError: string | null;
  initialPullDone: boolean;
}

export const useSyncStore = create<SyncStatus>(() => ({
  state: 'idle',
  pending: 0,
  pendingFiles: 0,
  conflicts: 0,
  lastSyncedAt: null,
  lastError: null,
  initialPullDone: false,
}));

const set = (p: Partial<SyncStatus>) => useSyncStore.setState(p);

type AnyRow = Record<string, unknown> & { id: string; updated_at: string; deleted_at?: string | null };
type LocalRow = AnyRow & { _base?: string | null; _dirty?: number; _rev?: number; _orig?: Record<string, unknown> };

class NetworkError extends Error {}

function isNetworkError(err: { message?: string; code?: string; status?: number } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    !err.code &&
    (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed') || msg.includes('fetch'))
  );
}

const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const PAGE = 1000;

/** Natural unique keys enforced by the database, used to reconcile rows created on two devices. */
const NATURAL_KEYS: Partial<Record<TableName, string[]>> = {
  profiles: ['user_id'],
  user_settings: ['user_id'],
  daily_pages: ['date'],
  daily_priorities: ['daily_page_id', 'position'],
  daily_reflections: ['daily_page_id', 'kind'],
  habit_logs: ['habit_id', 'date'],
  tags: ['name'],
  attachments: ['bucket', 'path'],
};
const OVERLAP_MS = 5000;

export class SyncEngine {
  private client: SupabaseClient;
  private userId: string;
  private channel: RealtimeChannel | null = null;
  private running = false;
  private again = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private unsubs: Array<() => void> = [];
  private stopped = false;

  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  start(opts: { realtime?: boolean } = {}) {
    this.stopped = false;
    const off = onLocalChange(() => {
      void this.refreshCounts();
      this.schedulePush();
    });
    this.unsubs.push(() => off());
    if (typeof window !== 'undefined') {
      const online = () => void this.syncNow();
      const offline = () => set({ state: 'offline' });
      const visible = () => document.visibilityState === 'visible' && void this.syncNow();
      window.addEventListener('online', online);
      window.addEventListener('offline', offline);
      document.addEventListener('visibilitychange', visible);
      this.unsubs.push(() => {
        window.removeEventListener('online', online);
        window.removeEventListener('offline', offline);
        document.removeEventListener('visibilitychange', visible);
      });
      this.interval = setInterval(() => void this.syncNow(), 90_000);
    }
    if (opts.realtime !== false) this.subscribeRealtime();
    void this.refreshCounts();
    void this.syncNow();
  }

  stop() {
    this.stopped = true;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.interval) clearInterval(this.interval);
    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.channel) void this.client.removeChannel(this.channel);
    this.channel = null;
  }

  schedulePush(delay = 700) {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.syncNow({ pullAfter: false }), delay);
  }

  async refreshCounts() {
    if (!hasDb()) return;
    const db = getDb();
    const [pending, conflicts, pendingFiles] = await Promise.all([
      db.outbox.count(),
      db.conflicts.count(),
      db.files.where('uploaded').equals(0).count(),
    ]);
    set({ pending, conflicts, pendingFiles });
  }

  /** Push local changes, then pull remote ones. Safe to call repeatedly. */
  async syncNow(opts: { pullAfter?: boolean } = {}): Promise<void> {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      set({ state: 'offline' });
      return;
    }
    this.running = true;
    set({ state: 'syncing' });
    try {
      // a few passes: merged rows and children waiting for parents are retried immediately
      for (let pass = 0; pass < 3; pass++) {
        const before = await getDb().outbox.count();
        if (!before) break;
        await this.push();
        const after = await getDb().outbox.count();
        if (after === 0 || after >= before) break;
      }
      await this.uploadFiles();
      if (opts.pullAfter !== false || !useSyncStore.getState().initialPullDone) await this.pull();
      await this.refreshCounts();
      const s = useSyncStore.getState();
      // Items still queued without an error are simply newer edits (a push is already scheduled).
      const failed = s.pending > 0 && !!s.lastError;
      set({ state: failed ? 'error' : s.pending > 0 ? 'idle' : 'synced', lastSyncedAt: Date.now(), lastError: failed ? s.lastError : null });
      if (s.pending > 0 && !failed) this.schedulePush(300);
    } catch (e) {
      await this.refreshCounts();
      if (e instanceof NetworkError) set({ state: 'offline', lastError: null });
      else set({ state: 'error', lastError: (e as Error).message });
    } finally {
      this.running = false;
      if (this.again && !this.stopped) {
        this.again = false;
        setTimeout(() => void this.syncNow(opts), 50);
      }
    }
  }

  // ------------------------------------------------------------------ push
  async push(): Promise<void> {
    const db = getDb();
    const items = await db.outbox.orderBy('seq').toArray();
    let lastError: string | null = null;
    for (const item of items) {
      if (this.stopped) return;
      const attempt = () =>
        this.pushOne(item.table, item.rowId).catch((e) => {
          if (e instanceof NetworkError) throw e;
          lastError = `${item.table}: ${(e as Error).message}`;
          return null;
        });
      // false = merged locally with the server version; push the merge immediately
      let ok = await attempt();
      for (let i = 0; ok === false && i < 2; i++) ok = await attempt();
      if (ok !== true && item.seq !== undefined && (await db.outbox.get(item.seq))) {
        await db.outbox.update(item.seq, { attempts: item.attempts + 1, lastError: lastError ?? undefined });
      }
    }
    set({ lastError });
  }

  /** Returns true when the item was resolved (pushed, merged, or turned into a conflict). */
  private async pushOne(table: TableName, rowId: string): Promise<boolean> {
    const db = getDb();
    const t = db.table(table);
    const row = (await t.get(rowId)) as LocalRow | undefined;
    if (!row) {
      await db.outbox.where('[table+rowId]').equals([table, rowId]).delete();
      return true;
    }
    const rev = row._rev ?? 0;
    const payload = stripLocal(row);
    payload.user_id = this.userId;

    if (!row._base) {
      const { data, error } = await this.client.from(table).insert(payload).select().maybeSingle();
      if (error) {
        if (isNetworkError(error)) throw new NetworkError(error.message);
        if (error.code === '23505') return this.handleDuplicateInsert(table, row);
        if (error.code === '23503') throw new Error(`waiting for parent row (${error.message})`);
        throw new Error(error.message);
      }
      await this.commit(table, rowId, rev, data as AnyRow);
      return true;
    }

    const { data, error } = await this.client.from(table).update(payload).eq('id', rowId).eq('updated_at', row._base).select();
    if (error) {
      if (isNetworkError(error)) throw new NetworkError(error.message);
      if (error.code === '23503') throw new Error(`waiting for parent row (${error.message})`);
      throw new Error(error.message);
    }
    if (data && data.length > 0) {
      await this.commit(table, rowId, rev, data[0] as AnyRow);
      return true;
    }
    // Zero rows: someone else changed (or deleted) the row since our base version.
    const server = await this.fetchRow(table, rowId);
    return this.handleConflict(table, row, server);
  }

  private async fetchRow(table: TableName, id: string): Promise<AnyRow | null> {
    const { data, error } = await this.client.from(table).select('*').eq('id', id).maybeSingle();
    if (error) {
      if (isNetworkError(error)) throw new NetworkError(error.message);
      throw new Error(error.message);
    }
    return (data as AnyRow) ?? null;
  }

  private async handleDuplicateInsert(table: TableName, local: LocalRow): Promise<boolean> {
    let server = await this.fetchRow(table, local.id);
    if (!server) {
      // Same natural key (e.g. one settings row per user) but a different id: adopt the server id.
      const keys = NATURAL_KEYS[table];
      if (!keys) throw new Error('duplicate key on a different row');
      let q = this.client.from(table).select('*');
      for (const k of keys) q = q.eq(k, local[k] as string);
      const { data, error } = await q.maybeSingle();
      if (error) {
        if (isNetworkError(error)) throw new NetworkError(error.message);
        throw new Error(error.message);
      }
      if (!data) throw new Error('duplicate key on a different row');
      server = data as AnyRow;
      const db = getDb();
      const oldId = local.id;
      await db.transaction('rw', db.table(table), db.outbox, async () => {
        await db.table(table).delete(oldId);
        await db.outbox.where('[table+rowId]').equals([table, oldId]).delete();
      });
      local = { ...local, id: server.id };
      await db.table(table).put({ ...local, _base: null });
      await db.outbox.add({ table, rowId: server.id, queuedAt: Date.now(), attempts: 0 });
    }
    // Both devices created the same deterministic row: merge fields that only one side filled in.
    const merged: Record<string, unknown> = { ...server };
    let clash = false;
    for (const [k, v] of Object.entries(stripLocal(local))) {
      if (['id', 'user_id', 'created_at', 'updated_at'].includes(k)) continue;
      const sv = server[k];
      const emptyServer = sv === null || sv === undefined || sv === '' || (Array.isArray(sv) && sv.length === 0) || deepEqual(sv, {});
      if (emptyServer) merged[k] = v;
      else if (!deepEqual(sv, v) && !(v === null || v === '' || (Array.isArray(v) && v.length === 0) || deepEqual(v, {}))) clash = true;
    }
    if (clash) return this.recordConflict(table, local, server);
    const db = getDb();
    await db.table(table).put({ ...merged, _base: server.updated_at, _dirty: 1, _rev: (local._rev ?? 0) + 1, _orig: {} });
    return false; // stays in the outbox; next pass pushes the merge as an update
  }

  private async handleConflict(table: TableName, local: LocalRow, server: AnyRow | null): Promise<boolean> {
    const db = getDb();
    if (!server) {
      // Row was purged on the server. If we deleted it too, nothing to do.
      if (local.deleted_at) {
        await db.transaction('rw', db.table(table), db.outbox, async () => {
          await db.table(table).delete(local.id);
          await db.outbox.where('[table+rowId]').equals([table, local.id]).delete();
        });
        return true;
      }
      return this.recordConflict(table, local, null);
    }
    // Three-way merge: if the server did not touch any field we changed, apply our fields on top.
    const orig = local._orig ?? {};
    const changed = Object.keys(orig);
    const safe = changed.length > 0 && changed.every((k) => deepEqual(server[k], orig[k]) || deepEqual(server[k], local[k]));
    if (safe) {
      const merged: Record<string, unknown> = { ...server };
      for (const k of changed) merged[k] = local[k];
      await db.table(table).put({ ...merged, _base: server.updated_at, _dirty: 1, _rev: (local._rev ?? 0) + 1, _orig: {} });
      return false; // pushed on the next pass with the new base
    }
    return this.recordConflict(table, local, server);
  }

  /** Keep the newer server version visible, and park our local version for the user to decide. */
  private async recordConflict(table: TableName, local: LocalRow, server: AnyRow | null): Promise<boolean> {
    const db = getDb();
    const item: ConflictItem = {
      key: `${table}:${local.id}`,
      table,
      rowId: local.id,
      local: stripLocal(local),
      server,
      detectedAt: Date.now(),
    };
    await db.transaction('rw', db.table(table), db.outbox, db.conflicts, async () => {
      await db.conflicts.put(item);
      if (server) await db.table(table).put({ ...server, _base: server.updated_at, _dirty: 0, _rev: (local._rev ?? 0) + 1, _orig: {} });
      else await db.table(table).put({ ...local, deleted_at: new Date().toISOString(), _base: null, _dirty: 0, _orig: {} });
      await db.outbox.where('[table+rowId]').equals([table, local.id]).delete();
    });
    return true;
  }

  async resolveConflict(key: string, keep: 'local' | 'server') {
    const db = getDb();
    const c = await db.conflicts.get(key);
    if (!c) return;
    await db.transaction('rw', db.table(c.table), db.outbox, db.conflicts, async () => {
      if (keep === 'local') {
        const base = c.server ? (c.server.updated_at as string) : null;
        await db.table(c.table).put({ ...c.local, _base: base, _dirty: 1, _rev: Date.now(), _orig: {} });
        const ex = await db.outbox.where('[table+rowId]').equals([c.table, c.rowId]).first();
        if (!ex) await db.outbox.add({ table: c.table, rowId: c.rowId, queuedAt: Date.now(), attempts: 0 });
      }
      await db.conflicts.delete(key);
    });
    await this.refreshCounts();
    this.schedulePush(50);
  }

  /** Replace the local row with the server's response unless it was edited again during the request. */
  private async commit(table: TableName, rowId: string, rev: number, server: AnyRow) {
    const db = getDb();
    await db.transaction('rw', db.table(table), db.outbox, async () => {
      const cur = (await db.table(table).get(rowId)) as LocalRow | undefined;
      if (!cur || (cur._rev ?? 0) === rev) {
        await db.table(table).put({ ...server, _base: server.updated_at, _dirty: 0, _rev: rev, _orig: {} });
        await db.outbox.where('[table+rowId]').equals([table, rowId]).delete();
      } else {
        // edited meanwhile: keep local edits, advance the base version; stays queued
        await db.table(table).put({ ...cur, _base: server.updated_at, _orig: {} });
      }
    });
  }

  // ------------------------------------------------------------------ pull
  async pull(): Promise<void> {
    const queue = [...TABLES];
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const table = queue.shift()!;
        await this.pullTable(table);
      }
    });
    await Promise.all(workers);
    set({ initialPullDone: true });
  }

  async pullTable(table: TableName): Promise<number> {
    const db = getDb();
    const key = `cursor:${table}`;
    const cursor = ((await db.meta.get(key))?.value as string | undefined) ?? null;
    let since = cursor ? new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString() : null;
    let strict = false;
    let total = 0;
    let maxSeen = cursor;
    for (;;) {
      let q = this.client.from(table).select('*').order('updated_at', { ascending: true }).order('id').limit(PAGE);
      if (since) q = strict ? q.gt('updated_at', since) : q.gte('updated_at', since);
      const { data, error } = await q;
      if (error) {
        if (isNetworkError(error)) throw new NetworkError(error.message);
        throw new Error(`${table}: ${error.message}`);
      }
      const rows = (data ?? []) as AnyRow[];
      await this.mergeRows(table, rows);
      total += rows.length;
      if (rows.length) {
        const last = rows[rows.length - 1].updated_at;
        if (!maxSeen || new Date(last).getTime() >= new Date(maxSeen).getTime()) maxSeen = last;
      }
      if (rows.length < PAGE) break;
      since = rows[rows.length - 1].updated_at;
      strict = true;
    }
    if (maxSeen && maxSeen !== cursor) await db.meta.put({ key, value: maxSeen });
    return total;
  }

  /** Merge server rows into IndexedDB without clobbering rows that have unpushed local edits. */
  async mergeRows(table: TableName, rows: AnyRow[]) {
    if (!rows.length) return;
    const db = getDb();
    await db.transaction('rw', db.table(table), async () => {
      for (const server of rows) {
        const local = (await db.table(table).get(server.id)) as LocalRow | undefined;
        if (local?._dirty) continue; // the push step will reconcile with a 3-way merge
        if (local && local._base === server.updated_at) continue;
        await db.table(table).put({ ...server, _base: server.updated_at, _dirty: 0, _rev: local?._rev ?? 0, _orig: {} });
      }
    });
  }

  private subscribeRealtime() {
    const ch = this.client.channel(`maknotes-${this.userId}`);
    for (const table of TABLES) {
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${this.userId}` },
        (payload) => {
          const row = payload.new as AnyRow;
          if (row && row.id) void this.mergeRows(table, [row]);
        },
      );
    }
    ch.subscribe();
    this.channel = ch;
  }

  // ------------------------------------------------------------------ files
  async uploadFiles() {
    const db = getDb();
    const pending = await db.files.where('uploaded').equals(0).toArray();
    for (const f of pending) {
      const { error } = await this.client.storage.from(f.bucket).upload(f.path, f.blob, { upsert: true, contentType: f.blob.type || undefined });
      if (error) {
        if (isNetworkError(error as never)) throw new NetworkError(error.message);
        await db.files.update(f.id, { attempts: f.attempts + 1 });
        set({ lastError: `upload ${f.path}: ${error.message}` });
        continue;
      }
      await db.files.update(f.id, { uploaded: 1 });
    }
  }
}

let engine: SyncEngine | null = null;

export function startSync(client: SupabaseClient, userId: string) {
  engine?.stop();
  engine = new SyncEngine(client, userId);
  engine.start();
  return engine;
}

export function stopSync() {
  engine?.stop();
  engine = null;
  useSyncStore.setState({ state: 'idle', pending: 0, conflicts: 0, pendingFiles: 0, initialPullDone: false });
}

export function getSyncEngine() {
  return engine;
}
