import React, { useState, useRef, useEffect } from 'react'
import {
  DollarSign, Leaf, Package, TrendingUp, TrendingDown,
  Award, Download, Tree, Wind, Droplets, ChevronRight,
  Minus, Star
} from 'lucide-react'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MONTHLY_DATA = [
  { month: 'Jun', label: 'Jun 24', val: 16.80, pts: 168 },
  { month: 'Jul', label: 'Jul 24', val: 21.40, pts: 214 },
  { month: 'Aug', label: 'Aug 24', val: 18.90, pts: 189 },
  { month: 'Sep', label: 'Sep 24', val: 24.60, pts: 246 },
  { month: 'Oct', label: 'Oct 24', val: 19.20, pts: 192 },
  { month: 'Nov', label: 'Nov 24', val: 17.50, pts: 175 },
  { month: 'Dec', label: 'Dec 24', val: 14.20, pts: 142 },
  { month: 'Jan', label: 'Jan 25', val: 18.60, pts: 186 },
  { month: 'Feb', label: 'Feb 25', val: 12.80, pts: 128 },
  { month: 'Mar', label: 'Mar 25', val: 22.40, pts: 224 },
  { month: 'Apr', label: 'Apr 25', val: 19.70, pts: 197 },
  { month: 'May', label: 'May 25', val: 14.20, pts: 142, current: true },
]

const MATERIALS_ALL = [
  { name: 'Aluminium',   kg: 48.2,  value: 89.17, pct: 71, prevPct: 68, color: 'bg-amber-400',  dot: 'bg-amber-400' },
  { name: 'PET Plastic', kg: 72.4,  value: 17.38, pct: 14, prevPct: 16, color: 'bg-blue-400',   dot: 'bg-blue-400' },
  { name: 'Paperboard',  kg: 38.1,  value: 5.36,  pct:  4, prevPct:  4, color: 'bg-slate-400',  dot: 'bg-slate-400' },
  { name: 'Glass',       kg: 11.7,  value: 0.21,  pct:  1, prevPct:  2, color: 'bg-teal-400',   dot: 'bg-teal-400' },
  { name: 'Steel',       kg: 5.3,   value: 0.64,  pct:  1, prevPct:  1, color: 'bg-orange-400', dot: 'bg-orange-400' },
  { name: 'HDPE Plastic',kg: 18.9,  value: 3.40,  pct:  3, prevPct:  2, color: 'bg-purple-400', dot: 'bg-purple-400' },
  { name: 'Cardboard',   kg: 22.6,  value: 3.17,  pct:  3, prevPct:  4, color: 'bg-yellow-400', dot: 'bg-yellow-400' },
]

const MATERIALS_MONTH = [
  { name: 'Aluminium',   kg: 8.2,   value: 15.17, pct: 73, prevPct: 68, color: 'bg-amber-400',  dot: 'bg-amber-400' },
  { name: 'PET Plastic', kg: 12.4,  value: 2.98,  pct: 14, prevPct: 16, color: 'bg-blue-400',   dot: 'bg-blue-400' },
  { name: 'Paperboard',  kg: 6.1,   value: 0.86,  pct:  4, prevPct:  4, color: 'bg-slate-400',  dot: 'bg-slate-400' },
  { name: 'Glass',       kg: 1.7,   value: 0.03,  pct:  1, prevPct:  2, color: 'bg-teal-400',   dot: 'bg-teal-400' },
  { name: 'Steel',       kg: 0.8,   value: 0.10,  pct:  1, prevPct:  1, color: 'bg-orange-400', dot: 'bg-orange-400' },
  { name: 'HDPE Plastic',kg: 3.1,   value: 0.56,  pct:  3, prevPct:  2, color: 'bg-purple-400', dot: 'bg-purple-400' },
  { name: 'Cardboard',   kg: 4.2,   value: 0.59,  pct:  3, prevPct:  4, color: 'bg-yellow-400', dot: 'bg-yellow-400' },
]

const PERIOD_DATA = {
  'This Month': {
    periodEarnings: 14.20, co2Kg: 6.8, weightKg: 36.5, months: MONTHLY_DATA.slice(-1),
    materials: MATERIALS_MONTH,
  },
  'Last 6 Months': {
    periodEarnings: 107.90, co2Kg: 51.4, weightKg: 198.2, months: MONTHLY_DATA.slice(-6),
    materials: MATERIALS_ALL.map(m => ({ ...m, kg: m.kg * 0.5, value: m.value * 0.5 })),
  },
  'This Year': {
    periodEarnings: 181.70, co2Kg: 86.7, weightKg: 316.8, months: MONTHLY_DATA.slice(-7),
    materials: MATERIALS_ALL.map(m => ({ ...m, kg: m.kg * 0.75, value: m.value * 0.75 })),
  },
  'All Time': {
    periodEarnings: 284.00, co2Kg: 135.5, weightKg: 493.4, months: MONTHLY_DATA,
    materials: MATERIALS_ALL,
  },
}

const LIFETIME = 284.00
const BEST_MONTH = 24.60
const TOTAL_CO2 = 135.5
const TOTAL_WEIGHT = 493.4

// ─── Polyline Chart ───────────────────────────────────────────────────────────

function EarningsChart({ data }) {
  const [hovered, setHovered] = useState(null)
  const W = 560
  const H = 180
  const PAD_LEFT = 44
  const PAD_RIGHT = 20
  const PAD_TOP = 20
  const PAD_BOT = 32

  const vals = data.map(d => d.val)
  const maxV = Math.max(...vals) * 1.15
  const minV = 0
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length

  const xOf = i => PAD_LEFT + (i / (data.length - 1)) * (W - PAD_LEFT - PAD_RIGHT)
  const yOf = v => PAD_TOP + (1 - (v - minV) / (maxV - minV)) * (H - PAD_TOP - PAD_BOT)

  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.val)}`).join(' ')
  const fillPts = [
    `${xOf(0)},${H - PAD_BOT}`,
    ...data.map((d, i) => `${xOf(i)},${yOf(d.val)}`),
    `${xOf(data.length - 1)},${H - PAD_BOT}`,
  ].join(' ')

  const avgY = yOf(avg)
  const yTicks = [0, Math.round(maxV * 0.25), Math.round(maxV * 0.5), Math.round(maxV * 0.75), Math.round(maxV)]

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 320 }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Y grid lines */}
        {yTicks.map(tick => {
          const y = yOf(tick)
          return (
            <g key={tick}>
              <line x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y}
                stroke="#f1f5f9" strokeWidth="1" />
              <text x={PAD_LEFT - 6} y={y + 4} textAnchor="end"
                fontSize="9" fill="#94a3b8">${tick}</text>
            </g>
          )
        })}

        {/* Area fill */}
        <polygon points={fillPts} fill="#16a34a" fillOpacity="0.07" />

        {/* Dashed average line */}
        <line
          x1={PAD_LEFT} y1={avgY} x2={W - PAD_RIGHT} y2={avgY}
          stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,4"
        />
        <text x={W - PAD_RIGHT + 2} y={avgY + 4} fontSize="8" fill="#94a3b8">avg</text>

        {/* Polyline */}
        <polyline
          points={pts}
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const cx = xOf(i)
          const cy = yOf(d.val)
          const isHov = hovered === i
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={isHov ? 7 : 4}
                fill={d.current ? '#16a34a' : '#fff'}
                stroke="#16a34a" strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                onMouseEnter={() => setHovered(i)}
              />
              {isHov && (
                <g>
                  <rect x={cx - 28} y={cy - 28} width={56} height={20}
                    rx="4" fill="#1e293b" fillOpacity="0.9" />
                  <text x={cx} y={cy - 14} textAnchor="middle"
                    fontSize="10" fill="#fff" fontWeight="600">
                    ${d.val.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* X axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={xOf(i)}
            y={H - 4}
            textAnchor="middle"
            fontSize="9"
            fill={d.current ? '#15803d' : '#94a3b8'}
            fontWeight={d.current ? '700' : '400'}
          >
            {d.month}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-eco-600 rounded-full" />
          Monthly earnings
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 border-t border-dashed border-slate-400" />
          Period average
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-eco-600" />
          Current month
        </div>
      </div>
    </div>
  )
}

// ─── Toast ─────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState(null)
  const show = (msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }
  return { toast, show }
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold flex items-center gap-2 transition-all
      ${toast.type === 'success' ? 'bg-eco-600 text-white' : 'bg-slate-800 text-white'}`}>
      {toast.type === 'success' ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {toast.msg}
    </div>
  )
}

// ─── Trend arrow ──────────────────────────────────────────────────────────────

function TrendBadge({ current, prev }) {
  if (current === prev) return <Minus className="w-3.5 h-3.5 text-slate-400" />
  const up = current > prev
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-eco-700' : 'text-red-500'}`}>
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {Math.abs(current - prev)}%
    </span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

const PERIODS = ['This Month', 'Last 6 Months', 'This Year', 'All Time']

export default function Earnings() {
  const [period, setPeriod] = useState('All Time')
  const { toast, show } = useToast()

  const data = PERIOD_DATA[period]

  const totalMaterialValue = data.materials.reduce((s, m) => s + m.value, 0)
  const avgMonthly = data.months.reduce((s, m) => s + m.val, 0) / data.months.length
  const projectedAnnual = avgMonthly * 12

  const trees = Math.round(data.co2Kg / 21)
  const drivingKm = Math.round(data.co2Kg * 6.3)
  const bottles = Math.round(data.weightKg * 1.4)

  function handleDownload() {
    show('Generating PDF…', 'loading')
    setTimeout(() => show('Statement ready! Downloading…', 'success'), 1500)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Earnings Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your recycling income and environmental impact</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-eco-600 hover:bg-eco-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Statement
          </button>
        </div>
      </div>

      {/* 5-card KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Lifetime Earnings',
            value: `$${LIFETIME.toFixed(2)}`,
            sub: 'Since Jun 2024',
            icon: DollarSign,
            iconBg: 'bg-eco-50',
            iconColor: 'text-eco-700',
          },
          {
            label: period === 'This Month' ? 'This Month' : 'Period Total',
            value: `$${data.periodEarnings.toFixed(2)}`,
            sub: period,
            icon: TrendingUp,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-700',
          },
          {
            label: 'Best Month',
            value: `$${BEST_MONTH.toFixed(2)}`,
            sub: 'Sep 2024',
            icon: Star,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-700',
          },
          {
            label: 'CO₂ Offset',
            value: `${TOTAL_CO2} kg`,
            sub: 'All time',
            icon: Leaf,
            iconBg: 'bg-teal-50',
            iconColor: 'text-teal-700',
          },
          {
            label: 'Weight Diverted',
            value: `${TOTAL_WEIGHT} kg`,
            sub: 'From landfill',
            icon: Package,
            iconBg: 'bg-purple-50',
            iconColor: 'text-purple-700',
          },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 lg:col-span-1 col-span-1">
            <div className={`w-8 h-8 ${s.iconBg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.iconColor}`} />
            </div>
            <div className="text-xl font-bold text-slate-900 leading-tight">{s.value}</div>
            <div className="text-xs font-medium text-slate-600 mt-0.5 leading-snug">{s.label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart + Tier */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Polyline chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-900">Monthly Earnings (AUD)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Period avg: <span className="font-semibold text-slate-600">${avgMonthly.toFixed(2)}/mo</span>
              </p>
            </div>
          </div>
          <EarningsChart data={data.months} />
        </div>

        {/* Tier progress */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-5">
          <h2 className="font-semibold text-slate-900">Tier Progress</h2>

          {/* Current tier badge */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl px-4 py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Award className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Silver</span>
            </div>
            <div className="text-3xl font-bold text-slate-700">1,420 pts</div>
            <div className="text-[11px] text-slate-400 mt-1">+5% bonus eco points active</div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="font-semibold text-slate-500">Progress to Gold</span>
              <span className="text-slate-400">28%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-700"
                style={{ width: '28%' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
              <span>1,420 pts</span>
              <span className="font-semibold text-amber-600">5,000 pts</span>
            </div>
          </div>

          {/* Points needed */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-700">3,580 pts to Gold</p>
            <p className="text-[11px] text-amber-600 mt-0.5">Roughly 18 more pickups at your current rate</p>
          </div>

          {/* Unlockable benefits */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-600">Unlocks at Gold:</p>
            {[
              '+10% bonus eco points per pickup',
              'Priority scheduling (next-day)',
              'Exclusive Gold-tier rewards',
              'Dedicated account support',
            ].map(b => (
              <div key={b} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <span className="text-xs text-slate-600">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Material breakdown table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-slate-900">Material Breakdown</h2>
            <p className="text-xs text-slate-400 mt-0.5">{period} · {data.materials.filter(m => m.kg > 0).length} materials collected</p>
          </div>
          <div className="text-sm font-bold text-slate-900">
            ${totalMaterialValue.toFixed(2)}
            <span className="text-xs font-normal text-slate-400 ml-1">total</span>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100">
          <div className="col-span-3">Material</div>
          <div className="col-span-3 text-right">Weight</div>
          <div className="col-span-2 text-right">Value</div>
          <div className="col-span-3">% of total</div>
          <div className="col-span-1 text-center">Trend</div>
        </div>

        <div className="divide-y divide-slate-50">
          {data.materials.filter(m => m.kg > 0).map(m => (
            <div key={m.name} className="grid grid-cols-12 gap-2 items-center py-3">
              <div className="col-span-3 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${m.dot} flex-shrink-0`} />
                <span className="text-sm font-medium text-slate-700 truncate">{m.name}</span>
              </div>
              <div className="col-span-3 text-right text-sm text-slate-600">{m.kg.toFixed(1)} kg</div>
              <div className="col-span-2 text-right text-sm font-bold text-slate-900">${m.value.toFixed(2)}</div>
              <div className="col-span-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.pct}%` }} />
                </div>
                <span className="text-xs text-slate-500 w-6 text-right">{m.pct}%</span>
              </div>
              <div className="col-span-1 flex justify-center">
                <TrendBadge current={m.pct} prev={m.prevPct} />
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-50">
          Aluminium generates the majority of your recovery value. Increasing aluminium volume is the fastest way to grow monthly earnings.
        </p>
      </div>

      {/* CO₂ Impact section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-eco-50 rounded-xl flex items-center justify-center">
            <Leaf className="w-4 h-4 text-eco-700" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Environmental Impact</h2>
            <p className="text-xs text-slate-400 mt-0.5">{period}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: (
                <svg className="w-7 h-7 text-eco-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 2C8 2 5 6 5 10c0 3 2 5.5 5 6.5V20h4v-3.5c3-1 5-3.5 5-6.5 0-4-3-8-7-8z" />
                </svg>
              ),
              value: trees,
              unit: 'trees',
              label: 'Annual tree equivalent',
              sublabel: `${data.co2Kg} kg CO₂ absorbed`,
              bg: 'bg-eco-50',
              border: 'border-eco-100',
              valColor: 'text-eco-700',
            },
            {
              icon: (
                <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 17l4-4 4 4m0-8l-4 4-4-4" />
                  <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" opacity="0.15" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 19h18" />
                </svg>
              ),
              value: drivingKm.toLocaleString(),
              unit: 'km',
              label: 'Driving emissions offset',
              sublabel: 'Equivalent car travel avoided',
              bg: 'bg-blue-50',
              border: 'border-blue-100',
              valColor: 'text-blue-700',
            },
            {
              icon: (
                <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 3h6l1 5H8L9 3zM8 8v10a2 2 0 002 2h4a2 2 0 002-2V8" />
                </svg>
              ),
              value: bottles.toLocaleString(),
              unit: 'bottles',
              label: 'Plastic containers diverted',
              sublabel: `${data.weightKg.toFixed(0)} kg from landfill`,
              bg: 'bg-teal-50',
              border: 'border-teal-100',
              valColor: 'text-teal-700',
            },
          ].map(item => (
            <div key={item.label} className={`${item.bg} border ${item.border} rounded-2xl p-5`}>
              <div className="mb-3">{item.icon}</div>
              <div className={`text-3xl font-bold ${item.valColor}`}>
                {item.value}
                <span className="text-base font-semibold ml-1">{item.unit}</span>
              </div>
              <div className="text-sm font-semibold text-slate-700 mt-1">{item.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{item.sublabel}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Projected annual earnings */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Projected Annual Earnings</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">${projectedAnnual.toFixed(2)}</span>
            <span className="text-sm text-slate-500">/ year</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Based on your {period.toLowerCase()} average of ${avgMonthly.toFixed(2)}/month × 12
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="text-xs text-slate-500">
            If you increase volume by <span className="font-semibold text-eco-700">20%</span>:
          </div>
          <div className="text-lg font-bold text-eco-700">
            ${(projectedAnnual * 1.2).toFixed(2)} / year
          </div>
          <div className="text-[11px] text-slate-400">+${(projectedAnnual * 0.2).toFixed(2)} additional recovery</div>
        </div>
      </div>
    </div>
  )
}
