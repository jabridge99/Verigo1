import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle } from 'lucide-react'
import { OVERRIDES, VOLATILITY_ALERTS, BOOK_VERSIONS } from '../../data/override'
import { COMMODITIES, PRICING_ENGINE_CONFIG } from '../../data/pie'

const DEVICE_LABELS = {
  smartphone: 'Smartphone', laptop: 'Laptop', desktop: 'Desktop PC',
  tablet: 'Tablet', tv_monitor: 'TV / Monitor', large_appliance: 'Large Appliance',
  mixed_ewaste: 'Mixed E-Waste',
}

// Current live book (BK-0088) — merges AI book with active overrides
const CURRENT_BOOK = BOOK_VERSIONS[0].book
const AI_BOOK_CLEAN = BOOK_VERSIONS[2].book  // BK-0086 — pure AI, no overrides

function TrendIcon({ pct }) {
  if (pct > 0.5)  return <TrendingUp   className="w-3.5 h-3.5 text-eco-500 flex-shrink-0" />
  if (pct < -0.5) return <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
  return <Minus className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
}

function VolatilityRisk({ metal }) {
  const comm = COMMODITIES[metal]
  if (!comm) return null
  const vol7d = Math.abs(comm.change_7d_pct)
  const risk = vol7d >= 5 ? 'High' : vol7d >= 2 ? 'Medium' : 'Low'
  const color = vol7d >= 5 ? 'text-red-600 bg-red-50' : vol7d >= 2 ? 'text-amber-600 bg-amber-50' : 'text-eco-600 bg-eco-50'
  const barColor = vol7d >= 5 ? 'bg-red-500' : vol7d >= 2 ? 'bg-amber-500' : 'bg-eco-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, vol7d * 10)}%` }} />
      </div>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{risk}</span>
    </div>
  )
}

export default function ExposureDashboard() {
  const [view, setView] = useState('pricing')

  const activeOverrides = OVERRIDES.filter(o => o.status === 'active')
  const openAlerts = VOLATILITY_ALERTS.filter(a => a.status === 'open')

  // Compute exposure: sum of (proposed_value - ai_value) × volume_estimate per active override
  const totalPositiveExposure = activeOverrides
    .filter(o => o.proposed_value > o.ai_value)
    .reduce((s, o) => s + (o.proposed_value - o.ai_value) * o.volume_estimate, 0)
  const totalNegativeExposure = activeOverrides
    .filter(o => o.proposed_value < o.ai_value)
    .reduce((s, o) => s + (o.ai_value - o.proposed_value) * o.volume_estimate, 0)

  // Pricing book comparison
  const bookComparison = CURRENT_BOOK.map(row => {
    const aiRow = AI_BOOK_CLEAN.find(r => r.device === row.device)
    const override = activeOverrides.find(o => o.device === row.device)
    const aiPure = aiRow?.offer || row.offer
    const diff = row.offer - aiPure
    const diffPct = aiPure > 0 ? (diff / aiPure) * 100 : 0
    const pieCfgRow = PRICING_ENGINE_CONFIG.book.find(b => b.device === row.device)
    return {
      device: row.device,
      label: DEVICE_LABELS[row.device] || row.device,
      live_offer: row.offer,
      ai_pure: aiPure,
      diff,
      diff_pct: diffPct,
      has_override: !!override,
      override_id: override?.id,
      margin_pct: pieCfgRow?.margin_pct || null,
      net_recovery: pieCfgRow?.net_recovery || null,
    }
  })

  const metals = ['copper', 'aluminium', 'tin', 'gold', 'silver', 'palladium', 'nickel']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Exposure Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Pricing book delta · Override exposure · Metal volatility risk</p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Lines with Overrides', value: activeOverrides.length, color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Upside Exposure (wk)', value: `+$${totalPositiveExposure.toLocaleString()}`, color: 'text-eco-700', bg: 'bg-eco-50' },
          { label: 'Downside Exposure (wk)', value: totalNegativeExposure > 0 ? `-$${totalNegativeExposure.toLocaleString()}` : '$0', color: totalNegativeExposure > 0 ? 'text-red-600' : 'text-slate-400', bg: totalNegativeExposure > 0 ? 'bg-red-50' : 'bg-slate-50' },
          { label: 'Open Volatility Alerts', value: openAlerts.length, color: openAlerts.length ? 'text-red-600' : 'text-slate-400', bg: openAlerts.length ? 'bg-red-50' : 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-100">
        {[
          { id: 'pricing',    label: 'Pricing Book Delta' },
          { id: 'volatility', label: 'Metal Volatility Risk' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              view === tab.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>{tab.label}</button>
        ))}
      </div>

      {view === 'pricing' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 bg-slate-900">
            <h2 className="font-bold text-white">Live Book vs Pure AI — Pricing Delta</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Comparing BK-0088 (current) against PIE pure AI output (BK-0086 baseline)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50">
                  <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Device</th>
                  <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">AI Pure</th>
                  <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Live Offer</th>
                  <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Delta</th>
                  <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden md:table-cell">Override</th>
                  <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bookComparison.map(row => (
                  <tr key={row.device} className={row.has_override ? 'bg-violet-50/30' : ''}>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                      {row.has_override && <span className="text-[10px] font-semibold text-violet-600">Override: {row.override_id}</span>}
                    </td>
                    <td className="px-3 py-3.5 text-right text-sm text-slate-500">${row.ai_pure.toFixed(2)}</td>
                    <td className="px-3 py-3.5 text-right">
                      <p className={`text-sm font-bold ${row.diff > 0 ? 'text-eco-700' : row.diff < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                        ${row.live_offer.toFixed(2)}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      {row.diff !== 0 ? (
                        <div>
                          <p className={`text-xs font-bold ${row.diff > 0 ? 'text-eco-700' : 'text-red-600'}`}>
                            {row.diff > 0 ? '+' : ''}${row.diff.toFixed(2)}
                          </p>
                          <p className={`text-[10px] ${row.diff > 0 ? 'text-eco-600' : 'text-red-500'}`}>
                            {row.diff_pct > 0 ? '+' : ''}{row.diff_pct.toFixed(1)}%
                          </p>
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3.5 hidden md:table-cell">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${row.has_override ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                        {row.has_override ? 'Overridden' : 'AI Only'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex justify-center"><TrendIcon pct={row.diff_pct} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-50 bg-slate-50">
            <p className="text-[11px] text-slate-400">
              Baseline: BK-0086 (pure AI, no overrides, no campaigns) · Live: BK-0088 (with {activeOverrides.length} overrides + Copper Week campaign)
            </p>
          </div>
        </div>
      )}

      {view === 'volatility' && (
        <div className="space-y-4">
          {/* Open alerts */}
          {openAlerts.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Open Alerts Requiring Action
              </h2>
              {openAlerts.map(a => (
                <div key={a.id} className="flex items-start gap-3 border border-red-200 bg-red-50 rounded-2xl px-4 py-3.5">
                  <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-900">{a.headline}</p>
                    <p className="text-xs text-red-700 mt-0.5">{a.recommendation}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {a.affected_devices.map(d => (
                        <span key={d} className="text-[10px] font-semibold px-1.5 py-0.5 bg-red-100 text-red-700 rounded">{DEVICE_LABELS[d]}</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-red-200 text-red-800 rounded-full flex-shrink-0 uppercase">{a.action_required.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Metal volatility grid */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50">
              <h2 className="font-bold text-slate-900">Metal Volatility Risk</h2>
              <p className="text-xs text-slate-400 mt-0.5">Based on 7-day price movements vs thresholds</p>
            </div>
            <div className="divide-y divide-slate-50">
              {metals.map(m => {
                const comm = COMMODITIES[m]
                if (!comm) return null
                const alert = VOLATILITY_ALERTS.find(a => a.metal === m)
                return (
                  <div key={m} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-800 capitalize w-20">{m}</span>
                        <span className="text-xs text-slate-400">{comm.exchange} · {comm.unit}</span>
                        {alert && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            alert.severity === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                          }`}>{alert.severity}</span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${comm.change_7d_pct >= 0 ? 'text-eco-600' : 'text-red-500'}`}>
                          {comm.change_7d_pct > 0 ? '+' : ''}{comm.change_7d_pct.toFixed(2)}% 7d
                        </p>
                        <p className="text-[11px] text-slate-400">${comm.spot_usd.toLocaleString()} {comm.unit}</p>
                      </div>
                    </div>
                    <VolatilityRisk metal={m} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
