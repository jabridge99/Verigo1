import React, { useState } from 'react'
import { Leaf } from 'lucide-react'
import { MERCHANTS, LISTINGS, MERCHANT_ANALYTICS_7D, PLATFORM_FEE_PCT } from '../../data/marketplace'

const MERCHANT = MERCHANTS[0]
const MAX_REDEMPTIONS = Math.max(...MERCHANT_ANALYTICS_7D.map(d => d.redemptions))

const PERIOD_DATA = {
  '7d': {
    label: '7 Days',
    redemptions: MERCHANT_ANALYTICS_7D.reduce((s, d) => s + d.redemptions, 0),
    points: MERCHANT_ANALYTICS_7D.reduce((s, d) => s + d.points, 0),
    revenue: MERCHANT_ANALYTICS_7D.reduce((s, d) => s + d.revenue, 0),
    chart: MERCHANT_ANALYTICS_7D,
  },
  '30d': {
    label: '30 Days',
    redemptions: 847, points: 124_800, revenue: 6_240,
    chart: [
      { day: 'W1', redemptions: 178, points: 25_600, revenue: 1_280 },
      { day: 'W2', redemptions: 194, points: 28_400, revenue: 1_420 },
      { day: 'W3', redemptions: 216, points: 31_200, revenue: 1_560 },
      { day: 'W4', redemptions: 259, points: 39_600, revenue: 1_980 },
    ],
  },
  '90d': {
    label: '90 Days',
    redemptions: 2_488, points: 364_200, revenue: 18_210,
    chart: [
      { day: 'M1', redemptions: 712, points: 108_400, revenue: 5_420 },
      { day: 'M2', redemptions: 821, points: 120_800, revenue: 6_040 },
      { day: 'M3', redemptions: 955, points: 135_000, revenue: 6_750 },
    ],
  },
}

const myListings = LISTINGS.filter(l => l.merchant_id === MERCHANT.id)

const CATEGORY_BREAKDOWN = [
  { category: 'electronics', redemptions: 612, pct: 72, color: 'bg-slate-700' },
  { category: 'swap',        redemptions: 214, pct: 25, color: 'bg-eco-600' },
  { category: 'accessories', redemptions: 21,  pct: 3,  color: 'bg-slate-300' },
]

export default function Analytics() {
  const [period, setPeriod] = useState('7d')
  const data = PERIOD_DATA[period]
  const chartMax = Math.max(...data.chart.map(d => d.redemptions))
  const fee = data.revenue * PLATFORM_FEE_PCT / 100
  const net = data.revenue - fee

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Redemption performance and revenue breakdown</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {Object.entries(PERIOD_DATA).map(([key, d]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                period === key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}>{d.label}</button>
          ))}
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Redemptions',    value: data.redemptions.toLocaleString(), color: 'text-slate-800',   bg: 'bg-white' },
          { label: 'Points Redeemed',value: data.points.toLocaleString(),      color: 'text-violet-700',  bg: 'bg-violet-50' },
          { label: 'Gross Revenue',  value: `$${data.revenue.toLocaleString()}`, color: 'text-slate-800', bg: 'bg-white' },
          { label: `Net (after ${PLATFORM_FEE_PCT}% fee)`, value: `$${net.toLocaleString()}`, color: 'text-eco-700', bg: 'bg-eco-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Redemptions chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4">Redemptions — {data.label}</h2>
          <div className="flex items-end gap-2 h-40">
            {data.chart.map(d => {
              const h = Math.max(6, (d.redemptions / chartMax) * 160)
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                  <p className="text-[10px] text-slate-500 font-semibold">{d.redemptions}</p>
                  <div className="w-full bg-eco-500 rounded-t-lg" style={{ height: `${h}px` }} />
                  <p className="text-[10px] text-slate-400">{d.day}</p>
                </div>
              )
            })}
          </div>

          {/* Revenue breakdown */}
          <div className="mt-4 pt-4 border-t border-slate-50 grid grid-cols-3 gap-4 text-center text-xs">
            <div>
              <p className="text-slate-400">Gross revenue</p>
              <p className="font-bold text-slate-800 text-sm">${data.revenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-amber-500">Platform fee ({PLATFORM_FEE_PCT}%)</p>
              <p className="font-bold text-amber-600 text-sm">−${fee.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-eco-600">Net to you</p>
              <p className="font-bold text-eco-700 text-sm">${net.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Category breakdown + top listings */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Category Breakdown</h3>
            <div className="space-y-3">
              {CATEGORY_BREAKDOWN.map(c => (
                <div key={c.category}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-600 capitalize">{c.category}</span>
                    <span className="text-slate-400">{c.redemptions} ({c.pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-eco-950 rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Leaf className="w-4 h-4 text-eco-400" /> Sustainability Impact
            </h3>
            <div className="space-y-2 text-xs text-eco-300">
              <div className="flex justify-between">
                <span>Devices diverted</span>
                <strong className="text-eco-200">{Math.round(MERCHANT.total_redemptions * 0.34)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Est. CO₂ saved</span>
                <strong className="text-eco-200">{Math.round(MERCHANT.total_redemptions * 68).toLocaleString()} kg</strong>
              </div>
              <div className="flex justify-between">
                <span>Avg order points</span>
                <strong className="text-eco-200">{Math.round(data.points / data.redemptions)} pts</strong>
              </div>
              <div className="flex justify-between">
                <span>Points → AUD rate</span>
                <strong className="text-eco-200">100 pts = $5.00</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top listings */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Top Listings by Redemptions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-50">
                <th className="text-left px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Listing</th>
                <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Points</th>
                <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Redeemed</th>
                <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Stock Left</th>
                <th className="text-right px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Gross</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {myListings.sort((a, b) => b.redeemed_total - a.redeemed_total).map(l => (
                <tr key={l.id}>
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">{l.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{l.type}</p>
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm text-slate-600">{l.points_cost.toLocaleString()}</td>
                  <td className="px-3 py-3.5 text-right font-bold text-eco-700">{l.redeemed_total}</td>
                  <td className="px-3 py-3.5 text-right text-sm text-slate-500">{l.stock === 999 ? '∞' : l.stock}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-800">${(l.redeemed_total * l.aud_value).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
