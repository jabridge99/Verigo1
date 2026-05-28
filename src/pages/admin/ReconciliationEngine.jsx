import React, { useState } from 'react'
import { CheckCircle, AlertTriangle, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { RECON_RUNS } from '../../data/finance'

const ITEM_STYLE = {
  exception: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', label: 'Exception' },
  missing:   { badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500',   label: 'Missing' },
  ghost:     { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', label: 'Ghost' },
}

function ReconCard({ run }) {
  const [expanded, setExpanded] = useState(false)
  const isMatched = run.status === 'Matched'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm ${isMatched ? 'border-slate-100' : 'border-amber-100'}`}>
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isMatched ? 'bg-eco-50' : 'bg-amber-50'
          }`}>
            {isMatched
              ? <CheckCircle className="w-5 h-5 text-eco-600" />
              : <AlertTriangle className="w-5 h-5 text-amber-600" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">{run.provider}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                isMatched ? 'bg-eco-100 text-eco-700' : 'bg-amber-100 text-amber-700'
              }`}>{run.status}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{run.id} · {run.date} · {run.records_total.toLocaleString()} records</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {run.variance !== 0 ? (
            <>
              <p className="text-xl font-bold text-amber-600">${run.variance.toFixed(2)}</p>
              <p className="text-[11px] text-slate-400">variance</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-eco-700">$0.00</p>
              <p className="text-[11px] text-slate-400">variance</p>
            </>
          )}
        </div>
      </div>

      {/* Match stats */}
      <div className="px-5 pb-4 grid grid-cols-4 gap-3">
        {[
          { label: 'Matched',    value: run.matched,    color: 'text-eco-700',    bg: 'bg-eco-50' },
          { label: 'Exceptions', value: run.exceptions, color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Missing',    value: run.missing,    color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'Ghost',      value: run.ghost,      color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Provider vs internal */}
      <div className="px-5 pb-4 grid sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-slate-50 rounded-xl px-4 py-3">
          <p className="text-[11px] text-slate-400 mb-0.5">Internal Ledger</p>
          <p className="font-bold text-slate-800">${run.total_internal.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl px-4 py-3 ${run.variance !== 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
          <p className="text-[11px] text-slate-400 mb-0.5">Provider Feed</p>
          <p className={`font-bold ${run.variance !== 0 ? 'text-amber-700' : 'text-slate-800'}`}>
            ${run.total_provider.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Exceptions */}
      {run.items.length > 0 && (
        <>
          <div className="border-t border-slate-50">
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
            >
              <span>{run.items.length} item{run.items.length !== 1 ? 's' : ''} requiring attention</span>
              {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
          {expanded && (
            <div className="border-t border-slate-50 divide-y divide-slate-50">
              {run.items.map((item, i) => {
                const s = ITEM_STYLE[item.type]
                return (
                  <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-slate-600">{item.ref}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.note}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-700 flex-shrink-0">${item.amount.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ReconciliationEngine() {
  const totalVariance = RECON_RUNS.reduce((s, r) => s + r.variance, 0)
  const exceptionRuns = RECON_RUNS.filter(r => r.status === 'Exception').length
  const totalRecords  = RECON_RUNS.reduce((s, r) => s + r.records_total, 0)
  const totalMatched  = RECON_RUNS.reduce((s, r) => s + r.matched, 0)
  const matchRate     = ((totalMatched / totalRecords) * 100).toFixed(1)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reconciliation Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Internal ledger vs provider feed — matched · exceptions · missing · ghost entries
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <RefreshCw className="w-4 h-4" /> Run Reconciliation
        </button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Match Rate',       value: `${matchRate}%`, color: matchRate >= 99 ? 'text-eco-700' : 'text-amber-600', bg: matchRate >= 99 ? 'bg-eco-50' : 'bg-amber-50' },
          { label: 'Total Variance',   value: `$${totalVariance.toFixed(2)}`, color: totalVariance > 0 ? 'text-amber-600' : 'text-eco-700', bg: totalVariance > 0 ? 'bg-amber-50' : 'bg-eco-50' },
          { label: 'Runs with Exceptions', value: exceptionRuns, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Total Records',    value: totalRecords.toLocaleString(), color: 'text-slate-800', bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Item type legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { type: 'exception', desc: 'Internal & provider differ (amount or timing)' },
          { type: 'missing',   desc: 'Present internally, absent from provider feed' },
          { type: 'ghost',     desc: 'Present in provider feed, no internal record' },
        ].map(item => {
          const s = ITEM_STYLE[item.type]
          return (
            <div key={item.type} className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-100 px-3 py-2">
              <div className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className={`font-bold ${s.badge.split(' ')[1]}`}>{s.label}:</span>
              <span className="text-slate-500">{item.desc}</span>
            </div>
          )
        })}
      </div>

      {/* Reconciliation runs */}
      <div className="space-y-4">
        {RECON_RUNS.map(run => <ReconCard key={run.id} run={run} />)}
      </div>
    </div>
  )
}
