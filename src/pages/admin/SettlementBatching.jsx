import React, { useState } from 'react'
import {
  Plus, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle, Clock, Zap, Landmark, AlertTriangle,
  Download, X, ArrowRight, Loader,
} from 'lucide-react'

const PIPELINE_STAGES = [
  { key: 'draft',      label: 'Draft',      color: 'bg-slate-400',    ring: 'ring-slate-200',    count: 2 },
  { key: 'approved',   label: 'Approved',   color: 'bg-blue-500',     ring: 'ring-blue-200',     count: 1 },
  { key: 'processing', label: 'Processing', color: 'bg-violet-500',   ring: 'ring-violet-200',   count: 1 },
  { key: 'disbursed',  label: 'Disbursed',  color: 'bg-emerald-500',  ring: 'ring-emerald-200',  count: 8 },
]

const BATCH_HISTORY = [
  { id: 'SB-20240514', period: 'May 1–14 2024',  operators: 12, total: 48320.0,  status: 'Disbursed',  createdBy: 'admin@ecobin.com.au', paymentDate: '2024-05-15', },
  { id: 'SB-20240430', period: 'Apr 16–30 2024', operators: 10, total: 41780.5,  status: 'Disbursed',  createdBy: 'admin@ecobin.com.au', paymentDate: '2024-05-01', },
  { id: 'SB-20240415', period: 'Apr 1–15 2024',  operators: 11, total: 39450.0,  status: 'Disbursed',  createdBy: 'finance@ecobin.com.au', paymentDate: '2024-04-16', },
  { id: 'SB-20240331', period: 'Mar 16–31 2024', operators: 9,  total: 35120.75, status: 'Disbursed',  createdBy: 'admin@ecobin.com.au', paymentDate: '2024-04-01', },
  { id: 'SB-20240315', period: 'Mar 1–15 2024',  operators: 13, total: 52100.0,  status: 'Disbursed',  createdBy: 'admin@ecobin.com.au', paymentDate: '2024-03-16', },
  { id: 'SB-20240229', period: 'Feb 16–29 2024', operators: 8,  total: 29870.2,  status: 'Processing', createdBy: 'finance@ecobin.com.au', paymentDate: '2024-03-01', },
  { id: 'SB-20240215', period: 'Feb 1–15 2024',  operators: 10, total: 37990.0,  status: 'Approved',   createdBy: 'admin@ecobin.com.au', paymentDate: '2024-02-16', },
  { id: 'SB-20240131', period: 'Jan 16–31 2024', operators: 7,  total: 24500.0,  status: 'Draft',      createdBy: 'admin@ecobin.com.au', paymentDate: '2024-02-01', },
]

const PREVIEW_OPERATORS = [
  { name: 'GreenCycle NSW',     amount: 8420.0,  method: 'NPP',  account: '••••  4821', onHold: false },
  { name: 'EcoLoop QLD',        amount: 5310.5,  method: 'BECS', account: '••••  3309', onHold: false },
  { name: 'ScrapMetal Co.',     amount: 7100.0,  method: 'NPP',  account: '••••  9912', onHold: true  },
  { name: 'BinStar SA',         amount: 3200.0,  method: 'BECS', account: '••••  1145', onHold: false },
  { name: 'RecoverRight VIC',   amount: 6040.25, method: 'NPP',  account: '••••  7734', onHold: false },
]

const OPERATOR_BREAKDOWN = {
  'SB-20240514': [
    { name: 'GreenCycle NSW',     amount: 5200.0,  method: 'NPP',  status: 'Paid' },
    { name: 'EcoLoop QLD',        amount: 4100.5,  method: 'BECS', status: 'Paid' },
    { name: 'BinStar SA',         amount: 7010.0,  method: 'NPP',  status: 'Paid' },
    { name: 'RecoverRight VIC',   amount: 4800.5,  method: 'BECS', status: 'Paid' },
    { name: 'ScrapMetal Co.',     amount: 6200.0,  method: 'NPP',  status: 'Paid' },
  ],
}

const STATUS_STYLE = {
  Draft:      { badge: 'bg-slate-100 text-slate-600' },
  Approved:   { badge: 'bg-blue-100 text-blue-700' },
  Processing: { badge: 'bg-violet-100 text-violet-700' },
  Disbursed:  { badge: 'bg-emerald-100 text-emerald-700' },
}

function BatchStatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Draft
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{status}</span>
}

function WizardModal({ onClose }) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [config, setConfig] = useState({
    period: 'May 1–14 2024',
    method: 'NPP',
    cutoff: '2024-05-14',
    excludeHolds: true,
    minThreshold: '50',
  })

  const eligible = PREVIEW_OPERATORS.filter(op => !(config.excludeHolds && op.onHold))
  const totalAmount = eligible.reduce((s, op) => s + op.amount, 0)

  function handleSubmit() {
    if (confirmText !== 'CONFIRM') return
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setDone(true)
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={!done ? onClose : undefined} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">New Settlement Batch</h3>
            {!done && <p className="text-xs text-slate-400 mt-0.5">Step {step} of 3</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step progress */}
        {!done && (
          <div className="px-6 pt-4 pb-0 flex items-center gap-2">
            {[1,2,3].map(n => (
              <React.Fragment key={n}>
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                  step === n ? 'text-violet-700' : step > n ? 'text-emerald-600' : 'text-slate-400'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step === n ? 'bg-violet-100 text-violet-700' :
                    step > n ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {step > n ? <CheckCircle className="w-3.5 h-3.5" /> : n}
                  </div>
                  {n === 1 ? 'Configure' : n === 2 ? 'Review' : 'Confirm'}
                </div>
                {n < 3 && <div className={`flex-1 h-px ${step > n ? 'bg-emerald-200' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Step 1 – Configure */}
        {step === 1 && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Period</label>
              <select
                value={config.period}
                onChange={e => setConfig(c => ({ ...c, period: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option>May 1–14 2024</option>
                <option>Apr 16–30 2024</option>
                <option>Apr 1–15 2024</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Payment Method</label>
              <div className="flex gap-2">
                {['NPP', 'BECS'].map(m => (
                  <button
                    key={m}
                    onClick={() => setConfig(c => ({ ...c, method: m }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      config.method === m
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    {m === 'NPP' ? <><Zap className="w-3.5 h-3.5 inline mr-1.5" />NPP (Instant)</> : <><Landmark className="w-3.5 h-3.5 inline mr-1.5" />BECS (Next Day)</>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cutoff Date</label>
              <input
                type="date"
                value={config.cutoff}
                onChange={e => setConfig(c => ({ ...c, cutoff: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Minimum Payout Threshold (AUD)</label>
              <input
                type="number"
                value={config.minThreshold}
                onChange={e => setConfig(c => ({ ...c, minThreshold: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="50.00"
              />
            </div>
            <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-slate-700">Exclude Accounts on Hold</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Skip operators with active fraud or dispute holds</p>
              </div>
              <button
                onClick={() => setConfig(c => ({ ...c, excludeHolds: !c.excludeHolds }))}
                className={`relative w-10 h-6 rounded-full transition-colors ${config.excludeHolds ? 'bg-violet-600' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${config.excludeHolds ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 – Review */}
        {step === 2 && (
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Operator Preview — {eligible.length} eligible
              {config.excludeHolds && PREVIEW_OPERATORS.some(op => op.onHold) && (
                <span className="text-amber-600 normal-case font-normal ml-2">
                  ({PREVIEW_OPERATORS.filter(op => op.onHold).length} excluded due to holds)
                </span>
              )}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 font-semibold text-slate-400">Operator</th>
                    <th className="text-right py-2 font-semibold text-slate-400">Amount</th>
                    <th className="text-center py-2 font-semibold text-slate-400">Method</th>
                    <th className="text-center py-2 font-semibold text-slate-400">Account</th>
                    <th className="text-center py-2 font-semibold text-slate-400">Eligible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {PREVIEW_OPERATORS.map((op, i) => {
                    const excluded = config.excludeHolds && op.onHold
                    return (
                      <tr key={i} className={excluded ? 'opacity-40' : ''}>
                        <td className="py-2.5 font-medium text-slate-800">{op.name}</td>
                        <td className="py-2.5 text-right font-mono text-slate-600">
                          ${op.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{op.method}</span>
                        </td>
                        <td className="py-2.5 text-center font-mono text-slate-500">{op.account}</td>
                        <td className="py-2.5 text-center">
                          {excluded
                            ? <X className="w-3.5 h-3.5 text-red-400 mx-auto" />
                            : <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mx-auto" />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">Batch Total</span>
              <span className="font-bold text-violet-700 text-base">${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {/* Step 3 – Confirm */}
        {step === 3 && !done && (
          <div className="px-6 py-5 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Period</span>
                <span className="font-semibold text-slate-800">{config.period}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method</span>
                <span className="font-semibold text-slate-800">{config.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cutoff Date</span>
                <span className="font-semibold text-slate-800">{config.cutoff}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Eligible Operators</span>
                <span className="font-semibold text-slate-800">{eligible.length}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="font-bold text-slate-900">Total Amount</span>
                <span className="font-bold text-violet-700">${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Payment Date</span>
                <span>{config.cutoff}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Type <span className="font-bold text-slate-900">CONFIRM</span> to proceed
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="CONFIRM"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono tracking-wider"
              />
            </div>
          </div>
        )}

        {/* Done state */}
        {done && (
          <div className="px-6 py-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Batch Submitted</h3>
            <p className="text-sm text-slate-500">Your settlement batch has been queued for approval.</p>
            <p className="text-xs text-violet-600 font-semibold mt-3">SB-{Date.now().toString().slice(-6)}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          {!done ? (
            <>
              <button
                onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
                className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-200 transition-colors"
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              {step < 3 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={confirmText !== 'CONFIRM' || submitting}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  {submitting ? <><Loader className="w-4 h-4 animate-spin" /> Submitting…</> : 'Submit Batch'}
                </button>
              )}
            </>
          ) : (
            <button onClick={onClose} className="flex-1 bg-violet-600 text-white font-semibold py-2.5 rounded-xl text-sm">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function BatchRow({ batch }) {
  const [expanded, setExpanded] = useState(false)
  const breakdown = OPERATOR_BREAKDOWN[batch.id]

  return (
    <>
      <tr
        className="hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => breakdown && setExpanded(e => !e)}
      >
        <td className="px-5 py-3.5">
          <span className="font-mono text-xs font-semibold text-violet-700">{batch.id}</span>
        </td>
        <td className="px-4 py-3.5 text-xs text-slate-600">{batch.period}</td>
        <td className="px-4 py-3.5 text-center text-xs font-semibold text-slate-700">{batch.operators}</td>
        <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700">
          ${batch.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
        </td>
        <td className="px-4 py-3.5 text-center">
          <BatchStatusBadge status={batch.status} />
        </td>
        <td className="px-4 py-3.5 text-xs text-slate-500">{batch.createdBy.split('@')[0]}</td>
        <td className="px-4 py-3.5 text-xs text-slate-500">{batch.paymentDate}</td>
        <td className="px-4 py-3.5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={e => { e.stopPropagation() }}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            {breakdown && (
              <span className="text-slate-300">
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            )}
          </div>
        </td>
      </tr>
      {expanded && breakdown && (
        <tr>
          <td colSpan={8} className="bg-violet-50 px-5 py-4">
            <p className="text-xs font-semibold text-violet-700 mb-2">Per-Operator Breakdown — {batch.id}</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-violet-100">
                  <th className="text-left py-1.5 font-semibold text-violet-600">Operator</th>
                  <th className="text-right py-1.5 font-semibold text-violet-600">Amount</th>
                  <th className="text-center py-1.5 font-semibold text-violet-600">Method</th>
                  <th className="text-center py-1.5 font-semibold text-violet-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-100">
                {breakdown.map((op, i) => (
                  <tr key={i}>
                    <td className="py-2 font-medium text-slate-800">{op.name}</td>
                    <td className="py-2 text-right font-mono text-slate-600">
                      ${op.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold text-[10px]">{op.method}</span>
                    </td>
                    <td className="py-2 text-center">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">{op.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}

export default function SettlementBatching() {
  const [showWizard, setShowWizard] = useState(false)

  const totalVolume = BATCH_HISTORY.reduce((s, b) => s + b.total, 0)
  const disbursedCount = BATCH_HISTORY.filter(b => b.status === 'Disbursed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settlement Batching</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Current period: <span className="font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full text-xs ml-1">May 1–14 2024</span>
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> New Batch
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Volume', value: `$${(totalVolume / 1000).toFixed(1)}k`, color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Disbursed Batches', value: disbursedCount, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'In Processing', value: BATCH_HISTORY.filter(b => b.status === 'Processing').length, color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Pending Approval', value: BATCH_HISTORY.filter(b => b.status === 'Approved' || b.status === 'Draft').length, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline flow */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-4">Active Batch Pipeline</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {PIPELINE_STAGES.map((stage, i) => (
            <React.Fragment key={stage.key}>
              <div className={`flex-1 min-w-[110px] rounded-2xl border-2 p-4 text-center ${
                stage.key === 'disbursed'
                  ? 'border-emerald-100 bg-emerald-50'
                  : stage.key === 'processing'
                  ? 'border-violet-100 bg-violet-50'
                  : stage.key === 'approved'
                  ? 'border-blue-100 bg-blue-50'
                  : 'border-slate-100 bg-slate-50'
              }`}>
                <div className={`w-10 h-10 rounded-full ${stage.color} flex items-center justify-center mx-auto mb-2`}>
                  <span className="text-white text-lg font-bold">{stage.count}</span>
                </div>
                <p className="text-sm font-bold text-slate-800">{stage.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{stage.count === 1 ? '1 batch' : `${stage.count} batches`}</p>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <ArrowRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Batch history table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Batch History</h2>
          <span className="text-xs text-slate-400">Click a row with a breakdown to expand</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Batch ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Period</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Operators</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Total (AUD)</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Created By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Payment Date</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {BATCH_HISTORY.map(batch => <BatchRow key={batch.id} batch={batch} />)}
            </tbody>
          </table>
        </div>
      </div>

      {showWizard && <WizardModal onClose={() => setShowWizard(false)} />}
    </div>
  )
}
