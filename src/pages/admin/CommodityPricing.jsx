import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  TrendingUp, TrendingDown, RefreshCw, Download, Edit3, Save,
  CheckCircle, Zap, Bell, ToggleLeft, ToggleRight, AlertCircle,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import { marketFeed, COMMODITIES, PLATFORM_MARGIN } from '../../lib/marketFeed'

// Map marketFeed materials to display IDs (stable keys for React)
const MATERIAL_IDS = Object.keys(COMMODITIES)

function feedToRow(record, id) {
  return {
    id,
    key: record.material,
    material: record.label,
    grade: record.grade,
    exchange: record.exchange,
    spot: record.spot,
    change: record.change_pct,
    consumerRate: record.consumer_rate,
    margin: record.platform_margin,
  }
}

function buildInitialPrices() {
  return marketFeed.snapshot().map((rec, i) => feedToRow(rec, i + 1))
}

// Build 12-month history for aluminium + PET from feed history
function buildHistory() {
  const alumHist = marketFeed.getHistory('aluminium', 90)
  const petHist  = marketFeed.getHistory('pet_plastic', 90)
  // Sample monthly (every ~7 data points from the last 90 days = ~12 months at daily resolution)
  const step = Math.max(1, Math.floor(alumHist.length / 12))
  const months = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May']
  return months.map((month, i) => {
    const idx = Math.min(i * step, alumHist.length - 1)
    return {
      month,
      alum: alumHist[idx]?.price ?? 2180,
      pet:  petHist[idx]?.price  ?? 320,
      current: i === 11,
    }
  })
}

const AUTO_RULES = [
  {
    id: 1,
    condition: 'If Aluminium spot > $2,500/t',
    action: 'Increase consumer rate by 5%',
    material: 'Aluminium',
    enabled: true,
  },
  {
    id: 2,
    condition: 'If PET Plastic spot < $280/t',
    action: 'Decrease consumer rate by 3%',
    material: 'PET Plastic',
    enabled: true,
  },
  {
    id: 3,
    condition: 'If avg platform margin < 20%',
    action: 'Trigger margin alert to treasury team',
    material: 'All',
    enabled: false,
  },
]

const ALERT_LOG = [
  { id: 1, ts: '27 May 2025, 06:00', material: 'Steel Cans',   dir: 'up',   pct: '+3.1%', note: 'Spot exceeded 30-day avg' },
  { id: 2, ts: '26 May 2025, 06:00', material: 'Paperboard',   dir: 'down', pct: '−1.5%', note: 'Below OCC 7-day floor' },
  { id: 3, ts: '25 May 2025, 06:00', material: 'Aluminium',    dir: 'up',   pct: '+1.8%', note: 'LME uptick — rate auto-adjusted' },
  { id: 4, ts: '23 May 2025, 06:00', material: 'PET Plastic',  dir: 'down', pct: '−0.8%', note: 'Asian market softening' },
  { id: 5, ts: '20 May 2025, 06:00', material: 'Mixed Plastic', dir: 'down', pct: '−0.3%', note: 'Commingled demand drop' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TARGET_MARGIN = 0.25

// SVG chart helpers
const CHART_W = 600
const CHART_H = 160
const CHART_PAD_L = 48
const CHART_PAD_R = 12
const CHART_PAD_T = 12
const CHART_PAD_B = 28

function scaleX(i, total) {
  return CHART_PAD_L + (i / (total - 1)) * (CHART_W - CHART_PAD_L - CHART_PAD_R)
}

function scaleY(val, min, max) {
  return CHART_PAD_T + (1 - (val - min) / (max - min)) * (CHART_H - CHART_PAD_T - CHART_PAD_B)
}

function polyline(data, key, min, max) {
  return data.map((d, i) => `${scaleX(i, data.length)},${scaleY(d[key], min, max)}`).join(' ')
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function SavedToast({ visible }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <CheckCircle className="w-3.5 h-3.5" /> Saved
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CommodityPricing() {
  const [prices, setPrices]           = useState(buildInitialPrices)
  const [history, setHistory]         = useState(buildHistory)
  const [editId, setEditId]           = useState(null)
  const [draftRate, setDraftRate]     = useState('')
  const [savedId, setSavedId]         = useState(null)
  const [rules, setRules]             = useState(AUTO_RULES)
  const [refreshing, setRefreshing]   = useState(false)
  const [lastRefresh, setLastRefresh] = useState(() => new Date().toLocaleString('en-AU'))
  const overridesRef = useRef({})   // materialKey → override consumerRate

  // Subscribe to live market feed
  useEffect(() => {
    marketFeed.start()
    const unsub = marketFeed.subscribe(null, record => {
      setPrices(prev => prev.map(p => {
        if (p.key !== record.material) return p
        const override = overridesRef.current[record.material]
        return {
          ...p,
          spot: record.spot,
          change: record.change_pct,
          consumerRate: override ?? record.consumer_rate,
          margin: record.platform_margin,
        }
      }))
      setLastRefresh(new Date().toLocaleTimeString('en-AU'))
    })
    return unsub
  }, [])

  const startEdit = useCallback((p) => {
    setEditId(p.id)
    setDraftRate(String(p.consumerRate))
    setSavedId(null)
  }, [])

  const saveRate = useCallback((id) => {
    const val = parseFloat(draftRate)
    if (isNaN(val) || val <= 0) return
    setPrices(prev => prev.map(p => {
      if (p.id !== id) return p
      const spotKg = p.spot / 1000
      const newMargin = spotKg > 0 ? Math.max(0, (spotKg - val) / spotKg) : p.margin
      overridesRef.current[p.key] = val
      return { ...p, consumerRate: val, margin: newMargin }
    }))
    setEditId(null)
    setSavedId(id)
    setTimeout(() => setSavedId(null), 2200)
  }, [draftRate])

  const toggleRule = useCallback((id) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }, [])

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      setHistory(buildHistory())
      setLastRefresh(new Date().toLocaleTimeString('en-AU'))
    }, 800)
  }

  const avgMargin = prices.reduce((a, p) => a + p.margin, 0) / prices.length
  const nonZero = prices.filter(p => p.change !== 0)
  const weightedChangePct = nonZero.length
    ? nonZero.reduce((a, p) => a + p.change, 0) / nonZero.length
    : 0
  const bestMaterial = prices.reduce((a, b) => (b.change > a.change ? b : a), prices[0])

  const SUMMARY_CARDS = [
    {
      label: 'Best Performing',
      value: bestMaterial.material,
      sub: `${bestMaterial.change >= 0 ? '+' : ''}${bestMaterial.change.toFixed(2)}% today`,
      icon: TrendingUp,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Avg Platform Margin',
      value: `${(avgMargin * 100).toFixed(1)}%`,
      sub: `Target: ${(TARGET_MARGIN * 100).toFixed(0)}%`,
      icon: Zap,
      color: avgMargin >= TARGET_MARGIN ? 'text-violet-700' : 'text-red-600',
      bg: avgMargin >= TARGET_MARGIN ? 'bg-violet-50' : 'bg-red-50',
    },
    {
      label: 'Live Feed',
      value: marketFeed.isRunning ? 'Active' : 'Paused',
      sub: `Last tick: ${lastRefresh}`,
      icon: RefreshCw,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      label: 'Market Movement',
      value: `${weightedChangePct > 0 ? '+' : ''}${weightedChangePct.toFixed(2)}%`,
      sub: 'Weighted avg today',
      icon: weightedChangePct >= 0 ? TrendingUp : TrendingDown,
      color: weightedChangePct >= 0 ? 'text-emerald-700' : 'text-red-600',
      bg: weightedChangePct >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commodity Pricing Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live commodity feed · Consumer rate cards · Automated margin management
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-violet-500' : ''}`} />
            Updated {lastRefresh}
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full tracking-wide">
            AUTO-SYNC: ON
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 border border-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-xl text-xs hover:border-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-2 rounded-xl text-xs transition-colors">
            <Download className="w-3.5 h-3.5" /> Export Rate Card
          </button>
        </div>
      </div>

      {/* ── 4-card summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SUMMARY_CARDS.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon style={{ width: 18, height: 18 }} className={c.color} />
              </div>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs font-semibold text-slate-600 mt-0.5">{c.label}</div>
              <div className="text-[11px] text-slate-400">{c.sub}</div>
            </div>
          )
        })}
      </div>

      {/* ── Live prices table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-900">Live Prices &amp; Consumer Rate Cards</h2>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full tracking-widest">
              LIVE
            </span>
          </div>
          <span className="text-xs text-slate-400">Click Edit to modify consumer rate per material</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Material', 'Grade', 'Spot (AUD/t)', '24h Change', 'Consumer Rate ($/kg)', 'Margin %', 'Derived $/kg', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {prices.map(p => {
                const derivedPerKg = p.consumerRate
                const isEditing = editId === p.id
                return (
                  <tr key={p.id} className={`hover:bg-slate-50/60 transition-colors ${isEditing ? 'bg-violet-50/30' : ''}`}>
                    <td className="px-5 py-4 font-semibold text-slate-900 whitespace-nowrap">{p.material}</td>
                    <td className="px-5 py-4 text-slate-400 text-xs whitespace-nowrap">{p.grade}</td>
                    <td className="px-5 py-4 font-bold text-slate-900">${p.spot.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      {p.change === 0 ? (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Minus className="w-3.5 h-3.5" /> —
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1 text-xs font-semibold ${
                          p.change > 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {p.change > 0
                            ? <ArrowUpRight className="w-3.5 h-3.5" />
                            : <ArrowDownRight className="w-3.5 h-3.5" />
                          }
                          {p.change > 0 ? '+' : ''}{p.change}%
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-xs">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={draftRate}
                            autoFocus
                            onChange={e => setDraftRate(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveRate(p.id) }}
                            className="w-20 border border-violet-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <span className="text-slate-400 text-xs">/kg</span>
                        </div>
                      ) : (
                        <span className="font-bold text-violet-700">
                          ${p.consumerRate.toFixed(2)}/kg
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-bold ${
                        p.margin >= TARGET_MARGIN ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {(p.margin * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      ${derivedPerKg.toFixed(4)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {savedId === p.id && <SavedToast visible={savedId === p.id} />}
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveRate(p.id)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <Save className="w-3 h-3" /> Save
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="text-xs text-slate-400 hover:text-slate-700 transition-colors px-1"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Historical price chart — SVG dual-line */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Price History — 12 Months</h2>
              <p className="text-xs text-slate-400 mt-0.5">AUD per tonne · LME / ASX feed</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-violet-700">
                <span className="w-8 h-0.5 bg-violet-600 inline-block rounded" /> Aluminium
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-600">
                <span className="w-8 h-0.5 bg-amber-400 inline-block rounded" /> PET (×10)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="w-full"
              style={{ minWidth: 320 }}
              preserveAspectRatio="none"
            >
              {/* Y grid lines (use live history range) */}
              {(() => {
                const aMin = Math.min(...history.map(h => h.alum)) - 50
                const aMax = Math.max(...history.map(h => h.alum)) + 50
                return [0, 0.25, 0.5, 0.75, 1].map(t => {
                  const y = CHART_PAD_T + t * (CHART_H - CHART_PAD_T - CHART_PAD_B)
                  const alumVal = aMax - t * (aMax - aMin)
                  return (
                    <g key={t}>
                      <line x1={CHART_PAD_L} y1={y} x2={CHART_W - CHART_PAD_R} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                      <text x={CHART_PAD_L - 4} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="9">
                        ${Math.round(alumVal / 100) * 100}
                      </text>
                    </g>
                  )
                })
              })()}

              {/* Aluminium fill */}
              <defs>
                <linearGradient id="alumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="petGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Chart uses history state (live OU data) */}
              {(() => {
                const alumMin = Math.min(...history.map(h => h.alum)) - 50
                const alumMax = Math.max(...history.map(h => h.alum)) + 50
                const petMin  = Math.min(...history.map(h => h.pet))  - 20
                const petMax  = Math.max(...history.map(h => h.pet))  + 20
                return (
                  <>
                    {/* Area fill */}
                    <polygon
                      points={`${scaleX(0, history.length)},${CHART_H - CHART_PAD_B} ${history.map((d, i) => `${scaleX(i, history.length)},${scaleY(d.alum, alumMin, alumMax)}`).join(' ')} ${scaleX(history.length - 1, history.length)},${CHART_H - CHART_PAD_B}`}
                      fill="url(#alumGrad)"
                    />
                    {/* Aluminium line */}
                    <polyline
                      points={history.map((d, i) => `${scaleX(i, history.length)},${scaleY(d.alum, alumMin, alumMax)}`).join(' ')}
                      fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round"
                    />
                    {/* PET line scaled onto alum axis */}
                    <polyline
                      points={history.map((d, i) => {
                        const pct = (d.pet - petMin) / (petMax - petMin)
                        const alumMapped = alumMin + pct * (alumMax - alumMin)
                        return `${scaleX(i, history.length)},${scaleY(alumMapped, alumMin, alumMax)}`
                      }).join(' ')}
                      fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" strokeLinejoin="round"
                    />
                    {/* Current month dot */}
                    <circle
                      cx={scaleX(history.length - 1, history.length)}
                      cy={scaleY(history[history.length - 1]?.alum ?? alumMax, alumMin, alumMax)}
                      r="4" fill="#7c3aed" stroke="white" strokeWidth="2"
                    />
                    {/* X labels */}
                    {history.map((d, i) => (
                      <text key={i} x={scaleX(i, history.length)} y={CHART_H - 4} textAnchor="middle"
                        fill={d.current ? '#7c3aed' : '#94a3b8'} fontSize="9" fontWeight={d.current ? 700 : 400}>
                        {d.month}
                      </text>
                    ))}
                  </>
                )
              })()}
            </svg>
          </div>

          <p className="text-[11px] text-slate-400 mt-2">
            PET axis scaled for readability · Aluminium left axis · Auto-adjusted daily at 06:00 AEST
          </p>
        </div>

        {/* Margin analysis bar chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Margin Analysis</h2>
              <p className="text-xs text-slate-400 mt-0.5">Platform margin % per material · Target {(TARGET_MARGIN * 100).toFixed(0)}%</p>
            </div>
          </div>

          <div className="space-y-3">
            {prices.map(p => {
              const pct = p.margin * 100
              const atTarget = pct >= TARGET_MARGIN * 100
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-28 text-xs font-medium text-slate-600 truncate flex-shrink-0">{p.material}</div>
                  <div className="flex-1 relative h-5 bg-slate-100 rounded-full overflow-visible">
                    {/* Target line */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-violet-400 z-10"
                      style={{ left: `${TARGET_MARGIN * 100}%` }}
                    />
                    {/* Bar */}
                    <div
                      className={`h-full rounded-full transition-all ${atTarget ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className={`w-12 text-right text-xs font-bold flex-shrink-0 ${atTarget ? 'text-emerald-600' : 'text-red-500'}`}>
                    {pct.toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-400 inline-block" /> At or above target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-400 inline-block" /> Below target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-px h-3 bg-violet-400 inline-block" /> Target ({(TARGET_MARGIN * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>

      {/* ── Auto-pricing rules ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-50 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Auto-Pricing Rules</h2>
              <p className="text-xs text-slate-400 mt-0.5">Automated rate adjustments based on market conditions</p>
            </div>
          </div>
          <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full">
            {rules.filter(r => r.enabled).length} active
          </span>
        </div>
        <div className="divide-y divide-slate-50">
          {rules.map(rule => (
            <div key={rule.id} className={`flex items-center gap-4 px-6 py-4 ${!rule.enabled ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{rule.condition}</span>
                  <span className="text-slate-300">→</span>
                  <span className="text-sm text-slate-600">{rule.action}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Material: {rule.material}</div>
              </div>
              <button
                onClick={() => toggleRule(rule.id)}
                className={`flex-shrink-0 transition-colors ${rule.enabled ? 'text-violet-600 hover:text-violet-800' : 'text-slate-300 hover:text-slate-500'}`}
              >
                {rule.enabled
                  ? <ToggleRight className="w-8 h-8" />
                  : <ToggleLeft className="w-8 h-8" />
                }
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Price alert log ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50">
          <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
            <Bell className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Price Alert Log</h2>
            <p className="text-xs text-slate-400 mt-0.5">Last 5 automatic price events</p>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {ALERT_LOG.map(a => (
            <div key={a.id} className="flex items-start gap-4 px-6 py-3.5">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                a.dir === 'up' ? 'bg-emerald-50' : 'bg-red-50'
              }`}>
                {a.dir === 'up'
                  ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                  : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{a.material}</span>
                  <span className={`text-xs font-bold ${a.dir === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {a.pct}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{a.note}</div>
              </div>
              <div className="text-[11px] text-slate-400 flex-shrink-0 mt-0.5">{a.ts}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
