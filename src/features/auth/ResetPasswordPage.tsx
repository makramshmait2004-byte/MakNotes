import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useT } from '@/i18n';

/** Shown after the user opens a password-recovery link. */
export function ResetPasswordPage() {
  const t = useT();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (pw.length < 8) return setMsg(t('Password must be at least 8 characters.'));
    if (pw !== pw2) return setMsg(t('Passwords do not match.'));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg(error.message);
    useAuth.setState({ recovery: false });
    window.location.hash = '#/today';
  };
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <form
        className="grid w-full max-w-sm gap-3 rounded-xl border bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h1 className="text-lg font-semibold">{t('Choose a new password')}</h1>
        <Field label={t('New password')}>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label={t('Confirm password')}>
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
        </Field>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        <Button type="submit" variant="bronze" disabled={busy}>
          {t('Save password')}
        </Button>
      </form>
    </div>
  );
}
