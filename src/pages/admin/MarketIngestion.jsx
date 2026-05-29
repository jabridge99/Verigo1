import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Wifi, WifiOff, Clock, Database, RefreshCw } from 'lucide-react'
import { COMMODITIES, FX_RATES, FEED_STATUS } from '../../data/pie'

const METAL_ORDER = ['copper', 'aluminium', 'tin', 'nickel', 'gold', 'silver', 'palladium']
const EXCHANGE_COLOR = { LME: 'bg-blue-100 text-blue-700', CME: 'bg-violet-100 text-violet-700' }

function TrendBadge({ pct }) {
  const up = pct >= 0
  const cls = up ? 'text-eco-600 bg-eco-50' : 'text-red-600 bg-red-50'
  const Icon = pct > 0.2 ? TrendingUp : pct < -0.2 ? TrendingDown : Minus
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

function BarSparkline({ value, high, low }) {
  const range = high - low
  const pct = range > 0 ? ((value - low) / range) * 100 : 50
  return (
    <div className="flex items-center gap-2 w-28">
      <span className="text-[9px] text-slate-400 w-8 text-right">{low.toLocaleString()}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full relative">
        <div className="absolute top-0 h-1.5 bg-violet-500 rounded-l-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-slate-400 w-10">{high.toLocaleString()}</span>
    </div>
  )
}

export default function MarketIngestion() {
  const [activeTab, setActiveTab] = useState('metals')
  const metals = METAL_ORDER.map(k => COMMODITIES[k])
  const baseMetals     = metals.filter(m => m.exchange === 'LME')
  const preciousMetals = metals.filter(m => m.exchange === 'CME')

  const staleFeed = FEED_STATUS.find(f => f.status === 'Stale')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Market Ingestion</h1>
          <p className="text-sm text-slate-500 mt-0.5">LME · CME · FX · Scrap feeds · Data source health</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <RefreshCw className="w-4 h-4" /> Force Refresh All
        </button>
      </div>

      {/* Feed health grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEED_STATUS.map(feed => {
          const isLive  = feed.status === 'Live'
          const isStale = feed.status === 'Stale'
          const lastPing = new Date(feed.last_ping)
          const minutesAgo = Math.floor((Date.now() - lastPing) / 60000)
          return (
            <div key={feed.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${isStale ? 'border-amber-200' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isLive ? <Wifi className="w-4 h-4 text-eco-600" /> : <WifiOff className="w-4 h-4 text-amber-500" />}
                  <span className="text-sm font-bold text-slate-900">{feed.label}</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isLive  ? 'bg-eco-100 text-eco-700' :
                  isStale ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>{feed.status}</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Last ping</span>
                  <span className="font-semibold text-slate-700">
                    {minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo/60)}h ago`}
                  </span>
                </div>
                {feed.latency_ms && (
                  <div className="flex justify-between">
                    <span>Latency</span>
                    <span className={`font-semibold ${feed.latency_ms > 2000 ? 'text-amber-600' : 'text-slate-700'}`}>
                      {feed.latency_ms}ms
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Records today</span>
                  <span className="font-semibold text-slate-700">{feed.records_today.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100">
        {[
          { id: 'metals', label: 'Metal Prices' },
          { id: 'fx',     label: 'FX Rates' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >{tab.label}</button>
        ))}
      </div>

      {activeTab === 'metals' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* LME Base Metals */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">LME</span>
              <h2 className="font-bold text-slate-900">Base Metals</h2>
              <span className="text-[11px] text-slate-400 ml-auto">London Metal Exchange · USD/tonne</span>
            </div>
            <div className="divide-y divide-slate-50">
              {baseMetals.map(m => (
                <div key={m.symbol} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{m.name}</span>
                        <span className="text-xs font-mono text-slate-500">{m.symbol}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{m.dominance}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">${m.spot_usd.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-400">AUD ${(m.aud_per_kg).toFixed(2)}/kg</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <BarSparkline value={m.spot_usd} high={m.w52_high} low={m.w52_low} />
                    <div className="flex gap-1.5">
                      <TrendBadge pct={m.change_24h_pct} />
                      <span className="text-[10px] text-slate-400 self-center">24h</span>
                      <TrendBadge pct={m.change_7d_pct} />
                      <span className="text-[10px] text-slate-400 self-center">7d</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <span>3M fwd: <span className="text-slate-600 font-semibold">${m.forward_3m_usd.toLocaleString()}</span></span>
                    <span>52w: <span className="text-slate-600">${m.w52_low.toLocaleString()} – ${m.w52_high.toLocaleString()}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CME Precious Metals */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-violet-100 text-violet-700">CME</span>
              <h2 className="font-bold text-slate-900">Precious Metals</h2>
              <span className="text-[11px] text-slate-400 ml-auto">CME Group · USD/troy oz</span>
            </div>
            <div className="divide-y divide-slate-50">
              {preciousMetals.map(m => (
                <div key={m.symbol} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{m.name}</span>
                        <span className="text-xs font-mono text-slate-500">{m.symbol}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{m.dominance}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">${m.spot_usd.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-400">AUD ${m.aud_per_g.toFixed(2)}/g</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <BarSparkline value={m.spot_usd} high={m.w52_high} low={m.w52_low} />
                    <div className="flex gap-1.5">
                      <TrendBadge pct={m.change_24h_pct} />
                      <span className="text-[10px] text-slate-400 self-center">24h</span>
                      <TrendBadge pct={m.change_7d_pct} />
                      <span className="text-[10px] text-slate-400 self-center">7d</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <span>3M fwd: <span className="text-slate-600 font-semibold">${m.forward_3m_usd.toLocaleString()}</span></span>
                    <span>52w: <span className="text-slate-600">${m.w52_low.toLocaleString()} – ${m.w52_high.toLocaleString()}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fx' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">FX Rates</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              Updated {new Date(FX_RATES.last_updated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })} AEST
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {Object.entries(FX_RATES).filter(([k]) => k !== 'last_updated').map(([pair, data]) => (
              <div key={pair} className="flex items-center gap-4 px-5 py-4">
                <div className="w-24">
                  <p className="text-sm font-bold text-slate-900 font-mono">{pair.replace('_', '/')}</p>
                  <p className="text-[11px] text-slate-400">{data.source}</p>
                </div>
                <p className="text-2xl font-bold text-slate-900 flex-1">{data.rate.toFixed(4)}</p>
                <div className="flex items-center gap-1.5">
                  <TrendBadge pct={(data.change_24h / data.rate) * 100} />
                  <span className="text-[10px] text-slate-400">24h Δ {data.change_24h >= 0 ? '+' : ''}{data.change_24h.toFixed(4)}</span>
                </div>
                {pair === 'USD_AUD' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full">Active conversion rate</span>
                )}
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-slate-50 bg-slate-50">
            <p className="text-xs text-slate-500">
              All commodity prices converted at USD/AUD <span className="font-bold">1.5662</span> for internal pricing calculations.
              FX adjustment buffer: <span className="font-bold">+1.2%</span> applied to hedge intra-day movements.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
