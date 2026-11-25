import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSyncStore, getSyncEngine } from '@/data/sync';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function SyncBadge({ compact }: { compact?: boolean }) {
  const { state, pending, conflicts, pendingFiles } = useSyncStore();
  const online = useOnline();
  const t = useT();
  const waiting = pending + pendingFiles;

  let icon = <Check className="size-3.5" />;
  let label = t('Synced');
  let tone = 'text-muted-foreground';
  if (!online || state === 'offline') {
    icon = <CloudOff className="size-3.5" />;
    label = waiting ? t('Offline · {n} unsynced', { n: waiting }) : t('Offline · saved on device');
    tone = 'text-amber-500';
  } else if (state === 'syncing') {
    icon = <RefreshCw className="size-3.5 animate-spin" />;
    label = t('Syncing…');
  } else if (conflicts > 0) {
    icon = <AlertTriangle className="size-3.5" />;
    label = t('{n} conflicts', { n: conflicts });
    tone = 'text-amber-500';
  } else if (state === 'error') {
    icon = <AlertTriangle className="size-3.5" />;
    label = waiting ? t('{n} waiting to sync', { n: waiting }) : t('Sync error');
    tone = 'text-destructive';
  } else if (waiting > 0) {
    icon = <Cloud className="size-3.5" />;
    label = t('Saving…');
  }

  return (
    <Link
      to="/settings#sync"
      onClick={() => online && void getSyncEngine()?.syncNow()}
      className={cn('inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-accent', tone)}
      title={label}
      aria-label={label}
      data-testid="sync-badge"
      data-sync-state={state}
    >
      {icon}
      {!compact && <span className="truncate">{label}</span>}
    </Link>
  );
}
