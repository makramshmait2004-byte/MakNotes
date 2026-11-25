import Dexie, { type Table } from 'dexie';
import type { Row, TableName, TableRowMap } from '@/types/models';
import { INDEXES, TABLES } from './tables';

export interface OutboxItem {
  seq?: number;
  table: TableName;
  rowId: string;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

export interface ConflictItem {
  key: string; // `${table}:${rowId}`
  table: TableName;
  rowId: string;
  local: Record<string, unknown>;
  server: Record<string, unknown> | null;
  detectedAt: number;
}

export interface LocalFile {
  id: string; // attachment id
  bucket: string;
  path: string;
  blob: Blob;
  uploaded: 0 | 1;
  attempts: number;
}

export interface MetaItem {
  key: string;
  value: unknown;
}

type Tables = { [K in TableName]: Table<Row<K>, string> };

export type MakDB = Dexie &
  Tables & {
    outbox: Table<OutboxItem, number>;
    conflicts: Table<ConflictItem, string>;
    files: Table<LocalFile, string>;
    meta: Table<MetaItem, string>;
  };

function schema() {
  const s: Record<string, string> = {};
  for (const t of TABLES) {
    const extra = INDEXES[t];
    s[t] = ['id', 'updated_at', 'deleted_at', '_dirty', extra].filter(Boolean).join(', ');
  }
  s.outbox = '++seq, &[table+rowId], table';
  s.conflicts = 'key, table';
  s.files = 'id, uploaded';
  s.meta = 'key';
  return s;
}

let current: MakDB | null = null;

/** Each signed-in user gets a separate IndexedDB database so workspaces never mix on a shared device. */
export function openUserDb(userId: string): MakDB {
  if (current && current.name === `maknotes-${userId}`) return current;
  current?.close();
  const db = new Dexie(`maknotes-${userId}`) as MakDB;
  db.version(1).stores(schema());
  current = db;
  return db;
}

export function getDb(): MakDB {
  if (!current) throw new Error('Local database is not open (no signed-in user).');
  return current;
}

export function hasDb(): boolean {
  return current !== null;
}

export async function closeAndDeleteUserDb(userId: string) {
  if (current?.name === `maknotes-${userId}`) {
    current.close();
    current = null;
  }
  await Dexie.delete(`maknotes-${userId}`);
}

export function closeDb() {
  current?.close();
  current = null;
}

export type { TableRowMap };
