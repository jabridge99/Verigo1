import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Eye } from 'lucide-react'
import { COMPETITOR_OFFERS } from '../../data/pie'

const COMPETITORS = [...new Set(COMPETITOR_OFFERS.map(c => c.competitor))]
const DEVICES     = [...new Set(COMPETITOR_OFFERS.map(c => c.device))]

function PositionChip({ spread }) {
  if (spread > 10)  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-eco-100 text-eco-700">Above Market</span>
  if (spread < -5)  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Below Market</span>
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">At Market</span>
}

function WinBar({ rate }) {
  const color = rate >= 70 ? 'bg-eco-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-8 text-right">{rate}%</span>
    </div>
  )
}

export default function CompetitorIntelligence() {
  const [selectedDevice, setSelectedDevice] = useState('All')

  const filtered = selectedDevice === 'All'
    ? COMPETITOR_OFFERS
    : COMPETITOR_OFFERS.filter(c => c.device === selectedDevice)

  // Aggregate by device
  const byDevice = DEVICES.map(dev => {
    const rows = COMPETITOR_OFFERS.filter(c => c.device === dev)
    const avgOurs  = rows.reduce((s, r) => s + r.our_offer, 0) / rows.length
    const avgTheirs = rows.reduce((s, r) => s + r.their_offer, 0) / rows.length
    const avgWin = rows.reduce((s, r) => s + r.win_rate, 0) / rows.length
    const avgSpread = rows.reduce((s, r) => s + r.spread_pct, 0) / rows.length
    return { device: dev, avgOurs, avgTheirs, avgWin, avgSpread, count: rows.length }
  })

  const overallWinRate = Math.round(COMPETITOR_OFFERS.reduce((s, c) => s + c.win_rate, 0) / COMPETITOR_OFFERS.length)
  const aboveMarket    = COMPETITOR_OFFERS.filter(c => c.spread_pct > 10).length
  const belowMarket    = COMPETITOR_OFFERS.filter(c => c.spread_pct < -5).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Competitor Intelligence</h1>
          <p className="text-sm text-slate-500 mt-0.5">Market positioning · Win rates · Price spread analysis</p>
        </div>
        <p className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Competitor feed 16h stale — last scraped 27 May 18:00
        </p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Overall Win Rate', value: `${overallWinRate}%`, color: overallWinRate >= 65 ? 'text-eco-700' : 'text-amber-600', bg: overallWinRate >= 65 ? 'bg-eco-50' : 'bg-amber-50' },
          { label: 'Above Market Lines', value: aboveMarket,  color: 'text-eco-700',  bg: 'bg-eco-50' },
          { label: 'Below Market Lines', value: belowMarket,  color: 'text-red-600',  bg: 'bg-red-50' },
          { label: 'Competitors Tracked', value: COMPETITORS.length, color: 'text-slate-800', bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Win rate by device */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Win Rate by Device Category</h2>
          <p className="text-xs text-slate-400 mt-0.5">Proportion of consumers choosing EcoBin over competitors</p>
        </div>
        <div className="divide-y divide-slate-50">
          {byDevice.sort((a, b) => b.avgWin - a.avgWin).map(row => (
            <div key={row.device} className="px-5 py-3.5 grid grid-cols-3 gap-4 items-center">
              <div>
                <p className="text-sm font-semibold text-slate-900">{row.device}</p>
                <p className="text-[11px] text-slate-400">{row.count} competitor{row.count !== 1 ? 's' : ''} tracked</p>
              </div>
              <WinBar rate={Math.round(row.avgWin)} />
              <div className="text-right">
                <PositionChip spread={row.avgSpread} />
                <p className="text-[11px] text-slate-400 mt-1">
                  Us ${row.avgOurs.toFixed(2)} vs mkt avg ${row.avgTheirs.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor detail table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-bold text-slate-900">Price Comparison Detail</h2>
          <div className="flex flex-wrap gap-2">
            {['All', ...DEVICES].map(d => (
              <button key={d}
                onClick={() => setSelectedDevice(d)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedDevice === d ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >{d === 'All' ? 'All' : d}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50">
                <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Device</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Competitor</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Their Offer</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Our Offer</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Spread</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Position</th>
                <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-xs font-semibold text-slate-800">{row.device}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{row.competitor}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-700 text-right">${row.their_offer.toFixed(2)}</td>
                  <td className="px-3 py-3 text-xs font-bold text-slate-900 text-right">${row.our_offer.toFixed(2)}</td>
                  <td className={`px-3 py-3 text-xs font-bold text-right ${row.spread_pct > 0 ? 'text-eco-600' : 'text-red-500'}`}>
                    {row.spread_pct > 0 ? '+' : ''}{row.spread_pct.toFixed(1)}%
                    {row.spread_pct > 0
                      ? <TrendingUp className="w-3 h-3 inline ml-1" />
                      : <TrendingDown className="w-3 h-3 inline ml-1" />
                    }
                  </td>
                  <td className="px-3 py-3"><PositionChip spread={row.spread_pct} /></td>
                  <td className="px-5 py-3 text-center">
                    <span className={`text-xs font-bold ${row.win_rate >= 70 ? 'text-eco-700' : row.win_rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {row.win_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
