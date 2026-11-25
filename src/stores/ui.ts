import { create } from 'zustand';
import type { Task, CalendarEvent } from '@/types/models';

interface UiState {
  sidebarCollapsed: boolean;
  sidePanel: boolean;
  taskDialog: { open: boolean; taskId?: string; defaults?: Partial<Task> };
  eventDialog: { open: boolean; eventId?: string; defaults?: Partial<CalendarEvent> };
  moreOpen: boolean;
}

const read = (k: string, d: boolean) => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : v === '1';
  } catch {
    return d;
  }
};

export const useUi = create<UiState>(() => ({
  sidebarCollapsed: read('maknotes-sidebar-collapsed', false),
  sidePanel: read('maknotes-side-panel', true),
  taskDialog: { open: false },
  eventDialog: { open: false },
  moreOpen: false,
}));

export function toggleSidebar() {
  const v = !useUi.getState().sidebarCollapsed;
  useUi.setState({ sidebarCollapsed: v });
  try {
    localStorage.setItem('maknotes-sidebar-collapsed', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}
export function toggleSidePanel() {
  const v = !useUi.getState().sidePanel;
  useUi.setState({ sidePanel: v });
  try {
    localStorage.setItem('maknotes-side-panel', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}
export const openTaskDialog = (taskId?: string, defaults?: Partial<Task>) => useUi.setState({ taskDialog: { open: true, taskId, defaults } });
export const closeTaskDialog = () => useUi.setState({ taskDialog: { open: false } });
export const openEventDialog = (eventId?: string, defaults?: Partial<CalendarEvent>) => useUi.setState({ eventDialog: { open: true, eventId, defaults } });
export const closeEventDialog = () => useUi.setState({ eventDialog: { open: false } });
