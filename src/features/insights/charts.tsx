import { useState } from 'react';
import { useT } from '@/i18n';

export interface Point {
  label: string;
  value: number | null;
  detail?: string;
}

/** Single-series bar chart: thin bars, rounded data-end, recessive axis, hover tooltip, table view. */
export function BarChart({ data, unit = '', height = 160, title }: { data: Point[]; unit?: string; height?: number; title: string }) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  const W = 600,
    H = height,
    padB = 22,
    padT = 8;
  const bw = W / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(28, bw * 0.6));
  const every = Math.ceil(data.length / 12);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={padT + (H - padB - padT) * (1 - f)} y2={padT + (H - padB - padT) * (1 - f)} className="stroke-border" strokeDasharray="2 4" />
        ))}
        <line x1={0} x2={W} y1={H - padB} y2={H - padB} className="stroke-border" />
        {data.map((d, i) => {
          const v = d.value ?? 0;
          const h = ((H - padB - padT) * v) / max;
          const x = i * bw + (bw - barW) / 2;
          const y = H - padB - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {h > 0 && <path d={`M${x},${H - padB} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${H - padB} Z`} className={hover === i ? 'fill-bronze' : 'fill-bronze/80'} />}
              {i % every === 0 && (
                <text x={i * bw + bw / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        <text x={2} y={padT + 10} className="fill-muted-foreground text-[11px]">
          {Math.round(max)}
          {unit}
        </text>
      </svg>
      <div className="h-5 text-xs text-muted-foreground" aria-live="polite">
        {hover !== null && data[hover] && `${data[hover].detail ?? data[hover].label}: ${data[hover].value ?? '—'}${unit}`}
      </div>
      <DataTable data={data} unit={unit} label={t('Show data')} />
    </figure>
  );
}

/** Single-series line chart with gaps for missing days and a hover crosshair. */
export function LineChart({ data, min, max, height = 150, title, unit = '' }: { data: Point[]; min: number; max: number; height?: number; title: string; unit?: string }) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const W = 600,
    H = height,
    padB = 22,
    padT = 10;
  const step = W / Math.max(1, data.length - 1 || 1);
  const x = (i: number) => (data.length === 1 ? W / 2 : i * step);
  const y = (v: number) => padT + (H - padB - padT) * (1 - (v - min) / (max - min || 1));
  const segments: string[] = [];
  let cur = '';
  data.forEach((d, i) => {
    if (d.value === null) {
      if (cur) segments.push(cur);
      cur = '';
    } else cur += `${cur ? 'L' : 'M'}${x(i)},${y(d.value)} `;
  });
  if (cur) segments.push(cur);
  const every = Math.ceil(data.length / 12);
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={title}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
      >
        {[min, (min + max) / 2, max].map((v) => (
          <g key={v}>
            <line x1={0} x2={W} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray="2 4" />
            <text x={2} y={y(v) - 3} className="fill-muted-foreground text-[11px]">
              {v}
            </text>
          </g>
        ))}
        {segments.map((d, i) => (
          <path key={i} d={d} className="fill-none stroke-bronze" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {data.map((d, i) =>
          d.value !== null ? <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 3} className="fill-bronze stroke-card" strokeWidth={2} /> : null,
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} className="stroke-muted-foreground/50" />}
        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {d.label}
            </text>
          ) : null,
        )}
      </svg>
      <div className="h-5 text-xs text-muted-foreground" aria-live="polite">
        {hover !== null && data[hover] && `${data[hover].detail ?? data[hover].label}: ${data[hover].value ?? t('no data')}${data[hover].value !== null ? unit : ''}`}
      </div>
      <DataTable data={data} unit={unit} label={t('Show data')} />
    </figure>
  );
}

function DataTable({ data, unit, label }: { data: Point[]; unit: string; label: string }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">{label}</summary>
      <table className="mt-1 w-full">
        <tbody>
          {data.map((d, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-0.5">{d.detail ?? d.label}</td>
              <td className="py-0.5 text-end tabular-nums">{d.value === null ? '—' : `${d.value}${unit}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-3xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
