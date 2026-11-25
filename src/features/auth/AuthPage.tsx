import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { appUrl, ENABLE_GOOGLE } from '@/lib/config';
import { useAuth } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/misc';
import { setLang, useLang, useT } from '@/i18n';

type Mode = 'login' | 'register' | 'forgot' | 'verify';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.3 6.6 2.3 12s4.3 9.8 9.7 9.8c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export function AuthPage() {
  const { mode = 'login' } = useParams<{ mode: Mode }>();
  const t = useT();
  const nav = useNavigate();
  const loc = useLocation();
  const { user, ready } = useAuth();
  const lang = useLang((s) => s.lang);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!ready) return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  if (user) return <Navigate to={(loc.state as { from?: string })?.from ?? '/today'} replace />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message === 'Email not confirmed' ? t('Please verify your email first — check your inbox.') : error.message);
      } else if (mode === 'register') {
        if (password.length < 8) throw new Error(t('Password must be at least 8 characters.'));
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl(), data: { display_name: name || undefined } } });
        if (error) throw error;
        if (!data.session) nav('/auth/verify', { state: { email } });
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
        if (error) throw error;
        setInfo(t('If an account exists for {email}, a reset link is on its way.', { email }));
      }
    });

  const google = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } });
      if (error) throw error;
    });

  const resend = () =>
    run(async () => {
      const target = (loc.state as { email?: string })?.email ?? email;
      if (!target) throw new Error(t('Enter your email'));
      const { error } = await supabase.auth.resend({ type: 'signup', email: target, options: { emailRedirectTo: appUrl() } });
      if (error) throw error;
      setInfo(t('Verification email sent again.'));
    });

  const titles: Record<Mode, string> = { login: 'Sign in', register: 'Create your account', forgot: 'Reset password', verify: 'Check your email' };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <svg viewBox="0 0 32 32" className="size-12" aria-hidden>
            <rect width="32" height="32" rx="7" className="fill-foreground" />
            <path d="M8 23V9l8 9 8-9v14" fill="none" stroke="hsl(var(--bronze))" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 className="font-serif text-3xl font-semibold">MakNotes</h1>
          <p className="text-sm text-muted-foreground">{t('Your daily planner, journal and notebook.')}</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold" data-testid="auth-title">
            {t(titles[mode as Mode] ?? 'Sign in')}
          </h2>
          {mode === 'verify' ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">{t('We sent a verification link to {email}. Open it on this device to activate your account.', { email: (loc.state as { email?: string })?.email ?? t('your email') })}</p>
              <Button variant="outline" className="w-full" onClick={() => void resend()} disabled={busy}>
                {t('Resend email')}
              </Button>
              <Link to="/auth/login" className="block text-center text-bronze">
                {t('Back to sign in')}
              </Link>
            </div>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {mode === 'register' && (
                <Field label={t('Name')}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </Field>
              )}
              <Field label={t('Email')}>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="auth-email" />
              </Field>
              {mode !== 'forgot' && (
                <Field label={t('Password')}>
                  <Input type="password" required minLength={mode === 'register' ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} data-testid="auth-password" />
                </Field>
              )}
              {error && (
                <p className="text-sm text-destructive" role="alert" data-testid="auth-error">
                  {error}
                </p>
              )}
              {info && <p className="text-sm text-muted-foreground" role="status">{info}</p>}
              <Button type="submit" variant="bronze" className="mt-1 w-full" disabled={busy} data-testid="auth-submit">
                {busy ? <Spinner className="size-4" /> : t(mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link')}
              </Button>
              {mode !== 'forgot' && ENABLE_GOOGLE && (
                <>
                  <div className="my-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    {t('or')}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={() => void google()} disabled={busy}>
                    <GoogleIcon /> {t('Continue with Google')}
                  </Button>
                </>
              )}
            </form>
          )}
        </div>
        <div className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {mode === 'login' && (
            <>
              <Link to="/auth/forgot" className="hover:text-foreground">
                {t('Forgot password?')}
              </Link>
              <span>
                {t('New here?')}{' '}
                <Link to="/auth/register" className="text-bronze" data-testid="to-register">
                  {t('Create an account')}
                </Link>
              </span>
            </>
          )}
          {(mode === 'register' || mode === 'forgot') && (
            <Link to="/auth/login" className="text-bronze">
              {t('Back to sign in')}
            </Link>
          )}
          <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="mt-2 text-xs underline">
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
      </div>
    </div>
  );
}
