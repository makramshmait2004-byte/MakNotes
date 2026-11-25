import { ArrowDown, ArrowUp, ChevronDown, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

export function Section({
  id,
  title,
  icon: Icon,
  collapsed,
  onToggle,
  onHide,
  onMoveUp,
  onMoveDown,
  actions,
  children,
  className,
}: {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  collapsed?: boolean;
  onToggle?: () => void;
  onHide?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <section id={`section-${id}`} data-section={id} className={cn('rounded-lg border bg-card', className)}>
      <header className="flex items-center gap-1 px-3 py-2">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-start" aria-expanded={!collapsed}>
          {Icon && <Icon className="size-4 shrink-0 text-bronze" />}
          <h2 className="truncate text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', collapsed && '-rotate-90 rtl:rotate-90')} />
        </button>
        {actions}
        {(onMoveUp || onMoveDown || onHide) && (
          <div className="flex items-center text-muted-foreground">
            {onMoveUp && (
              <button onClick={onMoveUp} className="rounded p-1.5 hover:bg-accent" aria-label={t('Move up')}>
                <ArrowUp className="size-4" />
              </button>
            )}
            {onMoveDown && (
              <button onClick={onMoveDown} className="rounded p-1.5 hover:bg-accent" aria-label={t('Move down')}>
                <ArrowDown className="size-4" />
              </button>
            )}
            {onHide && (
              <button onClick={onHide} className="rounded p-1.5 hover:bg-accent" aria-label={t('Hide section')}>
                <EyeOff className="size-4" />
              </button>
            )}
          </div>
        )}
      </header>
      {!collapsed && <div className="px-3 pb-3">{children}</div>}
    </section>
  );
}
