import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useUi, closeEventDialog } from '@/stores/ui';
import { useAll, useRow } from '@/data/hooks';
import { insert, remove, update } from '@/data/repo';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/controls';
import { confirmDialog, toast } from '@/components/ui/misc';
import { useT } from '@/i18n';
import { useSettings, useToday } from '@/stores/settings';
import { zonedToUtc } from '@/lib/dates';

const REMIND_OPTIONS = [
  { v: '', l: 'No reminder' },
  { v: '0', l: 'At start time' },
  { v: '10', l: '10 minutes before' },
  { v: '30', l: '30 minutes before' },
  { v: '60', l: '1 hour before' },
  { v: '1440', l: '1 day before' },
];

export function EventDialog() {
  const { open, eventId, defaults } = useUi((s) => s.eventDialog);
  const ev = useRow('calendar_events', eventId);
  const projects = useAll('projects', (p) => p.status !== 'archived');
  const t = useT();
  const today = useToday();
  const { timezone } = useSettings();
  const [f, setF] = useState({ title: '', description: '', location: '', start_date: today, end_date: '', start_time: '', end_time: '', all_day: false, project_id: '', remind: '' });

  useEffect(() => {
    if (!open) return;
    const src = ev ?? defaults ?? {};
    setF({
      title: src.title ?? '',
      description: src.description ?? '',
      location: src.location ?? '',
      start_date: src.start_date ?? today,
      end_date: src.end_date ?? '',
      start_time: src.start_time ?? '',
      end_time: src.end_time ?? '',
      all_day: src.all_day ?? false,
      project_id: src.project_id ?? '',
      remind: '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ev?.id]);

  const save = async () => {
    if (!f.title.trim()) return toast(t('Title is required'), 'error');
    if (f.end_date && f.end_date < f.start_date) return toast(t('End date is before start date'), 'error');
    const data = {
      title: f.title.trim(),
      description: f.description || null,
      location: f.location || null,
      start_date: f.start_date,
      end_date: f.end_date || null,
      start_time: f.all_day ? null : f.start_time || null,
      end_time: f.all_day ? null : f.end_time || null,
      all_day: f.all_day,
      project_id: f.project_id || null,
    };
    let id = ev?.id;
    if (ev) await update('calendar_events', ev.id, data);
    else id = (await insert('calendar_events', data)).id;
    if (f.remind !== '' && id) {
      const start = zonedToUtc(f.start_date, f.all_day || !f.start_time ? '09:00' : f.start_time, timezone);
      await insert('reminders', { event_id: id, title: data.title, remind_at: new Date(start.getTime() - Number(f.remind) * 60_000).toISOString() });
      if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    }
    closeEventDialog();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeEventDialog()}>
      <DialogContent title={ev ? t('Edit event') : t('New event')}>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t('Event title')} data-testid="event-title" dir="auto" />
          <div className="flex items-center justify-between">
            <span className="text-sm">{t('All day')}</span>
            <Switch checked={f.all_day} onCheckedChange={(v) => setF({ ...f, all_day: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Start date')}>
              <Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} required />
            </Field>
            <Field label={t('End date')}>
              <Input type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
            </Field>
            {!f.all_day && (
              <>
                <Field label={t('Start time')}>
                  <Input type="time" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} />
                </Field>
                <Field label={t('End time')}>
                  <Input type="time" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} />
                </Field>
              </>
            )}
          </div>
          <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder={t('Location')} />
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={t('Notes')} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Project')}>
              <NativeSelect value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
                <option value="">{t('None')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('Reminder')}>
              <NativeSelect value={f.remind} onChange={(e) => setF({ ...f, remind: e.target.value })}>
                {REMIND_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {t(o.l)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="flex justify-between pt-1">
            {ev ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  if (await confirmDialog({ title: t('Delete this event?'), destructive: true, confirmLabel: t('Delete') })) {
                    await remove('calendar_events', ev.id);
                    closeEventDialog();
                  }
                }}
              >
                <Trash2 /> {t('Delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={closeEventDialog}>
                {t('Cancel')}
              </Button>
              <Button type="submit" variant="bronze" data-testid="event-save">
                {t('Save')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
