import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Star } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { Badge } from '@/components/ui/card';
import { useLocale, useT } from '@/i18n';
import { useSettings, useToday } from '@/stores/settings';
import { addDays, addMonths, addYears, endOfMonth, endOfYear, formatDate, startOfMonth, startOfWeek, startOfYear } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { createJournalEntry, JOURNAL_CATEGORIES } from './journalActions';
import { MOODS } from '@/components/shared/MoodPicker';

type Period = 'all' | 'day' | 'week' | 'month' | 'year';

export default function JournalPage() {
  const t = useT();
  const locale = useLocale();
  const nav = useNavigate();
  const today = useToday();
  const { week_start } = useSettings();
  const entries = useAll('journal_entries');
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [anchor, setAnchor] = useState(today);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [mood, setMood] = useState('');
  const [favOnly, setFavOnly] = useState(false);

  const range = useMemo((): [string, string] | null => {
    if (period === 'day') return [anchor, anchor];
    if (period === 'week') {
      const s = startOfWeek(anchor, week_start);
      return [s, addDays(s, 6)];
    }
    if (period === 'month') return [startOfMonth(anchor), endOfMonth(anchor)];
    if (period === 'year') return [startOfYear(anchor), endOfYear(anchor)];
    return null;
  }, [period, anchor, week_start]);

  const shift = (dir: 1 | -1) => {
    if (period === 'day') setAnchor(addDays(anchor, dir));
    else if (period === 'week') setAnchor(addDays(anchor, 7 * dir));
    else if (period === 'month') setAnchor(addMonths(anchor, dir));
    else if (period === 'year') setAnchor(addYears(anchor, dir));
  };

  const allTags = useMemo(() => [...new Set(entries.flatMap((e) => e.tags))].sort(), [entries]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => {
        if (range && (e.entry_date < range[0] || e.entry_date > range[1])) return false;
        if (from && e.entry_date < from) return false;
        if (to && e.entry_date > to) return false;
        if (category && e.category !== category) return false;
        if (tag && !e.tags.includes(tag)) return false;
        if (mood && String(e.mood) !== mood) return false;
        if (favOnly && !e.is_favorite) return false;
        if (needle && !`${e.title ?? ''} ${e.plain_text} ${e.tags.join(' ')}`.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at));
  }, [entries, q, range, from, to, category, tag, mood, favOnly]);

  const grouped = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const e of filtered) m.set(e.entry_date, [...(m.get(e.entry_date) ?? []), e]);
    return [...m.entries()];
  }, [filtered]);

  const periodLabel = range
    ? period === 'day'
      ? formatDate(anchor, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : period === 'month'
        ? formatDate(anchor, locale, { month: 'long', year: 'numeric' })
        : period === 'year'
          ? anchor.slice(0, 4)
          : `${formatDate(range[0], locale, { day: 'numeric', month: 'short' })} – ${formatDate(range[1], locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  const create = async () => {
    const e = await createJournalEntry(period === 'day' ? anchor : today);
    nav(`/journal/${e.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('Journal')}
        subtitle={t('{n} entries', { n: entries.length })}
        actions={
          <Button variant="bronze" onClick={create} data-testid="new-journal-entry">
            <Plus /> {t('New entry')}
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md bg-muted p-1">
          {(['all', 'day', 'week', 'month', 'year'] as Period[]).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={cn('rounded px-3 py-1.5 text-sm', period === p ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
              {t(p === 'all' ? 'All' : p[0].toUpperCase() + p.slice(1))}
            </button>
          ))}
        </div>
        {range && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="iconSm" onClick={() => shift(-1)} aria-label={t('Previous')}>
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
            <span className="min-w-[9rem] text-center text-sm font-medium">{periodLabel}</span>
            <Button variant="ghost" size="iconSm" onClick={() => shift(1)} aria-label={t('Next')}>
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          </div>
        )}
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Input placeholder={t('Search journal…')} value={q} onChange={(e) => setQ(e.target.value)} className="sm:col-span-2 lg:col-span-3" data-testid="journal-search" />
        <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('Category')}>
          <option value="">{t('All categories')}</option>
          {JOURNAL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(c)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={tag} onChange={(e) => setTag(e.target.value)} aria-label={t('Tag')}>
          <option value="">{t('All tags')}</option>
          {allTags.map((x) => (
            <option key={x} value={x}>
              #{x}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={mood} onChange={(e) => setMood(e.target.value)} aria-label={t('Mood')}>
          <option value="">{t('Any mood')}</option>
          {MOODS.map((m) => (
            <option key={m.v} value={m.v}>
              {m.v} · {t(m.label)}
            </option>
          ))}
        </NativeSelect>
        {period === 'all' && (
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t('From')} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t('To')} />
          </>
        )}
        <Button variant={favOnly ? 'secondary' : 'outline'} onClick={() => setFavOnly((v) => !v)}>
          <Star className={cn(favOnly && 'fill-bronze text-bronze')} /> {t('Favorites')}
        </Button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon={BookOpen} title={entries.length ? t('No entries match') : t('Your journal is empty')} description={entries.length ? undefined : t('Write your first entry — typed or handwritten.')} action={<Button onClick={create}>{t('New entry')}</Button>} />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, list]) => (
            <div key={date}>
              <Link to={`/day/${date}`} className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-bronze">
                {formatDate(date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </Link>
              <div className="space-y-2">
                {list.map((e) => (
                  <Link key={e.id} to={`/journal/${e.id}`} className="block rounded-lg border bg-card p-4 hover:border-bronze/50" data-testid="journal-entry-card">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif text-lg font-medium">{e.title || t('Untitled entry')}</p>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {e.mood && <span>{t('Mood')} {e.mood}/5</span>}
                        {e.is_favorite && <Star className="size-4 fill-bronze text-bronze" />}
                      </div>
                    </div>
                    {e.plain_text && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground" dir="auto">{e.plain_text}</p>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.category && <Badge>{t(e.category)}</Badge>}
                      {e.tags.map((x) => (
                        <Badge key={x}>#{x}</Badge>
                      ))}
                      {e.word_count > 0 && <span className="text-[11px] text-muted-foreground">{t('{n} words', { n: e.word_count })}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
