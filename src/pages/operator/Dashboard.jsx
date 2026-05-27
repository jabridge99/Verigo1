import React from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, Truck, DollarSign, AlertCircle, TrendingUp,
  CheckCircle, Clock, ArrowRight, BarChart3,
} from 'lucide-react'

const STATS = [
  { label: 'Active Stations',    value: '12',      sub: 'Across 3 suburbs',  icon: Building2,  color: 'text-indigo-700', bg: 'bg-indigo-50' },
  { label: 'Revenue (May)',      value: '$4,280',  sub: '+14% vs April',     icon: DollarSign, color: 'text-eco-700',    bg: 'bg-eco-50' },
  { label: 'Collections (May)', value: '847',     sub: 'Completed',          icon: Truck,      color: 'text-blue-700',   bg: 'bg-blue-50' },
  { label: 'Active Alerts',      value: '3',       sub: 'Requires attention', icon: AlertCircle, color: 'text-amber-700', bg: 'bg-amber-50' },
]

const STATIONS = [
  { id: 'ST-001', name: 'Surry Hills Hub',    status: 'Active',      capacity: 28, revenue: '$780', collections: 142 },
  { id: 'ST-002', name: 'Redfern Node',       status: 'Active',      capacity: 61, revenue: '$620', collections: 118 },
  { id: 'ST-003', name: 'Darlinghurst Point', status: 'Maintenance', capacity: 0,  revenue: '$0',   collections: 0 },
  { id: 'ST-004', name: 'Newtown Station',    status: 'Active',      capacity: 44, revenue: '$940', collections: 201 },
]

const ALERTS = [
  { id: 1, type: 'warning', msg: 'ST-003 Darlinghurst — offline for scheduled maintenance until 30 May', time: '2h ago' },
  { id: 2, type: 'info',    msg: 'Collection run CL-2841 completed — 14.2 tonnes processed', time: '5h ago' },
  { id: 3, type: 'warning', msg: 'ST-002 Redfern reaching 60% capacity — schedule pickup', time: '1d ago' },
]

const STATUS_STYLE = {
  Active:      'bg-eco-100 text-eco-700',
  Maintenance: 'bg-amber-100 text-amber-700',
  Offline:     'bg-red-100 text-red-700',
}

const REVENUE_BARS = [
  { month: 'Jan', val: 2800 }, { month: 'Feb', val: 3100 }, { month: 'Mar', val: 2950 },
  { month: 'Apr', val: 3750 }, { month: 'May', val: 4280, current: true },
]
const maxBar = Math.max(...REVENUE_BARS.map(b => b.val))

export default function OperatorDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Operator Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">GreenStation Operations · May 2025</p>
        </div>
        <Link
          to="/operator/stations"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Building2 className="w-4 h-4" /> Manage Stations
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs font-medium text-slate-600 mt-0.5">{s.label}</div>
            <div className="text-[11px] text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Station overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Station Network</h2>
            <Link to="/operator/stations" className="text-xs text-indigo-600 font-semibold hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {STATIONS.map(st => (
              <div key={st.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{st.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[st.status]}`}>
                      {st.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{st.id} · {st.collections} collections</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-slate-900">{st.revenue}</div>
                  <div className="text-[11px] text-slate-400">May revenue</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue chart + alerts */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Revenue Trend</h2>
            <div className="flex items-end gap-2 h-28">
              {REVENUE_BARS.map(b => (
                <div key={b.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-md transition-all ${b.current ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    style={{ height: `${(b.val / maxBar) * 100}%` }}
                  />
                  <span className="text-[10px] text-slate-400">{b.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-sm">
              <span className="font-bold text-slate-900">$4,280</span>
              <span className="text-eco-600 font-semibold text-xs ml-2">↑ 14.1%</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Alerts</h2>
            <div className="space-y-3">
              {ALERTS.map(a => (
                <div key={a.id} className="flex gap-3">
                  <div className={`w-1.5 rounded-full flex-shrink-0 self-stretch ${a.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <div>
                    <p className="text-xs text-slate-700 leading-relaxed">{a.msg}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{a.time}</p>
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
