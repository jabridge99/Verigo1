import React, { useState } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Bell, MapPin, RefreshCw, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { COMPETITOR_OFFERS } from '../../data/pie'

// ─── static enrichment data ──────────────────────────────────────────────────

const RATE_COMPARISON = [
  { material: 'Smartphone',      ecobin: 42.50, compA: 38.00, compB: 44.00, compC: 35.50, unit: 'AUD/unit' },
  { material: 'Laptop',          ecobin: 68.00, compA: 72.00, compB: 65.00, compC: 58.00, unit: 'AUD/unit' },
  { material: 'Desktop PC',      ecobin: 31.00, compA: 28.50, compB: 29.00, compC: 33.00, unit: 'AUD/unit' },
  { material: 'Tablet',          ecobin: 22.00, compA: 20.00, compB: 24.00, compC: 18.50, unit: 'AUD/unit' },
  { material: 'TV / Monitor',    ecobin: 18.50, compA: 16.00, compB: 17.50, compC: 19.00, unit: 'AUD/unit' },
  { material: 'Large Appliance', ecobin: 14.00, compA: 15.50, compB: 13.00, compC: 12.00, unit: 'AUD/unit' },
]

const INTELLIGENCE_FEED = [
  { id: 1, type: 'price_change', severity: 'high',   ts: '08:14',  text: 'EcoRecycle raised laptop rates by $4.00 — now $72 AUD. EcoBin now $4 below market leader.' },
  { id: 2, type: 'new_entrant',  severity: 'medium', ts: 'Yesterday', text: 'New operator "GreenLoop QLD" launched in Brisbane metro area. Offering $40 smartphones, no COD.' },
  { id: 3, type: 'market_news',  severity: 'low',    ts: 'Yesterday', text: 'LME copper +1.8% week-on-week. Industry expects upward rate adjustments across major recyclers.' },
  { id: 4, type: 'price_change', severity: 'medium', ts: '27 May',    text: 'RecycleRight dropped desktop PC rate by $2.50 — now matching EcoBin at $31. Monitor for further moves.' },
  { id: 5, type: 'market_news',  severity: 'low',    ts: '27 May',    text: 'ACCC released guidance on e-waste operator transparency. May pressure competitors to publish rates publicly.' },
  { id: 6, type: 'price_change', severity: 'high',   ts: '26 May',    text: 'TechReclaim cut large appliance rates by $3.50 — now $12. EcoBin advantage widens to $2.00.' },
  { id: 7, type: 'new_entrant',  severity: 'medium', ts: '25 May',    text: 'EcoPro expanding from VIC into NSW market. Estimated market share impact: 3–5% in next quarter.' },
]

const PRICE_GAP = [
  { material: 'Smartphone',      ecobin: 42.50, mktAvg: 39.17, gap: +3.33, rec: null },
  { material: 'Laptop',          ecobin: 68.00, mktAvg: 71.67, gap: -3.67, rec: '+$3.50 — match market leader' },
  { material: 'Desktop PC',      ecobin: 31.00, mktAvg: 30.17, gap: +0.83, rec: null },
  { material: 'Tablet',          ecobin: 22.00, mktAvg: 20.83, gap: +1.17, rec: null },
  { material: 'TV / Monitor',    ecobin: 18.50, mktAvg: 17.50, gap: +1.00, rec: null },
  { material: 'Large Appliance', ecobin: 14.00, mktAvg: 13.50, gap: +0.50, rec: null },
]

const COMPETITOR_PROFILES = [
  {
    id: 'comp-a',
    name: 'EcoRecycle',
    logo: 'ER',
    color: 'bg-blue-600',
    areas: ['NSW', 'VIC', 'QLD'],
    materials: ['Smartphones', 'Laptops', 'Tablets', 'Desktops'],
    estRevenue: '$4.2M / yr',
    avgRate: '$44.80',
    strength: 'Highest laptop rate in market',
    weakness: 'No COD, 5–7 day settlement',
    lastUpdated: '27 May 2026',
    winRate: 58,
  },
  {
    id: 'comp-b',
    name: 'RecycleRight',
    logo: 'RR',
    color: 'bg-emerald-600',
    areas: ['VIC', 'SA', 'WA'],
    materials: ['All E-Waste', 'Large Appliances'],
    estRevenue: '$2.8M / yr',
    avgRate: '$37.42',
    strength: 'Fast 24h payment, popular in VIC',
    weakness: 'Lower rates on premium devices',
    lastUpdated: '27 May 2026',
    winRate: 71,
  },
  {
    id: 'comp-c',
    name: 'TechReclaim',
    logo: 'TC',
    color: 'bg-purple-600',
    areas: ['QLD', 'NSW'],
    materials: ['Smartphones', 'Tablets', 'TVs'],
    estRevenue: '$1.6M / yr',
    avgRate: '$31.25',
    strength: 'Strong brand in QLD, walk-in centres',
    weakness: 'Lowest overall rates, slow to reprice',
    lastUpdated: '26 May 2026',
    winRate: 84,
  },
]

const COMPETITORS = [...new Set(COMPETITOR_OFFERS.map(c => c.competitor))]
const DEVICES     = [...new Set(COMPETITOR_OFFERS.map(c => c.device))]

// ─── helper components ────────────────────────────────────────────────────────

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

// ─── Rate Comparison Table ────────────────────────────────────────────────────

function RateComparisonTable() {
  const compNames = ['compA', 'compB', 'compC']
  const compLabels = { compA: 'EcoRecycle', compB: 'RecycleRight', compC: 'TechReclaim' }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 bg-slate-900">
        <h2 className="font-bold text-white">Consumer Rate Comparison — EcoBin vs Competitors</h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Green = EcoBin leads · Red = EcoBin trails · Per-material consumer offer in AUD</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50">
              <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Material</th>
              <th className="text-right px-3 py-3 text-[11px] font-bold text-violet-600 uppercase">EcoBin</th>
              {compNames.map(c => (
                <th key={c} className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">{compLabels[c]}</th>
              ))}
              <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {RATE_COMPARISON.map(row => {
              const allComp = [row.compA, row.compB, row.compC]
              const mktAvg = allComp.reduce((s, v) => s + v, 0) / allComp.length
              const ecobinLeads = row.ecobin >= mktAvg
              return (
                <tr key={row.material} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-semibold text-slate-900">{row.material}</p>
                    <p className="text-[10px] text-slate-400">{row.unit}</p>
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${ecobinLeads ? 'bg-eco-100 text-eco-800' : 'bg-red-50 text-red-700'}`}>
                      ${row.ecobin.toFixed(2)}
                    </span>
                  </td>
                  {compNames.map(c => {
                    const val = row[c]
                    const beatsUs = val > row.ecobin
                    return (
                      <td key={c} className="px-3 py-3.5 text-right">
                        <span className={`text-xs font-semibold ${beatsUs ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                          ${val.toFixed(2)}
                          {beatsUs && <ArrowUp className="w-3 h-3 inline ml-0.5 text-red-500" />}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-5 py-3.5 text-center">
                    <PositionChip spread={((row.ecobin - mktAvg) / mktAvg) * 100} />
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

// ─── SVG Bar Chart — Market Position ─────────────────────────────────────────

function MarketPositionChart() {
  const chartH = 160
  const barW = 36
  const gap = 14
  const leftPad = 52
  const topPad = 16

  const series = RATE_COMPARISON.map(r => ({
    label: r.material.replace(' / ', '/').replace('Large ', 'Lg. '),
    ecobin: r.ecobin,
    avg: (r.compA + r.compB + r.compC) / 3,
  }))

  const maxVal = Math.max(...series.flatMap(s => [s.ecobin, s.avg])) * 1.15
  const groupW = barW * 2 + gap
  const totalW = leftPad + series.length * (groupW + gap) + 20

  function yPos(v) {
    return topPad + chartH - (v / maxVal) * chartH
  }

  const yTicks = [0, 20, 40, 60, 80]

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-slate-900">Market Position — Consumer Rate Chart</h2>
          <p className="text-xs text-slate-400 mt-0.5">EcoBin rate vs competitor average per material (AUD)</p>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-500 inline-block" />EcoBin</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-300 inline-block" />Comp. Avg</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg width={totalW} height={chartH + topPad + 44} className="block">
          {/* Y gridlines */}
          {yTicks.map(tick => {
            const y = yPos(tick)
            return (
              <g key={tick}>
                <line x1={leftPad} x2={totalW - 10} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={leftPad - 6} y={y + 4} fontSize="9" fill="#94a3b8" textAnchor="end">${tick}</text>
              </g>
            )
          })}
          {/* Bars */}
          {series.map((s, i) => {
            const x = leftPad + i * (groupW + gap)
            const ecobinH = (s.ecobin / maxVal) * chartH
            const avgH    = (s.avg / maxVal) * chartH
            const ecobinLeads = s.ecobin >= s.avg
            return (
              <g key={s.label}>
                {/* EcoBin bar */}
                <rect
                  x={x} y={yPos(s.ecobin)}
                  width={barW} height={ecobinH}
                  rx={3} fill={ecobinLeads ? '#7c3aed' : '#ef4444'}
                />
                <text x={x + barW / 2} y={yPos(s.ecobin) - 4} fontSize="9" fill="#475569" textAnchor="middle" fontWeight="700">
                  ${s.ecobin}
                </text>
                {/* Competitor avg bar */}
                <rect
                  x={x + barW + 4} y={yPos(s.avg)}
                  width={barW} height={avgH}
                  rx={3} fill="#cbd5e1"
                />
                <text x={x + barW + 4 + barW / 2} y={yPos(s.avg) - 4} fontSize="9" fill="#94a3b8" textAnchor="middle">
                  ${s.avg.toFixed(0)}
                </text>
                {/* X label */}
                <text x={x + barW} y={chartH + topPad + 14} fontSize="9" fill="#64748b" textAnchor="middle">{s.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ─── Intelligence Feed ────────────────────────────────────────────────────────

function IntelligenceFeed() {
  const typeIcon = {
    price_change: { icon: TrendingUp,    label: 'Price Change', cls: 'text-amber-500' },
    new_entrant:  { icon: AlertTriangle, label: 'New Entrant',  cls: 'text-blue-500' },
    market_news:  { icon: Bell,          label: 'Market News',  cls: 'text-slate-400' },
  }
  const sevBg = { high: 'border-red-100 bg-red-50', medium: 'border-amber-100 bg-amber-50', low: 'border-slate-100 bg-slate-50' }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
        <h2 className="font-bold text-slate-900">Intelligence Feed</h2>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          Feed 16h stale · last scraped 28 May 18:00
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {INTELLIGENCE_FEED.map(item => {
          const { icon: Icon, label, cls } = typeIcon[item.type]
          return (
            <div key={item.id} className={`px-5 py-3.5 border-l-2 ${
              item.severity === 'high' ? 'border-l-red-400' : item.severity === 'medium' ? 'border-l-amber-400' : 'border-l-slate-200'
            }`}>
              <div className="flex items-start gap-3">
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cls}`} />
                <div className="flex-1">
                  <p className="text-sm text-slate-700 leading-relaxed">{item.text}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-semibold text-slate-400">{item.ts}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.severity === 'high' ? 'bg-red-100 text-red-700' :
                      item.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                    }`}>{item.severity.toUpperCase()}</span>
                    <span className="text-[10px] text-slate-400">{label}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Price Gap Analysis ───────────────────────────────────────────────────────

function PriceGapAnalysis() {
  const maxAbs = Math.max(...PRICE_GAP.map(r => Math.abs(r.gap)))

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50">
        <h2 className="font-bold text-slate-900">Price Gap Analysis</h2>
        <p className="text-xs text-slate-400 mt-0.5">EcoBin rate vs market average — positive = EcoBin leads</p>
      </div>
      <div className="divide-y divide-slate-50">
        {PRICE_GAP.map(row => {
          const barPct = (Math.abs(row.gap) / maxAbs) * 100
          const isPos = row.gap >= 0
          return (
            <div key={row.material} className="px-5 py-3.5">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-sm font-semibold text-slate-800 w-36 flex-shrink-0">{row.material}</span>
                <div className="flex-1 relative h-5 flex items-center">
                  <div className="absolute left-1/2 w-px h-4 bg-slate-300" />
                  {isPos ? (
                    <div
                      className="absolute left-1/2 h-3.5 bg-eco-400 rounded-r"
                      style={{ width: `${barPct / 2}%` }}
                    />
                  ) : (
                    <div
                      className="absolute h-3.5 bg-red-400 rounded-l"
                      style={{ right: '50%', width: `${barPct / 2}%` }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 w-36 justify-end">
                  <span className={`text-xs font-bold ${isPos ? 'text-eco-600' : 'text-red-600'}`}>
                    {isPos ? '+' : ''}${row.gap.toFixed(2)} vs avg
                  </span>
                  {isPos
                    ? <ArrowUp className="w-3.5 h-3.5 text-eco-500" />
                    : <ArrowDown className="w-3.5 h-3.5 text-red-500" />
                  }
                </div>
              </div>
              {row.rec && (
                <div className="ml-36 mt-1 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  <p className="text-[11px] text-amber-700 font-semibold">Recommended: {row.rec}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="px-5 py-3 border-t border-slate-50 bg-slate-50 text-[11px] text-slate-400 flex gap-4">
        <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-eco-400 inline-block" /> EcoBin leads</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-red-400 inline-block" /> EcoBin trails</span>
      </div>
    </div>
  )
}

// ─── Competitor Profiles ──────────────────────────────────────────────────────

function CompetitorProfiles() {
  return (
    <div>
      <h2 className="font-bold text-slate-900 mb-3">Competitor Profiles</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {COMPETITOR_PROFILES.map(comp => (
          <div key={comp.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-3 border-b border-slate-50">
              <div className={`w-10 h-10 ${comp.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <span className="text-white font-black text-sm">{comp.logo}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900">{comp.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {comp.areas.map(a => (
                    <span key={a} className="text-[9px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{a}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 space-y-2.5">
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Materials Accepted</p>
                <div className="flex flex-wrap gap-1">
                  {comp.materials.map(m => (
                    <span key={m} className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded font-medium">{m}</span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-400">Est. Revenue</p>
                  <p className="text-xs font-bold text-slate-800">{comp.estRevenue}</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-400">Avg Rate</p>
                  <p className="text-xs font-bold text-slate-800">{comp.avgRate}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase mb-0.5">EcoBin Win Rate vs This Competitor</p>
                <WinBar rate={comp.winRate} />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-eco-700 font-semibold">+ {comp.strength}</p>
                <p className="text-[10px] text-red-600 font-semibold">- {comp.weakness}</p>
              </div>
            </div>
            <div className="px-5 py-2 border-t border-slate-50 bg-slate-50 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Last updated {comp.lastUpdated}</span>
              <RefreshCw className="w-3 h-3 text-slate-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompetitorIntelligence() {
  const [selectedDevice, setSelectedDevice] = useState('All')

  const filtered = selectedDevice === 'All'
    ? COMPETITOR_OFFERS
    : COMPETITOR_OFFERS.filter(c => c.device === selectedDevice)

  const byDevice = DEVICES.map(dev => {
    const rows = COMPETITOR_OFFERS.filter(c => c.device === dev)
    const avgOurs   = rows.reduce((s, r) => s + r.our_offer, 0) / rows.length
    const avgTheirs = rows.reduce((s, r) => s + r.their_offer, 0) / rows.length
    const avgWin    = rows.reduce((s, r) => s + r.win_rate, 0) / rows.length
    const avgSpread = rows.reduce((s, r) => s + r.spread_pct, 0) / rows.length
    return { device: dev, avgOurs, avgTheirs, avgWin, avgSpread, count: rows.length }
  })

  const overallWinRate = Math.round(COMPETITOR_OFFERS.reduce((s, c) => s + c.win_rate, 0) / COMPETITOR_OFFERS.length)
  const aboveMarket    = COMPETITOR_OFFERS.filter(c => c.spread_pct > 10).length
  const belowMarket    = COMPETITOR_OFFERS.filter(c => c.spread_pct < -5).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Competitor Intelligence</h1>
          <p className="text-sm text-slate-500 mt-0.5">Market positioning · Win rates · Price spread analysis · Intelligence feed</p>
        </div>
        <p className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Competitor feed 16h stale — last scraped 28 May 18:00
        </p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Overall Win Rate',    value: `${overallWinRate}%`, color: overallWinRate >= 65 ? 'text-eco-700' : 'text-amber-600', bg: overallWinRate >= 65 ? 'bg-eco-50' : 'bg-amber-50' },
          { label: 'Above Market Lines',  value: aboveMarket,          color: 'text-eco-700',  bg: 'bg-eco-50' },
          { label: 'Below Market Lines',  value: belowMarket,          color: 'text-red-600',  bg: 'bg-red-50' },
          { label: 'Competitors Tracked', value: COMPETITORS.length,   color: 'text-slate-800', bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Rate Comparison Table */}
      <RateComparisonTable />

      {/* Market Position Chart */}
      <MarketPositionChart />

      {/* Intelligence Feed + Price Gap side by side on large screens */}
      <div className="grid lg:grid-cols-2 gap-6">
        <IntelligenceFeed />
        <PriceGapAnalysis />
      </div>

      {/* Competitor Profiles */}
      <CompetitorProfiles />

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
              >{d}</button>
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
