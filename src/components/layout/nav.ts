import {
  BarChart3,
  BookOpen,
  CalendarDays,
  FolderKanban,
  ListChecks,
  NotebookPen,
  PenTool,
  Repeat,
  Settings,
  Sun,
  Target,
  Timer,
  Search,
  Home,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  mobilePrimary?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/today', label: 'Today', icon: Sun, mobilePrimary: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, mobilePrimary: true },
  { to: '/journal', label: 'Journal', icon: BookOpen, mobilePrimary: true },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, mobilePrimary: true },
  { to: '/notebooks', label: 'Notebooks', icon: NotebookPen },
  { to: '/sketchbook', label: 'Sketchbook', icon: PenTool },
  { to: '/habits', label: 'Habits', icon: Repeat },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/settings', label: 'Settings', icon: Settings },
];
