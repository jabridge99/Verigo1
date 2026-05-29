import React, { useState, useEffect } from 'react'
import {
  RefreshCw, CheckCircle, AlertTriangle, XCircle, Wrench,
  Search, Clock, ChevronDown, ChevronUp, CheckCheck,
} from 'lucide-react'
import { ledger, ACCOUNT_TYPE } from '../../lib/ledger'

function fmt(n) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildStatusCards(recon) {
  if (!recon) return []
  const tb = recon.trial_balance
  const floatBal   = ledger.balance('float_reserve')
  const walletBal  = ledger.balance('wallet_pool')
  const fraudBal   = ledger.balance('fraud_hold')
  const opBal      = ledger.balance('operator_payable')
  const floatIssue = recon.issues.find(i => i.code === 'NEGATIVE_FLOAT')
  const walletDrift= recon.issues.find(i => i.code === 'WALLET_POOL_DRIFT')
  return [
    {
      key: 'ledger',
      label: 'Trial Balance',
      value: tb.balanced ? 'Balanced' : `Δ ${fmt(Math.abs(tb.totalDebit - tb.totalCredit))}`,
      status: tb.balanced ? 'pass' : 'fail',
      detail: tb.balanced ? `${tb.rows.length} accounts, debits = credits` : 'Trial balance mismatch detected',
    },
    {
      key: 'float',
      label: 'Float Reserve',
      value: fmt(floatBal),
      status: floatIssue ? 'fail' : 'pass',
      detail: floatIssue ? floatIssue.detail : 'Float reserve positive',
    },
    {
      key: 'wallet',
      label: 'Wallet Pool',
      value: fmt(walletBal),
      status: walletDrift ? 'warn' : 'pass',
      detail: walletDrift ? walletDrift.detail : 'Wallet pool reconciled',
    },
    {
      key: 'operator',
      label: 'Operator Payable',
      value: fmt(opBal),
      status: 'pass',
      detail: 'Operator payable balance',
    },
    {
      key: 'fraud',
      label: 'Fraud Holds',
      value: fmt(fraudBal),
      status: 'pass',
      detail: 'Active fraud hold pool',
    },
  ]
}

function buildDiscrepancies(recon) {
  if (!recon) return []
  return recon.issues.map(issue => ({
    account: issue.code.replace(/_/g, ' '),
    expected: issue.variance ?? 0,
    actual: 0,
    variance: issue.variance ?? 0,
    autoFixable: issue.autoFixable,
    detail: issue.detail,
  }))
}

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
  const [running, setRunning]     = useState(false)
  const [progress, setProgress]   = useState(0)
  const [toast, setToast]         = useState(null)
  const [reconResult, setReconResult] = useState(null)
  const [lastRun, setLastRun]     = useState('Not yet run')

  const statusCards  = buildStatusCards(reconResult)
  const discrepancies = buildDiscrepancies(reconResult)

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
          const result = ledger.reconcile()
          setReconResult(result)
          setLastRun(new Date().toLocaleString('en-AU') + ' AEST')
          setRunning(false)
          const critical = result.issues.filter(x => x.severity === 'critical').length
          const warnings = result.issues.filter(x => x.severity === 'warning').length
          if (critical > 0) {
            setToast({ type: 'error', msg: `${critical} critical issue${critical > 1 ? 's' : ''} found — immediate action required` })
          } else if (warnings > 0) {
            setToast({ type: 'warning', msg: `${5 - warnings}/5 passed — ${warnings} warning${warnings > 1 ? 's' : ''}` })
          } else {
            setToast({ type: 'success', msg: 'All 5 checks passed — ledger is clean' })
          }
          setTimeout(() => setToast(null), 6000)
        }
      }, (i + 1) * 400)
    })
  }

  const checkLabels = ['Trial Balance', 'Float Reserve', 'Wallet Pool', 'Operator Payable', 'Fraud Hold Pool']

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
          toast.type === 'error'   ? 'bg-red-50 border-red-200 text-red-800' :
          toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
                                   : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          {toast.type === 'error'   ? <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          : toast.type === 'warning' ? <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          : <CheckCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
          <p className="text-sm font-semibold">{toast.msg}</p>
        </div>
      )}

      {/* Status grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statusCards.length > 0
          ? statusCards.map(card => <StatusCard key={card.key} card={card} />)
          : <div className="col-span-5 text-center py-8 text-slate-400 text-sm">Run reconciliation to see live results.</div>
        }
      </div>

      {/* Discrepancy table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Discrepancy Report</h2>
          <span className="text-xs text-slate-400">
            {reconResult
              ? `${discrepancies.filter(d => d.variance !== 0).length} issue${discrepancies.length !== 1 ? 's' : ''} found`
              : 'Run reconciliation to populate'
            }
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Issue</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Detail</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Variance</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Auto-fixable</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {discrepancies.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                    {reconResult ? 'No discrepancies found — ledger is balanced.' : 'Run reconciliation to see results.'}
                  </td>
                </tr>
              )}
              {discrepancies.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs font-semibold text-slate-800">{d.account}</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 max-w-xs truncate">{d.detail}</td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-mono text-xs font-semibold ${d.variance < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {d.variance > 0 ? '+' : ''}{d.variance.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {d.autoFixable
                      ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                      : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                    }
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {d.autoFixable ? (
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
