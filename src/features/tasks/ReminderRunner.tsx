import { useEffect } from 'react';
import { getDb, hasDb } from '@/data/db';
import { update } from '@/data/repo';
import { toast } from '@/components/ui/misc';
import { t } from '@/i18n';

/**
 * Fires due reminders while MakNotes is open (foreground or background tab).
 * Browsers do not allow a web app to wake itself when fully closed without a push server,
 * so reminders that came due while the app was closed are shown the next time it opens.
 */
export function ReminderRunner() {
  useEffect(() => {
    const check = async () => {
      if (!hasDb()) return;
      const db = getDb();
      const now = new Date().toISOString();
      const due = (await db.reminders.where('remind_at').belowOrEqual(now).toArray()).filter((r) => !r.deleted_at && !r.fired_at && !r.dismissed);
      for (const r of due) {
        await update('reminders', r.id, { fired_at: new Date().toISOString() });
        const body = t('Reminder');
        let shown = false;
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const reg = await navigator.serviceWorker?.getRegistration();
            if (reg) await reg.showNotification(r.title, { body, tag: r.id, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` });
            else new Notification(r.title, { body });
            shown = true;
          } catch {
            /* fall back to toast */
          }
        }
        if (!shown || document.visibilityState === 'visible') toast(`${t('Reminder')}: ${r.title}`, 'info');
      }
    };
    void check();
    const id = setInterval(() => void check(), 30_000);
    return () => clearInterval(id);
  }, []);
  return null;
}
