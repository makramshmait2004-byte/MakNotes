import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

const NAMESPACE = '6f1d3c2e-9b7a-4b8e-8a51-2d6f0c9e4a17';

export const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : uuidv4());

/**
 * Deterministic id for rows that must be unique per natural key (e.g. one daily page per user per date).
 * Two offline devices creating "the same" row produce the same id, so sync merges instead of duplicating.
 */
export const stableId = (...parts: string[]): string => uuidv5(parts.join('|'), NAMESPACE);
