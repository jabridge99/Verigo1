import React, { useState } from 'react'
import { Globe, Play, TrendingUp, TrendingDown, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { MARKET_TWIN_PARAMS, TWIN_SCENARIOS, SHADOW_MODELS } from '../../data/shadowLab'

const PARAM_META = {
  market_size_units_monthly: { label: 'Market Size (units/mo)',    min: 20000, max: 50000, step: 1000, fmt: v => v.toLocaleString() },
  ecobin_market_share_pct:   { label: 'EcoBin Market Share (%)',   min: 10,    max: 45,    step: 0.5,  fmt: v => v.toFixed(1) + '%' },
  competitor_avg_offer_index:{ label: 'Competitor Offer Index',    min: 0.70,  max: 1.30,  step: 0.05, fmt: v => v.toFixed(2) + '×' },
  copper_price_index:        { label: 'Copper Price Index',        min: 0.70,  max: 1.50,  step: 0.05, fmt: v => v.toFixed(2) + '×' },
  aud_usd_index:             { label: 'AUD/USD Index',             min: 0.80,  max: 1.20,  step: 0.02, fmt: v => v.toFixed(2) + '×' },
  consumer_sentiment_index:  { label: 'Consumer Sentiment (0–1)',  min: 0.20,  max: 1.00,  step: 0.05, fmt: v => v.toFixed(2) },
  logistics_capacity_pct:    { label: 'Logistics Capacity (%)',    min: 40,    max: 100,   step: 5,    fmt: v => v + '%' },
  fraud_pressure_index:      { label: 'Fraud Pressure Index',      min: 0.50,  max: 3.00,  step: 0.10, fmt: v => v.toFixed(2) + '×' },
  operator_saturation_pct:   { label: 'Operator Saturation (%)',   min: 20,    max: 90,    step: 5,    fmt: v => v + '%' },
}

function DeltaCell({ value }) {
  if (value === undefined || value === null) return <span className="text-slate-300">—</span>
  const pos = value > 0
  return (
    <span className={`font-bold text-xs ${pos ? 'text-eco-600' : value < 0 ? 'text-red-500' : 'text-slate-400'}`}>
      {pos ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

function ScenarioRow({ scenario }) {
  const [expanded, setExpanded] = useState(false)
  const activeModels = SHADOW_MODELS.filter(m => m.status !== 'shadow_paused')

  return (
    <>
      <tr className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3 w-4">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
        </td>
        <td className="px-3 py-3">
          <p className="text-sm font-semibold text-slate-800">{scenario.name}</p>
          <p className="text-[11px] text-slate-400">{scenario.id} · run {scenario.run_date}</p>
        </td>
        <td className="px-3 py-3 text-xs text-slate-500 hidden md:table-cell max-w-xs">
          <p className="truncate">{scenario.description}</p>
        </td>
        <td className="px-3 py-3 text-center">
          <DeltaCell value={scenario.model_outcomes['MDL-001']?.revenue_delta_pct} />
        </td>
        <td className="px-3 py-3 text-center">
          <DeltaCell value={scenario.model_outcomes['MDL-001']?.margin_delta_pct} />
        </td>
        <td className="px-4 py-3 text-center">
          <DeltaCell value={scenario.model_outcomes['MDL-001']?.volume_delta_pct} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={6} className="px-6 py-4">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Parameter Shocks Applied</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(scenario.param_deltas).map(([k, v]) => (
                    <span key={k} className="text-xs font-mono font-semibold px-2 py-1 bg-slate-900 text-white rounded-lg">
                      {PARAM_META[k]?.label || k}: {PARAM_META[k]?.fmt(v) || v}
                    </span>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-1.5 pr-4 text-slate-500 font-semibold">Model</th>
                      <th className="text-center px-3 py-1.5 text-slate-500 font-semibold">Revenue Δ</th>
                      <th className="text-center px-3 py-1.5 text-slate-500 font-semibold">Margin Δ</th>
                      <th className="text-center px-3 py-1.5 text-slate-500 font-semibold">Volume Δ</th>
                      <th className="text-center px-3 py-1.5 text-slate-500 font-semibold">Fraud Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeModels.map(m => {
                      const out = scenario.model_outcomes[m.id]
                      if (!out) return null
                      return (
                        <tr key={m.id} className={m.id === 'MDL-001' ? 'bg-eco-50/40' : ''}>
                          <td className="py-2 pr-4 font-semibold text-slate-700">
                            {m.name}
                            {m.id === 'MDL-001' && <span className="ml-1.5 text-[9px] font-bold text-eco-600">PROD</span>}
                          </td>
                          <td className="px-3 py-2 text-center"><DeltaCell value={out.revenue_delta_pct} /></td>
                          <td className="px-3 py-2 text-center"><DeltaCell value={out.margin_delta_pct} /></td>
                          <td className="px-3 py-2 text-center"><DeltaCell value={out.volume_delta_pct} /></td>
                          <td className="px-3 py-2 text-center"><DeltaCell value={out.fraud_delta_pct} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function MarketTwin() {
  const [params, setParams] = useState({ ...MARKET_TWIN_PARAMS })
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState(null)

  function handleRun() {
    setRunning(true)
    setTimeout(() => { setRunning(false); setLastRun(new Date().toLocaleTimeString()) }, 1800)
  }

  function handleReset() {
    setParams({ ...MARKET_TWIN_PARAMS })
  }

  const paramKeys = Object.keys(PARAM_META)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Virtual Market Twin</h1>
        <p className="text-sm text-slate-500 mt-0.5">Simulate market conditions against all shadow models simultaneously</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parameter panel */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Market Parameters</h2>
            <button onClick={handleReset} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div className="space-y-4">
            {paramKeys.map(key => {
              const meta = PARAM_META[key]
              const value = params[key]
              const isModified = Math.abs(value - MARKET_TWIN_PARAMS[key]) > 0.001
              return (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1">
                    <label className={`text-xs font-semibold ${isModified ? 'text-violet-700' : 'text-slate-500'}`}>{meta.label}</label>
                    <span className={`text-xs font-mono font-bold ${isModified ? 'text-violet-700' : 'text-slate-700'}`}>{meta.fmt(value)}</span>
                  </div>
                  <input type="range"
                    min={meta.min} max={meta.max} step={meta.step}
                    value={value}
                    onChange={e => setParams(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
                    className="w-full accent-violet-600"
                  />
                </div>
              )
            })}
          </div>

          <button
            onClick={handleRun}
            disabled={running}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              running ? 'bg-violet-200 text-violet-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running simulation…
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Simulation
              </>
            )}
          </button>
          {lastRun && <p className="text-[10px] text-center text-eco-600 font-semibold">Last run: {lastRun}</p>}

          <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-[11px] text-slate-400">
            <p className="font-semibold text-slate-500 mb-1">How the twin works</p>
            <p>Each model's pricing engine runs against your configured market parameters. Outcomes are compared across all active shadow models and production simultaneously.</p>
          </div>
        </div>

        {/* Scenarios table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 bg-slate-900">
              <h2 className="font-bold text-white">Saved Scenario Results</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Click any scenario to see per-model breakdown · Δ vs baseline (no shock applied)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="w-4 px-4 py-3" />
                    <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Scenario</th>
                    <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase hidden md:table-cell">Description</th>
                    <th className="text-center px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Revenue Δ</th>
                    <th className="text-center px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Margin Δ</th>
                    <th className="text-center px-4 py-3 text-[10px] text-slate-400 font-semibold uppercase">Volume Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {TWIN_SCENARIOS.map(s => <ScenarioRow key={s.id} scenario={s} />)}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50">
              <p className="text-[11px] text-slate-400">All deltas shown for production model (MDL-001). Click row for full model comparison.</p>
            </div>
          </div>

          {/* Scenario summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              {
                label: 'Best case (copper +20%)',
                revenue: '+8.4%', margin: '+3.1%', color: 'eco',
                bg: 'bg-eco-50', border: 'border-eco-200',
              },
              {
                label: 'Worst case (competitor undercuts)',
                revenue: '−6.8%', margin: '−1.4%', color: 'red',
                bg: 'bg-red-50', border: 'border-red-200',
              },
              {
                label: 'Fraud wave impact',
                revenue: '−2.1%', margin: '−4.8%', color: 'amber',
                bg: 'bg-amber-50', border: 'border-amber-200',
              },
            ].map(c => (
              <div key={c.label} className={`${c.bg} border ${c.border} rounded-2xl px-4 py-3`}>
                <p className="text-[11px] font-semibold text-slate-600 mb-2">{c.label}</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400">Revenue</p>
                    <p className={`font-bold ${c.color === 'eco' ? 'text-eco-700' : c.color === 'red' ? 'text-red-600' : 'text-amber-700'}`}>{c.revenue}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Margin</p>
                    <p className={`font-bold ${c.color === 'eco' ? 'text-eco-700' : c.color === 'red' ? 'text-red-600' : 'text-amber-700'}`}>{c.margin}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
