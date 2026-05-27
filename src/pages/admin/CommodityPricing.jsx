import React, { useState } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Download, Edit3, Save } from 'lucide-react'

const PRICES = [
  { id: 1, material: 'Aluminium',     grade: 'UBC Scrap',      spot: 2180, change: +2.4, consumerRate: 1.85, platformMargin: 0.15 },
  { id: 2, material: 'PET Plastic',   grade: 'Clear Baled',    spot: 320,  change: -0.8, consumerRate: 0.24, platformMargin: 0.25 },
  { id: 3, material: 'HDPE',          grade: 'Natural Baled',  spot: 280,  change: +1.2, consumerRate: 0.21, platformMargin: 0.25 },
  { id: 4, material: 'Clear Glass',   grade: 'Cullet',         spot: 45,   change:  0.0, consumerRate: 0.02, platformMargin: 0.55 },
  { id: 5, material: 'Steel Cans',    grade: 'No.1 Shredded',  spot: 195,  change: +3.1, consumerRate: 0.14, platformMargin: 0.28 },
  { id: 6, material: 'Paperboard',    grade: 'OCC Grade',      spot: 85,   change: -1.5, consumerRate: 0.06, platformMargin: 0.30 },
  { id: 7, material: 'Mixed Plastic', grade: 'Commingled',     spot: 55,   change: -0.3, consumerRate: 0.04, platformMargin: 0.25 },
]

const HISTORY = [
  { month: 'Jan', alum: 2050, pet: 290 },
  { month: 'Feb', alum: 2090, pet: 305 },
  { month: 'Mar', alum: 2140, pet: 310 },
  { month: 'Apr', alum: 2130, pet: 323 },
  { month: 'May', alum: 2180, pet: 320, current: true },
]
const maxAlum = Math.max(...HISTORY.map(h => h.alum))

export default function CommodityPricing() {
  const [editId, setEditId] = useState(null)
  const [rates, setRates]   = useState(
    Object.fromEntries(PRICES.map(p => [p.id, p.consumerRate])),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commodity Pricing Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live commodity feed · Consumer rate cards · Automated margin management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <RefreshCw className="w-3.5 h-3.5" />
            Updated 27 May, 6:00 am AEST
          </div>
          <button className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg text-xs hover:border-slate-300 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export Rates
          </button>
        </div>
      </div>

      {/* Commodity price table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Live Prices &amp; Consumer Rate Cards</h2>
          <span className="text-[10px] font-bold text-eco-700 bg-eco-100 px-2 py-0.5 rounded-full tracking-wide">
            LIVE
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Material', 'Grade', 'Spot (AUD/t)', '24h Δ', 'Consumer Rate ($/kg)', 'Platform Margin', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {PRICES.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-slate-900">{p.material}</td>
                  <td className="px-5 py-4 text-slate-400 text-xs">{p.grade}</td>
                  <td className="px-5 py-4 font-bold text-slate-900">${p.spot.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <span className={`flex items-center gap-1 text-xs font-semibold ${
                      p.change > 0 ? 'text-eco-600' : p.change < 0 ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {p.change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : p.change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                      {p.change !== 0 ? `${p.change > 0 ? '+' : ''}${p.change}%` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {editId === p.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={rates[p.id]}
                          onChange={e => setRates(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) }))}
                          className="w-20 border border-violet-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        <span className="text-slate-400">/kg</span>
                      </div>
                    ) : (
                      <span className="font-bold text-violet-700">${rates[p.id].toFixed(2)}/kg</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">{(p.platformMargin * 100).toFixed(0)}%</td>
                  <td className="px-5 py-4">
                    {editId === p.id ? (
                      <button
                        onClick={() => setEditId(null)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-eco-700 bg-eco-50 px-2.5 py-1 rounded-lg hover:bg-eco-100 transition-colors"
                      >
                        <Save className="w-3 h-3" /> Save
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditId(p.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aluminium price history chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-6">Aluminium Price History (AUD/tonne)</h2>
        <div className="flex items-end gap-6 h-36">
          {HISTORY.map(h => (
            <div key={h.month} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-slate-500">${(h.alum / 1000).toFixed(2)}k</span>
              <div
                className={`w-full rounded-t-lg ${h.current ? 'bg-violet-600' : 'bg-slate-200'}`}
                style={{ height: `${(h.alum / maxAlum) * 108}px` }}
              />
              <span className={`text-xs font-medium ${h.current ? 'text-violet-700' : 'text-slate-400'}`}>
                {h.month}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Source: LME / ASX commodity index feed · Prices in AUD · Auto-adjusted daily at 6:00 am AEST
        </p>
      </div>
    </div>
  )
}
