import React, { useState, useEffect } from 'react'
import { FlaskConical, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { SHADOW_MODELS, PERFORMANCE_METRICS } from '../../data/shadowLab'
import { pricingEngine } from '../../lib/pricingEngine'
import { marketFeed, COMMODITIES } from '../../lib/marketFeed'

const PERIODS = ['7d', '30d', '90d', '180d']
const PERIOD_LABELS = { '7d': '7 Days', '30d': '30 Days', '90d': '90 Days', '180d': '180 Days' }

const METRICS_CONFIG = [
  { key: 'volume_units',          label: 'Volume (units)',     fmt: v => v.toLocaleString(),         higherIsBetter: true },
  { key: 'margin_pct',            label: 'Margin %',           fmt: v => v.toFixed(1) + '%',         higherIsBetter: true },
  { key: 'fraud_rate_pct',        label: 'Fraud Rate %',       fmt: v => v.toFixed(2) + '%',         higherIsBetter: false },
  { key: 'operator_growth_pct',   label: 'Op. Growth MoM',     fmt: v => v.toFixed(1) + '%',         higherIsBetter: true },
  { key: 'logistics_load',        label: 'Logistics Load',     fmt: v => v.toFixed(1) + ' pk/truck', higherIsBetter: false },
  { key: 'revenue_aud',           label: 'Revenue (AUD)',       fmt: v => '$' + v.toLocaleString(),   higherIsBetter: true },
]

const MODEL_COLORS = {
  'MDL-001': { ring: 'ring-eco-300',    bg: 'bg-eco-50',    dot: 'bg-eco-500',    text: 'text-eco-700' },
  'MDL-002': { ring: 'ring-violet-300', bg: 'bg-violet-50', dot: 'bg-violet-500', text: 'text-violet-700' },
  'MDL-003': { ring: 'ring-amber-300',  bg: 'bg-amber-50',  dot: 'bg-amber-500',  text: 'text-amber-700' },
  'MDL-004': { ring: 'ring-red-300',    bg: 'bg-red-50',    dot: 'bg-red-400',    text: 'text-red-600' },
  'MDL-005': { ring: 'ring-indigo-300', bg: 'bg-indigo-50', dot: 'bg-indigo-500', text: 'text-indigo-700' },
}

function Sparkline({ values, color }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const h = 28
  const w = 60
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MetricBar({ value, max, color }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function WinnerBadge() {
  return <span className="text-[9px] font-bold px-1.5 py-0.5 bg-eco-500 text-white rounded-full ml-1">BEST</span>
}

export default function ScenarioSimulator() {
  const [period, setPeriod] = useState('30d')
  const [selectedModels, setSelectedModels] = useState(['MDL-001', 'MDL-002', 'MDL-003', 'MDL-005'])
  const [highlightMetric, setHighlightMetric] = useState('revenue_aud')
  const [liveExp, setLiveExp] = useState(null)
  const [liveRates, setLiveRates] = useState({})

  useEffect(() => {
    pricingEngine.start()
    marketFeed.start()
    const unsubP = pricingEngine.subscribe(s => setLiveExp(s))
    const unsubM = marketFeed.subscribe(null, r => setLiveRates(prev => ({ ...prev, [r.material]: r })))
    return () => { unsubP(); unsubM(); pricingEngine.stop(); marketFeed.stop() }
  }, [])

  const toggleModel = id => {
    setSelectedModels(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(m => m !== id) : prev) : [...prev, id]
    )
  }

  const visibleModels = SHADOW_MODELS.filter(m => selectedModels.includes(m.id))

  const getPerfMetrics = (modelId, p) => {
    const base = PERFORMANCE_METRICS[modelId][p]
    if (modelId !== 'MDL-001' || !liveExp) return base
    return {
      ...base,
      margin_pct: liveExp.weightedMarginPct ?? base.margin_pct,
      revenue_aud: liveExp.totalMarginAud != null ? Math.round(liveExp.totalMarginAud * 52) : base.revenue_aud,
    }
  }

  // Winners per metric
  const winners = {}
  METRICS_CONFIG.forEach(({ key, higherIsBetter }) => {
    const vals = visibleModels.map(m => ({ id: m.id, v: getPerfMetrics(m.id, period)[key] }))
    const winner = vals.reduce((best, cur) => {
      return higherIsBetter ? (cur.v > best.v ? cur : best) : (cur.v < best.v ? cur : best)
    }, vals[0])
    winners[key] = winner.id
  })

  // Trend data (across all periods for sparkline)
  const sparkData = id => PERIODS.map(p => {
    const base = PERFORMANCE_METRICS[id][p][highlightMetric]
    if (id === 'MDL-001' && liveExp) {
      if (highlightMetric === 'margin_pct') return liveExp.weightedMarginPct ?? base
      if (highlightMetric === 'revenue_aud') return liveExp.totalMarginAud != null ? Math.round(liveExp.totalMarginAud * 52) : base
    }
    return base
  })

  // Max values for bar scaling
  const maxVals = {}
  METRICS_CONFIG.forEach(({ key }) => {
    maxVals[key] = Math.max(...SHADOW_MODELS.map(m => getPerfMetrics(m.id, period)[key]))
  })

  const highlightCfg = METRICS_CONFIG.find(m => m.key === highlightMetric)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scenario Simulator</h1>
        <p className="text-sm text-slate-500 mt-0.5">Compare all shadow models across 7 / 30 / 90 / 180 day performance windows</p>
      </div>

      {/* Period tabs */}
      <div className="flex gap-2 border-b border-slate-100">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-5 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              period === p ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>{PERIOD_LABELS[p]}</button>
        ))}
      </div>

      {/* Live market context strip */}
      {Object.keys(liveRates).length > 0 && (
        <div className="bg-slate-900 rounded-2xl px-5 py-3 flex items-center gap-5 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-2 h-2 bg-eco-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-eco-400 uppercase tracking-wide">Live Spot Rates</span>
          </div>
          {Object.entries(liveRates).map(([k, r]) => {
            const mat = COMMODITIES[k]
            if (!mat) return null
            return (
              <div key={k} className="flex-shrink-0 text-center">
                <p className="text-[10px] text-slate-400">{mat.label}</p>
                <p className="text-xs font-bold text-white">${r.spot?.toFixed(2) ?? '—'}/{mat.unit}</p>
                <p className="text-[10px] text-eco-400">${r.consumer_rate?.toFixed(2) ?? '—'} paid</p>
              </div>
            )
          })}
          {liveExp && (
            <div className="ml-auto flex-shrink-0 border-l border-slate-700 pl-4">
              <p className="text-[10px] text-slate-400">Prod Margin</p>
              <p className="text-xs font-bold text-eco-400">{liveExp.weightedMarginPct?.toFixed(1) ?? '—'}%</p>
            </div>
          )}
        </div>
      )}

      {/* Model toggles */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500">Compare:</span>
        {SHADOW_MODELS.map(m => {
          const colors = MODEL_COLORS[m.id]
          const active = selectedModels.includes(m.id)
          return (
            <button key={m.id} onClick={() => toggleModel(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                active ? `${colors.bg} border-transparent ring-2 ${colors.ring}` : 'bg-white border-slate-200 text-slate-400 ring-0'
              }`}>
              <div className={`w-2 h-2 rounded-full ${active ? colors.dot : 'bg-slate-300'}`} />
              {m.name}
              {m.id === 'MDL-001' && liveExp && <span className="text-[9px] text-eco-600 font-bold">LIVE</span>}
              {m.status === 'production' && <span className="text-[9px] bg-eco-100 text-eco-600 font-bold px-1 rounded">PROD</span>}
            </button>
          )
        })}
      </div>

      {/* Highlight metric selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500">Highlight trend:</span>
        {METRICS_CONFIG.map(m => (
          <button key={m.key} onClick={() => setHighlightMetric(m.key)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              highlightMetric === m.key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}>{m.label}</button>
        ))}
      </div>

      {/* Trend sparklines */}
      <div className="bg-slate-900 rounded-2xl px-5 py-4">
        <p className="text-xs font-semibold text-slate-400 mb-3">{highlightCfg?.label} trend — 7d → 30d → 90d → 180d</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {visibleModels.map(m => {
            const colors = MODEL_COLORS[m.id]
            const vals = sparkData(m.id)
            const sparkColor = m.color === 'eco' ? '#22c55e' : m.color === 'violet' ? '#7c3aed' : m.color === 'amber' ? '#f59e0b' : m.color === 'indigo' ? '#6366f1' : '#ef4444'
            return (
              <div key={m.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-white mb-0.5">{m.name}</p>
                  <p className={`text-xs font-mono ${colors.text.replace('text-', 'text-')}`}>
                    {highlightCfg?.fmt(getPerfMetrics(m.id, period)[highlightMetric])}
                  </p>
                </div>
                <Sparkline values={vals} color={sparkColor} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Main comparison table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 bg-slate-900">
          <h2 className="font-bold text-white">Full Metric Comparison — {PERIOD_LABELS[period]}</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">BEST badge = winning model per metric · green bars show relative performance</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Metric</th>
                {visibleModels.map(m => (
                  <th key={m.id} className="text-center px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${MODEL_COLORS[m.id].bg}`}>
                      <div className={`w-2 h-2 rounded-full ${MODEL_COLORS[m.id].dot}`} />
                      {m.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {METRICS_CONFIG.map(({ key, label, fmt, higherIsBetter }) => {
                const isHighlighted = key === highlightMetric
                return (
                  <tr key={key} className={isHighlighted ? 'bg-violet-50/30' : ''}>
                    <td className="px-5 py-3.5">
                      <p className={`text-xs font-semibold ${isHighlighted ? 'text-violet-700' : 'text-slate-600'}`}>{label}</p>
                      <p className="text-[10px] text-slate-400">{higherIsBetter ? 'Higher is better' : 'Lower is better'}</p>
                    </td>
                    {visibleModels.map(m => {
                      const value = getPerfMetrics(m.id, period)[key]
                      const isWinner = winners[key] === m.id
                      const prodValue = getPerfMetrics('MDL-001', period)[key]
                      const delta = ((value - prodValue) / prodValue * 100)
                      const deltaPositive = higherIsBetter ? delta > 0 : delta < 0
                      return (
                        <td key={m.id} className={`px-3 py-3.5 text-center ${isWinner ? 'bg-eco-50/60' : ''}`}>
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-0.5">
                              <span className={`text-sm font-bold ${isWinner ? 'text-eco-700' : 'text-slate-700'}`}>{fmt(value)}</span>
                              {isWinner && <WinnerBadge />}
                            </div>
                            {m.id !== 'MDL-001' && (
                              <span className={`text-[10px] font-semibold ${deltaPositive ? 'text-eco-600' : Math.abs(delta) < 0.5 ? 'text-slate-400' : 'text-red-500'}`}>
                                {delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs prod
                              </span>
                            )}
                            <MetricBar
                              value={higherIsBetter ? value : maxVals[key] - value + maxVals[key] * 0.1}
                              max={higherIsBetter ? maxVals[key] : maxVals[key] * 1.1}
                              color={isWinner ? 'bg-eco-400' : 'bg-slate-200'}
                            />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Winner summary footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
          <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Win count — {PERIOD_LABELS[period]}</p>
          <div className="flex flex-wrap gap-3">
            {visibleModels.map(m => {
              const wins = Object.values(winners).filter(id => id === m.id).length
              return (
                <div key={m.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${MODEL_COLORS[m.id].bg}`}>
                  <span className={`text-sm font-bold ${MODEL_COLORS[m.id].text}`}>{wins}</span>
                  <span className="text-[11px] text-slate-600">{m.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Confidence intervals */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Margin Confidence Intervals — {PERIOD_LABELS[period]}</h2>
          <p className="text-xs text-slate-400 mt-0.5">95% CI narrows as observation period extends</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {visibleModels.map(m => {
            const met = getPerfMetrics(m.id, period)
            const low = met.margin_pct - met.ci_margin
            const high = met.margin_pct + met.ci_margin
            const colors = MODEL_COLORS[m.id]
            return (
              <div key={m.id} className="flex items-center gap-4">
                <div className="w-28 flex-shrink-0">
                  <p className="text-xs font-semibold text-slate-700">{m.name}</p>
                  <p className={`text-[10px] font-bold ${colors.text}`}>{met.margin_pct.toFixed(1)}% ± {met.ci_margin.toFixed(1)}pp</p>
                </div>
                <div className="flex-1 relative h-4">
                  <div className="absolute inset-y-0 bg-slate-100 rounded-full w-full" />
                  <div className={`absolute inset-y-1 ${colors.dot.replace('bg-', 'bg-')}`}
                    style={{
                      left: `${Math.max(0, ((low - 18) / 25) * 100)}%`,
                      width: `${Math.min(100, ((high - low) / 25) * 100)}%`,
                      borderRadius: '999px',
                    }}
                  />
                  <div className="absolute inset-y-0 w-0.5 bg-slate-400"
                    style={{ left: `${((met.margin_pct - 18) / 25) * 100}%` }}
                  />
                </div>
                <div className="w-20 text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400">{low.toFixed(1)}% – {high.toFixed(1)}%</p>
                </div>
              </div>
            )
          })}
          <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-32">
            <span>18%</span><span>30%</span><span>43%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
