import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Zap, AlertTriangle, CheckCircle, Play } from 'lucide-react'
import { PRICING_ENGINE_CONFIG, DEVICE_COMPOSITIONS, COMMODITIES, MARGIN_HISTORY } from '../../data/pie'

// ADMIN-ONLY PAGE — internal margin logic visible here intentionally
// Never expose this page or PRICING_ENGINE_CONFIG to consumers or operators.

const DEVICE_LABELS = {
  smartphone: 'Smartphone', laptop: 'Laptop', desktop: 'Desktop PC',
  tablet: 'Tablet', tv_monitor: 'TV / Monitor', large_appliance: 'Large Appliance',
  mixed_ewaste: 'Mixed E-Waste',
}

function TrendIcon({ trend }) {
  if (trend === 'up')   return <TrendingUp   className="w-4 h-4 text-eco-500" />
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />
  return <Minus className="w-4 h-4 text-slate-400" />
}

function MarginBar({ pct, min, max }) {
  const inBand = pct >= min && pct <= max
  const barLeft  = (min / 50) * 100
  const barWidth = ((max - min) / 50) * 100
  const dot = (pct / 50) * 100
  return (
    <div className="relative w-full">
      <div className="h-2 bg-slate-100 rounded-full overflow-visible relative">
        {/* Target band */}
        <div className="absolute top-0 h-full bg-eco-200 rounded-full" style={{ left: `${barLeft}%`, width: `${barWidth}%` }} />
        {/* Actual dot */}
        <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${inBand ? 'bg-eco-600' : 'bg-red-500'}`}
          style={{ left: `${Math.min(100, Math.max(0, dot))}%`, transform: 'translate(-50%, -50%)' }} />
      </div>
      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
        <span>0%</span>
        <span className="text-eco-600 font-semibold">{min}% — {max}% target</span>
        <span>50%</span>
      </div>
    </div>
  )
}

function WeeklyMarginChart({ data }) {
  const max = Math.max(...data.realised, data.target_max[0])
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 h-20">
        {data.realised.map((v, i) => {
          const isLast = i === data.realised.length - 1
          const inBand = v >= data.target_min[i] && v <= data.target_max[i]
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className={`w-full rounded-sm ${isLast ? 'opacity-100' : 'opacity-60'} ${inBand ? 'bg-eco-500' : 'bg-red-400'}`}
                style={{ height: `${(v / max) * 80}px` }} />
              <span className="text-[9px] text-slate-400 mt-1">{data.weeks[i]}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-eco-500 rounded-sm inline-block" />In-band</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-400 rounded-sm inline-block" />Out of band</span>
      </div>
    </div>
  )
}

export default function DynamicPricing() {
  const cfg = PRICING_ENGINE_CONFIG
  const [marginMin, setMarginMin] = useState(cfg.target_margin_min_pct)
  const [marginMax, setMarginMax] = useState(cfg.target_margin_max_pct)
  const [published, setPublished] = useState(false)

  const overallInBand = cfg.book.every(b => b.margin_pct >= marginMin && b.margin_pct <= marginMax)
  const outOfBandItems = cfg.book.filter(b => b.margin_pct < marginMin || b.margin_pct > marginMax)

  return (
    <div className="space-y-6">
      {/* ADMIN WARNING */}
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-red-700">
          <span className="font-bold">RESTRICTED — Admin Only.</span> This page contains internal margin targets and recovery value computations.
          Do NOT share, screenshot, or expose to consumers, operators, or external parties. Margin data is commercially sensitive.
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dynamic Pricing Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">Recovery value model · Margin parameters · Live pricing book generation</p>
        </div>
        <button
          onClick={() => setPublished(true)}
          className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Play className="w-4 h-4" /> Publish Pricing Book
        </button>
      </div>

      {published && (
        <div className="flex items-center gap-3 bg-eco-50 border border-eco-200 rounded-2xl px-4 py-3">
          <CheckCircle className="w-4 h-4 text-eco-600" />
          <p className="text-sm text-eco-700 font-semibold">Pricing book published — valid until {new Date(cfg.valid_until).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })} AEST</p>
        </div>
      )}

      {/* Engine parameters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-violet-600" />
          <h2 className="font-bold text-slate-900">Engine Parameters</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Margin band */}
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-semibold text-slate-500 mb-3">Target Margin Band</p>
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[11px] text-slate-400 block mb-1">Min %</label>
                <input type="number" value={marginMin} onChange={e => setMarginMin(Number(e.target.value))} min="0" max="100"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div className="flex-1">
                <label className="text-[11px] text-slate-400 block mb-1">Max %</label>
                <input type="number" value={marginMax} onChange={e => setMarginMax(Number(e.target.value))} min="0" max="100"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
            </div>
          </div>

          {/* Adjustments */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-3">Active Adjustments</p>
            <div className="space-y-2">
              {[
                { label: 'FX Buffer',         value: `+${cfg.fx_adjustment_pct}%`,         color: 'text-slate-700' },
                { label: 'Logistics Buffer',  value: `+${cfg.logistics_buffer_pct}%`,      color: 'text-slate-700' },
                { label: 'Sentiment Uplift',  value: `+${cfg.sentiment_adjustment_pct}%`,  color: 'text-eco-700' },
              ].map(adj => (
                <div key={adj.label} className="flex justify-between text-xs">
                  <span className="text-slate-500">{adj.label}</span>
                  <span className={`font-semibold ${adj.color}`}>{adj.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Current blended margin */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-3">Blended Realised Margin</p>
            <p className="text-3xl font-bold text-slate-900">{cfg.current_margin_pct}%</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Target: {marginMin}% – {marginMax}%</p>
            <div className="mt-2">
              <MarginBar pct={cfg.current_margin_pct} min={marginMin} max={marginMax} />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {outOfBandItems.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700">
            <span className="font-bold">{outOfBandItems.length} line{outOfBandItems.length > 1 ? 's' : ''} outside margin band:</span>
            {' '}{outOfBandItems.map(b => DEVICE_LABELS[b.device]).join(', ')}. Review offer prices.
          </div>
        </div>
      )}

      {/* Full pricing book with margins (admin only) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 bg-slate-900 flex items-center justify-between">
          <h2 className="font-bold text-white">Pricing Book — Internal View (Margins Visible)</h2>
          <span className="text-[10px] text-slate-500 bg-red-900/60 px-2 py-0.5 rounded font-semibold">ADMIN CONFIDENTIAL</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50">
                <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Device</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Gross Recovery</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Logistics</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Net Recovery</th>
                <th className="text-right px-3 py-3 text-[11px] text-red-400 font-semibold uppercase">MARGIN %</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Consumer Offer</th>
                <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cfg.book.map(row => {
                const inBand = row.margin_pct >= marginMin && row.margin_pct <= marginMax
                return (
                  <tr key={row.device} className={`hover:bg-slate-50 ${!inBand ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-slate-900">{DEVICE_LABELS[row.device]}</p>
                      <p className="text-[11px] text-slate-400">{DEVICE_COMPOSITIONS[row.device]?.characterisation}</p>
                    </td>
                    <td className="px-3 py-3.5 text-right text-xs text-slate-600">${row.gross_recovery.toFixed(2)}</td>
                    <td className="px-3 py-3.5 text-right text-xs text-red-500">-${row.logistics.toFixed(2)}</td>
                    <td className="px-3 py-3.5 text-right text-xs font-semibold text-slate-800">${row.net_recovery.toFixed(2)}</td>
                    <td className="px-3 py-3.5 text-right">
                      <span className={`text-sm font-bold ${inBand ? 'text-eco-700' : 'text-amber-600'}`}>
                        {row.margin_pct.toFixed(1)}%
                      </span>
                      {!inBand && <span className="text-[10px] text-amber-600 ml-1">⚠</span>}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <p className="text-base font-bold text-slate-900">${row.offer.toFixed(2)}</p>
                      {row.offer !== row.prev_offer && (
                        <p className={`text-[10px] font-semibold ${row.offer > row.prev_offer ? 'text-eco-600' : 'text-red-500'}`}>
                          {row.offer > row.prev_offer ? '+' : ''}${(row.offer - row.prev_offer).toFixed(2)} vs prev
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex justify-center"><TrendIcon trend={row.trend} /></div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-100">
                <td className="px-5 py-3 text-xs font-bold text-slate-700" colSpan={4}>Blended</td>
                <td className="px-3 py-3 text-right">
                  <span className={`text-sm font-bold ${overallInBand ? 'text-eco-700' : 'text-amber-600'}`}>
                    {cfg.current_margin_pct}%
                  </span>
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Weekly margin history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-4">Realised Margin History — 7 Weeks</h2>
        <WeeklyMarginChart data={MARGIN_HISTORY} />
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          {[
            { label: 'W26 Realised',  value: `${MARGIN_HISTORY.realised[6]}%`,  color: 'text-slate-800' },
            { label: 'Avg 7-Week',    value: `${(MARGIN_HISTORY.realised.reduce((a,b) => a+b,0)/7).toFixed(1)}%`, color: 'text-slate-800' },
            { label: 'Min Realised',  value: `${Math.min(...MARGIN_HISTORY.realised)}%`, color: Math.min(...MARGIN_HISTORY.realised) < marginMin ? 'text-red-600' : 'text-eco-700' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl p-3">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
