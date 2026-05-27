import React from 'react'
import { DollarSign, Leaf, Package, TrendingUp } from 'lucide-react'

const MONTHLY = [
  { month: 'Dec', val: 14.20 }, { month: 'Jan', val: 18.60 },
  { month: 'Feb', val: 12.80 }, { month: 'Mar', val: 22.40 },
  { month: 'Apr', val: 19.70 }, { month: 'May', val: 14.20, current: true },
]
const maxVal = Math.max(...MONTHLY.map(m => m.val))

const MATERIALS = [
  { name: 'Aluminium',  kg: 8.2,  value: '$15.17', pct: 73, color: 'bg-amber-400' },
  { name: 'PET Plastic', kg: 12.4, value: '$2.98',  pct: 14, color: 'bg-blue-400' },
  { name: 'Paperboard', kg: 6.1,  value: '$0.86',  pct: 4,  color: 'bg-slate-400' },
  { name: 'Glass',      kg: 1.7,  value: '$0.03',  pct: 1,  color: 'bg-teal-400' },
  { name: 'Steel',      kg: 0.0,  value: '$0.00',  pct: 0,  color: 'bg-slate-200' },
]

export default function Earnings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Earnings Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your recycling income — past 6 months</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Lifetime Value',   value: '$102.30', sub: 'Since Jan 2024', icon: DollarSign, color: 'text-eco-700 bg-eco-50' },
          { label: 'This Month',       value: '$14.20',  sub: '↑ from last avg', icon: TrendingUp, color: 'text-blue-700 bg-blue-50' },
          { label: 'Best Month',       value: '$22.40',  sub: 'March 2025',      icon: DollarSign, color: 'text-amber-700 bg-amber-50' },
          { label: 'Total CO₂ Offset', value: '41 kg',   sub: 'Equivalent',      icon: Leaf,       color: 'text-teal-700 bg-teal-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className={`w-9 h-9 ${s.color.split(' ')[1]} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color.split(' ')[0]}`} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs font-medium text-slate-600 mt-0.5">{s.label}</div>
            <div className="text-[11px] text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Monthly Earnings (AUD)</h2>
          <div className="flex items-end gap-4 h-40">
            {MONTHLY.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-slate-600 font-medium">${m.val.toFixed(0)}</span>
                <div
                  className={`w-full rounded-t-lg transition-all ${m.current ? 'bg-eco-600' : 'bg-slate-200'}`}
                  style={{ height: `${(m.val / maxVal) * 128}px` }}
                />
                <span className={`text-xs font-medium ${m.current ? 'text-eco-700' : 'text-slate-400'}`}>
                  {m.month}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-50 text-xs text-slate-500">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-eco-600" /> Current month</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-200" /> Previous</div>
          </div>
        </div>

        {/* Tier card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Your Tier</h2>
          <div className="bg-slate-200 rounded-xl px-4 py-4 text-center mb-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Silver Tier</div>
            <div className="text-3xl font-bold text-slate-600">1,420 pts</div>
            <div className="text-xs text-slate-400 mt-0.5">+5% bonus eco points active</div>
          </div>
          <div className="text-xs font-semibold text-slate-500 mb-2">Progress to Gold</div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-slate-400 rounded-full" style={{ width: '28%' }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>1,420 pts</span>
            <span>5,000 pts</span>
          </div>
          <div className="mt-4 space-y-1.5 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Collect 3,580 more points to unlock:</p>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> +10% bonus eco points</div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Priority scheduling</div>
            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Exclusive Gold rewards</div>
          </div>
        </div>
      </div>

      {/* Material breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-5">Material Breakdown — May 2025</h2>
        <div className="space-y-4">
          {MATERIALS.filter(m => m.kg > 0).map(m => (
            <div key={m.name} className="flex items-center gap-4">
              <div className="w-24 text-sm font-medium text-slate-700 flex-shrink-0">{m.name}</div>
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.pct}%` }} />
              </div>
              <div className="w-12 text-xs text-slate-500 text-right flex-shrink-0">{m.kg} kg</div>
              <div className="w-14 text-sm font-bold text-slate-900 text-right flex-shrink-0">{m.value}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-5">
          Aluminium generates ~73% of your total value. More aluminium = higher monthly recovery.
        </p>
      </div>
    </div>
  )
}
