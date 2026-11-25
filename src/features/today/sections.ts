import { BookOpen, CalendarCheck, CalendarClock, Gauge, ListChecks, Moon, PenLine, PenTool, Repeat, StickyNote, Sunrise, Target, Trophy } from 'lucide-react';
import type { SectionLayout } from '@/types/models';

export const SECTIONS = [
  { id: 'schedule', label: "Today's schedule", icon: CalendarClock },
  { id: 'priorities', label: 'Top 3 priorities', icon: Trophy },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'morning', label: 'Morning planning', icon: Sunrise },
  { id: 'quick_notes', label: 'Quick notes', icon: StickyNote },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'handwriting', label: 'Handwriting', icon: PenLine },
  { id: 'sketches', label: 'Sketches', icon: PenTool },
  { id: 'habits', label: 'Habits', icon: Repeat },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'evening', label: 'Evening reflection', icon: Moon },
  { id: 'sunday_review', label: 'Sunday review', icon: CalendarCheck },
  { id: 'progress', label: 'Daily progress', icon: Gauge },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];

/** Default daily page: priorities, tasks, habits, schedule, evening reflection (+ Sunday review on Sundays). */
export const DEFAULT_ORDER: SectionId[] = ['priorities', 'tasks', 'habits', 'schedule', 'evening', 'sunday_review', 'morning', 'quick_notes', 'journal', 'handwriting', 'sketches', 'goals', 'progress'];
export const DEFAULT_HIDDEN: SectionId[] = ['morning', 'quick_notes', 'journal', 'handwriting', 'sketches', 'goals', 'progress'];

/** Resolve the saved layout against the defaults. A layout that was never customized uses the defaults. */
export function resolveLayout(layout: SectionLayout | undefined) {
  const all = SECTIONS.map((s) => s.id) as SectionId[];
  const saved = (layout?.order ?? []).filter((id): id is SectionId => all.includes(id as SectionId));
  const base = saved.length ? saved : DEFAULT_ORDER;
  const order = [...base, ...all.filter((id) => !base.includes(id))];
  return {
    order,
    hidden: new Set<string>(layout?.hidden ?? DEFAULT_HIDDEN),
    collapsed: new Set<string>(layout?.collapsed ?? []),
  };
}

export const SUNDAY_PROMPTS = [
  'What did I finish this week?',
  'What did I not finish, and why?',
  'What do I cut or move?',
  'Which gym did I talk to?',
  "Next week's 3 priorities",
];
