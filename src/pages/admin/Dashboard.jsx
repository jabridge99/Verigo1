import React from 'react'
import { Link } from 'react-router-dom'
import { Users, Building2, Truck, DollarSign, TrendingUp, Globe, Shield, AlertCircle } from 'lucide-react'

const STATS = [
  { label: 'Registered Members',   value: '340,821', sub: '+4.2% this month',   icon: Users,      color: 'text-violet-700', bg: 'bg-violet-50' },
  { label: 'Active Operators',      value: '156',     sub: 'Across 28 suburbs',  icon: Building2,  color: 'text-indigo-700', bg: 'bg-indigo-50' },
  { label: 'Collection Runs (May)', value: '12,480',  sub: '↑ 8.1% vs Apr',     icon: Truck,      color: 'text-blue-700',   bg: 'bg-blue-50' },
  { label: 'Platform Revenue (May)', value: '$1.84M', sub: 'Gross before settle', icon: DollarSign, color: 'text-eco-700',   bg: 'bg-eco-50' },
]

const TOP_OPERATORS = [
  { name: 'GreenStation Ops',    suburb: 'Inner East',  collections: 847,  revenue: '$4,280' },
  { name: 'EcoLoop Sydney',      suburb: 'North Shore', collections: 1240, revenue: '$6,105' },
  { name: 'CirclHub Melbourne',  suburb: 'Inner North', collections: 980,  revenue: '$4,900' },
  { name: 'CleanRun Brisbane',   suburb: 'South Side',  collections: 620,  revenue: '$3,050' },
]

const ALERTS = [
  { type: 'alert',   msg: 'ST-0418 Alexandria offline > 48h — auto-maintenance triggered',    time: '1h ago' },
  { type: 'info',    msg: 'Settlement batch STL-0143 processed — $142K disbursed to 156 operators', time: '6h ago' },
  { type: 'warning', msg: 'Commodity feed: Aluminium up 2.4% — consumer rate auto-adjusted',  time: '6h ago' },
  { type: 'info',    msg: 'New operator onboarded: CirclHub Perth (ST-0500)',                  time: '1d ago' },
]

const COMMODITIES = [
  { mat: 'Aluminium',  price: '$2,180/t', change: +2.4 },
  { mat: 'PET Plastic', price: '$320/t',  change: -0.8 },
  { mat: 'Clear Glass', price: '$45/t',   change:  0.0 },
  { mat: 'Steel Cans',  price: '$195/t',  change: +3.1 },
]

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">CirclLoop · Australia-wide · May 2025</p>
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
        {/* Top operators */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Top Operators by Volume</h2>
            <Link to="/admin/partners" className="text-xs text-violet-600 font-semibold hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {TOP_OPERATORS.map((op, i) => (
              <div key={op.name} className="flex items-center gap-4 px-6 py-4">
                <div className="text-lg font-bold text-slate-200 w-5">{i + 1}</div>
                <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-violet-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{op.name}</div>
                  <div className="text-xs text-slate-400">{op.suburb} · {op.collections} collections</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-slate-900">{op.revenue}</div>
                  <div className="text-[11px] text-slate-400">May revenue</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Commodity snapshot */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">Commodity Snapshot</h2>
              <Link to="/admin/pricing" className="text-xs text-violet-600 font-semibold hover:underline">
                Manage →
              </Link>
            </div>
            <div className="space-y-3">
              {COMMODITIES.map(c => (
                <div key={c.mat} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 font-medium">{c.mat}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{c.price}</span>
                    <span className={`text-xs font-semibold ${c.change > 0 ? 'text-eco-600' : c.change < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {c.change !== 0 ? `${c.change > 0 ? '+' : ''}${c.change}%` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System health */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">System Health</h2>
            <div className="space-y-2">
              {[
                { service: 'API Gateway',      status: 'Operational' },
                { service: 'Payment Engine',   status: 'Operational' },
                { service: 'Commodity Feed',   status: 'Operational' },
                { service: 'IoT Bin Telemetry', status: 'Coming Soon' },
              ].map(s => (
                <div key={s.service} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{s.service}</span>
                  <span className={`font-semibold ${s.status === 'Operational' ? 'text-eco-600' : 'text-slate-400'}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Platform Alerts</h2>
            <div className="space-y-3">
              {ALERTS.slice(0, 3).map((a, i) => (
                <div key={i} className="flex gap-2">
                  <div className={`w-1.5 rounded-full flex-shrink-0 self-stretch ${
                    a.type === 'alert' ? 'bg-red-400' : a.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
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
