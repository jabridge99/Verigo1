import React, { useState } from 'react'
import { RefreshCw, Play, CheckCircle, AlertTriangle, XCircle, Wifi, WifiOff, Clock, Database } from 'lucide-react'

const LAST_SYNCED = '29 May 2026, 14:28 AEST'
const DATA_SOURCES_COUNT = 6
const CONFIDENCE_SCORE = 94.2

// Twin vs Actual — last 7 days
const COMPARISON_DATA = [
  { date: '23 May', predVol: 142.4, actVol: 138.9, predPrice: 1.44, actPrice: 1.46, varPct: 2.5,  ok: true },
  { date: '24 May', predVol: 139.1, actVol: 144.2, predPrice: 1.46, actPrice: 1.43, varPct: 3.7,  ok: true },
  { date: '25 May', predVol: 148.6, actVol: 141.0, predPrice: 1.43, actPrice: 1.49, varPct: 5.1,  ok: false },
  { date: '26 May', predVol: 152.3, actVol: 155.8, predPrice: 1.49, actPrice: 1.47, varPct: 2.3,  ok: true },
  { date: '27 May', predVol: 158.9, actVol: 157.1, predPrice: 1.47, actPrice: 1.48, varPct: 1.1,  ok: true },
  { date: '28 May', predVol: 162.4, actVol: 169.2, predPrice: 1.48, actPrice: 1.45, varPct: 4.2,  ok: true },
  { date: '29 May', predVol: 165.0, actVol: 163.4, predPrice: 1.45, actPrice: 1.46, varPct: 1.0,  ok: true },
]

// Prediction accuracy sparkline data (last 12 weeks)
const MAE_TREND    = [3.2, 2.9, 2.7, 3.1, 2.8, 2.6, 2.4, 2.5, 2.3, 2.2, 2.1, 2.0]
const RMSE_TREND   = [4.8, 4.5, 4.3, 4.6, 4.2, 4.0, 3.8, 3.9, 3.6, 3.5, 3.3, 3.2]
const DIRAC_TREND  = [78, 79, 81, 80, 82, 83, 84, 83, 85, 86, 87, 88]
const CONF_TREND   = [89, 90, 91, 91, 92, 92, 93, 93, 93, 94, 94, 94]

const ACTIVE_SIMS = [
  { name: 'Copper Supply Shock +15%',        started: '14:05', status: 'Completed', eta: null,   result: 'Rev +4.2%, Vol −1.8%' },
  { name: 'Consumer Demand Drop −20%',       started: '14:18', status: 'Running',   eta: '~2 min', result: null },
  { name: 'Fuel Price Spike +25%, Rain Zone', started: '13:52', status: 'Failed',    eta: null,   result: 'Timeout — retry queued' },
]

const DATA_SOURCES = [
  { name: 'LME Commodity Feed',     status: 'live',    lastUpdated: '14:28',  records: 48_210 },
  { name: 'ACCC Consumer Index',    status: 'live',    lastUpdated: '14:15',  records: 12_840 },
  { name: 'BOM Weather API',        status: 'delayed', lastUpdated: '13:45',  records: 9_320 },
  { name: 'EcoBin Transaction Log', status: 'live',    lastUpdated: '14:29',  records: 891_440 },
  { name: 'Competitor Rate Scrape', status: 'delayed', lastUpdated: '12:30',  records: 3_150 },
  { name: 'Regulatory Bulletin RSS',status: 'offline', lastUpdated: '09:12',  records: 2_280 },
]

// Scenario slider defaults
const SLIDER_DEFAULTS = {
  fuelPrice:       0,
  competitorRate:  0,
  commodityIndex:  0,
  consumerDemand:  1.0,
  weatherImpact:   0,
}

function StatusBadge({ status }) {
  if (status === 'live')    return <span className="flex items-center gap-1 text-[10px] font-bold text-eco-700 bg-eco-50 border border-eco-200 px-2 py-0.5 rounded-full"><Wifi className="w-2.5 h-2.5" /> Live</span>
  if (status === 'delayed') return <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><Clock className="w-2.5 h-2.5" /> Delayed</span>
  return                           <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><WifiOff className="w-2.5 h-2.5" /> Offline</span>
}

function SimStatusBadge({ status }) {
  if (status === 'Completed') return <span className="flex items-center gap-1 text-[10px] font-bold text-eco-700 bg-eco-50 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Completed</span>
  if (status === 'Running')   return <span className="flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full"><RefreshCw className="w-3 h-3 animate-spin" /> Running</span>
  return                             <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Failed</span>
}

function Sparkline({ data, color = '#16a34a', height = 28 }) {
  if (!data || data.length < 2) return null
  const W = 80
  const H = height
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="overflow-visible" style={{ width: 80, height: H }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * W} cy={H - ((data[data.length - 1] - min) / range) * H} r="2.5" fill={color} />
    </svg>
  )
}

export default function MarketTwin() {
  const [sliders, setSliders] = useState({ ...SLIDER_DEFAULTS })
  const [simRunning, setSimRunning] = useState(false)
  const [simResult, setSimResult] = useState(null)

  function setSlider(key, val) {
    setSliders(s => ({ ...s, [key]: val }))
    setSimResult(null)
  }

  function handleRunSimulation() {
    setSimRunning(true)
    setSimResult(null)
    setTimeout(() => {
      // Rough heuristic projection
      const revenueImpact = (
        sliders.fuelPrice * -0.02 +
        sliders.competitorRate * -0.15 +
        sliders.commodityIndex * 0.08 +
        (sliders.consumerDemand - 1.0) * 18.0 +
        sliders.weatherImpact * -4.0
      ).toFixed(1)
      const volumeImpact = (
        sliders.fuelPrice * -0.01 +
        sliders.competitorRate * -0.22 +
        sliders.commodityIndex * 0.05 +
        (sliders.consumerDemand - 1.0) * 22.0 +
        sliders.weatherImpact * -6.0
      ).toFixed(1)
      setSimResult({ revenueImpact, volumeImpact })
      setSimRunning(false)
    }, 1600)
  }

  function resetSliders() {
    setSliders({ ...SLIDER_DEFAULTS })
    setSimResult(null)
  }

  const syncOk = DATA_SOURCES.filter(s => s.status === 'live').length
  const totalSources = DATA_SOURCES.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Market Twin</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Digital twin of the EcoBin market — real-time comparison, scenario injection, and prediction accuracy tracking
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-bold text-eco-700 bg-eco-50 border border-eco-200 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-eco-500 animate-pulse inline-block" />
            Live
          </span>
          <div className="text-right">
            <p className="text-xs text-slate-500">Last synced: <span className="font-semibold text-slate-700">{LAST_SYNCED}</span></p>
            <p className="text-[11px] text-slate-400">{syncOk}/{totalSources} sources live · Confidence: <span className="font-bold text-violet-700">{CONFIDENCE_SCORE}%</span></p>
          </div>
        </div>
      </div>

      {/* Twin vs Actual comparison */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Twin vs Actual — Last 7 Days</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Predicted vs actual volume (tonnes) and avg price · variance flagged if outside 5%
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Date</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Pred. Vol (t)</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Act. Vol (t)</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Pred. Avg Price</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Act. Avg Price</th>
                <th className="text-center px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Variance</th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {COMPARISON_DATA.map((row, i) => (
                <tr key={i} className={!row.ok ? 'bg-amber-50/40' : 'hover:bg-slate-50/40'}>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-700">{row.date}</td>
                  <td className="px-3 py-3 text-right text-xs font-mono text-slate-600">{row.predVol.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right text-xs font-mono font-bold text-slate-800">{row.actVol.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right text-xs font-mono text-slate-600">${row.predPrice.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right text-xs font-mono font-bold text-slate-800">${row.actPrice.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-bold ${row.varPct <= 3 ? 'text-eco-600' : row.varPct <= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                      {row.varPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {row.ok ? (
                      <span className="text-eco-600 font-bold text-sm">&#x2713; within 5%</span>
                    ) : (
                      <span className="text-amber-600 font-bold text-sm">&#x26A0; outside</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scenario injection */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-bold text-slate-900">Scenario Injection Panel</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Adjust market levers and run a simulation to see projected platform impact</p>
          </div>
          <button onClick={resetSliders} className="text-xs text-slate-400 hover:text-slate-600 font-semibold">
            Reset all
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
          {[
            { key: 'fuelPrice',      label: 'Fuel Price Change (%)',       min: -20, max: 40, step: 1, fmt: v => `${v > 0 ? '+' : ''}${v}%` },
            { key: 'competitorRate', label: 'Competitor Rate Change (%)',   min: -30, max: 30, step: 1, fmt: v => `${v > 0 ? '+' : ''}${v}%` },
            { key: 'commodityIndex', label: 'Commodity Index Move (%)',     min: -20, max: 30, step: 1, fmt: v => `${v > 0 ? '+' : ''}${v}%` },
            { key: 'consumerDemand', label: 'Consumer Demand Multiplier',   min: 0.5, max: 1.5, step: 0.05, fmt: v => `${v.toFixed(2)}×` },
            { key: 'weatherImpact',  label: 'Weather Impact (−1 to +1)',    min: -1,  max: 1,  step: 0.1,  fmt: v => `${v > 0 ? '+' : ''}${v.toFixed(1)}` },
          ].map(({ key, label, min, max, step, fmt }) => {
            const val = sliders[key]
            const isModified = val !== SLIDER_DEFAULTS[key]
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={`text-xs font-semibold ${isModified ? 'text-violet-700' : 'text-slate-500'}`}>{label}</label>
                  <span className={`text-xs font-mono font-bold ${isModified ? 'text-violet-700' : 'text-slate-600'}`}>{fmt(val)}</span>
                </div>
                <input
                  type="range" min={min} max={max} step={step}
                  value={val}
                  onChange={e => setSlider(key, parseFloat(e.target.value))}
                  className="w-full accent-violet-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>{fmt(min)}</span><span>{fmt(max)}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleRunSimulation}
            disabled={simRunning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              simRunning ? 'bg-violet-200 text-violet-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {simRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {simRunning ? 'Running Simulation…' : 'Run Simulation'}
          </button>

          {simResult && (
            <div className={`flex items-center gap-6 px-5 py-2.5 rounded-xl ${
              parseFloat(simResult.revenueImpact) >= 0 ? 'bg-eco-50 border border-eco-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Revenue Impact</p>
                <p className={`text-lg font-black ${parseFloat(simResult.revenueImpact) >= 0 ? 'text-eco-700' : 'text-red-600'}`}>
                  {parseFloat(simResult.revenueImpact) >= 0 ? '+' : ''}{simResult.revenueImpact}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Volume Impact</p>
                <p className={`text-lg font-black ${parseFloat(simResult.volumeImpact) >= 0 ? 'text-eco-700' : 'text-red-600'}`}>
                  {parseFloat(simResult.volumeImpact) >= 0 ? '+' : ''}{simResult.volumeImpact}%
                </p>
              </div>
              <p className="text-[11px] text-slate-500 max-w-xs">Projected platform impact if scenario conditions persist for 30 days.</p>
            </div>
          )}
        </div>
      </div>

      {/* Prediction accuracy + Active simulations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prediction accuracy */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4">Prediction Accuracy</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'MAE (Volume)', value: '2.0 t', trend: MAE_TREND, color: '#ef4444', note: 'Mean abs error vs actual' },
              { label: 'RMSE (Price)', value: '$0.032', trend: RMSE_TREND, color: '#f59e0b', note: 'Root mean sq price error' },
              { label: 'Direction Acc.', value: '88%', trend: DIRAC_TREND, color: '#16a34a', note: 'Trend direction correct' },
              { label: 'Model Confidence', value: '94.2%', trend: CONF_TREND, color: '#7c3aed', note: 'Composite confidence score' },
            ].map(card => (
              <div key={card.label} className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-black text-slate-800">{card.value}</p>
                    <p className="text-[11px] font-semibold text-slate-500">{card.label}</p>
                    <p className="text-[10px] text-slate-400">{card.note}</p>
                  </div>
                  <Sparkline data={card.trend} color={card.color} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active simulations */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4">Active Simulations</h2>
          <div className="space-y-3">
            {ACTIVE_SIMS.map((sim, i) => (
              <div key={i} className={`rounded-xl border p-3.5 ${
                sim.status === 'Completed' ? 'border-eco-100 bg-eco-50/30' :
                sim.status === 'Running'   ? 'border-violet-100 bg-violet-50/30' :
                'border-red-100 bg-red-50/20'
              }`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-bold text-slate-800 leading-snug">{sim.name}</p>
                  <SimStatusBadge status={sim.status} />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span>Started {sim.started}</span>
                  {sim.eta && <span className="text-violet-600 font-semibold">ETA: {sim.eta}</span>}
                  {sim.result && <span className={`font-semibold ${sim.status === 'Failed' ? 'text-red-600' : 'text-eco-700'}`}>{sim.result}</span>}
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full text-center text-xs font-semibold text-violet-600 hover:text-violet-700">
            + New Simulation
          </button>
        </div>
      </div>

      {/* Data sources */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Connected Data Sources</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{syncOk} of {totalSources} sources currently live</p>
        </div>
        <div className="divide-y divide-slate-50">
          {DATA_SOURCES.map((src, i) => (
            <div key={i} className="px-5 py-3.5 flex items-center gap-4">
              <Database className={`w-4 h-4 flex-shrink-0 ${
                src.status === 'live' ? 'text-eco-500' :
                src.status === 'delayed' ? 'text-amber-500' : 'text-red-400'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800">{src.name}</p>
                <p className="text-[10px] text-slate-400">Last updated: {src.lastUpdated} · {src.records.toLocaleString()} records</p>
              </div>
              <StatusBadge status={src.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
