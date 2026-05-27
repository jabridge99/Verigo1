import React from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar, DollarSign, Package, Leaf, Users,
  ArrowRight, CheckCircle, Clock, TrendingUp, MapPin,
} from 'lucide-react'

const STATS = [
  { label: 'Value Recovered',     value: '$14.20', sub: 'This month',   icon: DollarSign, color: 'text-eco-700',    bg: 'bg-eco-50' },
  { label: 'Materials Collected', value: '28.4 kg', sub: 'This month',  icon: Package,    color: 'text-blue-700',   bg: 'bg-blue-50' },
  { label: 'CO₂ Offset',         value: '41 kg',   sub: 'Equivalent',  icon: Leaf,       color: 'text-teal-700',   bg: 'bg-teal-50' },
  { label: 'Circle Rank',         value: '#2',      sub: 'of 3 members', icon: Users,     color: 'text-purple-700', bg: 'bg-purple-50' },
]

const COLLECTIONS = [
  { date: '27 May 2025', type: '240L Mixed Recyclables', weight: '12.0 kg', value: '$5.40', status: 'Completed' },
  { date: '13 May 2025', type: '240L Mixed Recyclables', weight: '16.4 kg', value: '$8.80', status: 'Completed' },
  { date: '29 Apr 2025', type: '240L Cardboard & Paper',  weight: '9.2 kg',  value: '$3.22', status: 'Completed' },
]

const QUICK_ACTIONS = [
  { label: 'Book Pickup',       to: '/consumer/book',    icon: Calendar,    color: 'text-eco-700 bg-eco-50' },
  { label: 'Find a Bin',        to: '/consumer/find',    icon: MapPin,      color: 'text-blue-700 bg-blue-50' },
  { label: 'Eco Rewards',       to: '/consumer/rewards', icon: TrendingUp,  color: 'text-purple-700 bg-purple-50' },
  { label: 'Household Circle',  to: '/consumer/circle',  icon: Users,       color: 'text-orange-700 bg-orange-50' },
]

export default function ConsumerDashboard() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Good morning, Sarah</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your recycling summary for May 2025</p>
        </div>
        <Link
          to="/consumer/book"
          className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm"
        >
          <Calendar className="w-4 h-4" /> Book Pickup
        </Link>
      </div>

      {/* Next pickup banner */}
      <div className="bg-eco-700 rounded-2xl px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs font-semibold text-eco-200 uppercase tracking-wider mb-0.5">
              Next Scheduled Pickup
            </div>
            <div className="font-bold text-lg leading-tight">
              Thursday, 29 May · 8:00 am – 12:00 pm
            </div>
            <div className="text-sm text-eco-200 mt-0.5">
              240L Mixed Recyclables · 14 Garden St, Surry Hills NSW
            </div>
          </div>
        </div>
        <Link
          to="/consumer/book"
          className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Manage →
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs font-medium text-slate-600 mt-0.5">{s.label}</div>
            <div className="text-[11px] text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Collections table + sidebar */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Recent Collections</h2>
            <button className="text-xs text-eco-700 font-semibold hover:underline">View all</button>
          </div>
          <div className="divide-y divide-slate-50">
            {COLLECTIONS.map(c => (
              <div key={c.date} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-eco-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-eco-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{c.type}</div>
                    <div className="text-xs text-slate-400">{c.date} · {c.weight}</div>
                  </div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <div className="text-sm font-bold text-eco-700">{c.value}</div>
                  <span className="text-[11px] text-eco-700 bg-eco-50 px-2 py-0.5 rounded-full">
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-1.5">
              {QUICK_ACTIONS.map(a => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.color}`}>
                    <a.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 flex-1">{a.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Credit balance */}
          <div className="bg-slate-900 rounded-2xl p-5 text-white">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
              Eco Credit Balance
            </div>
            <div className="text-3xl font-bold text-eco-400">$14.20</div>
            <div className="text-sm text-slate-400 mt-1">Available to spend</div>
            <Link
              to="/consumer/rewards"
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-eco-400 font-semibold hover:text-eco-300 transition-colors"
            >
              Browse Eco Rewards <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
