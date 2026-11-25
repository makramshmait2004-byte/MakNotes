import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

export const MOODS = [
  { v: 1, label: 'Awful', glyph: '1' },
  { v: 2, label: 'Low', glyph: '2' },
  { v: 3, label: 'Okay', glyph: '3' },
  { v: 4, label: 'Good', glyph: '4' },
  { v: 5, label: 'Great', glyph: '5' },
];

export function MoodPicker({ value, onChange, label = 'Mood' }: { value: number | null; onChange: (v: number | null) => void; label?: string }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label={t(label)}>
      <span className="w-14 text-xs text-muted-foreground">{t(label)}</span>
      {MOODS.map((m) => (
        <button
          key={m.v}
          role="radio"
          aria-checked={value === m.v}
          title={t(m.label)}
          onClick={() => onChange(value === m.v ? null : m.v)}
          className={cn(
            'grid size-9 place-items-center rounded-full border text-sm tabular-nums text-muted-foreground transition-colors hover:border-bronze',
            value === m.v && 'border-bronze bg-bronze text-bronze-foreground',
          )}
        >
          {m.glyph}
        </button>
      ))}
      {value && <span className="text-xs text-muted-foreground">{t(MOODS[value - 1].label)}</span>}
    </div>
  );
}
