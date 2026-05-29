import React from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, Truck, DollarSign, AlertCircle, TrendingUp,
  CheckCircle, Clock, ArrowRight, CalendarClock, Wrench,
  Zap, Star, ChevronRight, Package, BarChart3, MapPin,
  BadgeCheck, ShieldAlert, Info,
} from 'lucide-react'

// ─── Static data ────────────────────────────────────────────────────────────

const KPI_CARDS = [
  {
    label: 'Active Stations', value: '12', sub: 'Across 3 suburbs',
    icon: Building2, color: 'text-indigo-700', bg: 'bg-indigo-50',
  },
  {
    label: 'Revenue MTD', value: '$4,280', sub: '+14.1% vs last month',
    icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-50',
  },
  {
    label: 'Collections MTD', value: '847', sub: '61 pending this week',
    icon: Truck, color: 'text-blue-700', bg: 'bg-blue-50',
  },
  {
    label: 'Avg Fill Level', value: '44%', sub: '1 station near capacity',
    icon: Package, color: 'text-amber-700', bg: 'bg-amber-50',
  },
  {
    label: 'Pending Pickups', value: '3', sub: 'Next: 31 May, 9:00 am',
    icon: CalendarClock, color: 'text-violet-700', bg: 'bg-violet-50',
  },
  {
    label: 'Contamination Rate', value: '2.3%', sub: '↓ 0.4 pts this month',
    icon: ShieldAlert, color: 'text-rose-700', bg: 'bg-rose-50',
  },
]

const STATIONS = [
  {
    id: 'ST-001', name: 'Surry Hills Hub',    suburb: 'Surry Hills',
    status: 'Active',      fillPct: 28, revenue: '$780', collections: 142, maintenance: false,
  },
  {
    id: 'ST-002', name: 'Redfern Node',       suburb: 'Redfern',
    status: 'Warning',     fillPct: 78, revenue: '$620', collections: 118, maintenance: false,
  },
  {
    id: 'ST-003', name: 'Darlinghurst Point', suburb: 'Darlinghurst',
    status: 'Maintenance', fillPct: 0,  revenue: '$0',   collections: 0,   maintenance: true,
  },
  {
    id: 'ST-004', name: 'Newtown Station',    suburb: 'Newtown',
    status: 'Active',      fillPct: 44, revenue: '$940', collections: 201, maintenance: false,
  },
]

const STATUS_STYLE = {
  Active:      'bg-emerald-100 text-emerald-700',
  Warning:     'bg-amber-100 text-amber-700',
  Maintenance: 'bg-slate-100 text-slate-600',
  Offline:     'bg-red-100 text-red-700',
}

const FILL_COLOR = (pct) => {
  if (pct >= 75) return 'bg-amber-500'
  if (pct >= 50) return 'bg-indigo-400'
  return 'bg-indigo-600'
}

const REVENUE_BARS = [
  { month: 'Dec', val: 2640 },
  { month: 'Jan', val: 2800 },
  { month: 'Feb', val: 3100 },
  { month: 'Mar', val: 2950 },
  { month: 'Apr', val: 3750 },
  { month: 'May', val: 4280, current: true },
]
const MAX_BAR = Math.max(...REVENUE_BARS.map(b => b.val))

const ALERTS = [
  {
    id: 1, type: 'offline',
    msg: 'ST-003 Darlinghurst — offline for scheduled maintenance until 30 May.',
    time: '2h ago',
  },
  {
    id: 2, type: 'capacity',
    msg: 'ST-002 Redfern at 78% capacity — consider scheduling a pickup soon.',
    time: '3h ago',
  },
  {
    id: 3, type: 'price',
    msg: 'Aluminium consumer rate updated to $1.85/kg (+2.4% spot movement).',
    time: '6h ago',
  },
  {
    id: 4, type: 'pickup',
    msg: 'Collection run CL-2841 confirmed — 14.2 tonnes processed, $380 credited.',
    time: '1d ago',
  },
  {
    id: 5, type: 'info',
    msg: 'Monthly performance report for April is now available.',
    time: '2d ago',
  },
]

const ALERT_STYLE = {
  offline:  { bar: 'bg-red-400',    icon: AlertCircle,  text: 'text-red-700' },
  capacity: { bar: 'bg-amber-400',  icon: AlertCircle,  text: 'text-amber-700' },
  price:    { bar: 'bg-indigo-400', icon: TrendingUp,   text: 'text-indigo-700' },
  pickup:   { bar: 'bg-emerald-400',icon: CheckCircle,  text: 'text-emerald-700' },
  info:     { bar: 'bg-blue-300',   icon: Info,         text: 'text-blue-700' },
}

const UPCOMING = [
  {
    id: 'CL-2850', date: '31 May 2026', time: '9:00 am',
    station: 'ST-002 Redfern Node', contractor: 'Metro Recycling Co.',
    estVol: '6.5 t', status: 'Confirmed',
  },
  {
    id: 'CL-2851', date: '3 Jun 2026', time: '11:30 am',
    station: 'ST-004 Newtown Station', contractor: 'GreenHaul Pty Ltd',
    estVol: '9.2 t', status: 'Scheduled',
  },
  {
    id: 'CL-2852', date: '7 Jun 2026', time: '8:00 am',
    station: 'ST-001 Surry Hills Hub', contractor: 'Metro Recycling Co.',
    estVol: '4.8 t', status: 'Pending',
  },
]

const PICKUP_STATUS = {
  Confirmed: 'bg-emerald-100 text-emerald-700',
  Scheduled: 'bg-indigo-100 text-indigo-700',
  Pending:   'bg-amber-100 text-amber-700',
}

// ─── Revenue bar chart ───────────────────────────────────────────────────────

function RevenueChart() {
  return (
    <div className="flex items-end gap-2 h-32">
      {REVENUE_BARS.map(b => (
        <div key={b.month} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-slate-600">
            ${(b.val / 1000).toFixed(1)}k
          </span>
          <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
            <div
              className={`w-full rounded-t-md transition-all ${b.current ? 'bg-indigo-600' : 'bg-slate-200'}`}
              style={{ height: `${(b.val / MAX_BAR) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400">{b.month}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function OperatorDashboard() {
  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6">

      {/* ── Welcome header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GreenStation Operations</h1>
          <p className="text-sm text-slate-500 mt-0.5">{today} · May 2026 reporting period</p>
        </div>
        {/* Performance badge */}
        <div className="flex items-center gap-2 bg-white border border-slate-100 shadow-sm rounded-2xl px-4 py-2.5">
          <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Star className="w-4 h-4 text-indigo-600 fill-indigo-200" />
          </div>
          <div>
            <div className="text-xs font-bold text-indigo-700">Silver Tier Operator</div>
            <div className="text-[11px] text-slate-400">Gold at $6k/mo · 2 more stations</div>
          </div>
          <BadgeCheck className="w-4 h-4 text-indigo-400 ml-1" />
        </div>
      </div>

      {/* ── 6-card KPI grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {KPI_CARDS.map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">{s.label}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid: stations + right column ── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Station status list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Station Status</h2>
            <Link to="/operator/stations" className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {STATIONS.map(st => (
              <div key={st.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Building2 className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{st.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[st.status]}`}>
                        {st.status}
                      </span>
                      {st.maintenance && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
                          <Wrench className="w-3 h-3" /> Maintenance
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {st.suburb} · {st.id}
                    </div>
                    {/* Fill level bar */}
                    <div className="mt-2">
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Fill level</span>
                        <span className={st.fillPct >= 75 ? 'text-amber-600 font-semibold' : ''}>{st.fillPct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${FILL_COLOR(st.fillPct)}`}
                          style={{ width: `${st.fillPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-slate-900">{st.revenue}</div>
                    <div className="text-[11px] text-slate-400">May revenue</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{st.collections} collections</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: revenue chart + alerts */}
        <div className="space-y-4">

          {/* Revenue chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Revenue — 6 Months</h2>
              <BarChart3 className="w-4 h-4 text-slate-300" />
            </div>
            <RevenueChart />
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-900">$4,280</span>
              <span className="text-emerald-600 font-semibold text-xs">↑ 14.1% vs April</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">MTD · May 2026</div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">Alerts</h2>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                5 active
              </span>
            </div>
            <div className="space-y-3">
              {ALERTS.map(a => {
                const style = ALERT_STYLE[a.type]
                const Icon = style.icon
                return (
                  <div key={a.id} className="flex gap-2.5">
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${style.text}`} />
                    <div>
                      <p className="text-xs text-slate-700 leading-relaxed">{a.msg}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Upcoming collections ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Upcoming Collections</h2>
          <Link to="/operator/logistics" className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
            View schedule <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {UPCOMING.map(u => (
            <div key={u.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <CalendarClock className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{u.date} · {u.time}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PICKUP_STATUS[u.status]}`}>
                    {u.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {u.station} · {u.contractor}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-slate-900">{u.estVol}</div>
                <div className="text-[11px] text-slate-400">Est. volume · {u.id}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/operator/logistics"
            className="flex flex-col items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl p-4 transition-colors text-center"
          >
            <CalendarClock className="w-5 h-5" />
            <span className="text-xs font-semibold">Schedule Pickup</span>
          </Link>
          <Link
            to="/operator/stations"
            className="flex flex-col items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl p-4 transition-colors text-center"
          >
            <Building2 className="w-5 h-5" />
            <span className="text-xs font-semibold">Add Station</span>
          </Link>
          <Link
            to="/operator/earnings"
            className="flex flex-col items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl p-4 transition-colors text-center"
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-xs font-semibold">View Earnings</span>
          </Link>
          <Link
            to="/operator/pricing"
            className="flex flex-col items-center gap-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl p-4 transition-colors text-center"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-semibold">View Pricing</span>
          </Link>
        </div>
      </div>

      {/* ── Silver tier performance badge ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Star className="w-7 h-7 text-indigo-600 fill-indigo-200" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-900 text-lg">Silver Tier Operator</h2>
              <BadgeCheck className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              You're performing well — here's what you need to reach Gold Tier.
            </p>
            <div className="mt-3 grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Monthly Revenue', current: '$4,280', target: '$6,000', pct: 71 },
                { label: 'Active Stations',  current: '12',     target: '14',     pct: 86 },
                { label: 'Avg Fill Utilisation', current: '44%', target: '55%',  pct: 80 },
              ].map(req => (
                <div key={req.label} className="bg-slate-50 rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">{req.label}</div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>{req.current}</span><span className="text-slate-300">→ {req.target}</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${req.pct}%` }} />
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
