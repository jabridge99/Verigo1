import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle,
  Activity, RefreshCw, Database, Eye, BarChart2, Layers, Zap,
} from 'lucide-react'
import {
  COMMODITIES, PRICING_BOOK, FEED_STATUS, MARKET_ALERTS, PRICING_ENGINE_CONFIG,
} from '../../data/pie'

const METAL_COLORS = {
  copper: 'text-orange-500', aluminium: 'text-slate-400', tin: 'text-sky-400',
  nickel: 'text-lime-500', gold: 'text-amber-400', silver: 'text-slate-300',
  palladium: 'text-violet-400',
}

function TrendIcon({ trend, className = 'w-3.5 h-3.5' }) {
  if (trend === 'up')   return <TrendingUp   className={`${className} text-eco-500`} />
  if (trend === 'down') return <TrendingDown className={`${className} text-red-400`} />
  return <Minus className={`${className} text-slate-400`} />
}

function CommodityTicker() {
  const metals = Object.values(COMMODITIES)
  return (
    <div className="bg-slate-900 rounded-2xl px-4 py-3 overflow-x-auto">
      <div className="flex gap-6 min-w-max">
        {metals.map(m => (
          <div key={m.symbol} className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-bold tracking-wider ${METAL_COLORS[m.symbol.toLowerCase()] || 'text-white'}`}>
              {m.symbol}
            </span>
            <span className="text-sm font-bold text-white">
              {m.unit === 'USD/ozt'
                ? `$${m.spot_usd.toFixed(2)}`
                : `$${m.spot_usd.toLocaleString()}`
              }
            </span>
            <span className={`text-[11px] font-semibold ${m.change_24h_pct >= 0 ? 'text-eco-400' : 'text-red-400'}`}>
              {m.change_24h_pct >= 0 ? '+' : ''}{m.change_24h_pct.toFixed(2)}%
            </span>
            <TrendIcon trend={m.trend} />
            <span className="text-slate-600 text-xs">{m.exchange}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 flex-shrink-0 border-l border-slate-700 pl-6">
          <span className="text-xs text-slate-500 font-semibold">AUD/USD</span>
          <span className="text-sm font-bold text-white">0.6385</span>
          <span className="text-[11px] text-eco-400">+0.0012</span>
        </div>
      </div>
    </div>
  )
}

function FeedHealthChips() {
  return (
    <div className="flex flex-wrap gap-2">
      {FEED_STATUS.map(feed => (
        <div key={feed.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
          feed.status === 'Live'  ? 'border-eco-200 bg-eco-50 text-eco-700' :
          feed.status === 'Stale' ? 'border-amber-200 bg-amber-50 text-amber-700' :
          'border-red-200 bg-red-50 text-red-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            feed.status === 'Live' ? 'bg-eco-500' :
            feed.status === 'Stale' ? 'bg-amber-500' : 'bg-red-500'
          }`} />
          {feed.label}
        </div>
      ))}
    </div>
  )
}

function AlertPanel() {
  const alertColor = {
    high: 'border-red-100 bg-red-50 text-red-700',
    medium: 'border-amber-100 bg-amber-50 text-amber-700',
    low: 'border-eco-100 bg-eco-50 text-eco-700',
  }
  return (
    <div className="space-y-2">
      {MARKET_ALERTS.map(a => (
        <div key={a.id} className={`flex items-start gap-2.5 border rounded-xl px-3 py-2.5 ${alertColor[a.severity]}`}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{a.message}</p>
        </div>
      ))}
    </div>
  )
}

export default function TraderDashboard() {
  const cfg = PRICING_ENGINE_CONFIG
  const marginHealthColor = cfg.margin_status === 'Healthy' ? 'text-eco-700 bg-eco-100' : cfg.margin_status === 'Compressed' ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100'

  const validUntil = new Date(cfg.valid_until).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
  const nextReprice = new Date(cfg.next_reprice).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 bg-violet-600 rounded flex items-center justify-center">
              <BarChart2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Pricing Intelligence Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Trader Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live pricing book · Metal markets · Recovery intelligence</p>
        </div>
        <div className="text-right text-xs text-slate-400 space-y-0.5">
          <p className="font-semibold text-slate-600">Thu 28 May 2026 · AEST</p>
          <p>Valid until <span className="text-slate-700 font-semibold">{validUntil}</span></p>
          <p>Next reprice <span className="text-slate-700 font-semibold">{nextReprice}</span></p>
        </div>
      </div>

      {/* Commodity Ticker */}
      <CommodityTicker />

      {/* Status strip */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FeedHealthChips />
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Margin Health</span>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${marginHealthColor}`}>
            {cfg.margin_status}
          </span>
          <button className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold hover:underline">
            <RefreshCw className="w-3.5 h-3.5" /> Reprice Now
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Live Offer Lines', value: PRICING_BOOK.length, color: 'text-slate-800' },
          { label: 'Feeds Active',     value: `${FEED_STATUS.filter(f => f.status === 'Live').length}/${FEED_STATUS.length}`, color: 'text-eco-700' },
          { label: 'Alerts Open',      value: MARKET_ALERTS.length, color: MARKET_ALERTS.some(a => a.severity === 'high') ? 'text-red-600' : 'text-amber-600' },
          { label: 'Blended FX Rate',  value: 'AUD/USD 0.6385', color: 'text-slate-800' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Live Pricing Book — primary */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-900">
            <h2 className="font-bold text-white">Live Pricing Book</h2>
            <span className="text-[11px] text-slate-400">No internal margins shown — admin pricing view</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50">
                  <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Device Category</th>
                  <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden sm:table-cell">Composition</th>
                  <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Offer (AUD)</th>
                  <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">24h Δ</th>
                  <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {PRICING_BOOK.map(row => (
                  <tr key={row.device} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                      <p className="text-[11px] text-slate-400">{row.unit}</p>
                    </td>
                    <td className="px-3 py-3.5 hidden sm:table-cell">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-full">{row.characterisation}</span>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <p className="text-base font-bold text-slate-900">${row.offer_aud.toFixed(2)}</p>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <span className={`text-xs font-bold ${
                        row.change_aud > 0 ? 'text-eco-600' :
                        row.change_aud < 0 ? 'text-red-500' : 'text-slate-400'
                      }`}>
                        {row.change_aud > 0 ? '+' : ''}{row.change_aud !== 0 ? `$${row.change_aud.toFixed(2)}` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex justify-center">
                        <TrendIcon trend={row.trend} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-slate-50 bg-slate-50">
            <p className="text-[11px] text-slate-400">Prices valid until {validUntil} · Repriced daily at 09:00 AEST from LME, CME, FX, scrap feeds</p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Metal snapshot */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Metal Snapshot</h2>
              <Link to="/admin/market-ingestion" className="text-xs text-violet-600 font-semibold hover:underline">Detail →</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {Object.values(COMMODITIES).map(m => (
                <div key={m.symbol} className="flex items-center gap-3 px-5 py-3">
                  <span className={`w-6 text-xs font-bold ${METAL_COLORS[m.name.toLowerCase()] || 'text-slate-400'}`}>{m.symbol}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700">{m.name}</p>
                    <p className="text-[10px] text-slate-400">{m.exchange} · {m.unit}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-slate-800">
                      ${m.spot_usd.toLocaleString()}
                    </p>
                    <p className={`text-[10px] font-semibold ${m.change_24h_pct >= 0 ? 'text-eco-600' : 'text-red-500'}`}>
                      {m.change_24h_pct >= 0 ? '+' : ''}{m.change_24h_pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50">
              <h2 className="font-bold text-slate-900">Market Alerts</h2>
            </div>
            <div className="p-4">
              <AlertPanel />
            </div>
          </div>
        </div>
      </div>

      {/* PIE module quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { to: '/admin/market-ingestion',    label: 'Market Ingestion',   icon: Database,  color: 'bg-violet-600' },
          { to: '/admin/scrap-pricing',       label: 'Scrap Pricing',      icon: Layers,    color: 'bg-slate-700' },
          { to: '/admin/competitor-intel',    label: 'Competitor Intel',   icon: Eye,       color: 'bg-blue-600' },
          { to: '/admin/sentiment',           label: 'Sentiment Engine',   icon: Activity,  color: 'bg-amber-600' },
          { to: '/admin/composition',         label: 'Composition',        icon: BarChart2, color: 'bg-eco-600' },
          { to: '/admin/pricing-engine',      label: 'Pricing Engine',     icon: Zap,       color: 'bg-red-600' },
        ].map(l => (
          <Link key={l.to} to={l.to}
            className="flex items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 hover:border-violet-200 hover:shadow-md transition-all group">
            <div className={`w-7 h-7 ${l.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <l.icon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 leading-tight">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
