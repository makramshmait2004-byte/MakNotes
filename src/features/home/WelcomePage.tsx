import { Link, Navigate } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarDays, CloudOff, ListChecks, Lock, PenTool, Repeat, Smartphone } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import { setLang, useLang, useT } from '@/i18n';
import { InstallButton } from '@/components/layout/pwa';

/** Public home page for signed-out visitors. */
export default function WelcomePage() {
  const t = useT();
  const { user, ready } = useAuth();
  const lang = useLang((s) => s.lang);
  if (ready && user) return <Navigate to="/" replace />;
  const features = [
    { icon: CalendarDays, title: 'A page for every day', body: 'Opens on today: schedule, top 3 priorities, tasks, notes, journal and reflection in one place.' },
    { icon: PenTool, title: 'Made for the S Pen', body: 'Pressure-sensitive handwriting and sketching with palm rejection, saved as editable ink.' },
    { icon: BookOpen, title: 'Journal & notebooks', body: 'Rich text, handwriting, images and files — organized into notebooks, sections and pages.' },
    { icon: ListChecks, title: 'Tasks that carry over', body: 'Recurring tasks, subtasks, reminders, and rescheduling that keeps the original history.' },
    { icon: Repeat, title: 'Habits & goals', body: 'Streaks, monthly consistency, milestones and projects that connect it all.' },
    { icon: BarChart3, title: 'Honest insights', body: 'Statistics calculated only from what you actually recorded.' },
    { icon: CloudOff, title: 'Works offline', body: 'Everything saves on your device first and syncs between phone and laptop when online.' },
    { icon: Lock, title: 'Private by design', body: 'Your workspace is protected by row-level security — only you can read it.' },
  ];
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
            <rect width="32" height="32" rx="7" className="fill-foreground" />
            <path d="M8 23V9l8 9 8-9v14" fill="none" stroke="hsl(var(--bronze))" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-serif text-xl font-semibold">MakNotes</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="text-muted-foreground hover:text-foreground">
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          <Link to="/auth/login" className="text-muted-foreground hover:text-foreground">
            {t('Sign in')}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5">
        <section className="py-14 md:py-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-bronze">{t('Your personal operating system')}</p>
          <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight tracking-tight md:text-6xl" data-testid="welcome-title">
            {t('Plan the day. Write it down. Keep going.')}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t('Daily planner, journal, notebooks, handwriting, habits and goals — in one calm, private app for your phone and laptop.')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth/register" className="inline-flex h-11 items-center rounded-md bg-bronze px-6 font-medium text-bronze-foreground hover:bg-bronze/90" data-testid="welcome-register">
              {t('Create free account')}
            </Link>
            <Link to="/auth/login" className="inline-flex h-11 items-center rounded-md border px-6 font-medium hover:bg-accent">
              {t('Sign in')}
            </Link>
            <InstallButton className="h-11" />
          </div>
        </section>
        <section className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="bg-card p-6">
              <f.icon className="mb-3 size-5 text-bronze" />
              <h2 className="mb-1 font-medium">{t(f.title)}</h2>
              <p className="text-sm text-muted-foreground">{t(f.body)}</p>
            </div>
          ))}
        </section>
        <section className="my-16 flex flex-col items-start gap-3 rounded-xl border bg-card p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="size-6 text-bronze" />
            <div>
              <p className="font-medium">{t('Install on Android')}</p>
              <p className="text-sm text-muted-foreground">{t('Open this site in Chrome on your Samsung, tap ⋮ and choose "Add to Home screen".')}</p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">MakNotes</footer>
    </div>
  );
}
