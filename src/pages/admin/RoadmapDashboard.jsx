import React, { useState, useMemo } from 'react'
import {
  PHASES, CAPEX_ITEMS, OPEX_MONTHLY, REVENUE_ASSUMPTIONS, DEFAULT_PARAMS, MILESTONES,
  MARKET_CONTEXT, computeModel, computeNPV, computePeakFunding, computeIRR,
  computePhaseSummary, BASE_STATION_SCHEDULE,
} from '../../data/roadmap.js'
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2, Layers,
  CheckCircle, SlidersHorizontal, RefreshCw, ChevronDown, ChevronUp,
  Target, Zap, Building2, Globe, Cpu, ArrowRight, MapPin,
} from 'lucide-react'

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtAUD(n, compact = false) {
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1_000_000).toFixed(1)}M`
    if (Math.abs(n) >= 1_000)     return `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1_000).toFixed(0)}K`
    return `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n))}`
  }
  return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString()
}

function fmtMonth(m) {
  if (!m) return 'Not reached'
  const yr = Math.ceil(m / 12)
  const mo = ((m - 1) % 12) + 1
  return `Yr ${yr} Mo ${mo}`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_HEX   = ['#22c55e', '#f59e0b', '#8b5cf6', '#6366f1']
const PHASE_FILL  = ['rgba(34,197,94,0.07)', 'rgba(245,158,11,0.07)', 'rgba(139,92,246,0.07)', 'rgba(99,102,241,0.07)']

const PHASE_STYLES = {
  eco:    { border: 'border-eco-200',    ring: 'ring-eco-400',    badge: 'bg-eco-100 text-eco-700',     accent: 'text-eco-600',    bg: 'bg-eco-50'    },
  amber:  { border: 'border-amber-200',  ring: 'ring-amber-400',  badge: 'bg-amber-100 text-amber-700', accent: 'text-amber-600',  bg: 'bg-amber-50'  },
  violet: { border: 'border-violet-200', ring: 'ring-violet-400', badge: 'bg-violet-100 text-violet-700',accent: 'text-violet-600',bg: 'bg-violet-50' },
  indigo: { border: 'border-indigo-200', ring: 'ring-indigo-400', badge: 'bg-indigo-100 text-indigo-700',accent: 'text-indigo-600',bg: 'bg-indigo-50' },
}

const OPEX_CAT_COLOR = {
  People: 'bg-violet-500', Tech: 'bg-indigo-500', Growth: 'bg-eco-500',
  Logistics: 'bg-amber-500', Legal: 'bg-slate-400', Other: 'bg-slate-300',
}

const CAPEX_CAT_COLOR = {
  Software: 'bg-violet-500', Hardware: 'bg-indigo-500', Facilities: 'bg-amber-500',
  Equipment: 'bg-eco-500', Legal: 'bg-slate-400', Office: 'bg-slate-300',
  Capital: 'bg-teal-500', Compliance: 'bg-rose-500',
}

const SLIDERS = [
  { key: 'platform_margin_pct',        label: 'Platform Margin',       min: 18,  max: 42,  step: 1,    fmt: v => `${v}%`   },
  { key: 'deposits_per_station_day',   label: 'Deposits/Station/Day',  min: 5,   max: 35,  step: 1,    fmt: v => `${v}`    },
  { key: 'avg_deposit_gross_aud',      label: 'Avg Deposit Value',     min: 4,   max: 20,  step: 0.5,  fmt: v => `$${v}`   },
  { key: 'station_rollout_multiplier', label: 'Rollout Speed',         min: 0.5, max: 2.0, step: 0.1,  fmt: v => `${v}×`  },
  { key: 'capex_multiplier',           label: 'CAPEX Multiplier',      min: 0.5, max: 2.0, step: 0.1,  fmt: v => `${v}×`  },
  { key: 'opex_multiplier',            label: 'OPEX Multiplier',       min: 0.7, max: 1.5, step: 0.05, fmt: v => `${v}×`  },
  { key: 'discount_rate_annual_pct',   label: 'Discount Rate',         min: 6,   max: 18,  step: 0.5,  fmt: v => `${v}%`   },
  { key: 'marketplace_multiplier',     label: 'Marketplace Revenue',   min: 0,   max: 2.0, step: 0.1,  fmt: v => `${v}×`  },
]

// ─── Chart constants ──────────────────────────────────────────────────────────

const W = 900, H = 260, PADL = 72, PADB = 30, PADT = 22, PADR = 16
const CW = W - PADL - PADR
const CH = H - PADT - PADB

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, valueColor = 'text-slate-900', icon: Icon, iconBg = 'bg-slate-100', iconColor = 'text-slate-500' }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</span>
        {Icon && (
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon size={13} className={iconColor} />
          </span>
        )}
      </div>
      <p className={`text-2xl font-black leading-none ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 leading-snug">{sub}</p>}
    </div>
  )
}

function HorizBar({ label, amount, max, category, catColor = 'bg-slate-400' }) {
  const pct = max > 0 ? Math.min((Math.abs(amount) / Math.abs(max)) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-700 leading-tight flex-1 min-w-0 truncate">{label}</span>
        <span className="text-[11px] text-slate-500 font-mono shrink-0">{fmtAUD(amount, true)}</span>
      </div>
      <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${catColor} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
      {category && (
        <span className={`inline-block text-[9px] uppercase tracking-wide font-bold px-1 py-0.5 rounded ${catColor.replace('bg-', 'text-').replace('-500', '-700').replace('-400', '-600').replace('-300', '-600')} bg-slate-50`}>
          {category}
        </span>
      )}
    </div>
  )
}

function CashFlowChart({ monthly, breakeven_month }) {
  const values = monthly.map(m => m.cum_cash_flow)
  const minV   = Math.min(...values, 0)
  const maxV   = Math.max(...values, 0)
  const range  = maxV - minV || 1
  const toX    = m => PADL + ((m - 1) / 83) * CW
  const toY    = v => PADT + (1 - (v - minV) / range) * CH
  const zeroY  = toY(0)

  const pts = monthly.map(m => `${toX(m.month)},${toY(m.cum_cash_flow)}`).join(' ')

  // Closed fill path for positive/negative clip trick
  const fillD =
    `M${toX(1)},${zeroY} ` +
    monthly.map(m => `L${toX(m.month)},${toY(m.cum_cash_flow)}`).join(' ') +
    ` L${toX(84)},${zeroY} Z`

  // Y grid
  const steps    = 5
  const gridVals = Array.from({ length: steps + 1 }, (_, i) => minV + (range / steps) * i)

  const beX = breakeven_month ? toX(breakeven_month) : null

  // Milestone boundary ticks (phase ends)
  const boundaryMonths = [12, 30, 54]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]">
      <defs>
        <clipPath id="cf-pos">
          <rect x={PADL} y={PADT} width={CW} height={Math.max(0, zeroY - PADT)} />
        </clipPath>
        <clipPath id="cf-neg">
          <rect x={PADL} y={zeroY} width={CW} height={Math.max(0, PADT + CH - zeroY)} />
        </clipPath>
      </defs>

      {/* Phase background bands */}
      {PHASES.map((ph, i) => (
        <rect
          key={ph.id}
          x={toX(ph.start_month)} y={PADT}
          width={Math.max(0, toX(ph.start_month + ph.duration_months) - toX(ph.start_month))}
          height={CH}
          fill={PHASE_FILL[i]}
        />
      ))}

      {/* Y gridlines */}
      {gridVals.map((v, i) => {
        const y = toY(v)
        return (
          <g key={i}>
            <line x1={PADL} x2={PADL + CW} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PADL - 5} y={y + 4} textAnchor="end" fill="#94a3b8" style={{ fontSize: 9, fontFamily: 'monospace' }}>
              {fmtAUD(v, true)}
            </text>
          </g>
        )
      })}

      {/* Zero dashed line */}
      <line x1={PADL} x2={PADL + CW} y1={zeroY} y2={zeroY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x={PADL - 5} y={zeroY + 4} textAnchor="end" fill="#64748b" fontWeight="bold" style={{ fontSize: 9, fontFamily: 'monospace' }}>$0</text>

      {/* Positive fill (eco tint) */}
      <path d={fillD} fill="rgba(34,197,94,0.10)" clipPath="url(#cf-pos)" />
      {/* Negative fill (red tint) */}
      <path d={fillD} fill="rgba(239,68,68,0.07)" clipPath="url(#cf-neg)" />

      {/* Phase boundary ticks */}
      {boundaryMonths.map(bm => (
        <line key={bm} x1={toX(bm)} x2={toX(bm)} y1={PADT} y2={PADT + CH} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
      ))}

      {/* Phase name labels at top */}
      {PHASES.map((ph, i) => {
        const cx = (toX(ph.start_month) + toX(Math.min(ph.start_month + ph.duration_months - 1, 84))) / 2
        return (
          <text key={ph.id} x={cx} y={PADT + 10} textAnchor="middle" fill={PHASE_HEX[i]} fontWeight="bold" style={{ fontSize: 8, opacity: 0.85 }}>
            {ph.name}
          </text>
        )
      })}

      {/* Breakeven vertical + dot */}
      {beX && (
        <g>
          <line x1={beX} x2={beX} y1={PADT} y2={PADT + CH} stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx={beX} cy={zeroY} r="5" fill="#22c55e" />
          <rect x={beX + 6} y={zeroY - 17} width={86} height={14} rx="3" fill="#22c55e" />
          <text x={beX + 49} y={zeroY - 7} textAnchor="middle" fill="white" fontWeight="700" style={{ fontSize: 8 }}>
            {`Breakeven ${fmtMonth(breakeven_month)}`}
          </text>
        </g>
      )}

      {/* Cash flow polyline */}
      <polyline
        points={pts} fill="none"
        stroke="#7c3aed" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"
      />

      {/* X axis year labels */}
      {[12, 24, 36, 48, 60, 72, 84].map(m => (
        <g key={m}>
          <line x1={toX(m)} x2={toX(m)} y1={PADT + CH} y2={PADT + CH + 4} stroke="#cbd5e1" strokeWidth="1" />
          <text x={toX(m)} y={H - 4} textAnchor="middle" fill="#94a3b8" style={{ fontSize: 9 }}>Yr {m / 12}</text>
        </g>
      ))}

      {/* Axes */}
      <line x1={PADL} x2={PADL} y1={PADT} y2={PADT + CH} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={PADL} x2={PADL + CW} y1={PADT + CH} y2={PADT + CH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  )
}

function StationChart({ monthly }) {
  const SH = 160
  const maxS = Math.max(monthly[83]?.stations ?? 1200, 1)
  const toX  = m => PADL + ((m - 1) / 83) * CW
  const toY  = s => PADT + (1 - s / maxS) * (SH - PADT - PADB)
  const botY = PADT + (SH - PADT - PADB)

  const fillD =
    `M${toX(1)},${botY} ` +
    monthly.map(m => `L${toX(m.month)},${toY(m.stations)}`).join(' ') +
    ` L${toX(84)},${botY} Z`

  const lineByPhase = { 1: [], 2: [], 3: [], 4: [] }
  monthly.forEach(m => lineByPhase[m.phase].push(m))

  const phaseEndPts = [
    { m: 12,  s: monthly.find(x => x.month === 12)?.stations  ?? 20   },
    { m: 30,  s: monthly.find(x => x.month === 30)?.stations  ?? 100  },
    { m: 54,  s: monthly.find(x => x.month === 54)?.stations  ?? 500  },
    { m: 84,  s: monthly.find(x => x.month === 84)?.stations  ?? 1200 },
  ]

  // Y grid values
  const yTicks = [0, 300, 600, 900, 1200].filter(v => v <= maxS * 1.05)

  return (
    <svg viewBox={`0 0 ${W} ${SH}`} className="w-full min-w-[560px]">
      <defs>
        <linearGradient id="stnFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Phase bands */}
      {PHASES.map((ph, i) => (
        <rect
          key={ph.id}
          x={toX(ph.start_month)} y={PADT}
          width={Math.max(0, toX(Math.min(ph.start_month + ph.duration_months, 85)) - toX(ph.start_month))}
          height={SH - PADT - PADB}
          fill={PHASE_FILL[i]}
        />
      ))}

      {/* Y grid */}
      {yTicks.map(v => {
        const y = toY(v)
        return (
          <g key={v}>
            <line x1={PADL} x2={PADL + CW} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PADL - 5} y={y + 4} textAnchor="end" fill="#94a3b8" style={{ fontSize: 9, fontFamily: 'monospace' }}>
              {v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v}
            </text>
          </g>
        )
      })}

      {/* Fill */}
      <path d={fillD} fill="url(#stnFill)" />

      {/* Phase-colored line segments */}
      {Object.entries(lineByPhase).map(([ph, segs]) =>
        segs.length > 1 ? (
          <polyline
            key={ph}
            points={segs.map(m => `${toX(m.month)},${toY(m.stations)}`).join(' ')}
            fill="none" stroke={PHASE_HEX[+ph - 1]} strokeWidth="2.5" strokeLinejoin="round"
          />
        ) : null
      )}

      {/* Phase-end annotation dots + labels */}
      {phaseEndPts.map((p, i) => {
        const phIdx = monthly.find(m => m.month === p.m)?.phase ?? (i + 1)
        return (
          <g key={p.m}>
            <circle cx={toX(p.m)} cy={toY(p.s)} r="4" fill={PHASE_HEX[phIdx - 1]} />
            <text
              x={toX(p.m)} y={toY(p.s) - 8}
              textAnchor="middle" fill={PHASE_HEX[phIdx - 1]}
              fontWeight="700" style={{ fontSize: 9 }}
            >
              {p.s >= 1000 ? `${(p.s / 1000).toFixed(1)}K` : p.s.toLocaleString()}
            </text>
          </g>
        )
      })}

      {/* X axis */}
      {[12, 24, 36, 48, 60, 72, 84].map(m => (
        <g key={m}>
          <line x1={toX(m)} x2={toX(m)} y1={PADT + (SH - PADT - PADB)} y2={PADT + (SH - PADT - PADB) + 4} stroke="#cbd5e1" strokeWidth="1" />
          <text x={toX(m)} y={SH - 4} textAnchor="middle" fill="#94a3b8" style={{ fontSize: 9 }}>Yr {m / 12}</text>
        </g>
      ))}

      {/* Axes */}
      <line x1={PADL} x2={PADL} y1={PADT} y2={PADT + (SH - PADT - PADB)} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={PADL} x2={PADL + CW} y1={PADT + (SH - PADT - PADB)} y2={PADT + (SH - PADT - PADB)} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function RoadmapDashboard() {
  const [params, setParams]               = useState(DEFAULT_PARAMS)
  const [selectedPhase, setSelectedPhase] = useState(1)
  const [showParams, setShowParams]       = useState(false)

  // ── Computed model ─────────────────────────────────────────────────────────
  const { monthly, breakeven_month } = useMemo(() => computeModel(params), [params])
  const npv       = useMemo(() => Math.round(computeNPV(monthly)),          [monthly])
  const peakFund  = useMemo(() => computePeakFunding(monthly),              [monthly])
  const irr       = useMemo(() => computeIRR(monthly),                      [monthly])
  const phaseSums = useMemo(() => computePhaseSummary(monthly),             [monthly])

  const totalRevenue7yr = useMemo(() => monthly.reduce((s, m) => s + m.revenue, 0), [monthly])
  const totalOpex7yr    = useMemo(() => monthly.reduce((s, m) => s + m.opex, 0),    [monthly])
  const totalCapex7yr   = useMemo(() => monthly.reduce((s, m) => s + m.capex, 0),   [monthly])
  const net7yr          = totalRevenue7yr - totalOpex7yr - totalCapex7yr

  const riskNPV = useMemo(() => {
    const r15 = Math.pow(1.15, 1 / 12) - 1
    return Math.round(monthly.reduce((s, m, i) => s + m.cash_flow / Math.pow(1 + r15, i + 1), 0))
  }, [monthly])

  const y5AnnualRevenue = useMemo(() => {
    const y5 = monthly.filter(m => m.month >= 49 && m.month <= 60)
    return y5.length > 0 ? Math.round(y5.reduce((s, m) => s + m.revenue, 0) / y5.length * 12) : 0
  }, [monthly])

  // ── KPI colour logic ────────────────────────────────────────────────────────
  const beColor  = !breakeven_month ? 'text-red-500' : breakeven_month <= 36 ? 'text-eco-600' : breakeven_month <= 54 ? 'text-amber-600' : 'text-red-500'
  const npvColor = npv >= 0 ? 'text-eco-600' : 'text-red-500'
  const irrColor = irr >= 15 ? 'text-eco-600' : irr >= 8 ? 'text-amber-600' : 'text-red-500'
  const irrDisplay = (!irr || isNaN(irr) || irr < -100) ? 'N/A' : `${irr}%`

  // ── Selected phase data ─────────────────────────────────────────────────────
  const phaseObj   = PHASES.find(p => p.id === selectedPhase) ?? PHASES[0]
  const phSt       = PHASE_STYLES[phaseObj.color]
  const capexItems = CAPEX_ITEMS[selectedPhase]  ?? []
  const opexItems  = OPEX_MONTHLY[selectedPhase] ?? []
  const ra         = REVENUE_ASSUMPTIONS[selectedPhase] ?? REVENUE_ASSUMPTIONS[1]
  const ps         = phaseSums[selectedPhase] ?? { revenue: 0, opex: 0, capex: 0, cashFlow: 0, months: 0 }

  const capexBase = capexItems.reduce((s, i) => s + i.amount, 0)
  const capexEff  = capexBase * params.capex_multiplier
  const capexMax  = Math.max(...capexItems.map(i => i.amount), 1)

  const opexBase  = opexItems.reduce((s, i) => s + i.amount, 0)
  const opexEff   = opexBase * params.opex_multiplier
  const opexMax   = Math.max(...opexItems.map(i => i.amount), 1)

  // Per-phase deposit scaler (mirrors computeModel logic)
  const depsScaler  = selectedPhase === 1 ? 0.53 : selectedPhase === 2 ? 1.0 : selectedPhase === 3 ? 1.47 : 1.87
  const grossScaler = selectedPhase === 1 ? 0.84 : selectedPhase === 2 ? 1.0 : selectedPhase === 3 ? 1.16 : 1.47
  const effDeps     = params.deposits_per_station_day * depsScaler
  const effGross    = params.avg_deposit_gross_aud * grossScaler
  const maxSt       = phaseObj.stations_end
  const peakStRev   = Math.round(maxSt * effDeps * (params.platform_margin_pct / 100) * effGross * 30)
  const effMkt      = ra.marketplace_monthly * params.marketplace_multiplier

  // TAM bar
  const tamAUD    = MARKET_CONTEXT.ecobin_tam_aud
  const tamBarPct = Math.min((y5AnnualRevenue / tamAUD) * 100, 100)

  return (
    <div className="space-y-6">

      {/* ── Section 1: Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Platform Roadmap &amp; Financial Model</h1>
          <p className="text-sm text-slate-400 mt-1">
            7-year projection across 4 phases · adjustable parameters · NPV / IRR / breakeven analysis
          </p>
        </div>
        <button
          onClick={() => setShowParams(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shrink-0"
        >
          <SlidersHorizontal size={14} />
          Adjust Parameters
          {showParams ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* ── Section 2: KPI Strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Breakeven"
          value={fmtMonth(breakeven_month)}
          sub={breakeven_month ? `Month ${breakeven_month} of 84` : 'Outside 7-year window'}
          valueColor={beColor}
          icon={Target}
          iconBg={breakeven_month && breakeven_month <= 36 ? 'bg-eco-50' : 'bg-red-50'}
          iconColor={breakeven_month && breakeven_month <= 36 ? 'text-eco-500' : 'text-red-400'}
        />
        <KpiCard
          title={`NPV @ ${params.discount_rate_annual_pct}%`}
          value={fmtAUD(npv, true)}
          sub={npv >= 0 ? 'Positive value creation' : 'Negative at this discount rate'}
          valueColor={npvColor}
          icon={npv >= 0 ? TrendingUp : TrendingDown}
          iconBg={npv >= 0 ? 'bg-eco-50' : 'bg-red-50'}
          iconColor={npv >= 0 ? 'text-eco-500' : 'text-red-400'}
        />
        <KpiCard
          title="Projected IRR"
          value={irrDisplay}
          sub={irr >= 15 ? 'Strong return' : irr >= 8 ? 'Acceptable return' : 'Below threshold'}
          valueColor={irrColor}
          icon={BarChart2}
          iconBg={irr >= 15 ? 'bg-eco-50' : irr >= 8 ? 'bg-amber-50' : 'bg-red-50'}
          iconColor={irr >= 15 ? 'text-eco-500' : irr >= 8 ? 'text-amber-500' : 'text-red-400'}
        />
        <KpiCard
          title="Peak Funding Required"
          value={fmtAUD(peakFund, true)}
          sub="Maximum cumulative deficit"
          valueColor="text-slate-800"
          icon={DollarSign}
          iconBg="bg-slate-100"
          iconColor="text-slate-500"
        />
        <KpiCard
          title="7-Year Revenue"
          value={fmtAUD(totalRevenue7yr, true)}
          sub="Cumulative platform revenue"
          valueColor="text-violet-700"
          icon={Layers}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
        />
      </div>

      {/* ── Section 3: Phase Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PHASES.map((ph, i) => {
          const stl      = PHASE_STYLES[ph.color]
          const isActive = selectedPhase === ph.id
          const phCapex  = (CAPEX_ITEMS[ph.id] ?? []).reduce((s, x) => s + x.amount, 0)
          const phRev    = phaseSums[ph.id]?.revenue ?? 0
          return (
            <div
              key={ph.id}
              onClick={() => setSelectedPhase(ph.id)}
              className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md
                ${stl.border} ${isActive ? `ring-2 ${stl.ring}` : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${stl.badge}`}>
                    {ph.id}
                  </span>
                  <span className="text-sm font-black text-slate-800">{ph.name}</span>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${ph.status === 'current' ? 'bg-eco-100 text-eco-700' : 'bg-slate-100 text-slate-500'}`}>
                  {ph.status === 'current' ? 'Current' : 'Planned'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Duration</p>
                  <p className="text-sm font-bold text-slate-800">{ph.duration_months}mo</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Revenue</p>
                  <p className={`text-sm font-black ${stl.accent}`}>{fmtAUD(phRev, true)}</p>
                </div>
              </div>

              <div className="space-y-1 mb-3">
                {ph.features.slice(0, 3).map((f, fi) => (
                  <div key={fi} className="flex items-start gap-1.5">
                    <CheckCircle size={10} className={`${stl.accent} mt-0.5 shrink-0`} />
                    <span className="text-[10px] text-slate-600 leading-tight">{f}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">CAPEX</p>
                  <p className="text-xs font-bold text-slate-700">
                    {fmtAUD(Math.round(phCapex * params.capex_multiplier), true)}
                    {params.capex_multiplier !== 1 && (
                      <span className="text-[9px] text-slate-400 ml-1">×{params.capex_multiplier}</span>
                    )}
                  </p>
                </div>
                {isActive && (
                  <div className={`flex items-center gap-1 text-[10px] font-bold ${stl.accent}`}>
                    <ChevronDown size={12} />
                    Details
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Section 4: Parameters Panel ─────────────────────────────────────── */}
      {showParams && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={15} className="text-violet-600" />
              <h2 className="text-sm font-black text-slate-800">Model Parameters</h2>
              <span className="text-[10px] text-slate-400 hidden sm:inline">— all KPIs update instantly</span>
            </div>
            <button
              onClick={() => setParams(DEFAULT_PARAMS)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={11} />
              Reset to Defaults
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SLIDERS.map(sl => (
              <div key={sl.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">{sl.label}</label>
                  <span className="text-lg font-black text-slate-900">{sl.fmt(params[sl.key])}</span>
                </div>
                <input
                  type="range"
                  min={sl.min} max={sl.max} step={sl.step}
                  value={params[sl.key]}
                  onChange={e => setParams(p => ({ ...p, [sl.key]: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-0.5">
                  <span>{sl.fmt(sl.min)}</span>
                  <span>{sl.fmt(sl.max)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 5: Cumulative Cash Flow Chart ───────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 min-w-[560px]">
          <div>
            <h2 className="text-sm font-black text-slate-800">Cumulative Cash Flow — 84 Months</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Breakeven:{' '}
              <span className={`font-black ${beColor}`}>{fmtMonth(breakeven_month)}</span>
              {breakeven_month && <span className="text-slate-400"> (month {breakeven_month})</span>}
              {' '}· purple = cumulative net position
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] shrink-0">
            {PHASES.map((ph, i) => (
              <span key={ph.id} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PHASE_HEX[i] }} />
                <span className="text-slate-500">{ph.name}</span>
              </span>
            ))}
          </div>
        </div>
        <CashFlowChart monthly={monthly} breakeven_month={breakeven_month} />
      </div>

      {/* ── Section 6: Phase Detail Panel ───────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-5 rounded-full" style={{ backgroundColor: PHASE_HEX[selectedPhase - 1] }} />
          <h2 className="text-sm font-black text-slate-800">{phaseObj.label} — Detail View</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* CAPEX Breakdown */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">CAPEX — Phase {selectedPhase}</h3>
              <span className="text-sm font-black text-slate-900">{fmtAUD(capexEff, true)}</span>
            </div>
            <div className="space-y-3">
              {capexItems.map((item, i) => (
                <HorizBar
                  key={i}
                  label={item.item}
                  amount={Math.round(item.amount * params.capex_multiplier)}
                  max={Math.round(capexMax * params.capex_multiplier)}
                  category={item.category}
                  catColor={CAPEX_CAT_COLOR[item.category] ?? 'bg-slate-400'}
                />
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700">Total CAPEX</span>
                <span className="text-base font-black text-slate-900">{fmtAUD(capexEff)}</span>
              </div>
              {params.capex_multiplier !== 1 && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Base {fmtAUD(capexBase, true)} × {params.capex_multiplier} multiplier
                </p>
              )}
            </div>
          </div>

          {/* Monthly OPEX */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly OPEX — Phase {selectedPhase}</h3>
              <span className="text-sm font-black text-slate-900">{fmtAUD(opexEff, true)}/mo</span>
            </div>
            <div className="space-y-3">
              {opexItems.map((item, i) => (
                <HorizBar
                  key={i}
                  label={item.item}
                  amount={Math.round(item.amount * params.opex_multiplier)}
                  max={Math.round(opexMax * params.opex_multiplier)}
                  category={item.category}
                  catColor={OPEX_CAT_COLOR[item.category] ?? 'bg-slate-300'}
                />
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700">Monthly Total</span>
                <span className="text-base font-black text-slate-900">{fmtAUD(opexEff)}</span>
              </div>
              {params.opex_multiplier !== 1 && (
                <p className="text-[10px] text-slate-400">
                  Base {fmtAUD(opexBase, true)}/mo × {params.opex_multiplier}
                </p>
              )}
              <p className="text-[10px] text-slate-400">
                Phase total: {fmtAUD(Math.round(opexEff * phaseObj.duration_months), true)}
              </p>
            </div>
          </div>

          {/* Revenue Model + Phase P&L */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
              Revenue Drivers — Phase {selectedPhase}
            </h3>
            <div className="space-y-2.5 mb-4">
              {[
                { label: 'Deposits / station / day', value: effDeps.toFixed(1), note: 'adjusted' },
                { label: 'Avg deposit gross value',  value: `$${effGross.toFixed(2)}` },
                { label: 'Platform margin',           value: `${params.platform_margin_pct}%`, note: 'adjustable' },
                { label: 'Marketplace / month',       value: fmtAUD(effMkt, true),
                  note: params.marketplace_multiplier !== 1 ? `×${params.marketplace_multiplier}` : undefined },
                ra.api_monthly    > 0 ? { label: 'API licensing / month',    value: fmtAUD(ra.api_monthly, true) }    : null,
                ra.carbon_monthly > 0 ? { label: 'Carbon credits / month',   value: fmtAUD(ra.carbon_monthly, true) } : null,
              ].filter(Boolean).map((row, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-[11px] text-slate-500">{row.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-slate-800">{row.value}</span>
                    {row.note && <span className="text-[9px] bg-slate-100 text-slate-400 px-1 py-0.5 rounded">{row.note}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Peak station revenue banner */}
            <div className="bg-eco-50 border border-eco-100 rounded-xl p-3 mb-3">
              <p className="text-[9px] font-bold text-eco-700 uppercase tracking-wider mb-1">Peak Station Revenue</p>
              <p className="text-xs text-eco-800">
                At {maxSt.toLocaleString()} stations:{' '}
                <span className="font-black text-lg text-eco-700">{fmtAUD(peakStRev, true)}</span>/mo
              </p>
            </div>

            {/* Phase P&L */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Phase P&amp;L</p>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Phase revenue</span>
                <span className="font-bold text-eco-700">{fmtAUD(ps.revenue, true)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total OPEX</span>
                <span className="font-bold text-slate-600">{fmtAUD(ps.opex, true)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total CAPEX</span>
                <span className="font-bold text-slate-600">{fmtAUD(ps.capex, true)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="text-xs font-black text-slate-700">Net Phase Result</span>
                <span className={`text-sm font-black ${ps.cashFlow >= 0 ? 'text-eco-600' : 'text-red-500'}`}>
                  {ps.cashFlow >= 0 ? '+' : ''}{fmtAUD(ps.cashFlow, true)}
                </span>
              </div>
              <p className="text-[9px] text-slate-400">
                {ps.months ?? phaseObj.duration_months} months in phase
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 7: Station Growth Chart ─────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 min-w-[560px]">
          <div>
            <h2 className="text-sm font-black text-slate-800">Station Rollout</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {(monthly[83]?.stations ?? 1200).toLocaleString()} stations at end of Phase 4
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] shrink-0">
            {PHASES.map((ph, i) => (
              <span key={ph.id} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PHASE_HEX[i] }} />
                <span className="text-slate-500">P{ph.id}: {ph.stations_end.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>
        <StationChart monthly={monthly} />
      </div>

      {/* ── Section 8: Market Context + Financial Returns ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Market Opportunity */}
        <div className="bg-slate-950 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Globe size={15} className="text-eco-400" />
            <h3 className="text-sm font-black text-white">Total Addressable Market</h3>
          </div>
          <div className="space-y-3 mb-5">
            {[
              { label: 'AUS e-waste generated / year',   value: `${(MARKET_CONTEXT.aus_ewaste_tonnes_yr / 1000).toFixed(0)}K tonnes`,         color: 'text-eco-400' },
              { label: 'Global e-waste market',           value: `$${MARKET_CONTEXT.global_ewaste_usd_bn}B USD`,                              color: 'text-violet-400' },
              { label: 'Current AUS recycling rate',      value: `${MARKET_CONTEXT.aus_recycling_rate_pct}%`,                                 color: 'text-amber-400', note: 'gap = opportunity' },
              { label: 'EcoBin serviceable TAM',          value: fmtAUD(MARKET_CONTEXT.ecobin_tam_aud, true),                                  color: 'text-eco-300' },
              { label: 'Year 5 penetration target',       value: `${MARKET_CONTEXT.serviceable_yr5_pct}%`,                                    color: 'text-slate-300' },
              { label: 'Projected Y5 annualised revenue', value: fmtAUD(y5AnnualRevenue, true),                                               color: 'text-eco-400' },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
                <span className="text-xs text-slate-400">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
                  {row.note && (
                    <span className="text-[9px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded font-semibold">{row.note}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* TAM bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">EcoBin Y5 vs TAM</span>
              <span className="text-[10px] text-eco-400 font-bold">{tamBarPct.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-eco-500 to-eco-400 transition-all duration-500"
                style={{ width: `${tamBarPct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {fmtAUD(y5AnnualRevenue, true)} of {fmtAUD(tamAUD, true)} serviceable market
            </p>
          </div>
        </div>

        {/* Financial Returns Summary */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={15} className="text-violet-600" />
            <h3 className="text-sm font-black text-slate-800">Financial Returns Summary</h3>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">NPV</p>
              <p className={`text-xl font-black leading-none ${npvColor}`}>{fmtAUD(npv, true)}</p>
              <p className="text-[9px] text-slate-400 mt-1">@ {params.discount_rate_annual_pct}%</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">IRR</p>
              <p className={`text-xl font-black leading-none ${irrColor}`}>{irrDisplay}</p>
              <p className="text-[9px] text-slate-400 mt-1">annualised</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payback</p>
              <p className={`text-lg font-black leading-none ${beColor}`}>{fmtMonth(breakeven_month)}</p>
              <p className="text-[9px] text-slate-400 mt-1">{breakeven_month ? `${breakeven_month}mo` : 'N/A'}</p>
            </div>
          </div>

          <div className="space-y-2.5 mb-4">
            {[
              { label: 'Risk-adj. NPV (15% hurdle)',             value: fmtAUD(riskNPV, true),                    color: riskNPV >= 0 ? 'text-eco-600' : 'text-red-500' },
              { label: '7-year gross revenue',                   value: fmtAUD(totalRevenue7yr, true),             color: 'text-eco-700' },
              { label: '7-year total investment (CAPEX + OPEX)', value: fmtAUD(totalOpex7yr + totalCapex7yr, true),color: 'text-slate-700' },
              { label: 'Net 7-year position',                    value: (net7yr >= 0 ? '+' : '') + fmtAUD(net7yr, true), color: net7yr >= 0 ? 'text-eco-600' : 'text-red-500' },
            ].map((row, i) => (
              <div key={i} className={`flex justify-between items-baseline py-2 ${i < 3 ? 'border-b border-slate-50' : ''}`}>
                <span className="text-xs text-slate-500">{row.label}</span>
                <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-violet-600 leading-relaxed">
              Base assumptions: <strong>{params.platform_margin_pct}%</strong> platform margin ·{' '}
              <strong>{params.deposits_per_station_day}</strong> deposits/station/day ·{' '}
              <strong>${params.avg_deposit_gross_aud}</strong> avg deposit value
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 9: Phase Timeline ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-black text-slate-800 mb-4">Platform Timeline — 7 Years</h2>

        {/* Timeline bar */}
        <div className="flex w-full gap-0.5 rounded-xl overflow-hidden h-11">
          {PHASES.map((ph, i) => {
            const wPct = (ph.duration_months / 84) * 100
            return (
              <button
                key={ph.id}
                onClick={() => setSelectedPhase(ph.id)}
                className={`flex items-center justify-center text-white text-[10px] font-bold overflow-hidden transition-all hover:opacity-90 ${selectedPhase === ph.id ? 'ring-2 ring-white ring-inset' : ''}`}
                style={{ width: `${wPct}%`, backgroundColor: PHASE_HEX[i] }}
              >
                <span className="truncate px-1">{ph.name}</span>
              </button>
            )
          })}
        </div>

        {/* Year labels */}
        <div className="flex w-full mt-1">
          {PHASES.map((ph, i) => {
            const wPct   = (ph.duration_months / 84) * 100
            const startY = Math.ceil(ph.start_month / 12)
            const endY   = Math.ceil((ph.start_month + ph.duration_months - 1) / 12)
            return (
              <div key={ph.id} className="overflow-hidden px-0.5" style={{ width: `${wPct}%` }}>
                <p className="text-[9px] text-slate-400 truncate">Yr {startY}{endY > startY ? `–${endY}` : ''}</p>
              </div>
            )
          })}
        </div>

        {/* Phase detail row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {PHASES.map((ph, i) => {
            const stl    = PHASE_STYLES[ph.color]
            const isAct  = selectedPhase === ph.id
            return (
              <div
                key={ph.id}
                onClick={() => setSelectedPhase(ph.id)}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${stl.border} ${stl.bg} ${isAct ? `ring-2 ${stl.ring}` : ''}`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PHASE_HEX[i] }} />
                  <span className={`text-[9px] font-black uppercase tracking-wider ${stl.accent}`}>{ph.label}</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-snug">{ph.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <ArrowRight size={10} className="text-slate-400" />
                  <span className="text-[9px] text-slate-500">{ph.stations_end.toLocaleString()} stations</span>
                </div>
                {/* Milestone labels for this phase */}
                <div className="mt-2 space-y-0.5">
                  {MILESTONES.filter(m => m.phase === ph.id).slice(0, 2).map((ms, mi) => (
                    <p key={mi} className="text-[9px] text-slate-400 truncate">· {ms.label}</p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Milestones Strip ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={14} className="text-slate-400" />
          <h2 className="text-sm font-black text-slate-800">Key Milestones</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MILESTONES.map((ms, i) => {
            const ph  = PHASES.find(p => p.id === ms.phase)
            const stl = ph ? PHASE_STYLES[ph.color] : PHASE_STYLES.eco
            return (
              <div key={i} className={`rounded-xl border p-3 ${stl.border}`}>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${stl.badge}`}>
                  {fmtMonth(ms.month)}
                </span>
                <p className="text-[11px] font-bold text-slate-700 mt-1.5 leading-snug">{ms.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{ph?.name}</p>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
