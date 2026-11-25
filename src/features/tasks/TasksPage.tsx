import { useMemo, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListChecks, Plus, FileDown } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { insert, update } from '@/data/repo';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { useT } from '@/i18n';
import { useToday } from '@/stores/settings';
import { openTaskDialog } from '@/stores/ui';
import { cn } from '@/lib/utils';
import { filterView, PRIORITY_LABELS, type TaskView } from './taskLogic';
import { TaskItem } from './TaskItem';
import { TASK_CATEGORIES } from './TaskDialog';
import { exportTasksCsv } from '@/features/export/exporters';
import type { Row } from '@/types/models';

const VIEWS: { id: TaskView; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All Tasks' },
];

function SortableTask({ task }: { task: Row<'tasks'> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'z-10 rounded-md bg-card shadow-lg')}>
      <TaskItem
        task={task}
        dragHandle={
          <button {...attributes} {...listeners} className="mt-0.5 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground" aria-label="Reorder">
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
}

export default function TasksPage() {
  const t = useT();
  const today = useToday();
  const tasks = useAll('tasks');
  const projects = useAll('projects');
  const [view, setView] = useState<TaskView>('today');
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [project, setProject] = useState('');
  const [quick, setQuick] = useState('');

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.id, filterView(tasks, v.id, today).filter((x) => v.id === 'completed' || v.id === 'all' || x.status === 'todo').length])), [tasks, today]);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return filterView(tasks, view, today)
      .filter(
        (x) =>
          (!needle || `${x.title} ${x.description ?? ''} ${x.tags.join(' ')}`.toLowerCase().includes(needle)) &&
          (!priority || String(x.priority) === priority) &&
          (!category || x.category === category) &&
          (!project || x.project_id === project),
      )
      .sort((a, b) => {
        if (view === 'completed') return (b.completed_at ?? '').localeCompare(a.completed_at ?? '');
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
        return a.position - b.position || a.created_at.localeCompare(b.created_at);
      });
  }, [tasks, view, today, q, priority, category, project]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = list.map((x) => x.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    // rewrite positions only where order changed
    for (const [i, id] of next.entries()) {
      const pos = (i + 1) * 1000;
      const cur = list.find((x) => x.id === id);
      if (cur && cur.position !== pos) await update('tasks', id, { position: pos });
    }
  };

  const quickAdd = async () => {
    const title = quick.trim();
    if (!title) return;
    const date = view === 'tomorrow' ? (await import('@/lib/dates')).addDays(today, 1) : view === 'today' || view === 'overdue' ? today : null;
    await insert('tasks', { title, scheduled_date: date, original_date: date, position: Date.now() });
    setQuick('');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('Tasks')}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => exportTasksCsv(tasks, projects)} aria-label={t('Export CSV')} title={t('Export CSV')}>
              <FileDown />
            </Button>
            <Button variant="bronze" onClick={() => openTaskDialog(undefined, { scheduled_date: view === 'all' || view === 'upcoming' ? null : today })}>
              <Plus /> {t('New task')}
            </Button>
          </>
        }
      />
      <div className="mb-3 flex gap-1 overflow-x-auto no-scrollbar" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm', view === v.id ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-accent')}
          >
            {t(v.label)}
            <span className={cn('text-xs tabular-nums', v.id === 'overdue' && counts.overdue > 0 ? 'text-destructive' : 'text-muted-foreground')}>{counts[v.id]}</span>
          </button>
        ))}
      </div>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void quickAdd();
        }}
      >
        <Input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={t('Quick add a task and press Enter')} data-testid="quick-task" dir="auto" />
        <Button type="submit" variant="secondary" size="icon" aria-label={t('Add task')}>
          <Plus />
        </Button>
      </form>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input placeholder={t('Search…')} value={q} onChange={(e) => setQ(e.target.value)} className="col-span-2 sm:col-span-1" />
        <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value)} aria-label={t('Priority')}>
          <option value="">{t('Any priority')}</option>
          {PRIORITY_LABELS.map((l, i) => (
            <option key={l} value={i}>
              {t(l)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('Category')}>
          <option value="">{t('All categories')}</option>
          {TASK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={project} onChange={(e) => setProject(e.target.value)} aria-label={t('Project')}>
          <option value="">{t('All projects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={ListChecks} title={t('Nothing here')} description={view === 'overdue' ? t('No overdue tasks. Well done.') : t('Add a task above to get started.')} />
      ) : (
        <div className="rounded-lg border bg-card p-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
            <SortableContext items={list.map((x) => x.id)} strategy={verticalListSortingStrategy}>
              {list.map((task) => (
                <SortableTask key={task.id} task={task} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
