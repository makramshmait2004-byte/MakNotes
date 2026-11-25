import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MiniMonth } from '@/features/calendar/CalendarPage';
import { useAll } from '@/data/hooks';
import { useLocale, useT } from '@/i18n';
import { useToday } from '@/stores/settings';
import { addDays, addMonths, formatDate } from '@/lib/dates';
import { TaskItem } from '@/features/tasks/TaskItem';

/** Optional desktop panel next to the daily workspace: month calendar + upcoming tasks. */
export function SidePanel() {
  const t = useT();
  const locale = useLocale();
  const nav = useNavigate();
  const today = useToday();
  const { date } = useParams();
  const selected = date ?? today;
  const [month, setMonth] = useState(selected.slice(0, 8) + '01');
  const horizon = addDays(today, 7);
  const upcoming = useAll('tasks', (x) => x.status === 'todo' && !!x.scheduled_date && x.scheduled_date > today && x.scheduled_date <= horizon, [today]);
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 overflow-y-auto border-s px-4 py-4 xl:block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{formatDate(month, locale, { month: 'long', year: 'numeric' })}</span>
        <div className="flex">
          <button onClick={() => setMonth(addMonths(month, -1))} className="rounded p-1 hover:bg-accent" aria-label={t('Previous month')}>
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </button>
          <button onClick={() => setMonth(addMonths(month, 1))} className="rounded p-1 hover:bg-accent" aria-label={t('Next month')}>
            <ChevronRight className="size-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
      <MiniMonth month={month} selected={selected} onPick={(d) => nav(d === today ? '/today' : `/day/${d}`)} />
      <h3 className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('Next 7 days')}</h3>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('Nothing upcoming.')}</p>
      ) : (
        upcoming.sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '')).map((x) => <TaskItem key={x.id} task={x} />)
      )}
    </aside>
  );
}
