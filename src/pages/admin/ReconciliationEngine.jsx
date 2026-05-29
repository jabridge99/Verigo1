import React, { useState, useEffect } from 'react'
import {
  RefreshCw, CheckCircle, AlertTriangle, XCircle, Wrench,
  Search, Clock, ChevronDown, ChevronUp, CheckCheck,
} from 'lucide-react'

const STATUS_CARDS = [
  {
    key: 'ledger',
    label: 'Ledger Balance',
    value: '$2,847,391.20',
    status: 'pass',
    detail: 'Internal ledger matches float pool',
  },
  {
    key: 'settlement',
    label: 'Settlement Totals',
    value: '$184,203.00',
    status: 'pass',
    detail: 'MTD settlements reconciled',
  },
  {
    key: 'wallet',
    label: 'Wallet Pool',
    value: '$43,872.55',
    status: 'pass',
    detail: 'All operator wallets accounted for',
  },
  {
    key: 'float',
    label: 'Float Reserve',
    value: '$8,120.00',
    status: 'warn',
    detail: 'Reserve 2.1% below minimum threshold',
  },
  {
    key: 'fraud',
    label: 'Fraud Hold Pool',
    value: '$1,450.00',
    status: 'pass',
    detail: '3 holds active, all within SLA',
  },
]

const DISCREPANCIES = [
  {
    account: 'Operator Wallet – GreenCycle NSW',
    expected: 4820.5,
    actual: 4817.3,
    variance: -3.2,
    autoFixable: true,
  },
  {
    account: 'Float Reserve – Main Pool',
    expected: 10000.0,
    actual: 8120.0,
    variance: -1880.0,
    autoFixable: false,
  },
  {
    account: 'Settlement Batch SB-20240511',
    expected: 22450.0,
    actual: 22450.0,
    variance: 0,
    autoFixable: true,
  },
  {
    account: 'Fraud Hold – TXN-88821',
    expected: 150.0,
    actual: 152.5,
    variance: 2.5,
    autoFixable: true,
  },
  {
    account: 'Recycler Payout – ScrapMetal Co.',
    expected: 7300.0,
    actual: 7294.15,
    variance: -5.85,
    autoFixable: false,
  },
]

const RUN_HISTORY = [
  { ts: '2024-05-14 08:00', duration: 1243, passed: 5, warned: 0, failed: 0, trigger: 'scheduled', status: 'clean' },
  { ts: '2024-05-13 08:00', duration: 1187, passed: 4, warned: 1, failed: 0, trigger: 'scheduled', status: 'warning' },
  { ts: '2024-05-12 14:32', duration: 998,  passed: 5, warned: 0, failed: 0, trigger: 'manual',    status: 'clean' },
  { ts: '2024-05-12 08:00', duration: 2104, passed: 3, warned: 1, failed: 1, trigger: 'scheduled', status: 'failed' },
  { ts: '2024-05-11 08:00', duration: 1312, passed: 5, warned: 0, failed: 0, trigger: 'scheduled', status: 'clean' },
  { ts: '2024-05-10 08:00', duration: 1095, passed: 4, warned: 1, failed: 0, trigger: 'scheduled', status: 'warning' },
  { ts: '2024-05-09 08:00', duration: 1178, passed: 5, warned: 0, failed: 0, trigger: 'manual',    status: 'clean' },
  { ts: '2024-05-08 08:00', duration: 1401, passed: 5, warned: 0, failed: 0, trigger: 'scheduled', status: 'clean' },
]

const AUTO_FIX_LOG = [
  { ts: '2024-05-14 08:01', account: 'Operator Wallet – EcoLoop QLD', field: 'balance', before: '2,340.10', after: '2,340.15', reason: 'Rounding correction after FX conversion' },
  { ts: '2024-05-13 08:02', account: 'Fraud Hold – TXN-77612',        field: 'hold_amount', before: '80.00', after: '82.50', reason: 'Applied late reversal delta' },
  { ts: '2024-05-12 14:33', account: 'Settlement Batch SB-20240510',  field: 'rail_fee',    before: '3.40',  after: '3.60',  reason: 'Fee table updated mid-cycle' },
  { ts: '2024-05-11 08:01', account: 'Wallet Pool – Aggregate',       field: 'total',       before: '43,210.00', after: '43,211.20', reason: 'Sub-cent accrual correction' },
  { ts: '2024-05-10 08:01', account: 'Operator Wallet – GreenCycle NSW', field: 'balance',  before: '1,899.95', after: '1,900.00', reason: 'Idempotency duplicate cleared' },
]

function StatusIcon({ status, size = 'w-5 h-5' }) {
  if (status === 'pass') return <CheckCircle className={`${size} text-emerald-600`} />
  if (status === 'warn') return <AlertTriangle className={`${size} text-amber-500`} />
  return <XCircle className={`${size} text-red-500`} />
}

function StatusCard({ card }) {
  const bg = card.status === 'pass' ? 'bg-emerald-50 border-emerald-100' :
             card.status === 'warn' ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
  const valueColor = card.status === 'pass' ? 'text-emerald-700' :
                     card.status === 'warn' ? 'text-amber-700' : 'text-red-700'
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${card.status !== 'pass' ? (card.status === 'warn' ? 'border-amber-100' : 'border-red-100') : 'border-slate-100'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">{card.label}</p>
        <StatusIcon status={card.status} size="w-4 h-4" />
      </div>
      <p className={`text-xl font-bold ${valueColor}`}>{card.value}</p>
      <p className="text-[11px] text-slate-400 mt-1 leading-snug">{card.detail}</p>
    </div>
  )
}

function RunStatusBadge({ status }) {
  if (status === 'clean')   return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Clean</span>
  if (status === 'warning') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Warning</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Failed</span>
}

export default function ReconciliationEngine() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState(null)
  const [expandedFix, setExpandedFix] = useState(null)
  const lastRun = '2024-05-14 08:00:43 AEST'

  function handleRunNow() {
    if (running) return
    setRunning(true)
    setProgress(0)
    setToast(null)
    const steps = [20, 40, 60, 80, 100]
    steps.forEach((p, i) => {
      setTimeout(() => {
        setProgress(p)
        if (p === 100) {
          setRunning(false)
          setToast({ type: 'warning', msg: '4/5 passed — 1 warning (Float Reserve below threshold)' })
          setTimeout(() => setToast(null), 5000)
        }
      }, (i + 1) * 400)
    })
  }

  const checkLabels = ['Ledger Balance', 'Settlement Totals', 'Wallet Pool', 'Float Reserve', 'Fraud Hold Pool']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reconciliation Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Last run: <span className="font-medium text-slate-700">{lastRun}</span>
          </p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={running}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running…' : 'Run Now'}
        </button>
      </div>

      {/* Running progress */}
      {running && (
        <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-violet-700">Running 5 checks…</p>
            <p className="text-xs text-slate-400">{progress}%</p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {checkLabels.map((label, i) => {
              const done = progress >= (i + 1) * 20
              return (
                <div key={label} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                  done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}>
                  {done ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {label}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`rounded-2xl border px-5 py-4 flex items-center gap-3 ${
          toast.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {toast.type === 'warning'
            ? <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            : <CheckCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
          <p className="text-sm font-semibold">{toast.msg}</p>
        </div>
      )}

      {/* Status grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATUS_CARDS.map(card => <StatusCard key={card.key} card={card} />)}
      </div>

      {/* Discrepancy table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Discrepancy Report</h2>
          <span className="text-xs text-slate-400">{DISCREPANCIES.filter(d => d.variance !== 0).length} discrepancies found</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Account</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Expected (AUD)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Actual (AUD)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Variance</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Auto-fixable</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {DISCREPANCIES.map((d, i) => (
                <tr key={i} className={`hover:bg-slate-50 transition-colors ${d.variance !== 0 ? '' : 'opacity-60'}`}>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-slate-800 text-xs">{d.account}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600">
                    ${d.expected.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600">
                    ${d.actual.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-mono text-xs font-semibold ${
                      d.variance === 0 ? 'text-emerald-600' :
                      d.variance < 0 ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {d.variance === 0 ? '—' : (d.variance > 0 ? '+' : '') + d.variance.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {d.variance === 0 ? (
                      <span className="text-slate-300 text-xs">—</span>
                    ) : d.autoFixable ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {d.variance === 0 ? (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Balanced</span>
                    ) : d.autoFixable ? (
                      <button className="text-[10px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1">
                        <Wrench className="w-3 h-3" /> Fix
                      </button>
                    ) : (
                      <button className="text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1">
                        <Search className="w-3 h-3" /> Investigate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Run history table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Run History</h2>
          <p className="text-xs text-slate-400 mt-0.5">Last 8 reconciliation runs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Timestamp</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Duration</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Passed</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Warned</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Failed</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Trigger</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {RUN_HISTORY.map((run, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-slate-600">{run.ts}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-mono text-xs text-slate-500">{run.duration}ms</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-xs font-bold text-emerald-600">{run.passed}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-xs font-bold ${run.warned > 0 ? 'text-amber-500' : 'text-slate-300'}`}>{run.warned}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-xs font-bold ${run.failed > 0 ? 'text-red-500' : 'text-slate-300'}`}>{run.failed}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      run.trigger === 'manual'
                        ? 'bg-violet-50 text-violet-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}>{run.trigger}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <RunStatusBadge status={run.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-fix log */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Auto-Fix Log</h2>
            <p className="text-xs text-slate-400 mt-0.5">Automatic corrections applied by the engine</p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">{AUTO_FIX_LOG.length} corrections</span>
        </div>
        <div className="divide-y divide-slate-50">
          {AUTO_FIX_LOG.map((fix, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800">{fix.account}</span>
                    <span className="text-[10px] font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{fix.field}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{fix.reason}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] font-mono text-red-500 bg-red-50 px-2 py-0.5 rounded">{fix.before}</span>
                    <span className="text-[10px] text-slate-400">→</span>
                    <span className="text-[11px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{fix.after}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0 font-mono">{fix.ts}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
