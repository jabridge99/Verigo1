import React, { useState } from 'react'
import {
  TrendingUp, TrendingDown, RefreshCw, DollarSign, Info,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Calculator,
  BadgeCheck, AlertCircle,
} from 'lucide-react'

// ─── Static data ────────────────────────────────────────────────────────────

const COMMODITIES = [
  { material: 'Aluminium',     grade: 'UBC Scrap',       spot: 2180, change: +2.4,  consumerRate: 1.85, marginPct: 15 },
  { material: 'PET Plastic',   grade: 'Clear Baled',     spot:  320, change: -0.8,  consumerRate: 0.24, marginPct: 25 },
  { material: 'HDPE',          grade: 'Natural Baled',   spot:  280, change: +1.2,  consumerRate: 0.21, marginPct: 25 },
  { material: 'Clear Glass',   grade: 'Cullet',          spot:   45, change:  0.0,  consumerRate: 0.02, marginPct: 55 },
  { material: 'Steel Cans',    grade: 'No.1 Shredded',   spot:  195, change: +3.1,  consumerRate: 0.14, marginPct: 28 },
  { material: 'Paperboard',    grade: 'OCC Grade',       spot:   85, change: -1.5,  consumerRate: 0.06, marginPct: 30 },
  { material: 'Mixed Plastic', grade: 'Commingled',      spot:   55, change: -0.3,  consumerRate: 0.04, marginPct: 25 },
]

// 6-month Aluminium spot vs consumer rate (AUD/kg derived from /tonne ÷1000)
const HISTORY = [
  { month: 'Dec', spot: 2.05, consumer: 1.74 },
  { month: 'Jan', spot: 2.12, consumer: 1.80 },
  { month: 'Feb', spot: 2.08, consumer: 1.77 },
  { month: 'Mar', spot: 2.19, consumer: 1.86 },
  { month: 'Apr', spot: 2.14, consumer: 1.82 },
  { month: 'May', spot: 2.18, consumer: 1.85 },
]

const FAQS = [
  {
    q: 'How is the consumer rate calculated?',
    a: 'The consumer rate is derived from the daily commodity spot price on the Australian scrap market. The platform applies a fixed margin (shown in the table) to cover processing, logistics, and operational costs. Your share is what remains after the platform fee is deducted.',
  },
  {
    q: 'Can I offer a higher rate to attract more consumers?',
    a: 'Yes — the Custom Rate Override feature lets you set a higher consumer rate for any material, up to 120% of the platform-set rate. This comes entirely from your share; the platform margin is not affected. The higher rate is visible to consumers in the EcoBin app.',
  },
  {
    q: 'How often are rates updated?',
    a: 'Commodity spot prices are fetched daily at 6:00 am AEST from the platform feed. Consumer rates are recalculated automatically and push to all your stations within minutes. You will receive an in-app notification whenever a rate change exceeds 5%.',
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt2(n) { return n.toFixed(2) }

function ChangeChip({ change }) {
  if (change === 0) return <span className="text-slate-400 text-sm">Flat</span>
  const up = change > 0
  return (
    <span className={`flex items-center gap-1 text-sm font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {up ? '+' : ''}{change}%
    </span>
  )
}

// ─── SVG Line Chart ──────────────────────────────────────────────────────────

function LineChart({ data }) {
  const W = 520
  const H = 120
  const PAD = { top: 12, right: 16, bottom: 28, left: 36 }
  const inner = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom }

  const allVals = data.flatMap(d => [d.spot, d.consumer])
  const minV = Math.min(...allVals) - 0.05
  const maxV = Math.max(...allVals) + 0.05

  const xScale = i => PAD.left + (i / (data.length - 1)) * inner.w
  const yScale = v => PAD.top + inner.h - ((v - minV) / (maxV - minV)) * inner.h

  const polyline = pts => pts.map(([x, y]) => `${x},${y}`).join(' ')

  const spotPts  = data.map((d, i) => [xScale(i), yScale(d.spot)])
  const consPts  = data.map((d, i) => [xScale(i), yScale(d.consumer)])

  // y-axis labels
  const yTicks = [minV, (minV + maxV) / 2, maxV].map(v => ({
    v,
    y: yScale(v),
    label: `$${v.toFixed(2)}`,
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
      {/* grid lines */}
      {yTicks.map(t => (
        <line key={t.v} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
          stroke="#f1f5f9" strokeWidth="1" />
      ))}
      {/* y labels */}
      {yTicks.map(t => (
        <text key={`l${t.v}`} x={PAD.left - 4} y={t.y + 4}
          textAnchor="end" fontSize="9" fill="#94a3b8">{t.label}</text>
      ))}
      {/* x labels */}
      {data.map((d, i) => (
        <text key={d.month} x={xScale(i)} y={H - 6}
          textAnchor="middle" fontSize="9" fill="#94a3b8">{d.month}</text>
      ))}
      {/* spot line */}
      <polyline points={polyline(spotPts)} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 3" />
      {/* consumer line */}
      <polyline points={polyline(consPts)} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" />
      {/* dots – consumer */}
      {consPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#4f46e5" />
      ))}
      {/* dots – spot */}
      {spotPts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#94a3b8" />
      ))}
    </svg>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function OperatorPricing() {
  // overrides: { [material]: { enabled, rate } }
  const [overrides, setOverrides] = useState({})
  // calculator: { [material]: kgInput }
  const [calcKg, setCalcKg] = useState({})
  // faq open index
  const [openFaq, setOpenFaq] = useState(null)

  function toggleOverride(material, baseRate) {
    setOverrides(prev => {
      const cur = prev[material]
      if (cur && cur.enabled) {
        return { ...prev, [material]: { enabled: false, rate: baseRate } }
      }
      return { ...prev, [material]: { enabled: true, rate: baseRate } }
    })
  }

  function setOverrideRate(material, val) {
    setOverrides(prev => ({ ...prev, [material]: { ...prev[material], rate: parseFloat(val) } }))
  }

  function effectiveRate(c) {
    const ov = overrides[c.material]
    if (ov && ov.enabled) return ov.rate
    return c.consumerRate
  }

  const totalEst = COMMODITIES.reduce((sum, c) => {
    const kg = parseFloat(calcKg[c.material] || 0)
    if (!kg) return sum
    const share = effectiveRate(c) * (1 - c.marginPct / 100)
    return sum + kg * share
  }, 0)

  const hasCalcInput = Object.values(calcKg).some(v => parseFloat(v) > 0)

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consumer Rate Cards</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Commodity-linked pricing. Consumer rates = what you pay consumers. Your share = earnings after platform fee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full flex items-center gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5" /> Auto-synced
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Updated 29 May 2026, 6:00 am AEST
          </span>
        </div>
      </div>

      {/* ── 2-card summary ── */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full w-fit mb-1">
              Your Best Rate
            </div>
            <div className="text-2xl font-bold text-slate-900">$1.85<span className="text-base font-medium text-slate-500">/kg</span></div>
            <div className="text-xs text-slate-400 mt-0.5">Aluminium — UBC Scrap</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full w-fit mb-1">
              Your Avg Margin
            </div>
            <div className="text-2xl font-bold text-slate-900">71%<span className="text-base font-medium text-slate-500"> of rate</span></div>
            <div className="text-xs text-slate-400 mt-0.5">Platform keeps avg 29% across all materials</div>
          </div>
        </div>
      </div>

      {/* ── Rate card table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Rate Card — All Materials</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            Consumer Rate = what you pay consumers &nbsp;·&nbsp; Your Share = what you earn after platform fee
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Material', 'Grade', 'Spot (AUD/t)', '24h Change', 'Consumer Rate $/kg', 'Platform Margin %', 'Your Share $/kg'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {COMMODITIES.map(c => {
                const yourShare = (c.consumerRate * (1 - c.marginPct / 100))
                return (
                  <tr key={c.material} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">{c.material}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap">{c.grade}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      ${c.spot.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <ChangeChip change={c.change} />
                    </td>
                    <td className="px-5 py-3.5 font-bold text-indigo-700">${fmt2(c.consumerRate)}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        {c.marginPct}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-emerald-700">${fmt2(yourShare)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Custom rate override section ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Custom Rate Overrides</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Offer a higher rate to attract more consumers — funded from your share. Min = platform rate, Max = 120% of platform rate.
          </p>
        </div>
        <div className="divide-y divide-slate-50">
          {COMMODITIES.map(c => {
            const ov = overrides[c.material]
            const enabled = ov && ov.enabled
            const curRate = (ov && ov.rate != null) ? ov.rate : c.consumerRate
            const minRate = c.consumerRate
            const maxRate = +(c.consumerRate * 1.2).toFixed(3)
            const yourShareOv = enabled ? curRate * (1 - c.marginPct / 100) : null

            return (
              <div key={c.material} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-[140px]">
                  <div className="font-semibold text-slate-900 text-sm">{c.material}</div>
                  <div className="text-xs text-slate-400">{c.grade}</div>
                </div>
                <div className="text-xs text-slate-500">
                  Platform rate: <span className="font-semibold text-indigo-700">${fmt2(c.consumerRate)}/kg</span>
                </div>
                <button
                  onClick={() => toggleOverride(c.material, c.consumerRate)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    enabled
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {enabled
                    ? <ToggleRight className="w-4 h-4" />
                    : <ToggleLeft className="w-4 h-4" />
                  }
                  {enabled ? 'Override On' : 'Override Off'}
                </button>
                {enabled && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Rate:</span>
                      <input
                        type="range"
                        min={minRate}
                        max={maxRate}
                        step={0.01}
                        value={curRate}
                        onChange={e => setOverrideRate(c.material, e.target.value)}
                        className="w-28 accent-indigo-600"
                      />
                      <span className="text-xs font-bold text-indigo-700 w-14">${fmt2(curRate)}/kg</span>
                    </div>
                    <div className="text-xs text-emerald-700 font-semibold">
                      Your share: ${fmt2(yourShareOv)}/kg
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                      Custom Override Active
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Rate history chart ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-slate-900">Aluminium Rate History — 6 Months</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-indigo-600 inline-block rounded-full" />
              Consumer Rate
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-slate-300 inline-block rounded-full border-dashed" style={{ borderTop: '2px dashed #cbd5e1', background: 'none' }} />
              Spot (AUD/kg)
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4">Spot price ÷ 1000 for per-kg comparison</p>
        <LineChart data={HISTORY} />
        <div className="mt-3 flex gap-6 text-xs text-slate-500">
          <span>Current spot: <strong className="text-slate-800">$2.18/kg</strong></span>
          <span>Current consumer rate: <strong className="text-indigo-700">$1.85/kg</strong></span>
          <span>Spread: <strong className="text-slate-800">$0.33/kg (15%)</strong></span>
        </div>
      </div>

      {/* ── Earnings calculator ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-600" />
          <h2 className="font-semibold text-slate-900">Earnings Calculator</h2>
          <span className="text-xs text-slate-400 ml-2">Enter estimated monthly kg per material to see projected earnings</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Material', 'Consumer Rate', 'Your Share/kg', 'Est. Monthly kg', 'Est. Monthly Earnings'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {COMMODITIES.map(c => {
                const rate = effectiveRate(c)
                const share = rate * (1 - c.marginPct / 100)
                const kg = parseFloat(calcKg[c.material] || 0)
                const est = kg * share
                return (
                  <tr key={c.material} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-semibold text-slate-900">{c.material}</td>
                    <td className="px-5 py-3 text-indigo-700 font-semibold">${fmt2(rate)}</td>
                    <td className="px-5 py-3 text-emerald-700 font-semibold">${fmt2(share)}</td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={calcKg[c.material] || ''}
                        onChange={e => setCalcKg(prev => ({ ...prev, [c.material]: e.target.value }))}
                        className="w-24 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-900">
                      {kg > 0 ? <span className="text-emerald-700">${est.toFixed(2)}</span> : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {hasCalcInput && (
          <div className="px-6 py-4 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-indigo-900">Estimated Total Monthly Earnings</span>
            <span className="text-2xl font-bold text-indigo-700">${totalEst.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* ── FAQ ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Frequently Asked Questions</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50/50 transition-colors"
              >
                <span className="text-sm font-semibold text-slate-900">{faq.q}</span>
                {openFaq === i
                  ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                }
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4 text-sm text-slate-600 leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
