import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Leaf, BarChart2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

const MERCHANT_NAME = 'Patagonia ANZ'

// KPI data by period
const PERIOD_KPIS = {
  '7d': {
    impressions:    14_820,  impressionsDelta: +8.3,
    redemptions:    412,     redemptionsDelta: +11.2,
    revenue:        10_300,  revenueDelta: +9.7,
    avgPoints:      248,     avgPointsDelta: -2.1,
    returnRate:     3.4,     returnRateDelta: -0.8,
  },
  '30d': {
    impressions:    58_440,  impressionsDelta: +5.1,
    redemptions:    1_624,   redemptionsDelta: +14.3,
    revenue:        40_600,  revenueDelta: +12.8,
    avgPoints:      252,     avgPointsDelta: +1.4,
    returnRate:     3.1,     returnRateDelta: -1.2,
  },
  '90d': {
    impressions:    172_100, impressionsDelta: +3.8,
    redemptions:    4_812,   redemptionsDelta: +18.7,
    revenue:        120_300, revenueDelta: +16.4,
    avgPoints:      245,     avgPointsDelta: +0.6,
    returnRate:     2.9,     returnRateDelta: -1.9,
  },
}

// Daily redemption trend (7d uses daily; 30d uses weekly; 90d monthly)
const TREND_DATA = {
  '7d': [
    { label: 'Mon', value: 48 },
    { label: 'Tue', value: 62 },
    { label: 'Wed', value: 55 },
    { label: 'Thu', value: 71 },
    { label: 'Fri', value: 84 },
    { label: 'Sat', value: 58 },
    { label: 'Sun', value: 34 },
  ],
  '30d': [
    { label: 'W1', value: 340 },
    { label: 'W2', value: 372 },
    { label: 'W3', value: 410 },
    { label: 'W4', value: 502 },
  ],
  '90d': [
    { label: 'Mar', value: 1_420 },
    { label: 'Apr', value: 1_640 },
    { label: 'May', value: 1_752 },
  ],
}

// Sparkline data: 7 points per product
const PRODUCTS = [
  { name: 'iPhone 15 Trade-In Voucher',     category: 'Electronics', impressions: 4_820, redemptions: 148, convRate: 3.07, revenue: 3_700,  spark: [18, 22, 20, 28, 32, 30, 38] },
  { name: '$50 Store Credit',               category: 'Rewards',     impressions: 3_640, redemptions: 96,  convRate: 2.64, revenue: 2_400,  spark: [10, 12, 14, 12, 16, 14, 18] },
  { name: 'Nano Puff Jacket',               category: 'Apparel',     impressions: 2_180, redemptions: 74,  convRate: 3.39, revenue: 1_850,  spark: [8, 9, 10, 12, 14, 13, 15] },
  { name: 'Worn Wear Repair Credit',        category: 'Repairs',     impressions: 1_920, redemptions: 58,  convRate: 3.02, revenue: 1_450,  spark: [5, 7, 6, 9, 10, 11, 12] },
  { name: 'Recycled Tote Bag',              category: 'Accessories', impressions: 1_440, redemptions: 24,  convRate: 1.67, revenue: 480,    spark: [2, 3, 2, 4, 3, 5, 4] },
  { name: 'Sustainability Report Download', category: 'Digital',     impressions: 820,   redemptions: 12,  convRate: 1.46, revenue: 120,    spark: [1, 1, 2, 1, 2, 2, 2] },
]

// Tier breakdown: Bronze/Silver/Gold/Platinum
const TIER_DATA = [
  { tier: 'Bronze',   pct: 18, color: 'bg-amber-700', count: 74  },
  { tier: 'Silver',   pct: 31, color: 'bg-slate-400', count: 128 },
  { tier: 'Gold',     pct: 34, color: 'bg-yellow-400',count: 140 },
  { tier: 'Platinum', pct: 17, color: 'bg-violet-500', count: 70  },
]

// Commission by category
const COMMISSION_DATA = [
  { category: 'Electronics', redemptions: 148, avgPoints: 310, commRate: 8.0,  totalComm: 296.0  },
  { category: 'Rewards',     redemptions: 96,  avgPoints: 200, commRate: 6.0,  totalComm: 144.0  },
  { category: 'Apparel',     redemptions: 74,  avgPoints: 250, commRate: 7.0,  totalComm: 129.5  },
  { category: 'Repairs',     redemptions: 58,  avgPoints: 250, commRate: 5.5,  totalComm: 79.75  },
  { category: 'Accessories', redemptions: 24,  avgPoints: 200, commRate: 5.0,  totalComm: 24.0   },
  { category: 'Digital',     redemptions: 12,  avgPoints: 100, commRate: 3.5,  totalComm: 4.2    },
]

function DeltaBadge({ delta, unit = '%' }) {
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-eco-600">
      <ArrowUpRight className="w-3 h-3" />+{delta}{unit} vs prior
    </span>
  )
  if (delta < 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500">
      <ArrowDownRight className="w-3 h-3" />{delta}{unit} vs prior
    </span>
  )
  return <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400"><Minus className="w-3 h-3" />No change</span>
}

function CategoryBadge({ category }) {
  const map = {
    Electronics: 'bg-blue-50 text-blue-700',
    Rewards:     'bg-violet-50 text-violet-700',
    Apparel:     'bg-eco-50 text-eco-700',
    Repairs:     'bg-amber-50 text-amber-700',
    Accessories: 'bg-slate-100 text-slate-600',
    Digital:     'bg-pink-50 text-pink-700',
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[category] || 'bg-slate-100 text-slate-600'}`}>{category}</span>
}

function ProductSparkline({ data }) {
  const W = 56, H = 20
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - ((v - min) / range) * H
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 56, height: 20 }} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinejoin="round" />
      <circle
        cx={(data.length - 1) / (data.length - 1) * W}
        cy={H - ((data[data.length - 1] - min) / range) * H}
        r="2"
        fill="#16a34a"
      />
    </svg>
  )
}

function RedemptionChart({ data }) {
  const W = 480, H = 160
  const PAD = { top: 16, right: 16, bottom: 32, left: 40 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(...data.map(d => d.value))
  const minVal = 0

  function xOf(i) { return PAD.left + (i / (data.length - 1)) * chartW }
  function yOf(v) { return PAD.top + chartH - ((v - minVal) / (maxVal - minVal || 1)) * chartH }

  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ')
  const areaClose = `${xOf(data.length - 1)},${PAD.top + chartH} ${xOf(0)},${PAD.top + chartH}`

  // Y grid
  const ySteps = 4
  const yGridVals = Array.from({ length: ySteps + 1 }, (_, i) => Math.round((i / ySteps) * maxVal))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Grid */}
      {yGridVals.map(v => (
        <line key={v}
          x1={PAD.left} y1={yOf(v)}
          x2={PAD.left + chartW} y2={yOf(v)}
          stroke="#f1f5f9" strokeWidth="1"
        />
      ))}
      {/* Area fill */}
      <polygon
        points={`${pts} ${areaClose}`}
        fill="#4ade80"
        opacity="0.12"
      />
      {/* Line */}
      <polyline points={pts} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round" />
      {/* Dots */}
      {data.map((d, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(d.value)} r="3" fill="#16a34a" stroke="#fff" strokeWidth="1.5">
          <title>{d.label}: {d.value} redemptions</title>
        </circle>
      ))}
      {/* X-axis labels */}
      {data.map((d, i) => (
        <text key={i} x={xOf(i)} y={H - 8} textAnchor="middle" fontSize="8" fill="#94a3b8">{d.label}</text>
      ))}
      {/* Y-axis labels */}
      {yGridVals.map(v => (
        <text key={v} x={PAD.left - 6} y={yOf(v) + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{v}</text>
      ))}
      {/* X-axis line */}
      <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  )
}

export default function Analytics() {
  const [period, setPeriod] = useState('7d')
  const kpi = PERIOD_KPIS[period]
  const trend = TREND_DATA[period]

  // Sustainability numbers for current period
  const ptsRedeemed = kpi.redemptions * kpi.avgPoints
  const kgDiverted  = Math.round(ptsRedeemed / 1000 * 0.42)
  const co2Offset   = Math.round(kgDiverted * 2.3)

  const totalCommission = COMMISSION_DATA.reduce((s, c) => s + c.totalComm, 0).toFixed(2)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="font-semibold text-eco-700">{MERCHANT_NAME}</span> · Redemption performance and revenue breakdown
          </p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {[
            { key: '7d',  label: '7d' },
            { key: '30d', label: '30d' },
            { key: '90d', label: '90d' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                period === p.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {/* 5-card KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Impressions',              value: kpi.impressions.toLocaleString(),    delta: kpi.impressionsDelta,    unit: '%', prefix: '' },
          { label: 'Redemptions',              value: kpi.redemptions.toLocaleString(),    delta: kpi.redemptionsDelta,    unit: '%', prefix: '' },
          { label: 'Revenue (AUD)',             value: `$${kpi.revenue.toLocaleString()}`,  delta: kpi.revenueDelta,        unit: '%', prefix: '' },
          { label: 'Avg Points / Redemption',  value: kpi.avgPoints.toLocaleString(),      delta: kpi.avgPointsDelta,      unit: '%', prefix: '' },
          { label: 'Return Rate',              value: `${kpi.returnRate}%`,                delta: kpi.returnRateDelta,     unit: 'pp', prefix: '' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-xl font-black text-slate-900">{card.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 leading-tight">{card.label}</p>
            <div className="mt-1.5">
              <DeltaBadge delta={card.delta} unit={card.unit} />
            </div>
          </div>
        ))}
      </div>

      {/* Redemption trend chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-1">Redemption Trend</h2>
        <p className="text-[11px] text-slate-400 mb-4">
          {period === '7d' ? 'Daily' : period === '30d' ? 'Weekly' : 'Monthly'} redemptions for selected period · hover dots for detail
        </p>
        <RedemptionChart data={trend} />
      </div>

      {/* Top products table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Top Products</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Sorted by redemptions for selected period</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Product</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Category</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Impressions</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Redemptions</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Conv. Rate</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Revenue</th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {PRODUCTS.sort((a, b) => b.redemptions - a.redemptions).map((p, i) => (
                <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 max-w-xs">
                    <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                  </td>
                  <td className="px-3 py-3.5"><CategoryBadge category={p.category} /></td>
                  <td className="px-3 py-3.5 text-right text-xs text-slate-600">{p.impressions.toLocaleString()}</td>
                  <td className="px-3 py-3.5 text-right font-bold text-eco-700">{p.redemptions}</td>
                  <td className="px-3 py-3.5 text-right text-xs font-semibold text-slate-700">{p.convRate.toFixed(2)}%</td>
                  <td className="px-3 py-3.5 text-right font-bold text-slate-800">${p.revenue.toLocaleString()}</td>
                  <td className="px-5 py-3.5 flex justify-center items-center">
                    <ProductSparkline data={p.spark} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tier breakdown + Sustainability side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier breakdown stacked bar */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4">Tier Breakdown</h2>
          <p className="text-[11px] text-slate-400 mb-3">Redemption split by user tier for selected period</p>
          {/* Stacked bar */}
          <div className="flex h-8 rounded-xl overflow-hidden mb-4">
            {TIER_DATA.map(t => (
              <div
                key={t.tier}
                className={`${t.color} h-full flex items-center justify-center transition-all`}
                style={{ width: `${t.pct}%` }}
                title={`${t.tier}: ${t.pct}%`}
              >
                {t.pct >= 15 && (
                  <span className="text-[9px] font-bold text-white drop-shadow">{t.pct}%</span>
                )}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2">
            {TIER_DATA.map(t => (
              <div key={t.tier} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-sm flex-shrink-0 ${t.color}`} />
                <div>
                  <p className="text-xs font-semibold text-slate-700">{t.tier}</p>
                  <p className="text-[10px] text-slate-400">{t.count} redemptions · {t.pct}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sustainability impact */}
        <div className="bg-eco-950 rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-eco-700 rounded-xl">
              <Leaf className="w-4 h-4 text-eco-200" />
            </div>
            <h2 className="font-bold text-white">Sustainability Impact</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-eco-900/60 rounded-xl px-4 py-3 text-center">
              <p className="text-3xl font-black text-eco-300">{ptsRedeemed.toLocaleString()}</p>
              <p className="text-[11px] text-eco-400 mt-0.5">points redeemed this period</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-eco-900/60 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black text-white">{kgDiverted.toLocaleString()} kg</p>
                <p className="text-[10px] text-eco-400 mt-0.5">materials diverted from landfill</p>
              </div>
              <div className="bg-eco-900/60 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-black text-eco-300">{co2Offset.toLocaleString()} kg</p>
                <p className="text-[10px] text-eco-400 mt-0.5">CO₂ equivalent offset</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-eco-600 mt-4">
            Calculated at 0.42 kg material per 1,000 pts redeemed · 2.3 kg CO₂ per kg diverted (lifecycle avg)
          </p>
        </div>
      </div>

      {/* Commission summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Commission Summary</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">By product category for selected period</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Total commission</p>
            <p className="text-lg font-black text-slate-900">${totalCommission}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Category</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Redemptions</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Avg Points</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Comm. Rate</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Total Comm. (AUD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {COMMISSION_DATA.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <CategoryBadge category={row.category} />
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs text-slate-600">{row.redemptions}</td>
                  <td className="px-3 py-3.5 text-right text-xs text-slate-600">{row.avgPoints}</td>
                  <td className="px-3 py-3.5 text-right text-xs font-semibold text-slate-700">{row.commRate}%</td>
                  <td className="px-5 py-3.5 text-right font-bold text-eco-700">${row.totalComm.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-100 bg-slate-50">
                <td className="px-5 py-3 font-bold text-slate-800" colSpan={4}>Total</td>
                <td className="px-5 py-3 text-right font-black text-slate-900">${totalCommission}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
