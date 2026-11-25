import * as React from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  side,
  ...props
}: React.ComponentPropsWithoutRef<typeof D.Content> & { title: string; description?: string; side?: 'center' | 'bottom' | 'right' }) {
  const pos =
    side === 'right'
      ? 'inset-y-0 end-0 h-full w-full max-w-md border-s data-[state=open]:slide-in-from-right'
      : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl data-[state=open]:slide-in-from-bottom-4';
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <D.Content
        className={cn('fixed z-50 flex flex-col overflow-hidden border bg-background shadow-xl data-[state=open]:animate-in', pos, className)}
        {...props}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <D.Title className="text-base font-semibold">{title}</D.Title>
          <D.Close className="rounded p-2 text-muted-foreground hover:bg-accent" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        {description ? <D.Description className="px-4 pt-3 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
        <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
