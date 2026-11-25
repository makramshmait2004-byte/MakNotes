import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { insert } from '@/data/repo';
import { hasDb } from '@/data/db';
import { dateInTz } from '@/lib/dates';
import { toast } from '@/components/ui/misc';
import { t } from '@/i18n';

export type Phase = 'focus' | 'short_break' | 'long_break';

interface FocusState {
  phase: Phase;
  running: boolean;
  endsAt: number | null; // epoch ms while running
  remaining: number; // ms while paused
  startedAt: string | null;
  round: number;
  taskId: string | null;
  durations: { focus: number; short: number; long: number; rounds: number };
  tz: string;
}

const ms = (min: number) => Math.round(min * 60_000);
const durationFor = (s: Pick<FocusState, 'durations'>, p: Phase) => ms(p === 'focus' ? s.durations.focus : p === 'short_break' ? s.durations.short : s.durations.long);

export const useFocus = create<FocusState>()(
  persist(
    (): FocusState => ({
      phase: 'focus' as Phase,
      running: false,
      endsAt: null,
      remaining: ms(25),
      startedAt: null,
      round: 1,
      taskId: null,
      durations: { focus: 25, short: 5, long: 15, rounds: 4 },
      tz: 'Asia/Beirut',
    }),
    { name: 'maknotes-focus' },
  ),
);

export function remainingMs(s: FocusState, now = Date.now()) {
  return s.running && s.endsAt ? Math.max(0, s.endsAt - now) : s.remaining;
}

export function configure(durations: FocusState['durations'], tz: string) {
  const s = useFocus.getState();
  const changed = JSON.stringify(s.durations) !== JSON.stringify(durations);
  useFocus.setState({ durations, tz, ...(changed && !s.running && !s.startedAt ? { remaining: durationFor({ durations }, s.phase) } : {}) });
}

export function start() {
  const s = useFocus.getState();
  if (s.running) return;
  useFocus.setState({ running: true, endsAt: Date.now() + s.remaining, startedAt: s.startedAt ?? new Date().toISOString() });
  if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
}

export function pause() {
  const s = useFocus.getState();
  if (!s.running) return;
  useFocus.setState({ running: false, remaining: remainingMs(s), endsAt: null });
}

async function record(s: FocusState, completed: boolean) {
  if (!s.startedAt || !hasDb()) return;
  const elapsed = durationFor(s, s.phase) - remainingMs(s);
  const seconds = Math.round(Math.max(0, Math.min(elapsed, 86_400_000)) / 1000);
  if (!completed && seconds < 60) return; // ignore accidental starts
  await insert('focus_sessions', {
    kind: s.phase,
    task_id: s.taskId,
    started_at: s.startedAt,
    ended_at: new Date().toISOString(),
    duration_seconds: seconds,
    completed,
    date: dateInTz(new Date(s.startedAt), s.tz),
  });
}

export async function stop() {
  const s = useFocus.getState();
  await record(s, false);
  useFocus.setState({ running: false, endsAt: null, startedAt: null, remaining: durationFor(s, s.phase) });
}

export function setPhase(phase: Phase) {
  const s = useFocus.getState();
  useFocus.setState({ phase, running: false, endsAt: null, startedAt: null, remaining: durationFor(s, phase) });
}

async function complete() {
  const s = useFocus.getState();
  await record(s, true);
  let phase: Phase = 'focus';
  let round = s.round;
  if (s.phase === 'focus') phase = s.round % s.durations.rounds === 0 ? 'long_break' : 'short_break';
  else round = s.round + 1;
  useFocus.setState({ phase, round, running: false, endsAt: null, startedAt: null, remaining: durationFor(s, phase) });
  const msg = s.phase === 'focus' ? t('Focus session complete. Take a break.') : t('Break over. Ready to focus?');
  toast(msg, 'success');
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification('MakNotes', { body: msg, tag: 'focus' });
      else new Notification('MakNotes', { body: msg });
    }
  } catch {
    /* ignore */
  }
}

// single global ticker — completes sessions even when the Focus page is not open
if (typeof window !== 'undefined') {
  setInterval(() => {
    const s = useFocus.getState();
    if (s.running && s.endsAt && Date.now() >= s.endsAt) void complete();
  }, 1000);
}
