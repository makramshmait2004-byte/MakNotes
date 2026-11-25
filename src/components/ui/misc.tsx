import * as React from 'react';
import { create } from 'zustand';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Dialog, DialogContent } from './dialog';

export function EmptyState({ icon: Icon, title, description, action }: { icon?: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
      {Icon && <Icon className="size-8 text-muted-foreground/60" />}
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, className }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="truncate font-serif text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn('size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-bronze', className)} />;
}

// ---- toasts
interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
  action?: { label: string; onClick: () => void };
}
const useToasts = create<{ items: ToastItem[] }>(() => ({ items: [] }));
let toastId = 0;
export function toast(text: string, kind: ToastItem['kind'] = 'info', action?: ToastItem['action']) {
  const id = ++toastId;
  useToasts.setState((s) => ({ items: [...s.items, { id, text, kind, action }] }));
  setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((i) => i.id !== id) })), action ? 7000 : 3500);
}
export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-3 rounded-md border bg-popover px-4 py-3 text-sm shadow-lg animate-in fade-in-0 slide-in-from-bottom-2',
            t.kind === 'error' && 'border-destructive/60 text-destructive',
            t.kind === 'success' && 'border-bronze/50',
          )}
        >
          <span>{t.text}</span>
          {t.action && (
            <button className="font-semibold text-bronze" onClick={t.action.onClick}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- confirm dialog
interface ConfirmState {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
  resolve?: (v: boolean) => void;
}
const useConfirm = create<ConfirmState>(() => ({ open: false, title: '' }));
export function confirmDialog(opts: Omit<ConfirmState, 'open' | 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirm.setState({ ...opts, open: true, resolve }));
}
export function ConfirmHost({ cancelLabel = 'Cancel', okLabel = 'Confirm' }: { cancelLabel?: string; okLabel?: string }) {
  const s = useConfirm();
  const close = (v: boolean) => {
    s.resolve?.(v);
    useConfirm.setState({ open: false, resolve: undefined });
  };
  return (
    <Dialog open={s.open} onOpenChange={(o) => !o && close(false)}>
      <DialogContent title={s.title}>
        {s.body && <p className="mb-4 text-sm text-muted-foreground">{s.body}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)}>
            {cancelLabel}
          </Button>
          <Button variant={s.destructive ? 'destructive' : 'bronze'} onClick={() => close(true)}>
            {s.confirmLabel ?? okLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
