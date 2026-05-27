import React from 'react'
import { TrendingUp, TrendingDown, RefreshCw, DollarSign } from 'lucide-react'

const COMMODITIES = [
  { material: 'Aluminium',      grade: 'UBC Scrap',      commodity: '$2,180', change: +2.4, unit: '/tonne', consumerRate: '$1.85/kg', margin: '15%' },
  { material: 'PET Plastic',    grade: 'Clear Baled',    commodity: '$320',   change: -0.8, unit: '/tonne', consumerRate: '$0.24/kg', margin: '25%' },
  { material: 'HDPE',           grade: 'Natural Baled',  commodity: '$280',   change: +1.2, unit: '/tonne', consumerRate: '$0.21/kg', margin: '25%' },
  { material: 'Clear Glass',    grade: 'Cullet',         commodity: '$45',    change:  0.0, unit: '/tonne', consumerRate: '$0.02/kg', margin: '55%' },
  { material: 'Steel Cans',     grade: 'No.1 Shredded',  commodity: '$195',   change: +3.1, unit: '/tonne', consumerRate: '$0.14/kg', margin: '28%' },
  { material: 'Paperboard',     grade: 'OCC Grade',      commodity: '$85',    change: -1.5, unit: '/tonne', consumerRate: '$0.06/kg', margin: '30%' },
  { material: 'Mixed Plastic',  grade: 'Commingled',     commodity: '$55',    change: -0.3, unit: '/tonne', consumerRate: '$0.04/kg', margin: '25%' },
]

export default function OperatorPricing() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pricing & Rate Cards</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Commodity-linked pricing updated daily. Consumer rates are set by platform admin.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <RefreshCw className="w-3.5 h-3.5" />
          Last updated: 27 May 2025, 6:00 am AEST
        </div>
      </div>

      {/* Live commodity feed */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Live Commodity Prices (AUD/tonne)</h2>
          <span className="text-[10px] font-semibold text-eco-700 bg-eco-100 px-2 py-0.5 rounded-full">
            LIVE FEED
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Material', 'Grade', 'Commodity Price', '24h Change', 'Consumer Rate', 'Platform Margin'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {COMMODITIES.map(c => (
                <tr key={c.material} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{c.material}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{c.grade}</td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-900">{c.commodity}</span>
                    <span className="text-xs text-slate-400">{c.unit}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1 text-sm font-semibold ${
                      c.change > 0 ? 'text-eco-600' : c.change < 0 ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {c.change > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : c.change < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : '—'}
                      {c.change !== 0 ? `${c.change > 0 ? '+' : ''}${c.change}%` : 'Flat'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-indigo-700">{c.consumerRate}</td>
                  <td className="px-6 py-4 text-slate-600 text-xs">{c.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate card summary */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Best Rate',       value: '$1.85/kg', sub: 'Aluminium',     color: 'text-amber-700 bg-amber-50' },
          { label: 'Avg Consumer Rate', value: '$0.37/kg', sub: 'Mixed bins',  color: 'text-indigo-700 bg-indigo-50' },
          { label: 'Platform Margin', value: 'Avg 29%',  sub: 'Across materials', color: 'text-eco-700 bg-eco-50' },
          { label: 'Rate Updates',    value: 'Daily',    sub: 'Auto-synced',   color: 'text-slate-700 bg-slate-100' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full w-fit mb-3 ${s.color}`}>
              {s.label}
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
