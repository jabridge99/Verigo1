import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, AlertTriangle, Zap, RefreshCw,
  Shield, DollarSign, Activity, X,
} from 'lucide-react'
import { pricingEngine } from '../../lib/pricingEngine'
import { marketFeed } from '../../lib/marketFeed'
import { overrideQueue } from '../../lib/overrideQueue'

// ── Sparkline component ───────────────────────────────────────────────────────

function Sparkline({ material }) {
  const points = marketFeed.getHistory(material, 30)
  if (!points || points.length < 2) {
    return <svg width={60} height={24} className="opacity-30"><line x1={0} y1={12} x2={60} y2={12} stroke="#94a3b8" strokeWidth={1} /></svg>
  }
  const prices = points.map(p => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const w = 60
  const h = 24
  const pad = 2
  const coords = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (p - min) / range) * (h - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const polyline = coords.join(' ')
  const first = prices[0]
  const last  = prices[prices.length - 1]
  const color = last >= first ? '#10b981' : '#ef4444'
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, iconColor, bgColor, borderColor }) {
  return (
    <div className={`${bgColor ?? 'bg-white'} rounded-2xl border ${borderColor ?? 'border-slate-100'} shadow-sm p-5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-2xl font-bold ${iconColor ?? 'text-slate-900'} leading-tight truncate`}>{value}</p>
          {sub && <p className="text-xs font-semibold text-slate-400 mt-0.5">{sub}</p>}
          <p className="text-[11px] text-slate-400 font-medium mt-1.5 leading-snug">{label}</p>
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${bgColor ?? 'bg-violet-50'}`}>
            <Icon className={`w-4.5 h-4.5 ${iconColor ?? 'text-violet-600'}`} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Risk badge ────────────────────────────────────────────────────────────────

function RiskBadge({ flag }) {
  return flag
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><AlertTriangle className="w-2.5 h-2.5" />Risk</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700"><Shield className="w-2.5 h-2.5" />OK</span>
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExposureDashboard() {
  const [summary, setSummary]   = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [overrides, setOverrides] = useState({})

  const refresh = useCallback(() => {
    const s = pricingEngine.getExposureSummary()
    setSummary(s)
    setUpdatedAt(new Date())
    setOverrides(pricingEngine.getOverrides())
  }, [])

  useEffect(() => {
    pricingEngine.start()
    const unsub = pricingEngine.subscribe(s => {
      setSummary(s)
      setUpdatedAt(new Date())
      setOverrides(pricingEngine.getOverrides())
    })
    return () => { unsub(); pricingEngine.stop() }
  }, [])

  const handleClearOverride = (material) => {
    pricingEngine.clearOverride(material, 'admin')
    refresh()
  }

  const fmtAud = (n) => n == null ? '—' : `$${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtPct = (n) => n == null ? '—' : `${n.toFixed(2)}%`

  const activeOverrideEntries = Object.entries(overrides)

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 bg-emerald-500 text-white rounded-full uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              {updatedAt ? updatedAt.toLocaleTimeString('en-AU') : '—'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Exposure Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daily notional · Margin health · Override positions</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Notional AUD"
          value={summary ? fmtAud(summary.totalNotionalAud) : '—'}
          sub="Daily gross"
          icon={DollarSign}
          iconColor="text-violet-600"
          bgColor="bg-violet-50"
          borderColor="border-violet-100"
        />
        <KpiCard
          label="Total Margin AUD"
          value={summary ? fmtAud(summary.totalMarginAud) : '—'}
          sub="Daily P&L"
          icon={TrendingUp}
          iconColor={summary && summary.totalMarginAud >= 0 ? 'text-emerald-600' : 'text-red-600'}
          bgColor={summary && summary.totalMarginAud >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
          borderColor={summary && summary.totalMarginAud >= 0 ? 'border-emerald-100' : 'border-red-100'}
        />
        <KpiCard
          label="Weighted Avg Margin %"
          value={summary ? fmtPct(summary.weightedMarginPct) : '—'}
          sub="Across all materials"
          icon={Activity}
          iconColor={
            summary
              ? summary.weightedMarginPct >= 20 ? 'text-emerald-600'
              : summary.weightedMarginPct >= 15 ? 'text-amber-600'
              : 'text-red-600'
              : 'text-slate-500'
          }
          bgColor="bg-white"
          borderColor="border-slate-100"
        />
        <KpiCard
          label="At-Risk Materials"
          value={summary ? summary.atRiskCount : '—'}
          sub={summary ? `of ${summary.rows.length} materials` : ''}
          icon={AlertTriangle}
          iconColor={summary && summary.atRiskCount > 0 ? 'text-red-600' : 'text-emerald-600'}
          bgColor={summary && summary.atRiskCount > 0 ? 'bg-red-50' : 'bg-emerald-50'}
          borderColor={summary && summary.atRiskCount > 0 ? 'border-red-100' : 'border-emerald-100'}
        />
      </div>

      {/* ── Exposure Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 bg-slate-900 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">Per-Material Exposure</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Live spot · Consumer rate · Daily volume estimates</p>
          </div>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50">
                <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Material</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Spot (AUD/t)</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Consumer Rate ($/kg)</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Margin %</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden md:table-cell">Daily Vol (kg)</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden md:table-cell">Daily Notional</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden lg:table-cell">Daily P&L</th>
                <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summary ? summary.rows.map(row => (
                <tr key={row.material} className={row.riskFlag ? 'bg-red-50/40' : row.hasOverride ? 'bg-violet-50/30' : ''}>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{row.material}</p>
                    {row.hasOverride && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">OVERRIDE</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-sm text-slate-700">
                    ${row.spot.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-sm font-semibold text-slate-800">
                    ${row.consumerRate.toFixed(4)}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <span className={`text-sm font-bold ${
                      row.marginPct >= 20 ? 'text-emerald-600'
                      : row.marginPct >= 15 ? 'text-amber-600'
                      : 'text-red-600'
                    }`}>
                      {row.marginPct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm text-slate-600 hidden md:table-cell font-mono">
                    {row.volumeKg.toLocaleString()}
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm text-slate-700 hidden md:table-cell font-mono">
                    {fmtAud(row.grossAud)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm hidden lg:table-cell font-mono">
                    <span className={row.marginAud >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {row.marginAud >= 0 ? '+' : ''}{fmtAud(row.marginAud)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <RiskBadge flag={row.riskFlag} />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400 text-sm">Loading market data…</td>
                </tr>
              )}
            </tbody>
            {summary && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-5 py-3 text-sm font-bold text-slate-700">Totals</td>
                  <td colSpan={3} />
                  <td className="px-3 py-3 text-right text-sm font-bold text-slate-700 hidden md:table-cell font-mono">
                    {Object.values(summary.rows).reduce((a, r) => a + r.volumeKg, 0).toLocaleString()} kg
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold text-violet-700 hidden md:table-cell font-mono">
                    {fmtAud(summary.totalNotionalAud)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-bold hidden lg:table-cell font-mono">
                    <span className={summary.totalMarginAud >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                      {summary.totalMarginAud >= 0 ? '+' : ''}{fmtAud(summary.totalMarginAud)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center text-[11px] text-slate-500 font-semibold">
                    {summary.atRiskCount} at risk
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Sparklines ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Margin Sparklines — Last 30 Price Points</h2>
          <p className="text-xs text-slate-400 mt-0.5">Intraday price history per material · Green = up, Red = down</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 divide-x divide-y divide-slate-50">
          {summary ? summary.rows.map(row => (
            <div key={row.material} className="px-4 py-4 flex flex-col items-center gap-2">
              <p className="text-[11px] font-bold text-slate-700 text-center leading-tight">{row.label}</p>
              <Sparkline material={row.material} />
              <p className="text-[10px] font-mono text-slate-500">
                ${row.spot.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          )) : (
            <div className="col-span-7 px-5 py-6 text-center text-slate-400 text-sm">Loading…</div>
          )}
        </div>
      </div>

      {/* ── Active Overrides Panel ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-600" />
              Active Rate Overrides
              {activeOverrideEntries.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full ml-1">
                  {activeOverrideEntries.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Manual rate overrides currently applied to the pricing engine</p>
          </div>
        </div>
        {activeOverrideEntries.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Shield className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-semibold">No active overrides</p>
            <p className="text-xs text-slate-300 mt-1">All materials are using market-derived rates</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {activeOverrideEntries.map(([material, ov]) => {
              const row = summary?.rows.find(r => r.material === material)
              return (
                <div key={material} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{row?.label ?? material}</p>
                      <p className="text-[10px] font-mono text-slate-400">{material}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-right flex-shrink-0">
                    <div>
                      <p className="text-sm font-bold text-violet-700 font-mono">${ov.ratePerKg.toFixed(4)}/kg</p>
                      <p className="text-[10px] text-slate-400">Override rate</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs font-semibold text-slate-700">{ov.actor}</p>
                      <p className="text-[10px] text-slate-400">Set by</p>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-xs font-mono text-slate-500">
                        {new Date(ov.appliedAt).toLocaleTimeString('en-AU')}
                      </p>
                      <p className="text-[10px] text-slate-400">Applied at</p>
                    </div>
                    <button
                      onClick={() => handleClearOverride(material)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors border border-red-100"
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-50 bg-slate-50">
          <p className="text-[11px] text-slate-400">
            Clearing an override returns the material to market-derived consumer rates.
            Override actions are written to the audit log.
          </p>
        </div>
      </div>
    </div>
  )
}
