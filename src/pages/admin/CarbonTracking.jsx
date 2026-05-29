import React, { useMemo } from 'react'
import { Leaf, Wind, Car, Plane, Award, TrendingUp } from 'lucide-react'
import { carbonEngine, CO2_FACTORS } from '../../lib/carbonEngine'

// ── Synthetic monthly breakdown (current month) ───────────────────────────────

const THIS_MONTH_KG = {
  aluminium:     4620, pet_plastic: 3380, hdpe:          2710,
  glass:         6240, steel:       3920, paperboard:    6750,
  mixed_plastic: 3040,
}

const MATERIAL_LABELS = {
  aluminium:     'Aluminium',
  pet_plastic:   'PET Plastic',
  hdpe:          'HDPE',
  glass:         'Glass',
  steel:         'Steel',
  paperboard:    'Paperboard',
  mixed_plastic: 'Mixed Plastic',
}

const MATERIAL_COLORS = {
  aluminium:     '#6366f1',
  pet_plastic:   '#0ea5e9',
  hdpe:          '#14b8a6',
  glass:         '#84cc16',
  steel:         '#f59e0b',
  paperboard:    '#f97316',
  mixed_plastic: '#ec4899',
}

// ── Sparkline path helper ────────────────────────────────────────────────────

function toSparkPath(values, w = 300, h = 60) {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 8)
    return `${x},${y}`
  })
  return 'M ' + pts.join(' L ')
}

export default function CarbonTracking() {
  const totalCO2Kg  = carbonEngine.getTotalCO2Saved(THIS_MONTH_KG)
  const totalCO2T   = (totalCO2Kg / 1000).toFixed(2)
  const equivalents = carbonEngine.getEquivalents(totalCO2Kg)
  const monthly     = useMemo(() => carbonEngine.getMonthlySummary(), [])
  const contributors = carbonEngine.getTopContributors()

  // Per-material CO₂ savings
  const perMaterial = Object.entries(THIS_MONTH_KG).map(([mat, kg]) => ({
    material: mat,
    label:    MATERIAL_LABELS[mat],
    weightKg: kg,
    co2Kg:    carbonEngine.computeCO2Saved(mat, kg),
    color:    MATERIAL_COLORS[mat],
    factor:   CO2_FACTORS[mat],
  })).sort((a, b) => b.co2Kg - a.co2Kg)

  const maxCO2 = Math.max(...perMaterial.map(m => m.co2Kg))

  const monthlyValues = monthly.map(m => m.totalKgCO2)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Carbon Tracking</h1>
        <p className="text-sm text-slate-500 mt-0.5">Platform-wide CO₂ savings from recycling — May 2026</p>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-eco-600 to-eco-700 text-white rounded-2xl shadow-sm p-5 col-span-2 lg:col-span-1">
          <Leaf className="w-6 h-6 mb-3 opacity-80" />
          <div className="text-3xl font-bold">{totalCO2T}t</div>
          <div className="text-sm font-semibold mt-0.5 opacity-90">CO₂ Saved This Month</div>
          <div className="text-xs opacity-70 mt-1">{totalCO2Kg.toLocaleString()} kg total</div>
        </div>

        {[
          {
            icon: Leaf, label: 'Trees Equivalent',
            value: equivalents.trees.toLocaleString(),
            sub: 'trees absorbing CO₂ for 1 year',
            bg: 'bg-emerald-50', icon_bg: 'bg-emerald-100', icon_c: 'text-emerald-700',
          },
          {
            icon: Car, label: 'km Not Driven',
            value: equivalents.kmNotDriven.toLocaleString(),
            sub: 'equivalent car travel avoided',
            bg: 'bg-blue-50', icon_bg: 'bg-blue-100', icon_c: 'text-blue-700',
          },
          {
            icon: Plane, label: 'Flights Avoided',
            value: equivalents.flightsAvoided.toFixed(1),
            sub: 'Syd↔Mel flights equivalent',
            bg: 'bg-violet-50', icon_bg: 'bg-violet-100', icon_c: 'text-violet-700',
          },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border border-slate-100 shadow-sm p-5 ${c.bg}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.icon_bg}`}>
              <c.icon className={`w-4 h-4 ${c.icon_c}`} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{c.value}</div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5">{c.label}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Per-material bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-5">CO₂ Saved by Material</h2>
          <div className="space-y-3">
            {perMaterial.map(m => (
              <div key={m.material} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{m.label}</span>
                  <span className="text-slate-500">
                    {m.co2Kg.toLocaleString()} kg CO₂
                    <span className="text-slate-400 ml-1">
                      ({m.weightKg.toLocaleString()} kg recycled × {m.factor})
                    </span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{
                      width: `${(m.co2Kg / maxCO2) * 100}%`,
                      backgroundColor: m.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Monthly Trend</h2>
            <TrendingUp className="w-4 h-4 text-eco-600" />
          </div>
          <svg viewBox="0 0 300 80" className="w-full" style={{ height: 80 }}>
            <defs>
              <linearGradient id="co2grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Area fill */}
            <path
              d={`${toSparkPath(monthlyValues, 300, 70)} L 300,80 L 0,80 Z`}
              fill="url(#co2grad)"
            />
            {/* Line */}
            <path
              d={toSparkPath(monthlyValues, 300, 70)}
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dots */}
            {monthlyValues.map((v, i) => {
              const min = Math.min(...monthlyValues)
              const max = Math.max(...monthlyValues)
              const range = max - min || 1
              const x = (i / (monthlyValues.length - 1)) * 300
              const y = 70 - ((v - min) / range) * 62
              return (
                <circle key={i} cx={x} cy={y} r="3.5" fill="#16a34a" />
              )
            })}
          </svg>
          <div className="flex justify-between text-[10px] text-slate-400 mt-2">
            {monthly.map(m => <span key={m.month}>{m.month}</span>)}
          </div>
          <div className="mt-3 space-y-1">
            {monthly.map((m, i) => (
              <div key={m.month} className="flex justify-between text-xs">
                <span className="text-slate-500">{m.month}</span>
                <span className={`font-semibold ${i === monthly.length - 1 ? 'text-eco-700' : 'text-slate-700'}`}>
                  {(m.totalKgCO2 / 1000).toFixed(2)}t
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top contributors */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
          <Award className="w-4 h-4 text-eco-600" />
          <h2 className="font-semibold text-slate-900">Top Contributors — CO₂ Saved This Month</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Rank', 'Contributor', 'Type', 'CO₂ Saved (kg)', 'Equivalent Trees'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {contributors.map(c => {
                const eq = carbonEngine.getEquivalents(c.totalKgCO2)
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        c.rank === 1 ? 'bg-yellow-100 text-yellow-700'
                        : c.rank === 2 ? 'bg-slate-200 text-slate-600'
                        : c.rank === 3 ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                      }`}>
                        {c.rank}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{c.id}</div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        c.type === 'station' ? 'bg-indigo-100 text-indigo-700' : 'bg-eco-100 text-eco-700'
                      }`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-bold text-eco-700">{c.totalKgCO2.toLocaleString()}</td>
                    <td className="px-6 py-3 text-slate-600">{eq.trees.toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CO₂ factor reference */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Emission Factors Used</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(CO2_FACTORS).map(([mat, factor]) => (
            <div key={mat} className="text-center">
              <div
                className="w-8 h-8 rounded-lg mx-auto mb-1"
                style={{ backgroundColor: MATERIAL_COLORS[mat] + '33', border: `2px solid ${MATERIAL_COLORS[mat]}` }}
              />
              <div className="text-[11px] font-semibold text-slate-700">{MATERIAL_LABELS[mat]}</div>
              <div className="text-[10px] text-slate-400">{factor} kg CO₂/kg</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
