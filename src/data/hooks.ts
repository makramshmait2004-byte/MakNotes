import { useLiveQuery } from 'dexie-react-hooks';
import { getDb, hasDb, type MakDB } from './db';
import type { Row, TableName } from '@/types/models';

/** Live query against the local database; re-renders whenever the underlying tables change. */
export function useDb<T>(fn: (db: MakDB) => Promise<T> | T, deps: unknown[], fallback: T): T {
  return useLiveQuery(async () => (hasDb() ? fn(getDb()) : fallback), deps, fallback) as T;
}

export function useRow<T extends TableName>(table: T, id: string | null | undefined): Row<T> | undefined {
  return useDb(
    async (db) => {
      if (!id) return undefined;
      const r = (await db.table(table).get(id)) as Row<T> | undefined;
      return r && !r.deleted_at ? r : undefined;
    },
    [table, id],
    undefined,
  );
}

export function useAll<T extends TableName>(table: T, filter?: (r: Row<T>) => boolean, deps: unknown[] = []): Row<T>[] {
  return useDb(
    async (db) => {
      const rows = (await db.table(table).toArray()) as Row<T>[];
      return rows.filter((r) => !r.deleted_at && (!filter || filter(r)));
    },
    [table, ...deps],
    [] as Row<T>[],
  );
}

export function useWhere<T extends TableName>(table: T, index: string, value: string | null | undefined, deps: unknown[] = []): Row<T>[] {
  return useDb(
    async (db) => {
      if (value === null || value === undefined) return [] as Row<T>[];
      const rows = (await db.table(table).where(index).equals(value).toArray()) as Row<T>[];
      return rows.filter((r) => !r.deleted_at);
    },
    [table, index, value, ...deps],
    [] as Row<T>[],
  );
}

export const byPosition = <R extends { position: number; created_at: string }>(a: R, b: R) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at);
