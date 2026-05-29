import React, { useState, useMemo } from 'react'
import {
  CheckCircle, X, AlertTriangle, Clock, Shield, Filter,
  ChevronDown, User, Building2, Gift, Ban, RotateCcw,
  Pause, ChevronRight, DollarSign,
} from 'lucide-react'

// ── Static data ───────────────────────────────────────────────────────────────

const INITIAL_QUEUE = [
  { id: 'PO-4821', recipient: 'GreenLoop Pty Ltd',   type: 'Operator Settlement',  amount: 18450.00, requested: '2026-05-29 08:14', risk: 'low',    score: 12, bank: 'ANZ ****4821', bsb: '012-003', status: 'Pending', flags: [] },
  { id: 'PO-4820', recipient: 'Sarah Chen',          type: 'Consumer Withdrawal',  amount: 284.50,   requested: '2026-05-29 07:55', risk: 'medium', score: 48, bank: 'CBA ****0931', bsb: '062-001', status: 'Pending', flags: ['New account < 30 days', 'First withdrawal'] },
  { id: 'PO-4819', recipient: 'EcoPartner QLD',      type: 'Operator Settlement',  amount: 8420.00,  requested: '2026-05-29 07:30', risk: 'low',    score: 8,  bank: 'NAB ****2244', bsb: '083-004', status: 'Pending', flags: [] },
  { id: 'PO-4818', recipient: 'Marcus Torres',       type: 'Referral Bonus',       amount: 50.00,    requested: '2026-05-29 07:10', risk: 'low',    score: 5,  bank: 'Westpac ****8801', bsb: '033-002', status: 'Pending', flags: [] },
  { id: 'PO-4817', recipient: 'WasteWorks NSW',      type: 'Operator Settlement',  amount: 15600.00, requested: '2026-05-28 18:42', risk: 'high',   score: 72, bank: 'ANZ ****3319', bsb: '012-088', status: 'Pending', flags: ['Large amount > $15k', 'Unusual timing', 'New operator'] },
  { id: 'PO-4816', recipient: 'Amara Okafor',        type: 'Consumer Withdrawal',  amount: 142.00,   requested: '2026-05-28 17:20', risk: 'medium', score: 41, bank: 'ING ****5502', bsb: '923-100', status: 'Pending', flags: ['Multiple withdrawals today'] },
  { id: 'PO-4815', recipient: 'NorthBin Co',         type: 'Operator Settlement',  amount: 9100.00,  requested: '2026-05-28 16:00', risk: 'low',    score: 14, bank: 'CommBank ****7714', bsb: '062-100', status: 'Pending', flags: [] },
  { id: 'PO-4814', recipient: 'James Wu',            type: 'Referral Bonus',       amount: 75.00,    requested: '2026-05-28 14:30', risk: 'low',    score: 9,  bank: 'NAB ****1122', bsb: '083-001', status: 'Pending', flags: [] },
  // Processed today
  { id: 'PO-4813', recipient: 'CleanEarth VIC',      type: 'Operator Settlement',  amount: 7280.00,  requested: '2026-05-29 06:00', risk: 'low',    score: 11, bank: 'ANZ ****0014', bsb: '012-004', status: 'Approved',  approver: 'admin@ecobin.com.au', approvedAt: '2026-05-29 09:15', flags: [] },
  { id: 'PO-4812', recipient: 'Lin Zhao',            type: 'Consumer Withdrawal',  amount: 310.00,   requested: '2026-05-29 05:44', risk: 'medium', score: 55, bank: 'CBA ****4410', bsb: '062-005', status: 'Rejected',  approver: 'admin@ecobin.com.au', approvedAt: '2026-05-29 08:50', rejectReason: 'Failed KYC re-check', flags: ['Mismatched address'] },
  { id: 'PO-4811', recipient: 'GreenLoop Pty Ltd',   type: 'Operator Settlement',  amount: 12800.00, requested: '2026-05-28 23:00', risk: 'low',    score: 7,  bank: 'ANZ ****4821', bsb: '012-003', status: 'Approved',  approver: 'finance@ecobin.com.au', approvedAt: '2026-05-29 08:00', flags: [] },
  { id: 'PO-4810', recipient: 'Tom Riley',           type: 'Referral Bonus',       amount: 50.00,    requested: '2026-05-28 22:10', risk: 'low',    score: 3,  bank: 'Westpac ****2203', bsb: '033-100', status: 'Approved', approver: 'admin@ecobin.com.au', approvedAt: '2026-05-29 07:30', flags: [] },
  { id: 'PO-4809', recipient: 'EcoPartner QLD',      type: 'Operator Settlement',  amount: 5400.00,  requested: '2026-05-28 20:00', risk: 'low',    score: 10, bank: 'NAB ****2244', bsb: '083-004', status: 'Rejected',  approver: 'finance@ecobin.com.au', approvedAt: '2026-05-29 07:10', rejectReason: 'Duplicate payout request', flags: [] },
]

const REJECT_REASONS = [
  'Failed KYC re-check',
  'Duplicate payout request',
  'Account suspended',
  'Fraud risk — manual hold',
  'Insufficient documentation',
  'Bank details mismatch',
  'Exceeds daily limit',
  'Other (see notes)',
]

const TYPE_ICON = {
  'Operator Settlement':  Building2,
  'Consumer Withdrawal':  User,
  'Referral Bonus':       Gift,
}

const TYPE_COLOR = {
  'Operator Settlement':  'bg-violet-50 text-violet-700',
  'Consumer Withdrawal':  'bg-blue-50 text-blue-700',
  'Referral Bonus':       'bg-emerald-50 text-emerald-700',
}

const RISK_STYLE = {
  low:    { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', label: 'Low' },
  medium: { badge: 'bg-amber-100 text-amber-700',     bar: 'bg-amber-500',   label: 'Medium' },
  high:   { badge: 'bg-red-100 text-red-700',         bar: 'bg-red-500',     label: 'High' },
}

const fmt = (n) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Modals ────────────────────────────────────────────────────────────────────

function ApproveModal({ payout, onClose, onApprove }) {
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const rs = RISK_STYLE[payout.risk]
  const TypeIcon = TYPE_ICON[payout.type] || User

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Approve Payout</h3>
            <p className="text-xs text-slate-400 mt-0.5">{payout.id} · {payout.type}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {/* Recipient & amount */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <TypeIcon className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 truncate">{payout.recipient}</p>
              <p className="text-xs text-slate-500 mt-0.5">{payout.bank} · BSB {payout.bsb}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xl font-bold text-slate-900">{fmt(payout.amount)}</p>
              <p className="text-[10px] text-slate-400">AUD</p>
            </div>
          </div>

          {/* Risk section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Risk Assessment</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rs.badge}`}>
                {rs.label} · {payout.score}/100
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${rs.bar}`} style={{ width: `${payout.score}%` }} />
            </div>
          </div>

          {/* Flags */}
          {payout.flags.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Risk Flags
              </p>
              {payout.flags.map(f => (
                <p key={f} className="text-xs text-amber-600 pl-5">• {f}</p>
              ))}
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Payout Type',    value: payout.type },
              { label: 'Requested',      value: payout.requested },
              { label: 'Bank Account',   value: payout.bank },
              { label: 'BSB',            value: payout.bsb },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400">{item.label}</p>
                <p className="font-semibold text-slate-800 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Approval Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Add an internal note..."
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 accent-violet-600" />
            <span className="text-xs text-slate-600">
              I have reviewed this payout and the recipient bank details. I authorise the payment of{' '}
              <strong className="text-violet-700">{fmt(payout.amount)}</strong> to <strong>{payout.recipient}</strong>.
            </span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!confirmed}
            onClick={() => { onApprove(payout.id); onClose() }}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            <CheckCircle className="w-4 h-4" /> Approve Payout
          </button>
        </div>
      </div>
    </div>
  )
}

function RejectModal({ payout, onClose, onReject }) {
  const [reason, setReason] = useState('')
  const [notes, setNotes]   = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Reject Payout</h3>
            <p className="text-xs text-slate-400 mt-0.5">{payout.id} · {payout.recipient}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-red-700">Amount to be rejected: {fmt(payout.amount)}</p>
            <p className="text-xs text-red-500 mt-0.5">Funds will remain in hold until manually released.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Rejection Reason <span className="text-red-500">*</span></label>
            <div className="relative">
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-red-300 text-slate-700"
              >
                <option value="">Select a reason…</option>
                {REJECT_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Additional Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Provide context for the rejection…"
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!reason}
              onClick={() => { onReject(payout.id, reason); onClose() }}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              <Ban className="w-4 h-4" /> Reject Payout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PayoutApprovals() {
  const [queue, setQueue]             = useState(INITIAL_QUEUE)
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget,  setRejectTarget]  = useState(null)
  const [selectedIds,   setSelectedIds]   = useState([])
  const [filterType,    setFilterType]    = useState('all')
  const [filterRisk,    setFilterRisk]    = useState('all')
  const [filterMinAmt,  setFilterMinAmt]  = useState('')
  const [showFilters,   setShowFilters]   = useState(false)

  const approve = (id) => {
    setQueue(q => q.map(p => p.id === id
      ? { ...p, status: 'Approved', approver: 'admin@ecobin.com.au', approvedAt: new Date().toLocaleString('en-AU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' }) }
      : p
    ))
    setSelectedIds(s => s.filter(sid => sid !== id))
  }

  const reject = (id, reason) => {
    setQueue(q => q.map(p => p.id === id
      ? { ...p, status: 'Rejected', rejectReason: reason, approver: 'admin@ecobin.com.au', approvedAt: new Date().toLocaleString('en-AU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' }) }
      : p
    ))
    setSelectedIds(s => s.filter(sid => sid !== id))
  }

  const hold = (id) => setQueue(q => q.map(p => p.id === id ? { ...p, status: 'On Hold' } : p))

  const batchApprove = () => {
    selectedIds.forEach(id => approve(id))
    setSelectedIds([])
  }

  const pending   = queue.filter(p => p.status === 'Pending')
  const todayDone = queue.filter(p => p.status === 'Approved' || p.status === 'Rejected')

  const filteredPending = useMemo(() => {
    return pending.filter(p => {
      if (filterType !== 'all' && p.type !== filterType) return false
      if (filterRisk !== 'all' && p.risk !== filterRisk) return false
      if (filterMinAmt && p.amount < parseFloat(filterMinAmt)) return false
      return true
    })
  }, [pending, filterType, filterRisk, filterMinAmt])

  const pendingTotal  = pending.reduce((s, p) => s + p.amount, 0)
  const approvedToday = todayDone.filter(p => p.status === 'Approved').length
  const rejectedToday = todayDone.filter(p => p.status === 'Rejected').length

  const selectableLowRisk = filteredPending.filter(p => p.risk === 'low')
  const allLowRiskSelected = selectableLowRisk.length > 0 && selectableLowRisk.every(p => selectedIds.includes(p.id))

  const toggleSelect = (id) => {
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payout Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manual approval queue · Risk scoring · Batch controls</p>
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={batchApprove}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors self-start"
          >
            <CheckCircle className="w-4 h-4" />
            Approve Selected ({selectedIds.length})
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending Review',      value: pending.length,                       color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Total Amount Pending', value: fmt(pendingTotal),                   color: 'text-slate-800',  bg: 'bg-white' },
          { label: 'Approved Today',       value: approvedToday,                       color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Rejected Today',       value: rejectedToday,                       color: 'text-red-600',    bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-5`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs font-semibold text-slate-500 mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Type filter */}
          <div className="relative">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 appearance-none text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="all">All Types</option>
              <option value="Operator Settlement">Operator Settlement</option>
              <option value="Consumer Withdrawal">Consumer Withdrawal</option>
              <option value="Referral Bonus">Referral Bonus</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {/* Risk filter */}
          <div className="relative">
            <select
              value={filterRisk}
              onChange={e => setFilterRisk(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 appearance-none text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {/* Min amount */}
          <input
            type="number"
            placeholder="Min amount (AUD)"
            value={filterMinAmt}
            onChange={e => setFilterMinAmt(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-36 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          <span className="text-xs text-slate-400 ml-auto">{filteredPending.length} of {pending.length} pending shown</span>

          {/* Batch select low risk */}
          {selectableLowRisk.length > 0 && (
            <button
              onClick={() => {
                if (allLowRiskSelected) {
                  setSelectedIds(s => s.filter(id => !selectableLowRisk.map(p => p.id).includes(id)))
                } else {
                  setSelectedIds(s => [...new Set([...s, ...selectableLowRisk.map(p => p.id)])])
                }
              }}
              className="text-xs font-semibold text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {allLowRiskSelected ? 'Deselect Low-Risk' : `Select All Low-Risk (${selectableLowRisk.length})`}
            </button>
          )}
        </div>
      </div>

      {/* ── Approval queue table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Pending Queue</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 w-8">
                  <span className="sr-only">Select</span>
                </th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Payout ID</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Recipient</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Amount</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide hidden md:table-cell">Requested</th>
                <th className="text-center px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Risk</th>
                <th className="text-center px-4 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPending.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400 text-sm">No pending payouts match the current filters.</td>
                </tr>
              )}
              {filteredPending.map(payout => {
                const rs = RISK_STYLE[payout.risk]
                const TypeIcon = TYPE_ICON[payout.type] || User
                const isSelected = selectedIds.includes(payout.id)
                return (
                  <tr
                    key={payout.id}
                    className={`transition-colors ${
                      payout.risk === 'high' ? 'bg-red-50/40 hover:bg-red-50' :
                      payout.risk === 'medium' ? 'hover:bg-amber-50/30' :
                      'hover:bg-slate-50'
                    } ${isSelected ? 'bg-violet-50/50' : ''}`}
                  >
                    <td className="px-4 py-3.5">
                      {payout.risk === 'low' && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(payout.id)}
                          className="accent-violet-600 cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="text-xs font-mono text-violet-700">{payout.id}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{payout.recipient}</p>
                          <p className="text-[10px] text-slate-400">{payout.bank}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 hidden sm:table-cell">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[payout.type]}`}>
                        {payout.type}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <span className="text-xs font-bold text-slate-900 tabular-nums">{fmt(payout.amount)}</span>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-slate-500 hidden md:table-cell whitespace-nowrap">{payout.requested}</td>
                    <td className="px-3 py-3.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rs.badge}`}>
                          {rs.label}
                        </span>
                        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${rs.bar}`} style={{ width: `${payout.score}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setApproveTarget(payout)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                          title="Approve"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRejectTarget(payout)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          title="Reject"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => hold(payout.id)}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition-colors"
                          title="Hold"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Approved today log ── */}
      {todayDone.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900">Processed Today</h2>
            <p className="text-xs text-slate-400 mt-0.5">Approved and rejected payouts for 29 May 2026</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">ID</th>
                  <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Recipient</th>
                  <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide hidden sm:table-cell">Type</th>
                  <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Amount</th>
                  <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide hidden md:table-cell">Decision</th>
                  <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide hidden md:table-cell">Approver</th>
                  <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {todayDone.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-xs font-mono text-slate-500">{p.id}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-800">{p.recipient}</td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLOR[p.type]}`}>{p.type}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-bold text-slate-800 tabular-nums">{fmt(p.amount)}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 hidden md:table-cell">{p.approvedAt}</td>
                    <td className="px-3 py-3 text-xs text-slate-500 hidden md:table-cell">{p.approver || '—'}</td>
                    <td className="px-5 py-3 text-center">
                      {p.status === 'Approved'
                        ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Approved</span>
                        : <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Rejected</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {approveTarget && (
        <ApproveModal
          payout={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApprove={approve}
        />
      )}
      {rejectTarget && (
        <RejectModal
          payout={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={reject}
        />
      )}
    </div>
  )
}
