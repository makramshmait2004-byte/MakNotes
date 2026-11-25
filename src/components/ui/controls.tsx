import * as React from 'react';
import * as S from '@radix-ui/react-switch';
import * as C from '@radix-ui/react-checkbox';
import * as T from '@radix-ui/react-tabs';
import * as P from '@radix-ui/react-popover';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: React.ComponentPropsWithoutRef<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-bronze data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <S.Thumb className="pointer-events-none block h-5 w-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5 data-[state=unchecked]:translate-x-0" />
    </S.Root>
  );
}

export function Checkbox({ className, ...props }: React.ComponentPropsWithoutRef<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        'peer grid h-5 w-5 shrink-0 place-items-center rounded border border-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:border-bronze data-[state=checked]:bg-bronze data-[state=checked]:text-bronze-foreground',
        className,
      )}
      {...props}
    >
      <C.Indicator>
        <Check className="size-3.5" strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  );
}

export const Tabs = T.Root;
export const TabsContent = T.Content;
export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof T.List>) {
  return <T.List className={cn('inline-flex h-10 items-center gap-1 overflow-x-auto rounded-md bg-muted p-1 text-muted-foreground no-scrollbar', className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export function PopoverContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content sideOffset={6} collisionPadding={8} className={cn('z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg outline-none', className)} {...props} />
    </P.Portal>
  );
}
