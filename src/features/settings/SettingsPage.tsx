import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, LogOut, RefreshCw, Trash2, Upload, Bell, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { updateSettings, useSettings } from '@/stores/settings';
import { useAll, useDb } from '@/data/hooks';
import { insert, update } from '@/data/repo';
import { saveFile, deleteAllUserFiles } from '@/data/files';
import { closeAndDeleteUserDb } from '@/data/db';
import { getSyncEngine, stopSync, useSyncStore } from '@/data/sync';
import { exportJson, exportTasksCsv, importBackup, type ImportReport } from '@/features/export/exporters';
import { useFileUrl } from '@/components/shared/Attachments';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { Switch } from '@/components/ui/controls';
import { confirmDialog, PageHeader, toast } from '@/components/ui/misc';
import { useInstallPrompt } from '@/components/layout/pwa';
import { useT } from '@/i18n';
import { listTimeZones, isValidTimeZone, todayISO } from '@/lib/dates';
import type { Paper, UserSettings } from '@/types/models';

function Card({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="rounded-lg border bg-card p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Profile() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const profile = useDb(async (db) => (await db.profiles.toArray()).find((p) => !p.deleted_at), [], undefined);
  const avatarAtt = useAll('attachments', (a) => a.bucket === 'profile-images' && a.path === profile?.avatar_path, [profile?.avatar_path]);
  const { url } = useFileUrl(avatarAtt[0]?.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  const setName = async (display_name: string) => {
    if (profile) await update('profiles', profile.id, { display_name });
    else await insert('profiles', { display_name });
  };
  const setAvatar = async (f: File) => {
    try {
      const att = await saveFile(f, { bucket: 'profile-images', parentTable: 'profiles', parentId: profile?.id });
      if (profile) await update('profiles', profile.id, { avatar_path: att.path });
      else await insert('profiles', { avatar_path: att.path });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Card title={t('Profile')}>
      <div className="flex items-center gap-4">
        <button onClick={() => fileRef.current?.click()} className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted text-xl font-semibold" aria-label={t('Change photo')}>
          {url ? <img src={url} alt="" className="size-full object-cover" /> : (profile?.display_name ?? user?.email ?? '?').slice(0, 1).toUpperCase()}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && void setAvatar(e.target.files[0])} />
        <div className="min-w-0 flex-1">
          <Input key={profile?.id} defaultValue={profile?.display_name ?? ''} onBlur={(e) => e.target.value !== (profile?.display_name ?? '') && void setName(e.target.value)} placeholder={t('Your name')} aria-label={t('Your name')} />
          <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const { error } = await supabase.auth.updateUser({ email });
            toast(error ? error.message : t('Check both inboxes to confirm the change.'), error ? 'error' : 'success');
          }}
        >
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('New email')} required />
          <Button type="submit" variant="outline">
            {t('Change')}
          </Button>
        </form>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.length < 8) return toast(t('Password must be at least 8 characters.'), 'error');
            const { error } = await supabase.auth.updateUser({ password: pw });
            toast(error ? error.message : t('Password updated'), error ? 'error' : 'success');
            setPw('');
          }}
        >
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t('New password')} autoComplete="new-password" />
          <Button type="submit" variant="outline">
            {t('Change')}
          </Button>
        </form>
      </div>
    </Card>
  );
}

function Preferences() {
  const t = useT();
  const s = useSettings();
  const zones = useMemo(() => listTimeZones(), []);
  const set = (patch: Partial<UserSettings>) => void updateSettings(patch);
  return (
    <Card title={t('Preferences')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Language')}>
          <NativeSelect value={s.language} onChange={(e) => set({ language: e.target.value as 'en' | 'ar' })} data-testid="setting-language">
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </NativeSelect>
        </Field>
        <Field label={t('Theme')}>
          <NativeSelect value={s.theme} onChange={(e) => set({ theme: e.target.value as UserSettings['theme'] })} data-testid="setting-theme">
            <option value="dark">{t('Dark')}</option>
            <option value="light">{t('Light')}</option>
            <option value="system">{t('System')}</option>
          </NativeSelect>
        </Field>
        <Field label={t('Open the app on')}>
          <NativeSelect value={s.start_page} onChange={(e) => set({ start_page: e.target.value as UserSettings['start_page'] })}>
            <option value="today">{t('Today page')}</option>
            <option value="home">{t('Home dashboard')}</option>
          </NativeSelect>
        </Field>
        <Field label={t('Timezone')}>
          <NativeSelect value={s.timezone} onChange={(e) => isValidTimeZone(e.target.value) && set({ timezone: e.target.value })}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">{t('Today in this timezone: {d}', { d: todayISO(s.timezone) })}</p>
        </Field>
        <Field label={t('Week starts on')}>
          <NativeSelect value={s.week_start} onChange={(e) => set({ week_start: Number(e.target.value) })}>
            <option value={1}>{t('Monday')}</option>
            <option value={0}>{t('Sunday')}</option>
            <option value={6}>{t('Saturday')}</option>
          </NativeSelect>
        </Field>
        <Field label={t('Default paper')}>
          <NativeSelect value={s.default_paper} onChange={(e) => set({ default_paper: e.target.value as Paper })}>
            <option value="blank">{t('Blank')}</option>
            <option value="lined">{t('Lined')}</option>
            <option value="grid">{t('Grid')}</option>
            <option value="dotted">{t('Dotted')}</option>
          </NativeSelect>
        </Field>
      </div>
      <Row label={t('Pen-only drawing')} hint={t('Only the S Pen draws; fingers scroll and zoom. Turns on automatically the first time a pen is used.')}>
        <Switch checked={s.pen_only} onCheckedChange={(v) => set({ pen_only: v })} />
      </Row>
      <Row label={t('Reflection prompts')} hint={t('Show morning and evening questions.')}>
        <Switch checked={s.reflection_prompts} onCheckedChange={(v) => set({ reflection_prompts: v })} />
      </Row>
      <div className="grid grid-cols-4 gap-2">
        {(['focus', 'short', 'long', 'rounds'] as const).map((k) => (
          <Field key={k} label={t(k === 'focus' ? 'Focus (min)' : k === 'short' ? 'Short break' : k === 'long' ? 'Long break' : 'Rounds')}>
            <Input type="number" min={1} max={k === 'rounds' ? 12 : 180} value={s.pomodoro[k]} onChange={(e) => set({ pomodoro: { ...s.pomodoro, [k]: Math.max(1, Number(e.target.value) || 1) } })} />
          </Field>
        ))}
      </div>
    </Card>
  );
}

function Device() {
  const t = useT();
  const { canInstall, install, standalone } = useInstallPrompt();
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  return (
    <Card title={t('This device')}>
      <Row label={t('Install MakNotes')} hint={standalone ? t('Running as an installed app.') : t('On Android Chrome: menu ⋮ → Add to Home screen / Install app.')}>
        {canInstall ? (
          <Button variant="outline" onClick={() => void install()}>
            <Smartphone /> {t('Install')}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{standalone ? t('Installed') : '—'}</span>
        )}
      </Row>
      <Row label={t('Notifications')} hint={t('Used for reminders and the focus timer while MakNotes is open or in the background.')}>
        {perm === 'granted' ? (
          <span className="text-xs text-muted-foreground">{t('Allowed')}</span>
        ) : perm === 'unsupported' ? (
          <span className="text-xs text-muted-foreground">{t('Not supported')}</span>
        ) : (
          <Button variant="outline" onClick={async () => setPerm(await Notification.requestPermission())}>
            <Bell /> {t('Allow')}
          </Button>
        )}
      </Row>
    </Card>
  );
}

function Sync() {
  const t = useT();
  const s = useSyncStore();
  const conflicts = useDb((db) => db.conflicts.toArray(), [], []);
  return (
    <Card id="sync" title={t('Sync')}>
      <Row label={t('Status')} hint={s.lastSyncedAt ? t('Last synced {time}', { time: new Date(s.lastSyncedAt).toLocaleString() }) : t('Not synced yet on this device')}>
        <Button variant="outline" onClick={() => void getSyncEngine()?.syncNow()} disabled={s.state === 'syncing'}>
          <RefreshCw className={s.state === 'syncing' ? 'animate-spin' : ''} /> {t('Sync now')}
        </Button>
      </Row>
      <p className="text-sm text-muted-foreground" data-testid="sync-summary">
        {t('State')}: {t(s.state)} · {t('Waiting to upload')}: {s.pending} · {t('Files waiting')}: {s.pendingFiles}
        {s.lastError && <span className="block text-destructive">{s.lastError}</span>}
      </p>
      {conflicts.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-500">
            <AlertTriangle className="size-4" /> {t('Edited on two devices — choose which version to keep')}
          </p>
          {conflicts.map((c) => {
            const label = String(c.local.title ?? c.local.name ?? c.local.date ?? c.local.text ?? c.rowId.slice(0, 8));
            return (
              <div key={c.key} className="rounded-md border p-3 text-sm">
                <p className="mb-1">
                  <span className="text-muted-foreground">{c.table}</span> · {label}
                </p>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t('This device')}: {new Date(String(c.local.updated_at)).toLocaleString()} · {t('Other device')}: {c.server ? new Date(String(c.server.updated_at)).toLocaleString() : t('deleted')}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void getSyncEngine()?.resolveConflict(c.key, 'local')}>
                    {t('Keep this device')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void getSyncEngine()?.resolveConflict(c.key, 'server')}>
                    {t('Keep other device')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function DataCard() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const tasks = useAll('tasks');
  const projects = useAll('projects');
  const [report, setReport] = useState<ImportReport | null>(null);
  const restore = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const preview = await importBackup(json, { dryRun: true });
      const n = Object.values(preview.imported).reduce((a, b) => a + b, 0);
      const ok = await confirmDialog({
        title: t('Restore backup?'),
        body: t('{n} records will be added or updated. {s} already exist and will be skipped. {r} invalid records will be ignored.', { n, s: preview.skippedExisting + preview.skippedDuplicateKey, r: preview.rejected.length }),
        confirmLabel: t('Restore'),
      });
      if (!ok) return;
      setReport(await importBackup(json));
      toast(t('Backup restored'), 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <Card title={t('Export & backup')}>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void exportJson()} data-testid="export-json">
          <Download /> {t('Full backup (JSON)')}
        </Button>
        <Button variant="outline" onClick={() => exportTasksCsv(tasks, projects)}>
          <Download /> {t('Tasks (CSV)')}
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload /> {t('Restore from backup')}
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => (e.target.files?.[0] && void restore(e.target.files[0]), (e.target.value = ''))} />
      </div>
      <p className="text-xs text-muted-foreground">{t('PDF export is available from any day, journal entry, notebook or page. PNG export is in the sketch editor. Backups contain all records; attached files stay in your private storage.')}</p>
      {report && (
        <pre className="max-h-48 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(report, null, 1)}</pre>
      )}
    </Card>
  );
}

function Account() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const pending = useSyncStore((s) => s.pending + s.pendingFiles);
  const signOut = async (clear: boolean) => {
    if (pending > 0 && !(await confirmDialog({ title: t('{n} changes have not synced yet', { n: pending }), body: t('If you sign out now and clear this device, those changes will be lost.'), destructive: true, confirmLabel: t('Sign out anyway') }))) return;
    const uid = user?.id;
    stopSync();
    await supabase.auth.signOut();
    if (clear && uid) await closeAndDeleteUserDb(uid);
  };
  const deleteAccount = async () => {
    const typed = window.prompt(t('This permanently deletes your account and ALL your data on every device. Type DELETE to confirm.'));
    if (typed !== 'DELETE' || !user) return;
    try {
      await deleteAllUserFiles(user.id);
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      stopSync();
      await closeAndDeleteUserDb(user.id);
      await supabase.auth.signOut({ scope: 'local' });
      toast(t('Your account has been deleted.'), 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <Card title={t('Account')}>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void signOut(false)} data-testid="sign-out">
          <LogOut /> {t('Sign out')}
        </Button>
        <Button variant="outline" onClick={() => void signOut(true)}>
          <LogOut /> {t('Sign out and remove data from this device')}
        </Button>
      </div>
      <Button variant="destructive" className="justify-self-start" onClick={() => void deleteAccount()}>
        <Trash2 /> {t('Delete account')}
      </Button>
    </Card>
  );
}

function ServerCheck() {
  const t = useT();
  // TanStack Query for the one remote-only read: server reachability / clock.
  const q = useQuery({ queryKey: ['server-now'], queryFn: async () => (await supabase.rpc('server_now')).data as string | null, staleTime: 5 * 60_000 });
  if (!q.data) return null;
  const skew = Math.round((Date.now() - new Date(q.data).getTime()) / 1000);
  return Math.abs(skew) > 120 ? <p className="text-xs text-amber-500">{t("This device's clock is off by {s} seconds.", { s: skew })}</p> : null;
}

export default function SettingsPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t('Settings')} />
      <Profile />
      <Preferences />
      <Device />
      <Sync />
      <ServerCheck />
      <DataCard />
      <Account />
      <p className="pb-4 text-center text-xs text-muted-foreground">MakNotes {__APP_VERSION__}</p>
    </div>
  );
}
