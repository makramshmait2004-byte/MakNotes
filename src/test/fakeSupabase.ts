// Minimal in-memory stand-in for the parts of supabase-js the sync engine uses.
// Simulates server-assigned updated_at, unique ids (23505) and per-user row visibility (RLS).
type Row = Record<string, unknown> & { id: string; updated_at: string; user_id: string };

export class FakeServer {
  tables = new Map<string, Map<string, Row>>();
  private clock = Date.parse('2026-11-25T10:00:00Z');
  failNetwork = false;
  now() {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }
  table(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }
  client(userId: string) {
    return new FakeClient(this, userId);
  }
}

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'insert' | 'update' = 'select';
  private payload: Record<string, unknown> | null = null;
  private single = false;
  private lim = Infinity;
  constructor(private server: FakeServer, private name: string, private userId: string) {}
  select() {
    return this;
  }
  insert(p: Record<string, unknown>) {
    this.op = 'insert';
    this.payload = p;
    return this;
  }
  update(p: Record<string, unknown>) {
    this.op = 'update';
    this.payload = p;
    return this;
  }
  eq(k: string, v: unknown) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  gte(k: string, v: string) {
    this.filters.push((r) => String(r[k]) >= v);
    return this;
  }
  gt(k: string, v: string) {
    this.filters.push((r) => String(r[k]) > v);
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  then<A, B>(ok?: ((v: { data: unknown; error: unknown }) => A) | null, bad?: ((e: unknown) => B) | null) {
    return Promise.resolve(this.exec()).then(ok, bad);
  }
  private exec(): { data: unknown; error: unknown } {
    if (this.server.failNetwork) return { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } };
    const t = this.server.table(this.name);
    const mine = (r: Row) => r.user_id === this.userId;
    if (this.op === 'insert') {
      const p = this.payload as Row;
      if (p.user_id !== this.userId) return { data: null, error: { message: 'rls', code: '42501' } };
      if (t.has(p.id)) return { data: null, error: { message: 'duplicate key', code: '23505' } };
      const row = { ...p, updated_at: this.server.now() } as Row;
      t.set(row.id, row);
      return { data: this.single ? { ...row } : [{ ...row }], error: null };
    }
    const rows = [...t.values()].filter((r) => mine(r) && this.filters.every((f) => f(r)));
    if (this.op === 'update') {
      const out = rows.map((r) => {
        const next = { ...r, ...this.payload, id: r.id, user_id: r.user_id, updated_at: this.server.now() } as Row;
        t.set(r.id, next);
        return { ...next };
      });
      return { data: out, error: null };
    }
    const sorted = rows.sort((a, b) => a.updated_at.localeCompare(b.updated_at)).slice(0, this.lim);
    return { data: this.single ? (sorted[0] ? { ...sorted[0] } : null) : sorted.map((r) => ({ ...r })), error: null };
  }
}

class FakeClient {
  constructor(private server: FakeServer, private userId: string) {}
  from(name: string) {
    return new Query(this.server, name, this.userId);
  }
  channel() {
    const ch = { on: () => ch, subscribe: () => ch };
    return ch;
  }
  removeChannel() {
    return Promise.resolve();
  }
  storage = {
    from: () => ({
      upload: async () => ({ data: {}, error: null }),
      createSignedUrl: async () => ({ data: null, error: { message: 'offline test storage' } }),
      download: async () => ({ data: null, error: { message: 'offline test storage' } }),
      remove: async () => ({ data: [], error: null }),
      list: async () => ({ data: [], error: null }),
    }),
  };
  rpc = async () => ({ data: new Date().toISOString(), error: null });
  auth = {
    getSession: async () => ({ data: { session: { user: { id: this.userId, email: 'e2e@maknotes.test' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
  };
}
