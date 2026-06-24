"use client";

import Link from "next/link";

export interface Bar { date: string; count: number; volume?: number }

export function BarChartSVG({ data, color = "#3b82f6", valueKey = "count" }: {
  data: Bar[]; color?: string; valueKey?: keyof Bar;
}) {
  if (!data.length) return null;
  const vals = data.map(d => Number(d[valueKey]) || 0);
  const max = Math.max(...vals, 1);
  const w = 560; const h = 120; const barW = Math.max(2, (w / vals.length) - 2);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full" style={{ minWidth: 280 }}>
        {vals.map((v, i) => {
          const bh = Math.max(2, (v / max) * h);
          const x = i * (w / vals.length);
          const y = h - bh;
          return (
            <g key={i}>
              <rect x={x + 1} y={y} width={barW} height={bh} fill={color} opacity={0.8} rx={2} />
              <title>{data[i].date}: {v.toLocaleString()}</title>
            </g>
          );
        })}
        {[0, Math.floor(vals.length / 2), vals.length - 1].map(i => (
          <text key={i} x={(i + 0.5) * (w / vals.length)} y={h + 18} textAnchor="middle"
            fontSize={10} fill="#64748b">
            {data[i]?.date?.slice(5) ?? ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

export interface DonutSegment { label: string; value: number; href?: string }

export function DonutChart({ segments, colors }: { segments: DonutSegment[]; colors: string[] }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="text-slate-500 text-sm text-center py-4">No data</div>;

  let angle = -90;
  const r = 60; const cx = 80; const cy = 80;
  const paths = segments.map((seg, i) => {
    const pct = seg.value / total;
    const sweep = pct * 360;
    const startRad = (angle * Math.PI) / 180;
    const endRad = ((angle + sweep) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const large = sweep > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    angle += sweep;
    return { d, color: colors[i % colors.length], label: seg.label, value: seg.value, pct, href: seg.href };
  });

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 160 160" className="w-32 h-32 flex-shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} opacity={0.85}>
            <title>{p.label}: {p.value.toLocaleString()} ({(p.pct * 100).toFixed(1)}%)</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={32} fill="#0d1526" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fill="#fff" fontWeight={700}>{total.toLocaleString()}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="#64748b">total</text>
      </svg>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {paths.map((p, i) => {
          const row = (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="text-slate-400 truncate capitalize">{p.label}</span>
              <span className="ml-auto font-mono text-slate-300">{p.value.toLocaleString()}</span>
            </div>
          );
          return p.href ? (
            <Link key={i} href={p.href} className="hover:bg-white/5 rounded px-1 -mx-1 transition-colors">{row}</Link>
          ) : <div key={i}>{row}</div>;
        })}
      </div>
    </div>
  );
}

export function KPI({ label, value, sub, icon: Icon, color, href }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string; href?: string;
}) {
  const body = (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 h-full hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">{label}</span>
        <div className={`p-1.5 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
      </div>
      <div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function StatTile({ label, value, color = "text-white", href }: {
  label: string; value: string | number; color?: string; href?: string;
}) {
  const body = (
    <div className="text-center hover:opacity-80 transition-opacity">
      <div className={`text-2xl font-bold ${color}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
