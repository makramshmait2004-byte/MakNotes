import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Expand, FileDown, Lightbulb, Shrink, Star, Trash2 } from 'lucide-react';
import { useRow } from '@/data/hooks';
import { insert, remove, update } from '@/data/repo';
import { getDb } from '@/data/db';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { confirmDialog, EmptyState, Spinner } from '@/components/ui/misc';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/menu';
import { MoodPicker } from '@/components/shared/MoodPicker';
import { TagInput } from '@/components/shared/TagInput';
import { BlockEditor } from '@/components/shared/BlockEditor';
import { textToDoc } from '@/components/shared/RichText';
import { useSettings } from '@/stores/settings';
import { cn } from '@/lib/utils';
import { countWords, EVENING_PROMPTS, JOURNAL_CATEGORIES, MORNING_PROMPTS } from './journalActions';

export default function JournalEntryPage() {
  const { id } = useParams();
  const entry = useRow('journal_entries', id);
  const t = useT();
  const nav = useNavigate();
  const settings = useSettings();
  const [focus, setFocus] = useState(false);

  if (!entry) return <div className="grid min-h-[40vh] place-items-center">{id ? <Spinner /> : <EmptyState title={t('Entry not found')} />}</div>;

  const addPrompt = async (q: string) => {
    const blocks = (await getDb().journal_blocks.where('journal_entry_id').equals(entry.id).toArray()).filter((b) => !b.deleted_at);
    const position = Math.max(0, ...blocks.map((b) => b.position)) + 1000;
    await insert('journal_blocks', {
      journal_entry_id: entry.id,
      kind: 'text',
      position,
      content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: t(q) }] }, ...(textToDoc('').content ?? [])] },
    });
  };

  return (
    <div className={cn('mx-auto max-w-3xl', focus && 'fixed inset-0 z-50 max-w-none overflow-y-auto bg-background px-4 py-6 md:px-0')}>
      <div className={cn(focus && 'mx-auto max-w-2xl')}>
        <div className="mb-3 flex items-center gap-2 no-print">
          {!focus && (
            <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label={t('Back')}>
              <ArrowLeft className="rtl:rotate-180" />
            </Button>
          )}
          <Input type="date" value={entry.entry_date} onChange={(e) => e.target.value && void update('journal_entries', entry.id, { entry_date: e.target.value })} className="w-40" aria-label={t('Date')} />
          <div className="flex-1" />
          {settings.reflection_prompts && (
            <Menu>
              <MenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('Reflection prompts')}>
                  <Lightbulb />
                </Button>
              </MenuTrigger>
              <MenuContent align="end" className="max-w-xs">
                <MenuLabel>{t('Morning')}</MenuLabel>
                {MORNING_PROMPTS.map((q) => (
                  <MenuItem key={q} onSelect={() => void addPrompt(q)}>
                    {t(q)}
                  </MenuItem>
                ))}
                <MenuLabel>{t('Evening')}</MenuLabel>
                {EVENING_PROMPTS.map((q) => (
                  <MenuItem key={q} onSelect={() => void addPrompt(q)}>
                    {t(q)}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          )}
          <Button variant="ghost" size="icon" onClick={() => void update('journal_entries', entry.id, { is_favorite: !entry.is_favorite })} aria-label={t('Favorite')} aria-pressed={entry.is_favorite}>
            <Star className={cn(entry.is_favorite && 'fill-bronze text-bronze')} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => nav(`/print/journal/${entry.id}`)} aria-label={t('Export PDF')}>
            <FileDown />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setFocus((f) => !f)} aria-label={t('Distraction-free mode')} data-testid="focus-mode">
            {focus ? <Shrink /> : <Expand />}
          </Button>
          {!focus && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('Delete')}
              onClick={async () => {
                if (await confirmDialog({ title: t('Delete this entry?'), destructive: true, confirmLabel: t('Delete') })) {
                  await remove('journal_entries', entry.id);
                  nav('/journal');
                }
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>

        <input
          key={entry.id}
          defaultValue={entry.title ?? ''}
          onBlur={(e) => e.target.value !== (entry.title ?? '') && void update('journal_entries', entry.id, { title: e.target.value || null })}
          placeholder={t('Title')}
          className="mb-3 w-full bg-transparent font-serif text-3xl font-semibold outline-none placeholder:text-muted-foreground/50"
          dir="auto"
          data-testid="journal-title"
        />

        {!focus && (
          <div className="mb-4 grid gap-3 rounded-lg border bg-card p-3 no-print">
            <MoodPicker value={entry.mood} onChange={(v) => void update('journal_entries', entry.id, { mood: v })} />
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <NativeSelect value={entry.category ?? ''} onChange={(e) => void update('journal_entries', entry.id, { category: e.target.value || null })} aria-label={t('Category')}>
                <option value="">{t('No category')}</option>
                {JOURNAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </NativeSelect>
              <TagInput value={entry.tags} onChange={(tags) => void update('journal_entries', entry.id, { tags })} />
            </div>
          </div>
        )}

        <BlockEditor
          table="journal_blocks"
          parentKey="journal_entry_id"
          parentId={entry.id}
          autoFocusFirst
          onTextChange={(text) => void update('journal_entries', entry.id, { plain_text: text.slice(0, 20000), word_count: countWords(text) })}
        />
        <p className="mt-4 text-xs text-muted-foreground">{t('{n} words', { n: entry.word_count })} · {t('Saved automatically')}</p>
      </div>
    </div>
  );
}
