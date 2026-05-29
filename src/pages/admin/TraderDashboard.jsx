import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle,
  Activity, RefreshCw, Database, Eye, BarChart2, Layers, Zap,
  DollarSign, ShieldAlert, Clock, ArrowUpRight, ArrowDownRight,
  BookOpen, ChevronsUpDown, Gauge,
} from 'lucide-react'
import {
  COMMODITIES, PRICING_BOOK, FEED_STATUS, MARKET_ALERTS, PRICING_ENGINE_CONFIG,
} from '../../data/pie'

// ─── static trading data ─────────────────────────────────────────────────────

const TICKER_DATA = [
  { sym: 'CU',  name: 'Copper',    price: 9842.50,  chg: +1.24,  unit: 'USD/t' },
  { sym: 'AL',  name: 'Aluminium', price: 2318.00,  chg: -0.47,  unit: 'USD/t' },
  { sym: 'NI',  name: 'Nickel',    price: 17640.00, chg: +2.11,  unit: 'USD/t' },
  { sym: 'SN',  name: 'Tin',       price: 31250.00, chg: -0.83,  unit: 'USD/t' },
  { sym: 'ZN',  name: 'Zinc',      price: 2765.00,  chg: +0.32,  unit: 'USD/t' },
  { sym: 'AU',  name: 'Gold',      price: 2341.80,  chg: +0.61,  unit: 'USD/ozt' },
  { sym: 'AG',  name: 'Silver',    price: 29.42,    chg: -0.19,  unit: 'USD/ozt' },
  { sym: 'PD',  name: 'Palladium', price: 1042.00,  chg: +1.88,  unit: 'USD/ozt' },
  { sym: 'AUD', name: 'AUD/USD',   price: 0.6385,   chg: +0.19,  unit: 'FX' },
  { sym: 'LME', name: 'LME Index', price: 3821.4,   chg: +0.74,  unit: 'Index' },
]

const POSITION_BOOK = [
  { commodity: 'Copper',    position: 42.8,  avgBuy: 9710,   market: 9842, limit: 120, currency: 'USD/t' },
  { commodity: 'Aluminium', position: 118.4, avgBuy: 2290,   market: 2318, limit: 300, currency: 'USD/t' },
  { commodity: 'Nickel',    position: 18.2,  avgBuy: 17100,  market: 17640, limit: 60, currency: 'USD/t' },
  { commodity: 'Tin',       position: 8.6,   avgBuy: 31800,  market: 31250, limit: 30, currency: 'USD/t' },
  { commodity: 'Gold',      position: 0.42,  avgBuy: 2295,   market: 2341, limit: 2,  currency: 'USD/ozt' },
  { commodity: 'Silver',    position: 12.4,  avgBuy: 28.90,  market: 29.42, limit: 40, currency: 'USD/ozt' },
]

const TRADE_HISTORY = [
  { id: 'T-2094', ts: '09:42:18', commodity: 'Copper',    action: 'BUY',  tonnes: 4.2,  price: 9838,   total: 41320 },
  { id: 'T-2093', ts: '09:31:05', commodity: 'Aluminium', action: 'SELL', tonnes: 12.0, price: 2324,   total: 27888 },
  { id: 'T-2092', ts: '09:18:44', commodity: 'Nickel',    action: 'BUY',  tonnes: 2.5,  price: 17580,  total: 43950 },
  { id: 'T-2091', ts: '08:55:11', commodity: 'Tin',       price: 31200,   action: 'SELL', tonnes: 1.8, total: 56160 },
  { id: 'T-2090', ts: '08:47:30', commodity: 'Copper',    action: 'BUY',  tonnes: 6.0,  price: 9795,   total: 58770 },
  { id: 'T-2089', ts: '08:33:22', commodity: 'Gold',      action: 'SELL', tonnes: 0.08, price: 2338,   total: 18704 },
  { id: 'T-2088', ts: '08:20:47', commodity: 'Silver',    action: 'BUY',  tonnes: 3.2,  price: 28.95,  total: 92640 },
  { id: 'T-2087', ts: '07:58:14', commodity: 'Aluminium', action: 'BUY',  tonnes: 24.0, price: 2298,   total: 55152 },
  { id: 'T-2086', ts: '07:41:09', commodity: 'Nickel',    action: 'SELL', tonnes: 3.0,  price: 17420,  total: 52260 },
  { id: 'T-2085', ts: '07:30:00', commodity: 'Copper',    action: 'BUY',  tonnes: 8.0,  price: 9680,   total: 77440 },
]

const DEPTH_DATA = [
  { commodity: 'Copper',    bid: 9839.50, ask: 9843.00, bidVol: 84,  askVol: 61  },
  { commodity: 'Aluminium', bid: 2316.50, ask: 2319.00, bidVol: 220, askVol: 195 },
  { commodity: 'Nickel',    bid: 17632,   ask: 17648,   bidVol: 32,  askVol: 28  },
  { commodity: 'Tin',       bid: 31235,   ask: 31265,   bidVol: 18,  askVol: 14  },
  { commodity: 'Gold',      bid: 2340.90, ask: 2342.40, bidVol: 12,  askVol: 9   },
  { commodity: 'Silver',    bid: 29.38,   ask: 29.46,   bidVol: 310, askVol: 290 },
]

const PNL_DATA = {
  realized_today: 18420,
  unrealized: 24810,
  pnl_24h: 6280,
  pnl_24h_pct: 1.84,
  pnl_mtd: 142600,
  pnl_mtd_pct: 4.21,
  total_exposure: 892400,
  margin_used: 284000,
}

const RISK_LIMITS = [
  { commodity: 'Copper',    exposure: 421300, limit: 800000 },
  { commodity: 'Aluminium', exposure: 274200, limit: 600000 },
  { commodity: 'Nickel',    exposure: 321000, limit: 400000 },
  { commodity: 'Tin',       exposure: 268700, limit: 300000 },
  { commodity: 'Gold',      exposure: 981000, limit: 1000000 },
  { commodity: 'Silver',    position: 12.4,   exposure: 365000, limit: 500000 },
]

// ─── helper components ────────────────────────────────────────────────────────

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

// ─── Animated Ticker Strip ────────────────────────────────────────────────────

function LiveTickerStrip() {
  const [tick, setTick] = useState(0)
  const [offsets, setOffsets] = useState(() => TICKER_DATA.map(() => 0))

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1)
      setOffsets(prev => prev.map(o => o + (Math.random() - 0.51) * 0.04))
    }, 1800)
    return () => clearInterval(id)
  }, [])

  const doubles = [...TICKER_DATA, ...TICKER_DATA]

  return (
    <div className="bg-slate-900 rounded-2xl px-0 py-0 overflow-hidden relative">
      <div className="flex items-center">
        <div className="flex-shrink-0 bg-amber-500 text-slate-900 text-[10px] font-black px-3 py-3.5 tracking-widest uppercase z-10 select-none">
          LIVE
        </div>
        <div className="overflow-hidden flex-1">
          <div
            className="flex gap-0 transition-transform"
            style={{ transform: `translateX(-${(tick % TICKER_DATA.length) * (100 / TICKER_DATA.length)}%)`, width: `${doubles.length * 160}px` }}
          >
            {doubles.map((t, i) => {
              const adj = offsets[i % TICKER_DATA.length] || 0
              const displayChg = (t.chg + adj).toFixed(2)
              const isPos = parseFloat(displayChg) >= 0
              return (
                <div key={i} className="w-40 flex-shrink-0 flex items-center gap-2 px-4 py-3 border-r border-slate-800">
                  <span className="text-[11px] font-black text-white tracking-wide">{t.sym}</span>
                  <span className="text-xs font-bold text-slate-200">{t.price.toLocaleString(undefined, { minimumFractionDigits: t.price < 100 ? 2 : 0 })}</span>
                  <span className={`text-[10px] font-bold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPos ? '+' : ''}{displayChg}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 px-4 border-l border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-slate-400 font-semibold">LME · CME · LBMA</span>
        </div>
      </div>
    </div>
  )
}

// ─── Portfolio P&L Card ───────────────────────────────────────────────────────

function PnLCard() {
  const d = PNL_DATA
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-50 flex items-center gap-2 bg-slate-900">
        <DollarSign className="w-4 h-4 text-amber-400" />
        <h2 className="font-bold text-white text-sm">Portfolio P&amp;L</h2>
        <span className="ml-auto text-[10px] text-slate-400">AUD · Today 09:42 AEST</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-50">
        {[
          { label: 'Realized Today',   value: `+$${d.realized_today.toLocaleString()}`, color: 'text-emerald-600' },
          { label: 'Unrealized',        value: `+$${d.unrealized.toLocaleString()}`,     color: 'text-emerald-600' },
          { label: '24h P&L',           value: `+$${d.pnl_24h.toLocaleString()}`,        sub: `+${d.pnl_24h_pct}%`, color: 'text-emerald-600' },
          { label: 'MTD P&L',           value: `+$${d.pnl_mtd.toLocaleString()}`,        sub: `+${d.pnl_mtd_pct}%`, color: 'text-emerald-600' },
        ].map(item => (
          <div key={item.label} className="px-5 py-4">
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            {item.sub && <p className="text-[11px] text-emerald-500 font-semibold">{item.sub}</p>}
            <p className="text-[11px] text-slate-400 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-50 border-t border-slate-50">
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">Total Exposure</span>
          <span className="text-sm font-bold text-slate-800">${d.total_exposure.toLocaleString()}</span>
        </div>
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">Margin Used</span>
          <span className="text-sm font-bold text-amber-700">${d.margin_used.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Position Book Table ──────────────────────────────────────────────────────

function PositionBook() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-white text-sm">Position Book</h2>
        </div>
        <span className="text-[10px] text-slate-400">Live · as of 09:42 AEST</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50">
              <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Commodity</th>
              <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Position (t)</th>
              <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Avg Buy</th>
              <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Market</th>
              <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Unreal. P&L</th>
              <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Exp. Limit</th>
              <th className="text-right px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {POSITION_BOOK.map(row => {
              const pnl = (row.market - row.avgBuy) * row.position
              const exposure = row.market * row.position
              const util = Math.round((exposure / (row.limit * 1000)) * 100)
              const utilColor = util >= 85 ? 'text-red-600' : util >= 65 ? 'text-amber-600' : 'text-emerald-600'
              return (
                <tr key={row.commodity} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-slate-900">{row.commodity}</p>
                    <p className="text-[10px] text-slate-400">{row.currency}</p>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <span className="text-sm font-bold text-slate-800">{row.position.toFixed(1)}</span>
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs text-slate-600 font-mono">
                    {row.avgBuy.toLocaleString()}
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs font-mono font-bold text-slate-800">
                    {row.market.toLocaleString()}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <span className={`text-xs font-bold ${pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {pnl >= 0 ? '+' : ''}${Math.round(pnl).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs text-slate-500 font-mono">
                    ${(row.limit * 1000).toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${util >= 85 ? 'bg-red-400' : util >= 65 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(util, 100)}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold w-8 text-right ${utilColor}`}>{util}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Market Depth Indicator ───────────────────────────────────────────────────

function MarketDepth() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-50 flex items-center gap-2">
        <ChevronsUpDown className="w-4 h-4 text-violet-500" />
        <h2 className="font-bold text-slate-900 text-sm">Market Depth — Bid/Ask Spread</h2>
      </div>
      <div className="divide-y divide-slate-50">
        {DEPTH_DATA.map(row => {
          const spread = row.ask - row.bid
          const spreadPct = ((spread / row.bid) * 100).toFixed(3)
          const totalVol = row.bidVol + row.askVol
          const bidPct = Math.round((row.bidVol / totalVol) * 100)
          const askPct = 100 - bidPct
          return (
            <div key={row.commodity} className="px-5 py-3 flex items-center gap-4">
              <span className="text-xs font-bold text-slate-800 w-20 flex-shrink-0">{row.commodity}</span>
              <div className="flex-1 flex items-center gap-1">
                {/* Bid bar */}
                <div className="flex items-center gap-1 flex-1 justify-end">
                  <span className="text-[10px] text-emerald-600 font-semibold font-mono">{row.bid.toLocaleString()}</span>
                  <div className="h-5 bg-emerald-100 rounded-l" style={{ width: `${bidPct * 0.7}%`, minWidth: '8px' }} title={`${row.bidVol}t`} />
                </div>
                {/* Spread label */}
                <div className="flex-shrink-0 px-2 text-center">
                  <p className="text-[9px] font-bold text-slate-500">{spreadPct}%</p>
                  <p className="text-[8px] text-slate-400">spread</p>
                </div>
                {/* Ask bar */}
                <div className="flex items-center gap-1 flex-1">
                  <div className="h-5 bg-red-100 rounded-r" style={{ width: `${askPct * 0.7}%`, minWidth: '8px' }} title={`${row.askVol}t`} />
                  <span className="text-[10px] text-red-500 font-semibold font-mono">{row.ask.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-[10px] text-slate-400">
                  <span className="text-emerald-600 font-semibold">{row.bidVol}t</span>
                  {' / '}
                  <span className="text-red-500 font-semibold">{row.askVol}t</span>
                </p>
                <p className="text-[9px] text-slate-400">bid / ask vol</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Trade History ────────────────────────────────────────────────────────────

function TradeHistory() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-white text-sm">Recent Trades</h2>
        </div>
        <span className="text-[10px] text-slate-400">Last 10 · Thu 29 May</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50">
              <th className="text-left px-5 py-2.5 text-[11px] text-slate-400 font-semibold uppercase">Trade ID</th>
              <th className="text-left px-3 py-2.5 text-[11px] text-slate-400 font-semibold uppercase">Time</th>
              <th className="text-left px-3 py-2.5 text-[11px] text-slate-400 font-semibold uppercase">Commodity</th>
              <th className="text-center px-3 py-2.5 text-[11px] text-slate-400 font-semibold uppercase">Side</th>
              <th className="text-right px-3 py-2.5 text-[11px] text-slate-400 font-semibold uppercase">Tonnes</th>
              <th className="text-right px-3 py-2.5 text-[11px] text-slate-400 font-semibold uppercase">Price</th>
              <th className="text-right px-5 py-2.5 text-[11px] text-slate-400 font-semibold uppercase">Total USD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {TRADE_HISTORY.map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-5 py-2.5">
                  <span className="text-[11px] font-mono font-semibold text-violet-700">{t.id}</span>
                </td>
                <td className="px-3 py-2.5 text-[11px] font-mono text-slate-500">{t.ts}</td>
                <td className="px-3 py-2.5 text-xs font-semibold text-slate-800">{t.commodity}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    t.action === 'BUY'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}>{t.action}</span>
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-mono text-slate-700">{t.tonnes}</td>
                <td className="px-3 py-2.5 text-right text-xs font-mono text-slate-700">{t.price.toLocaleString()}</td>
                <td className="px-5 py-2.5 text-right text-xs font-bold text-slate-900">
                  ${t.total.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Risk Limits Panel ────────────────────────────────────────────────────────

function RiskLimits() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-50 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-violet-600" />
        <h2 className="font-bold text-slate-900 text-sm">Risk Exposure Limits</h2>
      </div>
      <div className="divide-y divide-slate-50">
        {RISK_LIMITS.map(row => {
          const pct = Math.round((row.exposure / row.limit) * 100)
          const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'
          const textColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600'
          const badge = pct >= 90 ? 'BREACH RISK' : pct >= 70 ? 'ELEVATED' : 'NORMAL'
          const badgeBg = pct >= 90 ? 'bg-red-100 text-red-700' : pct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
          return (
            <div key={row.commodity} className="px-5 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{row.commodity}</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${badgeBg}`}>{badge}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">
                    ${row.exposure.toLocaleString()} / ${row.limit.toLocaleString()}
                  </span>
                  <span className={`text-xs font-bold ${textColor}`}>{pct}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-5 py-3 border-t border-slate-50 bg-slate-50 flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Normal &lt;70%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Elevated 70–89%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Breach Risk ≥90%</span>
      </div>
    </div>
  )
}

// ─── legacy sub-components (from original) ───────────────────────────────────

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
    high:   'border-red-100 bg-red-50 text-red-700',
    medium: 'border-amber-100 bg-amber-50 text-amber-700',
    low:    'border-eco-100 bg-eco-50 text-eco-700',
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TraderDashboard() {
  const cfg = PRICING_ENGINE_CONFIG
  const marginHealthColor = cfg.margin_status === 'Healthy'
    ? 'text-eco-700 bg-eco-100'
    : cfg.margin_status === 'Compressed'
    ? 'text-amber-700 bg-amber-100'
    : 'text-red-700 bg-red-100'

  const validUntil  = new Date(cfg.valid_until).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
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
          <p className="font-semibold text-slate-600">Thu 29 May 2026 · AEST</p>
          <p>Valid until <span className="text-slate-700 font-semibold">{validUntil}</span></p>
          <p>Next reprice <span className="text-slate-700 font-semibold">{nextReprice}</span></p>
        </div>
      </div>

      {/* Live Ticker Strip */}
      <LiveTickerStrip />

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
          { label: 'Live Offer Lines', value: PRICING_BOOK.length,          color: 'text-slate-800' },
          { label: 'Feeds Active',     value: `${FEED_STATUS.filter(f => f.status === 'Live').length}/${FEED_STATUS.length}`, color: 'text-eco-700' },
          { label: 'Alerts Open',      value: MARKET_ALERTS.length,          color: MARKET_ALERTS.some(a => a.severity === 'high') ? 'text-red-600' : 'text-amber-600' },
          { label: 'Blended FX Rate',  value: 'AUD/USD 0.6385',              color: 'text-slate-800' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Portfolio P&L */}
      <PnLCard />

      {/* Position Book */}
      <PositionBook />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Live Pricing Book */}
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
                    <p className="text-xs font-bold text-slate-800">${m.spot_usd.toLocaleString()}</p>
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

      {/* Market Depth */}
      <MarketDepth />

      {/* Trade History */}
      <TradeHistory />

      {/* Risk Limits */}
      <RiskLimits />

      {/* PIE module quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { to: '/admin/market-ingestion', label: 'Market Ingestion',  icon: Database,  color: 'bg-violet-600' },
          { to: '/admin/scrap-pricing',    label: 'Scrap Pricing',     icon: Layers,    color: 'bg-slate-700' },
          { to: '/admin/competitor-intel', label: 'Competitor Intel',  icon: Eye,       color: 'bg-blue-600' },
          { to: '/admin/sentiment',        label: 'Sentiment Engine',  icon: Activity,  color: 'bg-amber-600' },
          { to: '/admin/composition',      label: 'Composition',       icon: BarChart2, color: 'bg-eco-600' },
          { to: '/admin/pricing-engine',   label: 'Pricing Engine',    icon: Zap,       color: 'bg-red-600' },
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
