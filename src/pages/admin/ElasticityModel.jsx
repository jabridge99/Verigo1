import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react'
import { marketFeed } from '../../lib/marketFeed'

const MODEL_VERSION = 'v3.2.1'
const LAST_CALIBRATED = '22 May 2026'

const MATERIALS = [
  { id: 'aluminium', name: 'Aluminium',     coeff: -1.8,  confidence: 91, lastUpdated: '22 May 2026', trend: 'stable',  currentRate: 1.42, optimalRate: 1.48 },
  { id: 'copper',    name: 'Copper',         coeff: -1.4,  confidence: 88, lastUpdated: '22 May 2026', trend: 'up',     currentRate: 9.80, optimalRate: 10.20 },
  { id: 'steel',     name: 'Steel Scrap',    coeff: -0.9,  confidence: 85, lastUpdated: '21 May 2026', trend: 'down',   currentRate: 0.38, optimalRate: 0.37 },
  { id: 'nickel',    name: 'Nickel',         coeff: -2.1,  confidence: 79, lastUpdated: '20 May 2026', trend: 'up',     currentRate: 14.20, optimalRate: 14.80 },
  { id: 'lithium',   name: 'Lithium',        coeff: -0.6,  confidence: 82, lastUpdated: '22 May 2026', trend: 'down',   currentRate: 22.50, optimalRate: 21.80 },
  { id: 'plastics',  name: 'Plastics (PET)', coeff: -0.4,  confidence: 75, lastUpdated: '18 May 2026', trend: 'stable', currentRate: 0.18, optimalRate: 0.18 },
  { id: 'ewaste',    name: 'E-Waste Mixed',  coeff: -1.1,  confidence: 83, lastUpdated: '21 May 2026', trend: 'up',     currentRate: 0.95, optimalRate: 0.99 },
]

// Map ElasticityModel material IDs to marketFeed keys where available
const LIVE_RATE_MAP = {
  aluminium: 'aluminium',
  plastics:  'pet_plastic',
  steel:     'steel',
}

// Expected volume/revenue at optimal rate
const OPTIMAL_VOLUME_CHANGE = {
  aluminium: +4.2, copper: +3.8, steel: +0.9, nickel: +3.1,
  lithium: +0.8, plastics: 0, ewaste: +2.7,
}
const OPTIMAL_REVENUE_CHANGE = {
  aluminium: +5.8, copper: +5.4, steel: -0.5, nickel: +4.6,
  lithium: -0.9, plastics: 0, ewaste: +3.6,
}

// Backtesting data
const BACKTEST = [
  { material: 'Aluminium',     mae: 1.2, rmse: 1.8, dirAcc: 87 },
  { material: 'Copper',        mae: 0.9, rmse: 1.3, dirAcc: 91 },
  { material: 'Steel Scrap',   mae: 1.8, rmse: 2.4, dirAcc: 79 },
  { material: 'Nickel',        mae: 2.1, rmse: 2.9, dirAcc: 74 },
  { material: 'Lithium',       mae: 3.4, rmse: 4.1, dirAcc: 68 },
  { material: 'Plastics (PET)',mae: 0.6, rmse: 0.9, dirAcc: 83 },
  { material: 'E-Waste Mixed', mae: 1.4, rmse: 2.0, dirAcc: 81 },
]

function classifyElasticity(coeff) {
  const abs = Math.abs(coeff)
  if (abs > 1.5) return { label: 'Highly Elastic',  color: 'bg-red-100 text-red-700' }
  if (abs > 1.0) return { label: 'Elastic',         color: 'bg-amber-100 text-amber-700' }
  if (abs > 0.5) return { label: 'Inelastic',       color: 'bg-slate-100 text-slate-600' }
  return            { label: 'Very Inelastic',   color: 'bg-eco-100 text-eco-700' }
}

function TrendIcon({ trend }) {
  if (trend === 'up')   return <TrendingUp className="w-4 h-4 text-eco-500" />
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-slate-400" />
}

// Elasticity curve: price range $/kg, volume as weekly kg
function buildCurve(material) {
  const base = material.currentRate
  const coeff = material.coeff
  // Generate 11 price points from -30% to +30%
  return Array.from({ length: 11 }, (_, i) => {
    const pctChange = -30 + i * 6 // -30, -24, ..., +30
    const priceChange = pctChange / 100
    const price = +(base * (1 + priceChange)).toFixed(3)
    // Volume = base * (1 + elasticity * priceChange)
    const baseVolume = 1000
    const volumeMult = Math.max(0.1, 1 + coeff * priceChange)
    const volume = Math.round(baseVolume * volumeMult)
    return { price, volume, pctChange }
  })
}

function ElasticityCurveChart({ material }) {
  const curve = buildCurve(material)
  const W = 480, H = 180
  const PAD = { top: 16, right: 20, bottom: 32, left: 52 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxVolume = Math.max(...curve.map(p => p.volume))
  const minVolume = Math.min(...curve.map(p => p.volume))
  const minPrice = Math.min(...curve.map(p => p.price))
  const maxPrice = Math.max(...curve.map(p => p.price))

  function xOf(price) {
    return PAD.left + ((price - minPrice) / (maxPrice - minPrice)) * chartW
  }
  function yOf(vol) {
    return PAD.top + chartH - ((vol - minVolume) / (maxVolume - minVolume)) * chartH
  }

  // Current operating point (pctChange = 0)
  const currentPoint = curve.find(p => p.pctChange === 0)

  const polyPoints = curve.map(p => `${xOf(p.price)},${yOf(p.volume)}`).join(' ')

  // X-axis price labels
  const xLabels = curve.filter((_, i) => i % 2 === 0)
  // Y-axis volume labels
  const ySteps = 4
  const yLabelValues = Array.from({ length: ySteps + 1 }, (_, i) =>
    Math.round(minVolume + (i / ySteps) * (maxVolume - minVolume))
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      {/* Grid lines */}
      {yLabelValues.map(v => (
        <line key={v}
          x1={PAD.left} y1={yOf(v)}
          x2={PAD.left + chartW} y2={yOf(v)}
          stroke="#f1f5f9" strokeWidth="1"
        />
      ))}

      {/* Polyline */}
      <polyline points={polyPoints} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Current operating point */}
      {currentPoint && (
        <>
          <circle cx={xOf(currentPoint.price)} cy={yOf(currentPoint.volume)} r="6" fill="#7c3aed" stroke="#fff" strokeWidth="2" />
          <text x={xOf(currentPoint.price)} y={yOf(currentPoint.volume) - 10} textAnchor="middle" fontSize="8" fill="#7c3aed" fontWeight="700">
            Current (${currentPoint.price}/kg)
          </text>
        </>
      )}

      {/* X-axis */}
      <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH} stroke="#e2e8f0" strokeWidth="1" />
      {xLabels.map(p => (
        <text key={p.price} x={xOf(p.price)} y={H - 8} textAnchor="middle" fontSize="8" fill="#94a3b8">
          ${p.price.toFixed(2)}
        </text>
      ))}

      {/* Y-axis */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH} stroke="#e2e8f0" strokeWidth="1" />
      {yLabelValues.map(v => (
        <text key={v} x={PAD.left - 6} y={yOf(v) + 3} textAnchor="end" fontSize="8" fill="#94a3b8">
          {v}
        </text>
      ))}

      {/* Axis titles */}
      <text x={PAD.left + chartW / 2} y={H - 1} textAnchor="middle" fontSize="8" fill="#64748b">Price ($/kg)</text>
      <text
        x={10} y={PAD.top + chartH / 2}
        textAnchor="middle" fontSize="8" fill="#64748b"
        transform={`rotate(-90, 10, ${PAD.top + chartH / 2})`}
      >Vol (kg/wk)</text>
    </svg>
  )
}

function MiniBarChart({ data, maxVal }) {
  const max = maxVal || Math.max(...data.map(d => d.value))
  return (
    <div className="flex items-end gap-1 h-10">
      {data.map((d, i) => {
        const h = Math.max(4, (d.value / max) * 40)
        const color = d.value < 1.5 ? 'bg-eco-500' : d.value < 2.5 ? 'bg-amber-400' : 'bg-red-400'
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5" title={`${d.label}: ${d.value}`}>
            <div className={`w-full rounded-t-sm ${color}`} style={{ height: `${h}px` }} />
          </div>
        )
      })}
    </div>
  )
}

export default function ElasticityModel() {
  const [selectedMaterial, setSelectedMaterial] = useState('aluminium')
  const [priceChangePct, setPriceChangePct] = useState(0)
  const [liveRates, setLiveRates] = useState({})

  useEffect(() => {
    marketFeed.start()
    const unsub = marketFeed.subscribe(null, r => {
      setLiveRates(prev => ({ ...prev, [r.material]: r }))
    })
    return () => { unsub(); marketFeed.stop() }
  }, [])

  // Merge live consumer_rate into MATERIALS for the three wired materials
  const materials = MATERIALS.map(m => {
    const feedKey = LIVE_RATE_MAP[m.id]
    const live = feedKey ? liveRates[feedKey] : null
    return live ? { ...m, currentRate: +live.consumer_rate.toFixed(4), _live: true } : { ...m, _live: false }
  })

  const mat = materials.find(m => m.id === selectedMaterial)
  const volumeChangePct = +(mat.coeff * priceChangePct).toFixed(1)
  const baseRevenue = mat.currentRate * 1000
  const newPrice = +(mat.currentRate * (1 + priceChangePct / 100)).toFixed(3)
  const newVolumeMult = Math.max(0.05, 1 + mat.coeff * (priceChangePct / 100))
  const newRevenue = +(newPrice * 1000 * newVolumeMult).toFixed(0)
  const revenueChangePct = +(((newRevenue / baseRevenue) - 1) * 100).toFixed(1)

  const avgMAE = (BACKTEST.reduce((s, b) => s + b.mae, 0) / BACKTEST.length).toFixed(2)
  const avgRMSE = (BACKTEST.reduce((s, b) => s + b.rmse, 0) / BACKTEST.length).toFixed(2)
  const avgDirAcc = Math.round(BACKTEST.reduce((s, b) => s + b.dirAcc, 0) / BACKTEST.length)

  function simRecommendation() {
    if (Math.abs(priceChangePct) < 1) return 'No change applied. Adjust the slider to simulate.'
    if (priceChangePct > 0 && revenueChangePct > 0)
      return `A ${priceChangePct}% price increase is expected to grow revenue by ${revenueChangePct}% despite a ${Math.abs(volumeChangePct)}% volume reduction. The demand is inelastic enough to support this.`
    if (priceChangePct > 0 && revenueChangePct <= 0)
      return `A ${priceChangePct}% price increase is expected to reduce revenue by ${Math.abs(revenueChangePct)}%. Volume drop of ${Math.abs(volumeChangePct)}% outweighs the rate gain — consider a smaller increase.`
    if (priceChangePct < 0 && revenueChangePct >= 0)
      return `A ${Math.abs(priceChangePct)}% price reduction is expected to increase revenue by ${revenueChangePct}% via volume uplift of ${Math.abs(volumeChangePct)}%. Strategically viable.`
    return `A ${Math.abs(priceChangePct)}% price reduction is expected to reduce revenue by ${Math.abs(revenueChangePct)}%. Volume uplift of ${Math.abs(volumeChangePct)}% is insufficient to offset the rate cut.`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Price Elasticity Model</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Model version: <span className="font-semibold text-violet-700">{MODEL_VERSION}</span> · Last calibrated:{' '}
          <span className="font-semibold text-slate-700">{LAST_CALIBRATED}</span> · Based on 90-day A/B test and transaction history
        </p>
      </div>

      {/* Elasticity matrix */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Elasticity Matrix</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">How volume responds to a 1% change in rate for each material</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Material</th>
                <th className="text-center px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Elasticity</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Interpretation</th>
                <th className="text-center px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Confidence</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Last Updated</th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {materials.map(mat => {
                const cls = classifyElasticity(mat.coeff)
                return (
                  <tr
                    key={mat.id}
                    onClick={() => setSelectedMaterial(mat.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedMaterial === mat.id ? 'bg-violet-50/50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-5 py-3 font-semibold text-slate-800">
                      {mat.name}
                      {mat._live && (
                        <span className="ml-2 text-[9px] font-bold text-eco-700 bg-eco-100 px-1.5 py-0.5 rounded-full animate-pulse">Live</span>
                      )}
                      {selectedMaterial === mat.id && (
                        <span className="ml-2 text-[9px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">Selected</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center font-mono font-bold text-slate-700">{mat.coeff}</td>
                    <td className="px-3 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls.color}`}>{cls.label}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${mat.confidence >= 85 ? 'bg-eco-500' : mat.confidence >= 75 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${mat.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 w-8 text-right">{mat.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{mat.lastUpdated}</td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex justify-center"><TrendIcon trend={mat.trend} /></div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demand simulator + curve side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Simulator */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
          <div>
            <h2 className="font-bold text-slate-900">Demand Simulator</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Select a material and adjust price change to see impact</p>
          </div>
          {/* Material selector */}
          <div className="flex flex-wrap gap-2">
            {materials.map(m => (
              <button
                key={m.id}
                onClick={() => { setSelectedMaterial(m.id); setPriceChangePct(0) }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                  selectedMaterial === m.id
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                }`}
              >{m.name}{m._live && <span className="ml-1 text-[8px] font-bold opacity-80">●</span>}</button>
            ))}
          </div>
          {/* Slider */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-2">
              <span className="text-slate-500">Price change</span>
              <span className={`font-mono font-bold ${priceChangePct > 0 ? 'text-red-600' : priceChangePct < 0 ? 'text-eco-600' : 'text-slate-500'}`}>
                {priceChangePct > 0 ? '+' : ''}{priceChangePct}%
              </span>
            </div>
            <input
              type="range" min="-30" max="30" step="1"
              value={priceChangePct}
              onChange={e => setPriceChangePct(parseInt(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>−30%</span><span>0% baseline</span><span>+30%</span>
            </div>
          </div>
          {/* Results */}
          <div className="bg-slate-900 rounded-2xl p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">New Rate</p>
              <p className="text-xl font-bold text-white">${newPrice}/kg</p>
              <p className={`text-xs font-semibold mt-0.5 ${priceChangePct > 0 ? 'text-amber-400' : priceChangePct < 0 ? 'text-eco-400' : 'text-slate-400'}`}>
                {priceChangePct === 0 ? 'Baseline' : `${priceChangePct > 0 ? '+' : ''}${priceChangePct}% from $${mat.currentRate}/kg`}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Est. Volume Change</p>
              <p className={`text-xl font-bold ${volumeChangePct >= 0 ? 'text-eco-400' : 'text-red-400'}`}>
                {volumeChangePct >= 0 ? '+' : ''}{volumeChangePct}%
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Elasticity: {mat.coeff}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Revenue Impact</p>
              <p className={`text-xl font-bold ${revenueChangePct >= 0 ? 'text-eco-400' : 'text-red-400'}`}>
                {revenueChangePct >= 0 ? '+' : ''}{revenueChangePct}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Confidence</p>
              <p className="text-xl font-bold text-white">{mat.confidence}%</p>
            </div>
          </div>
          {/* Recommendation text */}
          <div className={`rounded-xl px-4 py-3 text-xs ${
            revenueChangePct >= 0 && Math.abs(priceChangePct) > 0 ? 'bg-eco-50 text-eco-700 border border-eco-100' : 'bg-slate-50 text-slate-600'
          }`}>
            {simRecommendation()}
          </div>
        </div>

        {/* Elasticity curve */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-1">Elasticity Curve — {mat.name}</h2>
          <p className="text-[11px] text-slate-400 mb-4">
            X-axis: Price ($/kg) · Y-axis: Est. weekly volume (kg) · Violet dot = current operating point
          </p>
          <ElasticityCurveChart material={mat} />
          <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-violet-600 inline-block rounded" /> Demand curve
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-violet-600 rounded-full inline-block" /> Current price
            </span>
          </div>
        </div>
      </div>

      {/* Revenue optimizer table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Revenue Optimizer</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Model-recommended rate adjustments · highlighted rows indicate actionable opportunities</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Material</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Current Rate</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Optimal Rate</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Est. Vol Change</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Est. Rev Change</th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {materials.map(m => {
                const volChg = OPTIMAL_VOLUME_CHANGE[m.id]
                const revChg = OPTIMAL_REVENUE_CHANGE[m.id]
                const hasAction = Math.abs(m.optimalRate - m.currentRate) > 0.005
                return (
                  <tr key={m.id} className={hasAction ? 'bg-eco-50/30' : ''}>
                    <td className="px-5 py-3 font-semibold text-slate-800">
                      {m.name}
                      {m._live && <span className="ml-2 text-[9px] font-bold text-eco-700 bg-eco-100 px-1.5 py-0.5 rounded-full animate-pulse">Live</span>}
                      {hasAction && (
                        <span className="ml-2 text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">Adjust</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">${m.currentRate.toFixed(2)}/kg</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-violet-700">${m.optimalRate.toFixed(2)}/kg</td>
                    <td className={`px-3 py-3 text-right font-bold ${volChg >= 0 ? 'text-eco-600' : 'text-red-500'}`}>
                      {volChg >= 0 ? '+' : ''}{volChg}%
                    </td>
                    <td className={`px-3 py-3 text-right font-bold ${revChg >= 0 ? 'text-eco-600' : 'text-red-500'}`}>
                      {revChg >= 0 ? '+' : ''}{revChg}%
                    </td>
                    <td className="px-5 py-3 text-center">
                      {hasAction ? (
                        <button className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold rounded-lg transition-colors">
                          Apply
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">No change</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model accuracy panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="mb-4">
          <h2 className="font-bold text-slate-900">Model Accuracy — 90-day Backtesting</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Prediction error metrics across all materials</p>
        </div>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Avg MAE', value: avgMAE, unit: '%', note: 'Mean Absolute Error', color: 'text-slate-800' },
            { label: 'Avg RMSE', value: avgRMSE, unit: '%', note: 'Root Mean Sq. Error', color: 'text-amber-700' },
            { label: 'Direction Accuracy', value: `${avgDirAcc}%`, unit: '', note: 'Correct trend direction', color: 'text-eco-700' },
          ].map(card => (
            <div key={card.label} className="bg-slate-50 rounded-xl p-4 text-center">
              <p className={`text-2xl font-black ${card.color}`}>{card.value}{card.unit}</p>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{card.label}</p>
              <p className="text-[10px] text-slate-400">{card.note}</p>
            </div>
          ))}
        </div>
        {/* Prediction error bar chart by material */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-3">MAE by Material</p>
          <div className="space-y-2">
            {BACKTEST.map(b => {
              const maxMAE = Math.max(...BACKTEST.map(x => x.mae))
              const pct = (b.mae / maxMAE) * 100
              const color = b.mae < 1.5 ? 'bg-eco-500' : b.mae < 2.5 ? 'bg-amber-400' : 'bg-red-400'
              return (
                <div key={b.material} className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-slate-600 w-28 flex-shrink-0">{b.material}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-600 w-10 text-right">{b.mae}%</span>
                  <span className="text-[10px] text-slate-400 w-12 text-right">{b.dirAcc}% dir</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
