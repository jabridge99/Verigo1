import React, { useState, useMemo } from 'react'
import {
  TrendingUp, DollarSign, BarChart2, Layers, CheckCircle,
  SlidersHorizontal, RefreshCw, Target, ArrowRight, Globe,
} from 'lucide-react'
import {
  PHASES, CAPEX_ITEMS, OPEX_MONTHLY, REVENUE_ASSUMPTIONS, DEFAULT_PARAMS,
  MILESTONES, MARKET_CONTEXT, computeModel, computeNPV, computePeakFunding,
  computeIRR, computePhaseSummary,
} from '../../data/roadmap.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtAUD(n, compact = false) {
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000)     return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1_000).toFixed(0)}K`
    return `$${Math.round(Math.abs(n))}`
  }
  return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString()
}

function fmtMonth(m) {
  if (!m) return 'Not reached'
  const yr = Math.ceil(m / 12)
  const mo = ((m - 1) % 12) + 1
  return `Yr ${yr} Mo ${mo}`
}

const PHASE_COLORS = {
  eco:    { border: 'border-eco-200',    bg: 'bg-eco-50',    badge: 'bg-eco-100 text-eco-700',    bar: 'bg-eco-500',    fill: 'rgba(34,197,94,0.12)'    },
  amber:  { border: 'border-amber-200',  bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500',  fill: 'rgba(245,158,11,0.12)'   },
  violet: { border: 'border-violet-200', bg: 'bg-violet-50', badge: 'bg-violet-100 text-violet-700',bar: 'bg-violet-500',fill: 'rgba(139,92,246,0.12)'   },
  indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700',bar: 'bg-indigo-500',fill: 'rgba(99,102,241,0.12)'   },
}

const OPEX_CAT_COLORS = {
  People: 'bg-violet-500', Tech: 'bg-indigo-500', Growth: 'bg-eco-500',
  Logistics: 'bg-amber-500', Legal: 'bg-slate-400', Other: 'bg-slate-300',
}

const PARAM_DEFS = [
  { key: 'platform_margin_pct',      label: 'Platform Margin',      min: 18, max: 42,  step: 1,   fmt: v => `${v}%`  },
  { key: 'deposits_per_station_day', label: 'Deposits / Station / Day', min: 5, max: 35, step: 1, fmt: v => `${v}`   },
  { key: 'avg_deposit_gross_aud',    label: 'Avg Deposit Value',     min: 4,  max: 20,  step: 0.5, fmt: v => `$${v}`  },
  { key: 'station_rollout_multiplier',label:'Rollout Speed',         min: 0.5,max: 2.0, step: 0.1, fmt: v => `${v}×`  },
  { key: 'capex_multiplier',         label: 'CAPEX Multiplier',      min: 0.5,max: 2.0, step: 0.1, fmt: v => `${v}×`  },
  { key: 'opex_multiplier',          label: 'OPEX Multiplier',       min: 0.7,max: 1.5, step: 0.05,fmt: v => `${v}×`  },
  { key: 'discount_rate_annual_pct', label: 'Discount Rate',         min: 6,  max: 18,  step: 0.5, fmt: v => `${v}%`  },
  { key: 'marketplace_multiplier',   label: 'Marketplace Revenue',   min: 0,  max: 2.0, step: 0.1, fmt: v => `${v}×`  },
]

// ─── SVG chart components ────────────────────────────────────────────────────

const W = 900, H = 260, PADL = 72, PADB = 32, PADT = 24, PADR = 16
const CW = W - PADL - PADR
const CH = H - PADT - PADB

function CashFlowChart({ monthly, breakeven_month }) {
  const values = monthly.map(m => m.cum_cash_flow)
  const minV = Math.min(...values, 0)
  const maxV = Math.max(...values, 0)
  const range = maxV - minV || 1
  const toX = m => PADL + ((m - 1) / 83) * CW
  const toY = v => PADT + (1 - (v - minV) / range) * CH
  const zeroY = toY(0)

  const pts = monthly.map(m => `${toX(m.month)},${toY(m.cum_cash_flow)}`).join(' ')

  // Phase bands
  const bands = [
    { from: 1, to: 12, color: 'rgba(34,197,94,0.06)'   },
    { from: 13,to: 30, color: 'rgba(245,158,11,0.06)'  },
    { from: 31,to: 54, color: 'rgba(139,92,246,0.06)'  },
    { from: 55,to: 84, color: 'rgba(99,102,241,0.06)'  },
  ]

  // Y gridlines
  const steps = 5
  const gridVals = Array.from({ length: steps + 1 }, (_, i) => minV + (range / steps) * i)

  const beX = breakeven_month ? toX(breakeven_month) : null
  const beY = breakeven_month ? toY(0) : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]">
      {/* Phase bands */}
      {bands.map(b => (
        <rect key={b.from} x={toX(b.from)} y={PADT} width={toX(b.to + 1) - toX(b.from)} height={CH} fill={b.color} />
      ))}
      {/* Grid */}
      {gridVals.map(v => {
        const y = toY(v)
        return (
          <g key={v}>
            <line x1={PADL} x2={PADL + CW} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PADL - 6} y={y + 4} textAnchor="end" fill="#94a3b8" style={{ fontSize: 9 }}>
              {fmtAUD(v, true)}
            </text>
          </g>
        )
      })}
      {/* Zero line */}
      <line x1={PADL} x2={PADL + CW} y1={zeroY} y2={zeroY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
      {/* X axis labels */}
      {[12, 24, 36, 48, 60, 72, 84].map(m => (
        <text key={m} x={toX(m)} y={H - 4} textAnchor="middle" fill="#94a3b8" style={{ fontSize: 9 }}>
          Yr {m / 12}
        </text>
      ))}
      {/* Phase labels */}
      {[{ m: 6, l: 'P1' }, { m: 21, l: 'P2' }, { m: 42, l: 'P3' }, { m: 69, l: 'P4' }].map(p => (
        <text key={p.l} x={toX(p.m)} y={PADT + 12} textAnchor="middle" fill="#64748b" style={{ fontSize: 9, fontWeight: 600 }}>
          {p.l}
        </text>
      ))}
      {/* Breakeven annotation */}
      {beX && (
        <g>
          <line x1={beX} x2={beX} y1={PADT} y2={PADT + CH} stroke="#22c55e" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx={beX} cy={beY} r="4" fill="#22c55e" />
          <rect x={beX - 36} y={PADT + 2} width={72} height={14} rx="3" fill="#22c55e" />
          <text x={beX} y={PADT + 12} textAnchor="middle" fill="white" style={{ fontSize: 8, fontWeight: 700 }}>
            BREAKEVEN
          </text>
        </g>
      )}
      {/* Cash flow line */}
      <polyline points={pts} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* Axes */}
      <line x1={PADL} x2={PADL} y1={PADT} y2={PADT + CH} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={PADL} x2={PADL + CW} y1={PADT + CH} y2={PADT + CH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  )
}

function StationChart({ monthly }) {
  const maxS = monthly[83]?.stations ?? 1
  const toX = m => PADL + ((m - 1) / 83) * CW
  const toY = s => PADT + (1 - s / maxS) * CH

  const lineColor = { 1: '#22c55e', 2: '#f59e0b', 3: '#8b5cf6', 4: '#6366f1' }
  const segments = { 1: [], 2: [], 3: [], 4: [] }
  monthly.forEach(m => segments[m.phase].push(m))

  const fillPath = `M${toX(1)},${toY(0)} ` +
    monthly.map(m => `L${toX(m.month)},${toY(m.stations)}`).join(' ') +
    ` L${toX(84)},${toY(0)} Z`

  const peaks = [
    { m: 12, s: 20, l: '20' }, { m: 30, s: 100, l: '100' },
    { m: 54, s: 500, l: '500' }, { m: 84, s: 1200, l: '1,200' },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]">
      <defs>
        <linearGradient id="stationFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {[0, 300, 600, 900, 1200].filter(v => v <= maxS * 1.05).map(v => {
        const y = toY(v)
        return (
          <g key={v}>
            <line x1={PADL} x2={PADL + CW} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PADL - 6} y={y + 4} textAnchor="end" fill="#94a3b8" style={{ fontSize: 9 }}>
              {v.toLocaleString()}
            </text>
          </g>
        )
      })}
      {/* Fill */}
      <path d={fillPath} fill="url(#stationFill)" />
      {/* Colored segment lines */}
      {Object.entries(segments).map(([ph, segs]) =>
        segs.length > 1 ? (
          <polyline key={ph}
            points={segs.map(m => `${toX(m.month)},${toY(m.stations)}`).join(' ')}
            fill="none" stroke={lineColor[ph]} strokeWidth="2.5" strokeLinejoin="round" />
        ) : null
      )}
      {/* Peak labels */}
      {peaks.map(p => (
        <g key={p.m}>
          <circle cx={toX(p.m)} cy={toY(p.s)} r="3.5" fill={lineColor[monthly.find(m => m.month === p.m)?.phase ?? 1]} />
          <text x={toX(p.m)} y={toY(p.s) - 8} textAnchor="middle" fill="#475569" style={{ fontSize: 9, fontWeight: 600 }}>
            {p.l}
          </text>
        </g>
      ))}
      {/* X axis */}
      {[12, 24, 36, 48, 60, 72, 84].map(m => (
        <text key={m} x={toX(m)} y={H - 4} textAnchor="middle" fill="#94a3b8" style={{ fontSize: 9 }}>
          Yr {m / 12}
        </text>
      ))}
      <line x1={PADL} x2={PADL + CW} y1={PADT + CH} y2={PADT + CH} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={PADL} x2={PADL} y1={PADT} y2={PADT + CH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  )
}

function HBar({ value, max, color = 'bg-violet-500', height = 'h-2' }) {
  const pct = Math.min(100, (value / (max || 1)) * 100)
  return (
    <div className={`w-full bg-slate-100 rounded-full ${height} overflow-hidden`}>
      <div className={`${height} ${color} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoadmapDashboard() {
  const [params, setParams]             = useState(DEFAULT_PARAMS)
  const [selectedPhase, setSelectedPhase] = useState(1)
  const [showParams, setShowParams]     = useState(false)

  const { monthly, breakeven_month } = useMemo(() => computeModel(params), [params])
  const npv       = useMemo(() => Math.round(computeNPV(monthly)), [monthly])
  const peakFund  = useMemo(() => computePeakFunding(monthly), [monthly])
  const irr       = useMemo(() => computeIRR(monthly), [monthly])
  const phaseSums = useMemo(() => computePhaseSummary(monthly), [monthly])
  const totalRevenue7yr = useMemo(() => monthly.reduce((s, m) => s + m.revenue, 0), [monthly])
  const totalOpex7yr    = useMemo(() => monthly.reduce((s, m) => s + m.opex, 0), [monthly])
  const totalCapex7yr   = useMemo(() => monthly.reduce((s, m) => s + m.capex, 0), [monthly])

  const sp = PHASES.find(p => p.id === selectedPhase)
  const sc = PHASE_COLORS[sp.color]
  const capexItems = CAPEX_ITEMS[selectedPhase] ?? []
  const opexItems  = OPEX_MONTHLY[selectedPhase] ?? []
  const ra         = REVENUE_ASSUMPTIONS[selectedPhase]
  const ps         = phaseSums[selectedPhase] ?? { revenue: 0, opex: 0, capex: 0, cashFlow: 0, months: 0 }

  const maxCapex   = Math.max(...capexItems.map(i => i.amount), 1)
  const maxOpex    = Math.max(...opexItems.map(i => i.amount), 1)
  const totalCapex = capexItems.reduce((s, i) => s + i.amount, 0) * params.capex_multiplier
  const totalOpexM = opexItems.reduce((s, i) => s + i.amount, 0) * params.opex_multiplier

  const phaseEndStation = monthly.find(m => m.phase === selectedPhase && m.month === (PHASES.find(p => p.id === selectedPhase + 1)?.start_month - 1 || 84))?.stations
    ?? monthly.filter(m => m.phase === selectedPhase).at(-1)?.stations ?? 0

  const stationRevenuePeak = phaseEndStation
    * ra.deposits_per_station_day * (params.deposits_per_station_day / 15)
    * ra.avg_deposit_gross_aud * (params.avg_deposit_gross_aud / 9.50)
    * (params.platform_margin_pct / 100) * 30

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roadmap &amp; Financial Model</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            4-phase · 7-year projection · NPV / IRR / breakeven · adjustable parameters
          </p>
        </div>
        <button onClick={() => setShowParams(v => !v)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-sm font-bold rounded-xl hover:bg-slate-50 text-slate-700 transition-colors">
          <SlidersHorizontal className="w-4 h-4" />
          {showParams ? 'Hide Parameters' : 'Adjust Parameters'}
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: 'Breakeven', icon: Target,
            value: fmtMonth(breakeven_month),
            color: !breakeven_month ? 'text-red-500' : breakeven_month <= 36 ? 'text-eco-600' : breakeven_month <= 54 ? 'text-amber-600' : 'text-orange-500',
            sub: breakeven_month ? `Month ${breakeven_month}` : 'Outside 7yr window',
          },
          {
            label: `NPV @ ${params.discount_rate_annual_pct}%`, icon: TrendingUp,
            value: fmtAUD(npv, true),
            color: npv >= 0 ? 'text-eco-600' : 'text-red-500',
            sub: npv >= 0 ? 'Value-positive' : 'Negative at this rate',
          },
          {
            label: 'Projected IRR', icon: BarChart2,
            value: irr >= 0 ? `${irr}%` : 'N/A',
            color: irr >= 15 ? 'text-eco-600' : irr >= 8 ? 'text-amber-600' : 'text-red-500',
            sub: irr >= 15 ? 'Strong return' : irr >= 8 ? 'Acceptable' : 'Below threshold',
          },
          {
            label: 'Peak Funding', icon: DollarSign,
            value: fmtAUD(peakFund, true),
            color: 'text-slate-800',
            sub: 'Total capital required',
          },
          {
            label: '7-Year Revenue', icon: Layers,
            value: fmtAUD(totalRevenue7yr, true),
            color: 'text-violet-600',
            sub: `Net: ${fmtAUD(totalRevenue7yr - totalOpex7yr - totalCapex7yr, true)}`,
          },
        ].map(({ label, icon: Icon, value, color, sub }) => (
          <div key={label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <Icon className="w-4 h-4 text-slate-400 mb-2" />
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Parameters Panel */}
      {showParams && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-violet-500" />
              <h2 className="font-bold text-slate-900">Model Parameters</h2>
              <span className="text-[10px] text-slate-400">All KPIs update instantly</span>
            </div>
            <button onClick={() => setParams(DEFAULT_PARAMS)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors">
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PARAM_DEFS.map(({ key, label, min, max, step, fmt }) => (
              <div key={key}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-bold text-slate-700">{label}</span>
                  <span className="text-sm font-black text-slate-900">{fmt(params[key])}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={params[key]}
                  onChange={e => setParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                  className="w-full accent-violet-600 cursor-pointer" />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>{fmt(min)}</span><span>{fmt(max)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PHASES.map(phase => {
          const pc = PHASE_COLORS[phase.color]
          const ps2 = phaseSums[phase.id] ?? {}
          const isSelected = selectedPhase === phase.id
          const capexTotal = (CAPEX_ITEMS[phase.id] ?? []).reduce((s, i) => s + i.amount, 0)
          return (
            <div key={phase.id} onClick={() => setSelectedPhase(phase.id)}
              className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition-all ${pc.border} ${isSelected ? `ring-2 ring-offset-1 ring-violet-400 shadow-md` : 'hover:shadow-md hover:-translate-y-0.5'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pc.badge}`}>Phase {phase.id}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${phase.status === 'current' ? 'bg-eco-100 text-eco-700' : 'bg-slate-100 text-slate-500'}`}>
                  {phase.status === 'current' ? 'Current' : 'Planned'}
                </span>
              </div>
              <p className="font-black text-slate-900 text-base leading-tight">{phase.name}</p>
              <p className="text-[10px] text-slate-400 mb-3">{phase.duration_months} months · up to {phase.stations_end.toLocaleString()} stations</p>
              {phase.features.slice(0, 3).map(f => (
                <div key={f} className="flex items-start gap-1.5 mb-1">
                  <CheckCircle className={`w-3 h-3 flex-shrink-0 mt-0.5 ${phase.color === 'eco' ? 'text-eco-500' : phase.color === 'amber' ? 'text-amber-500' : phase.color === 'violet' ? 'text-violet-500' : 'text-indigo-500'}`} />
                  <span className="text-[10px] text-slate-600 leading-tight">{f}</span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-[10px]">
                <span className="text-slate-400">CAPEX: <strong className="text-slate-700">{fmtAUD(capexTotal, true)}</strong></span>
                <span className="text-slate-400">Rev: <strong className="text-eco-600">{fmtAUD(ps2.revenue ?? 0, true)}</strong></span>
              </div>
              {isSelected && (
                <div className="mt-2 text-center text-[10px] font-bold text-violet-500">↓ Details below</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cash Flow Chart */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="font-bold text-slate-900">Cumulative Cash Flow — 84 Months</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Phase bands shown · purple line = cumulative net position · green marker = breakeven
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            {[{ c: 'bg-eco-500', l: 'P1 MVP' }, { c: 'bg-amber-500', l: 'P2 Pilot' }, { c: 'bg-violet-500', l: 'P3 Scale' }, { c: 'bg-indigo-500', l: 'P4 Enterprise' }].map(({ c, l }) => (
              <div key={l} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${c}`} /><span className="text-slate-500">{l}</span></div>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <CashFlowChart monthly={monthly} breakeven_month={breakeven_month} />
        </div>
      </div>

      {/* Phase Detail */}
      <div className={`rounded-2xl border p-5 ${sc.bg} ${sc.border}`}>
        <h2 className="font-bold text-slate-900 mb-4">{sp.label} — Detail</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* CAPEX */}
          <div className="bg-white rounded-xl p-4">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">CAPEX</span>
              <span className="font-black text-slate-900">{fmtAUD(totalCapex, true)}</span>
            </div>
            <div className="space-y-2">
              {capexItems.map(item => (
                <div key={item.item}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-slate-600 font-semibold truncate pr-2">{item.item}</span>
                    <span className="text-slate-500 flex-shrink-0">{fmtAUD(item.amount * params.capex_multiplier, true)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HBar value={item.amount} max={maxCapex} color={sc.bar} height="h-1.5" />
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${sc.badge} flex-shrink-0`}>{item.category}</span>
                  </div>
                </div>
              ))}
            </div>
            {params.capex_multiplier !== 1.0 && (
              <p className="text-[10px] text-amber-600 mt-2 font-semibold">× {params.capex_multiplier} multiplier applied</p>
            )}
          </div>

          {/* OPEX */}
          <div className="bg-white rounded-xl p-4">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Monthly OPEX</span>
              <span className="font-black text-slate-900">{fmtAUD(totalOpexM, true)}</span>
            </div>
            <div className="space-y-2">
              {opexItems.map(item => (
                <div key={item.item}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-slate-600 font-semibold truncate pr-2">{item.item}</span>
                    <span className="text-slate-500 flex-shrink-0">{fmtAUD(item.amount * params.opex_multiplier, true)}</span>
                  </div>
                  <HBar value={item.amount} max={maxOpex} color={OPEX_CAT_COLORS[item.category] ?? 'bg-slate-400'} height="h-1.5" />
                </div>
              ))}
            </div>
            {params.opex_multiplier !== 1.0 && (
              <p className="text-[10px] text-amber-600 mt-2 font-semibold">× {params.opex_multiplier} multiplier applied</p>
            )}
          </div>

          {/* Revenue + Phase P&L */}
          <div className="bg-white rounded-xl p-4">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Revenue Drivers</span>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Deposits / station / day',  value: `~${(ra.deposits_per_station_day * (params.deposits_per_station_day / 15)).toFixed(1)}` },
                { label: 'Avg deposit gross',          value: `$${(ra.avg_deposit_gross_aud * (params.avg_deposit_gross_aud / 9.50)).toFixed(2)}` },
                { label: 'Platform margin',            value: `${params.platform_margin_pct}%` },
                { label: 'Revenue / station / month',  value: fmtAUD(stationRevenuePeak / (phaseEndStation || 1), true) },
                ...(ra.marketplace_monthly > 0 ? [{ label: 'Marketplace (monthly)',  value: fmtAUD(ra.marketplace_monthly * params.marketplace_multiplier, true) }] : []),
                ...(ra.api_monthly > 0          ? [{ label: 'API licensing (monthly)', value: fmtAUD(ra.api_monthly, true) }] : []),
                ...(ra.carbon_monthly > 0        ? [{ label: 'Carbon credits (monthly)', value: fmtAUD(ra.carbon_monthly, true) }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-bold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-eco-50 border border-eco-100 rounded-lg px-3 py-2">
              <p className="text-[10px] text-eco-700 font-semibold">
                At {phaseEndStation} stations: <strong>{fmtAUD(stationRevenuePeak, true)}/month</strong>
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-slate-500">Phase revenue</span><span className="font-bold text-eco-600">{fmtAUD(ps.revenue, true)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Phase costs</span><span className="font-bold text-slate-700">−{fmtAUD(ps.opex + ps.capex, true)}</span></div>
              <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
                <span className="font-bold text-slate-700">Phase net</span>
                <span className={`font-black ${ps.cashFlow >= 0 ? 'text-eco-600' : 'text-red-500'}`}>{fmtAUD(ps.cashFlow, true)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Station growth chart */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">Station Rollout</h2>
          <div className="flex items-center gap-4 text-[10px]">
            {[{ c: 'bg-eco-500', l: 'P1' }, { c: 'bg-amber-500', l: 'P2' }, { c: 'bg-violet-500', l: 'P3' }, { c: 'bg-indigo-500', l: 'P4' }].map(({ c, l }) => (
              <div key={l} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${c}`} /><span className="text-slate-500">{l}</span></div>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <StationChart monthly={monthly} />
        </div>
      </div>

      {/* Market + Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-950 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-eco-400" />
            <h2 className="font-bold text-white">Market Opportunity</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'AUS e-waste generated / year',   value: '539,000 tonnes' },
              { label: 'Global e-waste market',           value: '$62B USD' },
              { label: 'Current AUS recycling rate',      value: `${MARKET_CONTEXT.aus_recycling_rate_pct}% (gap = opportunity)` },
              { label: 'Total addressable market (AUS)',  value: `~$${Math.round(MARKET_CONTEXT.ecobin_tam_aud / 1_000_000)}M AUD` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="font-bold text-white">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-[10px] text-slate-400 mb-1.5">
              EcoBin Y7 revenue vs TAM ({MARKET_CONTEXT.serviceable_yr5_pct}% target penetration)
            </p>
            <HBar value={monthly[83]?.revenue * 12 ?? 0} max={MARKET_CONTEXT.ecobin_tam_aud} color="bg-eco-500" height="h-2" />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>$0</span>
              <span>{fmtAUD(MARKET_CONTEXT.ecobin_tam_aud, true)} TAM</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-violet-500" />
            <h2 className="font-bold text-slate-900">Financial Returns Summary</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Net Present Value',   value: fmtAUD(npv, true),           color: npv >= 0 ? 'text-eco-600' : 'text-red-500' },
              { label: 'Internal Rate of Return', value: `${irr >= 0 ? irr : 'N/A'}%`, color: irr >= 15 ? 'text-eco-600' : 'text-amber-600' },
              { label: 'Payback period',      value: fmtMonth(breakeven_month),   color: 'text-slate-800' },
              { label: 'Peak funding required', value: fmtAUD(peakFund, true),    color: 'text-slate-800' },
              { label: '7-year gross revenue', value: fmtAUD(totalRevenue7yr, true), color: 'text-eco-600' },
              { label: '7-year total investment', value: fmtAUD(totalOpex7yr + totalCapex7yr, true), color: 'text-slate-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-baseline">
                <span className="text-sm text-slate-500">{label}</span>
                <span className={`font-black text-lg ${color}`}>{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-slate-500">
              Base assumptions: {params.platform_margin_pct}% margin · {params.deposits_per_station_day} deposits/station/day · {params.discount_rate_annual_pct}% discount rate
            </p>
          </div>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-4">Phase Timeline</h2>
        <div className="flex gap-1 items-stretch">
          {PHASES.map((phase, idx) => {
            const pc = PHASE_COLORS[phase.color]
            const widthPct = (phase.duration_months / 84) * 100
            const startYr = Math.ceil(phase.start_month / 12)
            const endYr = Math.ceil((phase.start_month + phase.duration_months - 1) / 12)
            return (
              <React.Fragment key={phase.id}>
                <div className={`rounded-xl px-3 py-3 border cursor-pointer transition-all ${pc.bg} ${pc.border} ${selectedPhase === phase.id ? 'ring-2 ring-violet-400' : 'hover:shadow-sm'}`}
                  style={{ flex: `${widthPct} 0 0%`, minWidth: 0 }}
                  onClick={() => setSelectedPhase(phase.id)}>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${pc.badge} block w-fit mb-1`}>Phase {phase.id}</span>
                  <p className="font-black text-slate-900 text-sm truncate">{phase.name}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Yr {startYr}–{endYr} · {phase.duration_months}mo</p>
                  <p className="text-[9px] text-slate-500 mt-1 truncate">{phase.stations_end.toLocaleString()} stations</p>
                </div>
                {idx < PHASES.length - 1 && (
                  <div className="flex items-center flex-shrink-0">
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
        <div className="mt-2 flex gap-1">
          {PHASES.map(phase => (
            <div key={phase.id} style={{ flex: `${(phase.duration_months / 84) * 100} 0 0%` }} className="text-center">
              {MILESTONES.filter(m => m.phase === phase.id).slice(0, 2).map(ms => (
                <span key={ms.label} className="text-[8px] text-slate-400 block leading-tight">{ms.label}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
