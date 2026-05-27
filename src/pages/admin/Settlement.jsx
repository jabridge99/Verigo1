import React, { useState } from 'react'
import { DollarSign, Clock, CheckCircle, Download, Calendar, Play } from 'lucide-react'

const RUNS = [
  { id: 'STL-0143', period: 'May 2025 (partial)', totalPayout: '$142,840', operators: 156, status: 'Processing', date: '27 May 2025', disbursed: 0 },
  { id: 'STL-0142', period: 'Apr 2025',           totalPayout: '$138,560', operators: 152, status: 'Completed',  date: '1 May 2025',  disbursed: 152 },
  { id: 'STL-0131', period: 'Mar 2025',           totalPayout: '$124,200', operators: 148, status: 'Completed',  date: '1 Apr 2025',  disbursed: 148 },
  { id: 'STL-0120', period: 'Feb 2025',           totalPayout: '$118,080', operators: 145, status: 'Completed',  date: '3 Mar 2025',  disbursed: 145 },
]

const PENDING_PAYOUTS = [
  { operator: 'EcoLoop Sydney',      amount: '$5,810.00', method: 'Bank Transfer', due: '1 Jun 2025' },
  { operator: 'GreenStation Ops',    amount: '$4,066.00', method: 'Bank Transfer', due: '1 Jun 2025' },
  { operator: 'Council West Sydney', amount: '$8,244.00', method: 'Bank Transfer', due: '1 Jun 2025' },
  { operator: 'CirclHub Melbourne',  amount: '$4,655.00', method: 'Bank Transfer', due: '1 Jun 2025' },
  { operator: 'CleanRun Brisbane',   amount: '$2,897.50', method: 'Bank Transfer', due: '1 Jun 2025' },
]

const STATUS_STYLE = {
  Completed:  'bg-eco-100 text-eco-700',
  Processing: 'bg-amber-100 text-amber-700',
  Scheduled:  'bg-blue-100 text-blue-700',
}

export default function AdminSettlement() {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settlement</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Financial settlement runs and operator payment management
          </p>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Play className="w-4 h-4" /> Run Settlement
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'YTD Disbursed',     value: '$523.7K', sub: 'Jan–May 2025',       color: 'text-eco-700' },
          { label: 'May (Est.)',         value: '$142.8K', sub: 'In progress',         color: 'text-amber-700' },
          { label: 'Active Operators',  value: '156',     sub: 'Awaiting settlement', color: 'text-violet-700' },
          { label: 'Next Run',          value: '1 Jun',   sub: 'Automated monthly',   color: 'text-slate-900' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs font-medium text-slate-600 mt-0.5">{s.label}</div>
            <div className="text-[11px] text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Run history */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Settlement Runs</h2>
            <button className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {RUNS.map(run => (
              <div key={run.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    run.status === 'Completed' ? 'bg-eco-50' : 'bg-amber-50'
                  }`}>
                    {run.status === 'Completed'
                      ? <CheckCircle className="w-4 h-4 text-eco-700" />
                      : <Clock className="w-4 h-4 text-amber-700" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{run.id}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[run.status]}`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {run.period} · {run.operators} operators · {run.date}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">{run.totalPayout}</div>
                  <button className="text-xs text-violet-600 font-semibold hover:underline mt-0.5">
                    {run.status === 'Completed' ? 'Download' : 'View'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending payouts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Pending Payouts</h2>
            <p className="text-xs text-slate-400 mt-0.5">Due 1 Jun 2025</p>
          </div>
          <div className="divide-y divide-slate-50">
            {PENDING_PAYOUTS.map(p => (
              <div key={p.operator} className="px-6 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{p.operator}</div>
                  <div className="text-xs text-slate-400">{p.method}</div>
                </div>
                <div className="font-bold text-sm text-slate-900 flex-shrink-0">{p.amount}</div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-slate-50 bg-slate-50 rounded-b-2xl">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Total Pending</span>
              <span className="font-bold text-slate-900">$25,672.50</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Run Settlement?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will process payouts for 156 operators totalling approximately <strong>$142,840</strong>. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:border-slate-300 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
