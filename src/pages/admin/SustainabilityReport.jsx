import React, { useMemo } from 'react'
import { Leaf, Printer, TrendingUp, TrendingDown, Users, Zap, Award } from 'lucide-react'
import { carbonEngine } from '../../lib/carbonEngine'

// ── Synthetic KPIs ────────────────────────────────────────────────────────────

const THIS_MONTH = {
  materialsKg:  30660,
  co2SavedT:    68.4,
  ecoPoints:    2_840_000,
  activeUsers:  14_820,
}
const LAST_MONTH = {
  materialsKg:  28_400,
  co2SavedT:    63.2,
  ecoPoints:    2_510_000,
  activeUsers:  13_970,
}

const SDG_BADGES = [
  {
    number: 11, label: 'Sustainable Cities',
    desc: 'Reducing urban landfill through distributed collection network.',
    color: 'bg-amber-500',
  },
  {
    number: 12, label: 'Responsible Consumption',
    desc: 'Closing the loop on recyclable materials across 7 commodity streams.',
    color: 'bg-amber-600',
  },
  {
    number: 13, label: 'Climate Action',
    desc: `${THIS_MONTH.co2SavedT} tonnes CO₂ avoided per month through material recovery.`,
    color: 'bg-green-600',
  },
  {
    number: 17, label: 'Partnerships for the Goals',
    desc: 'Cross-sector partnership: consumers, operators, merchants, and scrap dealers.',
    color: 'bg-blue-700',
  },
]

const DIVERSION_PCT = {
  aluminium:     94,
  pet_plastic:   87,
  hdpe:          82,
  glass:         78,
  steel:         91,
  paperboard:    85,
  mixed_plastic: 69,
}

const MATERIAL_LABELS = {
  aluminium: 'Aluminium', pet_plastic: 'PET Plastic', hdpe: 'HDPE',
  glass: 'Glass', steel: 'Steel', paperboard: 'Paperboard', mixed_plastic: 'Mixed Plastic',
}

const SEGMENT_COLORS = [
  '#6366f1','#0ea5e9','#14b8a6','#84cc16','#f59e0b','#f97316','#ec4899',
]

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ data }) {
  const cx = 80, cy = 80, r = 58, stroke = 24
  const circumference = 2 * Math.PI * r
  let offset = 0

  const slices = data.map((d, i) => {
    const dashLen = (d.pct / 100) * circumference
    const el = (
      <circle
        key={i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={d.color}
        strokeWidth={stroke}
        strokeDasharray={`${dashLen} ${circumference - dashLen}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
      />
    )
    offset += dashLen
    return el
  })

  return (
    <svg viewBox="0 0 160 160" className="w-full max-w-[160px] mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {slices}
      <text x={cx} y={cy - 6} textAnchor="middle" className="text-xs" fill="#334155" fontSize="12" fontWeight="700">
        Avg
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#22c55e" fontSize="16" fontWeight="800">
        {Math.round(data.reduce((s, d) => s + d.pct, 0) / data.length)}%
      </text>
    </svg>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SustainabilityReport() {
  const monthly = useMemo(() => carbonEngine.getMonthlySummary(), [])

  function pctChange(now, then) {
    if (!then) return 0
    return Math.round(((now - then) / then) * 100 * 10) / 10
  }

  const kpis = [
    {
      label: 'Total Materials Recycled',
      value: `${(THIS_MONTH.materialsKg / 1000).toFixed(1)}t`,
      change: pctChange(THIS_MONTH.materialsKg, LAST_MONTH.materialsKg),
      icon: Leaf, iconBg: 'bg-eco-100', iconColor: 'text-eco-700',
    },
    {
      label: 'CO₂ Saved',
      value: `${THIS_MONTH.co2SavedT}t`,
      change: pctChange(THIS_MONTH.co2SavedT, LAST_MONTH.co2SavedT),
      icon: TrendingUp, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700',
    },
    {
      label: 'Eco-Points Awarded',
      value: (THIS_MONTH.ecoPoints / 1e6).toFixed(2) + 'M',
      change: pctChange(THIS_MONTH.ecoPoints, LAST_MONTH.ecoPoints),
      icon: Zap, iconBg: 'bg-amber-100', iconColor: 'text-amber-700',
    },
    {
      label: 'Active Users',
      value: THIS_MONTH.activeUsers.toLocaleString(),
      change: pctChange(THIS_MONTH.activeUsers, LAST_MONTH.activeUsers),
      icon: Users, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700',
    },
  ]

  const donutData = Object.entries(DIVERSION_PCT).map(([mat, pct], i) => ({
    label: MATERIAL_LABELS[mat], pct, color: SEGMENT_COLORS[i],
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sustainability Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform impact summary — May 2026</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-lg text-sm hover:border-slate-300 transition-colors"
        >
          <Printer className="w-4 h-4" /> Print / Download PDF
        </button>
      </div>

      {/* KPI cards with MoM change */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => {
          const up = k.change >= 0
          return (
            <div key={k.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${k.iconBg}`}>
                <k.icon className={`w-4 h-4 ${k.iconColor}`} />
              </div>
              <div className="text-2xl font-bold text-slate-900">{k.value}</div>
              <div className="text-xs font-semibold text-slate-600 mt-0.5">{k.label}</div>
              <div className={`flex items-center gap-1 text-[11px] font-semibold mt-1 ${up ? 'text-eco-600' : 'text-red-500'}`}>
                {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {up ? '+' : ''}{k.change}% vs last month
              </div>
            </div>
          )
        })}
      </div>

      {/* Diversion chart + SDG badges */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Diversion rate donut */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Material Diversion Rate</h2>
          <div className="flex gap-6 items-center">
            <div className="w-40 flex-shrink-0">
              <DonutChart data={donutData} />
            </div>
            <div className="flex-1 space-y-2">
              {donutData.map(d => (
                <div key={d.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600">{d.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-slate-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${d.pct}%`, backgroundColor: d.color }}
                      />
                    </div>
                    <span className="font-bold text-slate-700 w-9 text-right">{d.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SDG badges */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">UN SDG Alignment</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SDG_BADGES.map(sdg => (
              <div key={sdg.number} className="border border-slate-100 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-xs font-bold flex-shrink-0 ${sdg.color}`}>
                    {sdg.number}
                  </span>
                  <span className="text-xs font-bold text-slate-800">{sdg.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{sdg.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly CO₂ trend table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">6-Month CO₂ Savings Trend</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Month', 'Total CO₂ Saved', 'Trees Equiv.', 'km Not Driven', 'Flights Avoided', 'MoM Δ'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthly.map((m, i) => {
                const prev = monthly[i - 1]
                const delta = prev
                  ? Math.round(((m.totalKgCO2 - prev.totalKgCO2) / prev.totalKgCO2) * 1000) / 10
                  : null
                return (
                  <tr key={m.month} className={`hover:bg-slate-50/50 ${i === monthly.length - 1 ? 'bg-eco-50/30' : ''}`}>
                    <td className="px-6 py-3 font-semibold text-slate-900">{m.month}</td>
                    <td className="px-6 py-3 font-bold text-eco-700">{(m.totalKgCO2 / 1000).toFixed(2)}t</td>
                    <td className="px-6 py-3 text-slate-600">{m.equivalents.trees.toLocaleString()}</td>
                    <td className="px-6 py-3 text-slate-600">{m.equivalents.kmNotDriven.toLocaleString()}</td>
                    <td className="px-6 py-3 text-slate-600">{m.equivalents.flightsAvoided.toFixed(1)}</td>
                    <td className="px-6 py-3">
                      {delta !== null && (
                        <span className={`text-xs font-bold ${delta >= 0 ? 'text-eco-600' : 'text-red-500'}`}>
                          {delta >= 0 ? '+' : ''}{delta}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
