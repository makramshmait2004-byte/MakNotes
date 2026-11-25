import { useState } from 'react';
import { X } from 'lucide-react';
import { useAll } from '@/data/hooks';
import { upsert, currentUserId } from '@/data/repo';
import { stableId } from '@/lib/ids';
import { useT } from '@/i18n';

export async function ensureTag(name: string) {
  const clean = name.trim().toLowerCase().slice(0, 60);
  if (!clean) return;
  await upsert('tags', stableId(currentUserId(), 'tag', clean), { name: clean });
}

export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const tags = useAll('tags');
  const t = useT();
  const add = (raw: string) => {
    const name = raw.trim().toLowerCase().replace(/^#/, '');
    if (!name || value.includes(name)) return setDraft('');
    onChange([...value, name]);
    void ensureTag(name);
    setDraft('');
  };
  const suggestions = draft ? tags.filter((x) => x.name.startsWith(draft.toLowerCase()) && !value.includes(x.name)).slice(0, 5) : [];
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
          #{tag}
          <button onClick={() => onChange(value.filter((x) => x !== tag))} aria-label={t('Remove tag')}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length ? '' : t('Add tags…')}
        className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
        list="tag-suggestions"
      />
      {suggestions.length > 0 && (
        <div className="flex w-full flex-wrap gap-1">
          {suggestions.map((s) => (
            <button key={s.id} onMouseDown={(e) => e.preventDefault()} onClick={() => add(s.name)} className="rounded border px-1.5 text-xs text-muted-foreground hover:bg-accent">
              #{s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
