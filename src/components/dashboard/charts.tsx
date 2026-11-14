import type { PsdPoint } from "@/lib/insights/types";

type Line = { id: string; color: string; points: PsdPoint[] };

function xOf(d_nm: number) {
  return Math.log10(Math.max(d_nm, 1));
}

export function Sparkline({
  values,
  color,
  className,
}: {
  values: number[];
  color: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 120;
  const h = 36;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden>
      <path d={area} fill={color} opacity="0.18" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function PsdChart({ series, labels }: { series: Line[]; labels: { x: string; y: string } }) {
  const pad = { l: 42, r: 12, t: 12, b: 36 };
  const W = 560;
  const H = 260;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const all = series.flatMap((s) => s.points);
  const xmin = Math.min(...all.map((p) => xOf(p.d_nm)));
  const xmax = Math.max(...all.map((p) => xOf(p.d_nm)));
  const ymin = -2;
  const ymax = Math.max(...all.map((p) => p.log10), 1);
  const sx = (x: number) => pad.l + ((x - xmin) / (xmax - xmin || 1)) * innerW;
  const sy = (y: number) => pad.t + (1 - (y - ymin) / (ymax - ymin || 1)) * innerH;
  const ticksX = [1, 10, 100, 1000, 10000, 100000];
  const ticksY = [0, 3, 6, 9];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={labels.y}>
      {ticksX.map((d) => (
        <g key={d}>
          <line x1={sx(xOf(d))} x2={sx(xOf(d))} y1={pad.t} y2={H - pad.b} stroke="currentColor" opacity="0.08" />
          <text x={sx(xOf(d))} y={H - 12} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
            {d >= 1000 ? `${d / 1000}μm` : `${d}nm`}
          </text>
        </g>
      ))}
      {ticksY.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="currentColor" opacity="0.08" />
          <text x={pad.l - 8} y={sy(t) + 3} textAnchor="end" className="fill-muted-foreground" fontSize="10">
            10^{t}
          </text>
        </g>
      ))}
      {series.map((s) => {
        const visible = s.points.filter((p) => p.log10 >= ymin - 1);
        if (visible.length < 2) return null;
        const d = visible
          .map((p, i) => `${i === 0 ? "M" : "L"}${sx(xOf(p.d_nm)).toFixed(1)},${sy(p.log10).toFixed(1)}`)
          .join(" ");
        const first = visible[0]!;
        const last = visible[visible.length - 1]!;
        const area = `${d} L${sx(xOf(last.d_nm)).toFixed(1)},${sy(ymin)} L${sx(xOf(first.d_nm)).toFixed(1)},${sy(ymin)} Z`;
        return (
          <g key={s.id}>
            <path d={area} fill={s.color} opacity="0.14" />
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" />
          </g>
        );
      })}
      <text x={W / 2} y={H - 2} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
        {labels.x}
      </text>
    </svg>
  );
}

export function BarChart({
  items,
  colors,
}: {
  items: { label: string; value: number }[];
  colors: string[];
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const pad = { l: 108, r: 16, t: 8, b: 8 };
  const W = 560;
  const row = 28;
  const H = pad.t + pad.b + items.length * row;
  const barW = W - pad.l - pad.r - 36;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      {items.map((item, i) => {
        const y = pad.t + i * row;
        const w = (item.value / max) * barW;
        return (
          <g key={item.label}>
            <text x={pad.l - 8} y={y + 14} textAnchor="end" className="fill-muted-foreground" fontSize="11">
              {item.label}
            </text>
            <rect x={pad.l} y={y + 4} width={w} height={16} rx="4" fill={colors[i % colors.length]} opacity="0.9" />
            <text x={pad.l + w + 6} y={y + 16} className="fill-foreground" fontSize="11">
              {item.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function GroupedBarChart({
  categories,
  series,
  yLabel,
}: {
  categories: string[];
  series: { id: string; label: string; color: string; values: number[] }[];
  yLabel: string;
}) {
  const max = Math.max(...series.flatMap((s) => s.values), 0.05);
  const pad = { l: 40, r: 12, t: 16, b: 40 };
  const W = 560;
  const H = 260;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const groupW = innerW / categories.length;
  const barW = Math.min(26, (groupW / (series.length + 1)) * 0.85);
  const ticks = 4;
  const sy = (v: number) => pad.t + (1 - v / max) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={yLabel}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = (max / ticks) * i;
        return (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke="currentColor" opacity="0.08" />
            <text x={pad.l - 8} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground" fontSize="10">
              {v >= 1 ? v.toFixed(0) : v.toFixed(1)}
            </text>
          </g>
        );
      })}
      {categories.map((cat, ci) => {
        const gx = pad.l + ci * groupW;
        return (
          <g key={cat}>
            {series.map((s, si) => {
              const v = s.values[ci] ?? 0;
              const h = (v / max) * innerH;
              const x = gx + groupW / 2 - (series.length * barW) / 2 + si * barW;
              return (
                <rect
                  key={s.id}
                  x={x}
                  y={sy(v)}
                  width={barW - 4}
                  height={h}
                  rx="4"
                  fill={s.color}
                  opacity="0.92"
                />
              );
            })}
            <text x={gx + groupW / 2} y={H - 18} textAnchor="middle" className="fill-muted-foreground" fontSize="11">
              {cat}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
        {yLabel}
      </text>
    </svg>
  );
}

export function AtmosphereBars({
  zones,
}: {
  zones: { id: string; label: string; o2: number; psi: number; color: string }[];
}) {
  const maxO2 = 100;
  const maxP = 15;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {zones.map((z) => (
        <div key={z.id} className="space-y-2">
          <p className="text-sm font-medium">{z.label}</p>
          <div>
            <p className="mb-1 font-mono text-[10px] text-muted-foreground">O₂ {z.o2}%</p>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full" style={{ width: `${(z.o2 / maxO2) * 100}%`, background: z.color }} />
            </div>
          </div>
          <div>
            <p className="mb-1 font-mono text-[10px] text-muted-foreground">{z.psi} psi</p>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full opacity-80"
                style={{ width: `${(z.psi / maxP) * 100}%`, background: z.color }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
