import React from 'react'
import { DollarSign, TrendingUp, Calendar, Download, CheckCircle } from 'lucide-react'

const MONTHLY = [
  { month: 'Jan', revenue: 2800 }, { month: 'Feb', revenue: 3100 },
  { month: 'Mar', revenue: 2950 }, { month: 'Apr', revenue: 3750 },
  { month: 'May', revenue: 4280, current: true },
]
const maxRev = Math.max(...MONTHLY.map(m => m.revenue))

const SETTLEMENTS = [
  { id: 'STL-0142', period: 'Apr 2025',  amount: '$3,487.50', status: 'Paid',    date: '1 May 2025' },
  { id: 'STL-0131', period: 'Mar 2025',  amount: '$2,803.20', status: 'Paid',    date: '1 Apr 2025' },
  { id: 'STL-0120', period: 'Feb 2025',  amount: '$2,944.80', status: 'Paid',    date: '3 Mar 2025' },
  { id: 'STL-0109', period: 'Jan 2025',  amount: '$2,660.00', status: 'Paid',    date: '3 Feb 2025' },
]

export default function OperatorEarnings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Earnings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Revenue and financial settlement history</p>
        </div>
        <button className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-lg text-sm hover:border-slate-300 transition-colors">
          <Download className="w-4 h-4" /> Export Statement
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'May Revenue',    value: '$4,280', sub: '↑ 14.1% vs Apr', color: 'text-eco-700' },
          { label: 'YTD Revenue',    value: '$16,880', sub: 'Jan–May 2025',  color: 'text-slate-900' },
          { label: 'Next Settlement', value: '1 Jun',  sub: 'Est. $4,066',   color: 'text-indigo-700' },
          { label: 'Avg Monthly',    value: '$3,376',  sub: 'YTD average',   color: 'text-slate-900' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-slate-600 mt-0.5">{s.label}</div>
            <div className="text-[11px] text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Monthly Revenue</h2>
          <div className="flex items-end gap-4 h-44">
            {MONTHLY.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">
                  ${(m.revenue / 1000).toFixed(1)}k
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all ${m.current ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  style={{ height: `${(m.revenue / maxRev) * 140}px` }}
                />
                <span className={`text-xs font-medium ${m.current ? 'text-indigo-700' : 'text-slate-400'}`}>
                  {m.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Next settlement */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Next Settlement</h2>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3 text-sm">
            {[
              { label: 'Period',     value: 'May 2025' },
              { label: 'Est. Amount', value: '$4,066.00' },
              { label: 'Payment Date', value: '1 Jun 2025' },
              { label: 'Method',     value: 'Bank Transfer' },
              { label: 'Account',    value: 'BSB 062-000 · ••4821' },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-slate-500">{r.label}</span>
                <span className="font-semibold text-slate-900">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Settlement history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Settlement History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Reference', 'Period', 'Amount', 'Status', 'Payment Date', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {SETTLEMENTS.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{s.id}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{s.period}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{s.amount}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-eco-700 bg-eco-50 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{s.date}</td>
                  <td className="px-6 py-4">
                    <button className="text-xs text-indigo-600 font-semibold hover:underline">Download</button>
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
