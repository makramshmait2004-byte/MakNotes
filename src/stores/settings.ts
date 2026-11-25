import { useEffect } from 'react';
import { useDb } from '@/data/hooks';
import { insert, update, currentUserId } from '@/data/repo';
import { getDb } from '@/data/db';
import { stableId } from '@/lib/ids';
import { DEFAULT_TZ, todayISO } from '@/lib/dates';
import { setLang } from '@/i18n';
import type { UserSettings, Row } from '@/types/models';

export const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'> = {
  timezone: DEFAULT_TZ,
  language: 'en',
  theme: 'dark',
  start_page: 'today',
  week_start: 1,
  section_layout: {},
  reflection_prompts: true,
  pen_only: false,
  default_paper: 'lined',
  pomodoro: { focus: 25, short: 5, long: 15, rounds: 4 },
};

export type Settings = typeof DEFAULT_SETTINGS & { id?: string };

export function useSettings(): Settings {
  const row = useDb(async (db) => (await db.user_settings.toArray()).find((r) => !r.deleted_at), [], undefined as Row<'user_settings'> | undefined);
  return row ? { ...DEFAULT_SETTINGS, ...row } : cachedSettings();
}

function cachedSettings(): Settings {
  try {
    const raw = localStorage.getItem('maknotes-settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<UserSettings>) {
  const db = getDb();
  const existing = (await db.user_settings.toArray()).find((r) => !r.deleted_at);
  if (existing) await update('user_settings', existing.id, patch);
  else await insert('user_settings', { ...DEFAULT_SETTINGS, ...patch, id: stableId(currentUserId(), 'settings') });
}

export function useToday(): string {
  const { timezone } = useSettings();
  return todayISO(timezone);
}

/** Applies theme, language and direction to the document. */
export function useApplySettings(settings: Settings) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f0f10' : '#f7f6f3');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    setLang(settings.language);
    try {
      localStorage.setItem('maknotes-settings', JSON.stringify({ theme: settings.theme, language: settings.language, timezone: settings.timezone, week_start: settings.week_start }));
    } catch {
      /* ignore */
    }
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme, settings.language, settings.timezone, settings.week_start]);
}
