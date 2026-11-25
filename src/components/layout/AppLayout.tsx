import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarPlus, ChevronsLeft, ChevronsRight, ListPlus, Menu as MenuIcon, PanelRight, PenTool, Plus, StickyNote } from 'lucide-react';
import { NAV } from './nav';
import { SyncBadge } from './SyncBadge';
import { InstallButton, UpdatePrompt } from './pwa';
import { SidePanel } from './SidePanel';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';
import { toggleSidebar, toggleSidePanel, useUi, openTaskDialog, openEventDialog } from '@/stores/ui';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { TaskDialog } from '@/features/tasks/TaskDialog';
import { EventDialog } from '@/features/calendar/EventDialog';
import { createJournalEntry } from '@/features/journal/journalActions';
import { createSketch } from '@/features/sketch/sketchActions';
import { useSettings, useToday } from '@/stores/settings';

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2">
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-foreground" />
        <path d="M8 23V9l8 9 8-9v14" fill="none" stroke="hsl(var(--bronze))" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!collapsed && <span className="font-serif text-lg font-semibold tracking-tight">MakNotes</span>}
    </div>
  );
}

function QuickAddMenu({ children }: { children: React.ReactNode }) {
  const t = useT();
  const nav = useNavigate();
  const today = useToday();
  const settings = useSettings();
  const loc = useLocation();
  const dayMatch = /^\/day\/(\d{4}-\d{2}-\d{2})/.exec(loc.pathname);
  const date = dayMatch ? dayMatch[1] : today;
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align="end">
        <MenuItem onSelect={() => openTaskDialog(undefined, { scheduled_date: date })}>
          <ListPlus /> {t('New task')}
        </MenuItem>
        <MenuItem
          onSelect={async () => {
            const e = await createJournalEntry(date);
            nav(`/journal/${e.id}`);
          }}
        >
          <BookOpen /> {t('Journal entry')}
        </MenuItem>
        <MenuItem onSelect={() => nav(dayMatch ? loc.pathname + '?focus=quick_notes' : '/today?focus=quick_notes')}>
          <StickyNote /> {t('Quick note')}
        </MenuItem>
        <MenuItem
          onSelect={async () => {
            const d = await createSketch({ date, paper: settings.default_paper });
            nav(`/sketchbook/${d.id}`);
          }}
        >
          <PenTool /> {t('Sketch / handwriting')}
        </MenuItem>
        <MenuItem onSelect={() => openEventDialog(undefined, { start_date: date })}>
          <CalendarPlus /> {t('Event')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function AppLayout() {
  const t = useT();
  const { sidebarCollapsed, sidePanel, moreOpen } = useUi();
  const loc = useLocation();
  const fullBleed = /^\/sketchbook\/./.test(loc.pathname);
  const showPanel = sidePanel && /^\/(today|day)/.test(loc.pathname);

  return (
    <div className="flex min-h-dvh">
      <UpdatePrompt />
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-e bg-card/40 py-3 transition-[width] md:flex',
          sidebarCollapsed ? 'w-[60px]' : 'w-56',
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <Logo collapsed={sidebarCollapsed} />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 no-scrollbar">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={t(item.label)}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  (isActive || (item.to === '/today' && loc.pathname.startsWith('/day'))) && 'bg-accent font-medium text-foreground',
                )
              }
            >
              <item.icon className="size-[18px] shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{t(item.label)}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 px-2 pt-2">
          {!sidebarCollapsed && <InstallButton className="w-full" />}
          <div className={cn('flex items-center', sidebarCollapsed ? 'flex-col gap-1' : 'justify-between')}>
            <SyncBadge compact={sidebarCollapsed} />
            <button onClick={toggleSidebar} className="rounded p-2 text-muted-foreground hover:bg-accent" aria-label={t('Toggle sidebar')}>
              {sidebarCollapsed ? <ChevronsRight className="size-4 rtl:rotate-180" /> : <ChevronsLeft className="size-4 rtl:rotate-180" />}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        {!fullBleed && (
          <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-background/90 px-3 pt-safe backdrop-blur md:hidden">
            <Logo />
            <div className="flex items-center gap-1">
              <InstallButton />
              <SyncBadge compact />
            </div>
          </header>
        )}
        {/* Desktop top actions */}
        {!fullBleed && (
          <div className="hidden items-center justify-end gap-2 px-6 pt-4 md:flex">
            <QuickAddMenu>
              <button className="inline-flex h-9 items-center gap-2 rounded-md bg-bronze px-3 text-sm font-medium text-bronze-foreground hover:bg-bronze/90">
                <Plus className="size-4" /> {t('New')}
              </button>
            </QuickAddMenu>
            {/^\/(today|day)/.test(loc.pathname) && (
              <button onClick={toggleSidePanel} className="rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label={t('Toggle calendar panel')}>
                <PanelRight className="size-4" />
              </button>
            )}
          </div>
        )}
        <div className="flex min-w-0 flex-1">
          <main className={cn('min-w-0 flex-1', fullBleed ? '' : 'px-3 pb-28 pt-3 md:px-6 md:pb-10 md:pt-2')}>
            <Outlet />
          </main>
          {showPanel && <SidePanel />}
        </div>
      </div>

      {/* Mobile bottom navigation */}
      {!fullBleed && (
        <>
          <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-safe backdrop-blur md:hidden" aria-label={t('Main navigation')}>
            {NAV.filter((n) => n.mobilePrimary).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground',
                    (isActive || (item.to === '/today' && loc.pathname.startsWith('/day'))) && 'text-bronze',
                  )
                }
              >
                <item.icon className="size-5" />
                {t(item.label)}
              </NavLink>
            ))}
            <button onClick={() => useUi.setState({ moreOpen: true })} className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <MenuIcon className="size-5" />
              {t('More')}
            </button>
          </nav>
          <QuickAddMenu>
            <button
              className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] end-4 z-40 grid size-14 place-items-center rounded-full bg-bronze text-bronze-foreground shadow-lg shadow-black/30 md:hidden"
              aria-label={t('Quick add')}
            >
              <Plus className="size-6" />
            </button>
          </QuickAddMenu>
        </>
      )}

      <Dialog open={moreOpen} onOpenChange={(o) => useUi.setState({ moreOpen: o })}>
        <DialogContent title={t('More')}>
          <div className="grid grid-cols-3 gap-2">
            {NAV.filter((n) => !n.mobilePrimary).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => useUi.setState({ moreOpen: false })}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-sm hover:bg-accent"
              >
                <item.icon className="size-6 text-bronze" />
                {t(item.label)}
              </NavLink>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <SyncBadge />
            <InstallButton />
          </div>
        </DialogContent>
      </Dialog>

      <TaskDialog />
      <EventDialog />
    </div>
  );
}
