export function DetectorTrace({
  series,
  labels,
}: {
  series: { id: string; color: string; values: (number | null)[] }[];
  labels: { x: string; y: string };
}) {
  const nums = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const ymin = nums.length ? Math.min(...nums) : 0;
  const ymax = nums.length ? Math.max(...nums) : 1;
  const pad = { l: 44, r: 12, t: 12, b: 32 };
  const W = 640;
  const H = 240;
  const n = Math.max((series[0]?.values.length ?? 1) - 1, 1);
  const sx = (i: number) => pad.l + (i / n) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - (v - ymin) / (ymax - ymin || 1)) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={labels.y}>
      {series.map((s) => {
        const pts = s.values
          .map((v, i) => (v == null ? null : `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`))
          .filter((p): p is string => p != null);
        if (pts.length < 2) return null;
        return <polyline key={s.id} fill="none" stroke={s.color} strokeWidth="1.8" points={pts.join(" ")} />;
      })}
      <text x={W / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
        {labels.x}
      </text>
    </svg>
  );
}
