import React, { useState, useEffect } from 'react'
import {
  DollarSign, Clock, CheckCircle, Download, Calendar, Play,
  AlertTriangle, X, ChevronRight, RefreshCw, Eye, Ban,
  Building2, Layers, ArrowRight, Filter, ExternalLink,
} from 'lucide-react'
import { ledger } from '../../lib/ledger'

// ─── Static data ────────────────────────────────────────────────────────────

const KPI = [
  {
    label: 'YTD Disbursed',
    value: '$523,680',
    sub: 'Jan – May 2025',
    icon: DollarSign,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
  },
  {
    label: 'Current Period (Est.)',
    value: '$142,840',
    sub: 'May 2025 · In progress',
    icon: Clock,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  {
    label: 'Operators Awaiting',
    value: '156',
    sub: 'Pending this cycle',
    icon: Building2,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
  },
  {
    label: 'Next Settlement Date',
    value: '1 Jun 2025',
    sub: 'Automated monthly',
    icon: Calendar,
    color: 'text-slate-700',
    bg: 'bg-slate-100',
  },
  {
    label: 'Failed Payouts',
    value: '3',
    sub: 'Require attention',
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
]

const PIPELINE = [
  { label: 'Collected',     count: 21840, color: 'bg-slate-200',    text: 'text-slate-600' },
  { label: 'Verified',      count: 21612, color: 'bg-blue-200',     text: 'text-blue-700' },
  { label: 'Batch Created', count: 21612, color: 'bg-violet-300',   text: 'text-violet-800' },
  { label: 'Approved',      count: 21330, color: 'bg-violet-500',   text: 'text-violet-50' },
  { label: 'Disbursed',     count: 20890, color: 'bg-violet-700',   text: 'text-violet-50' },
]

const SETTLEMENTS = [
  {
    id: 'STL-0143',
    period: 'May 2025 (partial)',
    operators: 156,
    total: 142840,
    status: 'Processing',
    paymentDate: '—',
    operators_detail: [
      { name: 'EcoLoop Sydney',      stations: 12, weight: '18,420 kg', gross: 5810, fee: 465, net: 5345 },
      { name: 'GreenStation Ops',    stations: 8,  weight: '12,890 kg', gross: 4066, fee: 325, net: 3741 },
      { name: 'Council West Sydney', stations: 22, weight: '26,100 kg', gross: 8244, fee: 659, net: 7585 },
      { name: 'CirclHub Melbourne',  stations: 9,  weight: '14,750 kg', gross: 4655, fee: 372, net: 4283 },
      { name: 'CleanRun Brisbane',   stations: 6,  weight: '9,180 kg',  gross: 2897, fee: 232, net: 2665 },
    ],
  },
  {
    id: 'STL-0142',
    period: 'Apr 2025',
    operators: 152,
    total: 138560,
    status: 'Completed',
    paymentDate: '1 May 2025',
    operators_detail: [
      { name: 'EcoLoop Sydney',      stations: 12, weight: '17,800 kg', gross: 5620, fee: 450, net: 5170 },
      { name: 'GreenStation Ops',    stations: 8,  weight: '12,500 kg', gross: 3940, fee: 315, net: 3625 },
      { name: 'Council West Sydney', stations: 22, weight: '25,200 kg', gross: 7950, fee: 636, net: 7314 },
      { name: 'CirclHub Melbourne',  stations: 9,  weight: '14,200 kg', gross: 4480, fee: 358, net: 4122 },
      { name: 'CleanRun Brisbane',   stations: 6,  weight: '8,900 kg',  gross: 2810, fee: 225, net: 2585 },
    ],
  },
  {
    id: 'STL-0131',
    period: 'Mar 2025',
    operators: 148,
    total: 124200,
    status: 'Completed',
    paymentDate: '1 Apr 2025',
    operators_detail: [
      { name: 'EcoLoop Sydney',      stations: 11, weight: '16,100 kg', gross: 5080, fee: 406, net: 4674 },
      { name: 'GreenStation Ops',    stations: 8,  weight: '11,200 kg', gross: 3532, fee: 283, net: 3249 },
      { name: 'Council West Sydney', stations: 21, weight: '22,900 kg', gross: 7220, fee: 578, net: 6642 },
      { name: 'CirclHub Melbourne',  stations: 9,  weight: '12,800 kg', gross: 4038, fee: 323, net: 3715 },
      { name: 'CleanRun Brisbane',   stations: 6,  weight: '8,100 kg',  gross: 2554, fee: 204, net: 2350 },
    ],
  },
  {
    id: 'STL-0120',
    period: 'Feb 2025',
    operators: 145,
    total: 118080,
    status: 'Completed',
    paymentDate: '3 Mar 2025',
    operators_detail: [
      { name: 'EcoLoop Sydney',      stations: 11, weight: '15,200 kg', gross: 4797, fee: 384, net: 4413 },
      { name: 'GreenStation Ops',    stations: 7,  weight: '10,500 kg', gross: 3312, fee: 265, net: 3047 },
      { name: 'Council West Sydney', stations: 20, weight: '21,800 kg', gross: 6878, fee: 550, net: 6328 },
      { name: 'CirclHub Melbourne',  stations: 8,  weight: '11,900 kg', gross: 3754, fee: 300, net: 3454 },
      { name: 'CleanRun Brisbane',   stations: 5,  weight: '7,600 kg',  gross: 2397, fee: 192, net: 2205 },
    ],
  },
  {
    id: 'STL-0110',
    period: 'Jun 2025',
    operators: 158,
    total: 147200,
    status: 'Scheduled',
    paymentDate: '1 Jul 2025',
    operators_detail: [],
  },
]

const PENDING_PAYOUTS = [
  { id: 1, operator: 'EcoLoop Sydney',       account: 'BSB 062-001 · ****4421', amount: 5345, method: 'NPP',  due: '1 Jun 2025', hold: false },
  { id: 2, operator: 'GreenStation Ops',      account: 'BSB 033-710 · ****8820', amount: 3741, method: 'BECS', due: '1 Jun 2025', hold: false },
  { id: 3, operator: 'Council West Sydney',   account: 'BSB 082-055 · ****1193', amount: 7585, method: 'NPP',  due: '1 Jun 2025', hold: false },
  { id: 4, operator: 'CirclHub Melbourne',    account: 'BSB 013-280 · ****6674', amount: 4283, method: 'BECS', due: '1 Jun 2025', hold: true  },
  { id: 5, operator: 'CleanRun Brisbane',     account: 'BSB 124-001 · ****3310', amount: 2665, method: 'NPP',  due: '1 Jun 2025', hold: false },
  { id: 6, operator: 'RecycleCo Adelaide',    account: 'BSB 105-055 · ****7782', amount: 4110, method: 'BECS', due: '1 Jun 2025', hold: false },
]

const FAILED_PAYOUTS = [
  { id: 1, operator: 'Perth Green Loop',  amount: 3220, reason: 'Account closed – BSB mismatch',  date: '1 May 2025', attempts: 2 },
  { id: 2, operator: 'Nth QLD Recycle',   amount: 1880, reason: 'Insufficient account details',    date: '1 May 2025', attempts: 1 },
  { id: 3, operator: 'WA Depot Network',  amount: 5540, reason: 'NPP gateway timeout – retry pending', date: '27 May 2025', attempts: 3 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = n =>
  '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_PILL = {
  Completed:  'bg-emerald-100 text-emerald-700',
  Processing: 'bg-amber-100 text-amber-700',
  Scheduled:  'bg-blue-100 text-blue-700',
  Failed:     'bg-red-100 text-red-600',
}

const STATUS_ICON = {
  Completed:  <CheckCircle className="w-4 h-4 text-emerald-600" />,
  Processing: <Clock className="w-4 h-4 text-amber-600" />,
  Scheduled:  <Calendar className="w-4 h-4 text-blue-600" />,
  Failed:     <AlertTriangle className="w-4 h-4 text-red-500" />,
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SettlementDetailSlideOut({ settlement, onClose }) {
  if (!settlement) return null
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold tracking-widest text-violet-600 uppercase">Settlement</span>
              <span className="text-xs text-slate-400">{settlement.id}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{settlement.period}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {settlement.operators} operators · {fmt(settlement.total)} total
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 text-sm">Per-Operator Breakdown</h3>
            <button className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          {settlement.operators_detail.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Operator data not yet available for scheduled settlements.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Operator', 'Stations', 'Weight', 'Gross Amt', 'Platform Fee', 'Net Amount'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {settlement.operators_detail.map((op, i) => (
                    <tr key={i} className="hover:bg-violet-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{op.name}</td>
                      <td className="px-4 py-3 text-slate-500">{op.stations}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{op.weight}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{fmt(op.gross)}</td>
                      <td className="px-4 py-3 text-red-500 text-xs">−{fmt(op.fee)}</td>
                      <td className="px-4 py-3 font-bold text-violet-700">{fmt(op.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Totals</td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {fmt(settlement.operators_detail.reduce((a, o) => a + o.gross, 0))}
                    </td>
                    <td className="px-4 py-3 font-bold text-red-500 text-xs">
                      −{fmt(settlement.operators_detail.reduce((a, o) => a + o.fee, 0))}
                    </td>
                    <td className="px-4 py-3 font-bold text-violet-700">
                      {fmt(settlement.operators_detail.reduce((a, o) => a + o.net, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[settlement.status]}`}>
            {settlement.status}
          </span>
          {settlement.paymentDate !== '—' && (
            <span className="text-xs text-slate-400">Payment date: {settlement.paymentDate}</span>
          )}
          <div className="flex-1" />
          <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700">
            <Download className="w-3.5 h-3.5" /> Full Report
          </button>
        </div>
      </div>
    </div>
  )
}

function RunSettlementModal({ onClose }) {
  const [confirmation, setConfirmation] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const ready = confirmation === 'CONFIRM'

  function handleRun() {
    if (!ready) return
    setSubmitted(true)
    setTimeout(onClose, 1800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-8 pt-8 pb-0">
          <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mb-4">
            <Play className="w-6 h-6 text-violet-700" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Run Settlement</h3>
          <p className="text-sm text-slate-500 mt-1">
            You are about to initiate a settlement run for the current period.
          </p>
        </div>

        {/* Details */}
        <div className="mx-8 mt-5 rounded-2xl border border-slate-100 bg-slate-50 divide-y divide-slate-100">
          {[
            ['Period',           'May 2025 (partial)'],
            ['Operators',        '156 active operators'],
            ['Estimated Amount', '$142,840.00 AUD'],
            ['Payment Method',   'NPP + BECS batch'],
            ['Scheduled Date',   '1 Jun 2025'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs font-medium text-slate-500">{k}</span>
              <span className="text-xs font-bold text-slate-900">{v}</span>
            </div>
          ))}
        </div>

        {/* Confirmation input */}
        <div className="px-8 mt-5">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Type <span className="font-bold text-violet-700 tracking-widest">CONFIRM</span> to proceed
          </label>
          <input
            type="text"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value.toUpperCase())}
            placeholder="CONFIRM"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        {/* Actions */}
        <div className="px-8 py-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:border-slate-300 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={!ready || submitted}
            className={`flex-1 font-semibold py-3 rounded-xl text-sm transition-colors ${
              submitted
                ? 'bg-emerald-600 text-white'
                : ready
                ? 'bg-violet-600 hover:bg-violet-700 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {submitted ? '✓ Queued' : 'Run Settlement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminSettlement() {
  const [showRunModal, setShowRunModal]           = useState(false)
  const [activeDetail, setActiveDetail]           = useState(null)
  const [retryId, setRetryId]                     = useState(null)
  const [ledgerKpis, setLedgerKpis]               = useState(null)
  const [recentEntries, setRecentEntries]         = useState([])

  useEffect(() => {
    setLedgerKpis({ opPayable: ledger.balance('operator_payable'), platformFee: ledger.balance('platform_fee'), entryCount: ledger.entryCount })
    setRecentEntries(ledger.statement('operator_payable', 20))
    const id = setInterval(() => {
      setLedgerKpis({ opPayable: ledger.balance('operator_payable'), platformFee: ledger.balance('platform_fee'), entryCount: ledger.entryCount })
      setRecentEntries(ledger.statement('operator_payable', 20))
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const pipelineMax = PIPELINE[0].count

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settlement</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Financial settlement runs, operator disbursements, and payout management
          </p>
        </div>
        <button
          onClick={() => setShowRunModal(true)}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
        >
          <Play className="w-4 h-4" /> Run Settlement
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {KPI.map((k, idx) => {
          const Icon = k.icon
          let displayValue = k.value
          if (idx === 0 && ledgerKpis) displayValue = '$' + ledgerKpis.opPayable.toLocaleString('en-AU', { maximumFractionDigits: 0 })
          if (idx === 1 && ledgerKpis) displayValue = '$' + ledgerKpis.platformFee.toLocaleString('en-AU', { maximumFractionDigits: 0 })
          return (
            <div key={k.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className={`w-9 h-9 ${k.bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${k.color}`} style={{ width: 18, height: 18 }} />
              </div>
              <div className={`text-2xl font-bold ${k.color}`}>{displayValue}</div>
              <div className="text-xs font-semibold text-slate-600 mt-0.5">{idx === 0 ? 'Operator Payable' : idx === 1 ? 'Platform Revenue' : k.label}</div>
              <div className="text-[11px] text-slate-400">{k.sub}</div>
            </div>
          )
        })}
      </div>

      {/* ── Live Ledger Entries ── */}
      {recentEntries.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <span className="w-2 h-2 bg-eco-500 rounded-full animate-pulse" />
            <h2 className="font-bold text-slate-900">Live Operator Ledger</h2>
            <span className="text-xs text-slate-400 ml-auto">{ledgerKpis?.entryCount ?? 0} total entries</span>
          </div>
          <div className="divide-y divide-slate-50">
            {recentEntries.slice(0, 10).map(entry => (
              <div key={entry.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{entry.description}</p>
                  <p className="text-[11px] text-slate-400">{new Date(entry.ts).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })} · {entry.actor}</p>
                </div>
                <p className="font-bold text-slate-900 flex-shrink-0">
                  ${Math.abs(entry.lines.find(l => l.account === 'operator_payable')?.amount ?? 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Settlement pipeline ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-5">Settlement Pipeline — May 2025</h2>
        <div className="flex items-end gap-2 overflow-x-auto pb-2">
          {PIPELINE.map((step, i) => (
            <React.Fragment key={step.label}>
              <div className="flex flex-col items-center gap-2 min-w-[90px]">
                <span className="text-xs font-bold text-slate-700">
                  {step.count.toLocaleString()}
                </span>
                <div className="relative w-full flex flex-col items-center">
                  <div
                    className={`w-full rounded-t-xl ${step.color}`}
                    style={{ height: `${Math.round((step.count / pipelineMax) * 72) + 24}px` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-slate-500 text-center leading-tight">{step.label}</span>
              </div>
              {i < PIPELINE.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-300 mb-6 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          Counts represent individual redemption transactions in the current settlement batch.
        </p>
      </div>

      {/* ── Settlement history table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <div>
            <h2 className="font-semibold text-slate-900">Settlement History</h2>
            <p className="text-xs text-slate-400 mt-0.5">All settlement runs</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
            <button className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Reference', 'Period', 'Operators', 'Total Amount', 'Status', 'Payment Date', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {SETTLEMENTS.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs font-bold text-slate-700">{s.id}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-700 font-medium">{s.period}</td>
                  <td className="px-5 py-4 text-slate-500">{s.operators}</td>
                  <td className="px-5 py-4 font-bold text-slate-900">{fmt(s.total)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_PILL[s.status]}`}>
                      {STATUS_ICON[s.status]}
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">{s.paymentDate}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {s.status === 'Completed' && (
                        <button className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      )}
                      <button
                        onClick={() => setActiveDetail(s)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pending payouts ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <div>
            <h2 className="font-semibold text-slate-900">Pending Payouts</h2>
            <p className="text-xs text-slate-400 mt-0.5">Queued for 1 Jun 2025 disbursement</p>
          </div>
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
            {PENDING_PAYOUTS.length} queued
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Operator', 'Account', 'Amount', 'Method', 'Due Date', 'Hold', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {PENDING_PAYOUTS.map(p => (
                <tr key={p.id} className={`hover:bg-slate-50/60 transition-colors ${p.hold ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-5 py-4 font-semibold text-slate-900">{p.operator}</td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{p.account}</td>
                  <td className="px-5 py-4 font-bold text-slate-900">{fmt(p.amount)}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      p.method === 'NPP' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {p.method}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-500 text-xs">{p.due}</td>
                  <td className="px-5 py-4">
                    {p.hold
                      ? <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">On Hold</span>
                      : <span className="text-xs text-slate-400">—</span>
                    }
                  </td>
                  <td className="px-5 py-4">
                    <button className="text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">
                      {p.hold ? 'Release Hold' : 'Place Hold'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={2} className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Total Pending</td>
                <td className="px-5 py-3 font-bold text-slate-900">
                  {fmt(PENDING_PAYOUTS.reduce((a, p) => a + p.amount, 0))}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Failed / held payouts ── */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-red-50">
          <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Failed &amp; Held Payouts</h2>
            <p className="text-xs text-slate-400 mt-0.5">Require manual review or retry</p>
          </div>
          <span className="ml-auto text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
            {FAILED_PAYOUTS.length} outstanding
          </span>
        </div>
        <div className="divide-y divide-slate-50">
          {FAILED_PAYOUTS.map(f => (
            <div key={f.id} className="flex items-start gap-4 px-6 py-4">
              <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Ban className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{f.operator}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-sm font-bold text-red-600">{fmt(f.amount)}</span>
                  <span className="text-[11px] text-slate-400">Attempts: {f.attempts}</span>
                </div>
                <div className="text-xs text-red-500 mt-0.5">{f.reason}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Failed: {f.date}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setRetryId(retryId === f.id ? null : f.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    retryId === f.id
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {retryId === f.id ? 'Queued' : 'Retry'}
                </button>
                <button className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modals / slide-outs ── */}
      {showRunModal && <RunSettlementModal onClose={() => setShowRunModal(false)} />}
      {activeDetail && (
        <SettlementDetailSlideOut
          settlement={activeDetail}
          onClose={() => setActiveDetail(null)}
        />
      )}
    </div>
  )
}
