import { CalendarClock, Flag, Repeat, MoreHorizontal, GripVertical, ListTree } from 'lucide-react';
import { useLocale, useT } from '@/i18n';
import { Checkbox } from '@/components/ui/controls';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { openTaskDialog } from '@/stores/ui';
import { useSettings, useToday } from '@/stores/settings';
import { useWhere } from '@/data/hooks';
import { remove } from '@/data/repo';
import { addDays, formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { isOverdue, PRIORITY_COLORS, rescheduleTask, toggleTask } from './taskLogic';
import type { Row } from '@/types/models';

export function TaskItem({ task, dragHandle, compact }: { task: Row<'tasks'>; dragHandle?: React.ReactNode; compact?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const today = useToday();
  const { timezone } = useSettings();
  const subs = useWhere('subtasks', 'task_id', task.id);
  const done = task.status === 'done';
  const overdue = isOverdue(task, today);
  const date = task.scheduled_date ?? task.due_date;
  const subDone = subs.filter((s) => s.done).length;

  return (
    <div className={cn('group flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-accent/50', done && 'opacity-60')} data-testid="task-item" data-task-title={task.title}>
      {dragHandle ?? (compact ? null : <GripVertical className="mt-0.5 hidden size-4 text-muted-foreground/30 md:block" />)}
      <Checkbox className="mt-0.5" checked={done} onCheckedChange={() => void toggleTask(task, timezone)} aria-label={t('Complete {title}', { title: task.title })} />
      <button className="min-w-0 flex-1 text-start" onClick={() => openTaskDialog(task.id)}>
        <p className={cn('text-[15px] leading-snug', done && 'line-through')} dir="auto">
          {task.title}
        </p>
        {!compact && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {date && (
              <span className={cn('inline-flex items-center gap-1', overdue && 'text-destructive')}>
                <CalendarClock className="size-3" />
                {date === today ? t('Today') : formatDate(date, locale, { day: 'numeric', month: 'short' })}
                {task.scheduled_time && ` ${task.scheduled_time}`}
                {task.due_date && task.scheduled_date && task.due_date !== task.scheduled_date && ` · ${t('due')} ${formatDate(task.due_date, locale, { day: 'numeric', month: 'short' })}`}
              </span>
            )}
            {task.priority > 0 && <Flag className={cn('size-3', PRIORITY_COLORS[task.priority])} aria-label={t('Priority')} />}
            {task.recurrence_id && <Repeat className="size-3" aria-label={t('Recurring')} />}
            {subs.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <ListTree className="size-3" /> {subDone}/{subs.length}
              </span>
            )}
            {task.reschedule_history?.length > 0 && <span>{t('moved {n}×', { n: task.reschedule_history.length })}</span>}
            {task.category && <span>{t(task.category)}</span>}
            {task.tags.map((x) => (
              <span key={x}>#{x}</span>
            ))}
          </div>
        )}
      </button>
      {!done && (
        <Menu>
          <MenuTrigger asChild>
            <button className="rounded p-1 text-muted-foreground opacity-70 hover:bg-accent md:opacity-0 md:group-hover:opacity-100" aria-label={t('Task actions')}>
              <MoreHorizontal className="size-4" />
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => void rescheduleTask(task, today)}>{t('Move to today')}</MenuItem>
            <MenuItem onSelect={() => void rescheduleTask(task, addDays(today, 1))}>{t('Move to tomorrow')}</MenuItem>
            <MenuItem onSelect={() => void rescheduleTask(task, addDays(today, 7))}>{t('Move to next week')}</MenuItem>
            <MenuItem onSelect={() => void rescheduleTask(task, null)}>{t('Remove date')}</MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={() => openTaskDialog(task.id)}>{t('Edit')}</MenuItem>
            <MenuItem destructive onSelect={() => void remove('tasks', task.id)}>
              {t('Delete')}
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </div>
  );
}
