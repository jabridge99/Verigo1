import React from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Building2, Truck, DollarSign, MapPin, ShieldAlert,
  Clock, Leaf, ArrowUpRight, ArrowDownRight, Minus,
  Terminal, RefreshCw, UserPlus, Flag, CheckSquare,
  Zap, Settings, BarChart2, AlertTriangle, TrendingUp,
} from 'lucide-react'

// ─── Platform Health ─────────────────────────────────────────────────────────
const SERVICES = [
  { name: 'API Gateway',       status: 'green'  },
  { name: 'Pricing Engine',    status: 'green'  },
  { name: 'Payment Rails',     status: 'amber'  },
  { name: 'IoT Feed',          status: 'green'  },
  { name: 'Fraud Engine',      status: 'green'  },
  { name: 'Settlement Queue',  status: 'amber'  },
]

const STATUS_DOT = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
}
const STATUS_LABEL = {
  green: 'text-emerald-700 bg-emerald-50',
  amber: 'text-amber-700 bg-amber-50',
  red:   'text-red-700 bg-red-50',
}
const STATUS_TEXT = { green: 'Operational', amber: 'Degraded', red: 'Down' }

// ─── KPI Cards ───────────────────────────────────────────────────────────────
const KPIS = [
  {
    label: 'Registered Members',
    value: '340,821',
    sub: '+4.2% vs last month',
    trend: 'up',
    icon: Users,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
  },
  {
    label: 'Active Operators',
    value: '156',
    sub: 'Across 28 suburbs',
    trend: 'up',
    icon: Building2,
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
  },
  {
    label: 'Collection Runs (MTD)',
    value: '12,480',
    sub: '+8.1% vs May',
    trend: 'up',
    icon: Truck,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
  },
  {
    label: 'Platform Revenue (MTD)',
    value: '$1.84M',
    sub: 'Gross before settlement',
    trend: 'up',
    icon: DollarSign,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
  },
  {
    label: 'Active Stations',
    value: '894',
    sub: '12 offline · 3 maintenance',
    trend: 'flat',
    icon: MapPin,
    color: 'text-cyan-700',
    bg: 'bg-cyan-50',
  },
  {
    label: 'Fraud Alerts',
    value: '23',
    sub: '+5 since yesterday',
    trend: 'down',
    icon: ShieldAlert,
    color: 'text-red-700',
    bg: 'bg-red-50',
  },
  {
    label: 'Pending Settlements',
    value: '14',
    sub: '$384K awaiting release',
    trend: 'flat',
    icon: Clock,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  {
    label: 'CO₂ Diverted (MTD)',
    value: '1,204 t',
    sub: 'vs 1,019 t last month',
    trend: 'up',
    icon: Leaf,
    color: 'text-teal-700',
    bg: 'bg-teal-50',
  },
]

// ─── Revenue Chart Data (12 months) ──────────────────────────────────────────
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
const REVENUE  = [920, 1050, 1130, 980, 1210, 1380, 1520, 1280, 1410, 1600, 1750, 1840]
const PAYOUTS  = [540, 620,  680,  580, 720,  820,  910,  770,  840,  960,  1050, 1100]

function sparkPolyline(data, h, w, color, fill) {
  const max = Math.max(...data)
  const min = Math.min(...data) * 0.85
  const pad = 10
  const xs = data.map((_, i) => pad + (i / (data.length - 1)) * (w - pad * 2))
  const ys = data.map(v => h - pad - ((v - min) / (max - min)) * (h - pad * 2))
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  const fillPts = `${xs[0]},${h - pad} ${pts} ${xs[xs.length - 1]},${h - pad}`
  return { pts, fillPts, xs, ys }
}

// ─── Network Coverage ─────────────────────────────────────────────────────────
const CITIES = [
  { city: 'Sydney',    state: 'NSW', stations: 312, operators: 48, revenue: '$641K', collections: 4280 },
  { city: 'Melbourne', state: 'VIC', stations: 244, operators: 37, revenue: '$502K', collections: 3340 },
  { city: 'Brisbane',  state: 'QLD', stations: 142, operators: 22, revenue: '$291K', collections: 1940 },
  { city: 'Perth',     state: 'WA',  stations: 98,  operators: 18, revenue: '$201K', collections: 1340 },
  { city: 'Adelaide',  state: 'SA',  stations: 64,  operators: 14, revenue: '$131K', collections: 874  },
  { city: 'Canberra',  state: 'ACT', stations: 34,  operators: 8,  revenue: '$71K',  collections: 473  },
]

// ─── System Events ────────────────────────────────────────────────────────────
const EVENTS = [
  { icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', msg: 'Settlement batch STL-0143 processed — $142K disbursed to 156 operators', time: '2m ago', tag: 'Settlement' },
  { icon: Flag,        color: 'text-red-600',     bg: 'bg-red-50',     msg: 'Fraud flag raised on member #MBR-88402 — duplicate scan pattern detected', time: '18m ago', tag: 'Fraud' },
  { icon: RefreshCw,   color: 'text-blue-600',    bg: 'bg-blue-50',    msg: 'Commodity feed sync: Aluminium +2.4%, PET −0.8% — consumer rates auto-adjusted', time: '44m ago', tag: 'Pricing' },
  { icon: UserPlus,    color: 'text-violet-600',  bg: 'bg-violet-50',  msg: 'New operator onboarded: CirclHub Perth (ST-0500) — pending first station review', time: '1h ago', tag: 'Onboarding' },
  { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50',   msg: 'Payment Rails latency elevated — P99 at 1,840ms, threshold 1,500ms', time: '2h ago', tag: 'Infra' },
  { icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', msg: 'Station ST-0418 Alexandria back online after scheduled maintenance window', time: '3h ago', tag: 'Station' },
  { icon: Terminal,    color: 'text-slate-600',   bg: 'bg-slate-100',  msg: 'Platform config pushed: recycler payout rate revised to 68% across all tiers', time: '5h ago', tag: 'Config' },
  { icon: Flag,        color: 'text-red-600',     bg: 'bg-red-50',     msg: 'Fraud cluster detected in Inner West — 6 accounts suspended pending review', time: '7h ago', tag: 'Fraud' },
]

// ─── Quick Actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Command Centre', desc: 'Live ops & alerts',          icon: Zap,        to: '/admin/command-center', accent: 'bg-violet-600 text-white' },
  { label: 'Fraud Console',  desc: 'Review flagged activity',    icon: ShieldAlert, to: '/admin/fraud',          accent: 'bg-red-50 text-red-700' },
  { label: 'Settlements',    desc: 'Approve & release batches',  icon: DollarSign,  to: '/admin/settlement',     accent: 'bg-emerald-50 text-emerald-700' },
  { label: 'Trader Desk',    desc: 'Commodity prices & feeds',   icon: BarChart2,   to: '/admin/trader',         accent: 'bg-amber-50 text-amber-700' },
  { label: 'Engineering',    desc: 'System config & infra',      icon: Settings,    to: '/admin/engineering',    accent: 'bg-slate-100 text-slate-700' },
]

// ─── Commodity Snapshot ───────────────────────────────────────────────────────
const COMMODITIES = [
  { mat: 'Aluminium',   price: '$2,180/t', change: +2.4, unit: 'LME' },
  { mat: 'PET Plastic', price: '$320/t',   change: -0.8, unit: 'ICIS' },
  { mat: 'Clear Glass', price: '$45/t',    change:  0.0, unit: 'Local' },
  { mat: 'Steel Cans',  price: '$195/t',   change: +3.1, unit: 'LME' },
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const W = 580, H = 160
  const rev  = sparkPolyline(REVENUE,  H, W, '#7c3aed', '#7c3aed')
  const pay  = sparkPolyline(PAYOUTS,  H, W, '#94a3b8', '#94a3b8')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">EcoBin · Australia-wide · May 2026</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live · Updated just now
        </div>
      </div>

      {/* ── Platform Health Bar ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Platform Health</span>
          <Link to="/admin/engineering" className="text-xs text-violet-600 font-semibold hover:underline">Status page →</Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {SERVICES.map(s => (
            <div key={s.name} className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 ${STATUS_LABEL[s.status]}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[s.status]} ${s.status !== 'green' ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-semibold text-center leading-tight">{s.name}</span>
              <span className="text-[10px] font-medium opacity-70">{STATUS_TEXT[s.status]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 8-card KPI Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {KPIS.map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 ${k.bg} rounded-xl flex items-center justify-center`}>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <span className={`mt-0.5 ${
                k.trend === 'up'   ? 'text-emerald-500' :
                k.trend === 'down' ? 'text-red-400'     : 'text-slate-300'
              }`}>
                {k.trend === 'up'   ? <ArrowUpRight className="w-4 h-4" /> :
                 k.trend === 'down' ? <ArrowDownRight className="w-4 h-4" /> :
                                     <Minus className="w-4 h-4" />}
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 leading-none">{k.value}</div>
            <div className="text-xs font-semibold text-slate-700 mt-1.5">{k.label}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Revenue Trend Chart + Network Coverage ── */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-900">Revenue Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">12-month rolling · Platform revenue vs operator payouts</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-3 h-0.5 bg-violet-600 rounded-full inline-block" />
                Platform Rev.
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                <span className="w-3 h-0.5 bg-slate-400 rounded-full inline-block" />
                Op. Payouts
              </span>
            </div>
          </div>

          <div className="relative w-full overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full" style={{ minWidth: 320 }}>
              {/* Phase shading: H2 2025 (Jul–Dec = indices 1–6) */}
              <rect
                x={sparkPolyline(REVENUE, H, W, '', '').xs[1] - 4}
                y={8}
                width={sparkPolyline(REVENUE, H, W, '', '').xs[6] - sparkPolyline(REVENUE, H, W, '', '').xs[1] + 8}
                height={H - 14}
                fill="#f5f3ff"
                rx="4"
              />
              {/* Q1 2026 phase (indices 7–9) */}
              <rect
                x={rev.xs[7] - 4}
                y={8}
                width={rev.xs[9] - rev.xs[7] + 8}
                height={H - 14}
                fill="#fefce8"
                rx="4"
              />

              {/* Payout fill */}
              <polyline
                points={pay.fillPts}
                fill="#94a3b820"
                stroke="none"
              />
              {/* Revenue fill */}
              <polyline
                points={rev.fillPts}
                fill="#7c3aed18"
                stroke="none"
              />
              {/* Payout line */}
              <polyline
                points={pay.pts}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeDasharray="5 3"
                strokeLinejoin="round"
              />
              {/* Revenue line */}
              <polyline
                points={rev.pts}
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Revenue dots */}
              {rev.xs.map((x, i) => (
                <circle key={i} cx={x} cy={rev.ys[i]} r="3.5" fill="#7c3aed" />
              ))}

              {/* Month labels */}
              {MONTHS.map((m, i) => (
                <text
                  key={m}
                  x={rev.xs[i]}
                  y={H + 20}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#94a3b8"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                >
                  {m}
                </text>
              ))}
            </svg>
          </div>

          <div className="flex items-center gap-6 mt-2 pt-3 border-t border-slate-50 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-violet-50 border border-violet-200 inline-block" /> H2 2025</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-50 border border-yellow-200 inline-block" /> Q1 2026</span>
            <span className="ml-auto font-semibold text-slate-600">MTD: <span className="text-violet-700">$1.84M</span></span>
          </div>
        </div>

        {/* Network Coverage */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Network Coverage</h2>
            <Link to="/admin/stations" className="text-xs text-violet-600 font-semibold hover:underline">Map view →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-2.5">City</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Stations</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Ops</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2.5">Rev (MTD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {CITIES.map((c, i) => (
                  <tr key={c.city} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 w-3">{i + 1}</span>
                        <div>
                          <div className="font-semibold text-slate-900">{c.city}</div>
                          <div className="text-[10px] text-slate-400">{c.state} · {c.collections.toLocaleString()} runs</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-800">{c.stations}</td>
                    <td className="px-3 py-3 text-right text-slate-500">{c.operators}</td>
                    <td className="px-3 py-3 text-right font-semibold text-violet-700">{c.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── System Events + Quick Actions + Commodity Snapshot ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* System Events */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Recent System Events</h2>
            <Link to="/admin/engineering" className="text-xs text-violet-600 font-semibold hover:underline">Full log →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {EVENTS.map((e, i) => (
              <div key={i} className="flex items-start gap-3 px-6 py-3.5 hover:bg-slate-50/50 transition-colors">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${e.bg}`}>
                  <e.icon className={`w-3.5 h-3.5 ${e.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 leading-relaxed">{e.msg}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400">{e.time}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{e.tag}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Quick Actions + Commodity */}
        <div className="space-y-5">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {QUICK_ACTIONS.map(a => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.accent}`}>
                    <a.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">{a.label}</div>
                    <div className="text-[11px] text-slate-400">{a.desc}</div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* Commodity Snapshot */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Commodity Snapshot</h2>
              <Link to="/admin/trader" className="text-xs text-violet-600 font-semibold hover:underline">Trader →</Link>
            </div>
            <div className="space-y-3">
              {COMMODITIES.map(c => (
                <div key={c.mat} className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{c.mat}</div>
                    <div className="text-[10px] text-slate-400">{c.unit}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">{c.price}</div>
                    <div className={`flex items-center justify-end gap-0.5 text-[11px] font-semibold ${
                      c.change > 0 ? 'text-emerald-600' :
                      c.change < 0 ? 'text-red-500' : 'text-slate-400'
                    }`}>
                      {c.change > 0 ? <ArrowUpRight className="w-3 h-3" /> :
                       c.change < 0 ? <ArrowDownRight className="w-3 h-3" /> :
                                      <Minus className="w-3 h-3" />}
                      {c.change !== 0 ? `${c.change > 0 ? '+' : ''}${c.change}%` : 'Flat'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
