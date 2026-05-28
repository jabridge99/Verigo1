import React, { useState } from 'react'
import {
  CheckCircle, Clock, X, AlertTriangle, User, Shield,
  TrendingUp, Ban, RotateCcw,
} from 'lucide-react'
import { PAYOUT_QUEUE } from '../../data/finance'

const STATUS_STYLE = {
  'Manual Review': { badge: 'bg-amber-100 text-amber-700', icon: Clock },
  'Approved':      { badge: 'bg-blue-100 text-blue-700',   icon: CheckCircle },
  'Completed':     { badge: 'bg-eco-100 text-eco-700',     icon: CheckCircle },
  'Rejected':      { badge: 'bg-red-100 text-red-700',     icon: X },
}

const RAIL_LABEL = { payid: 'PayID', bank: 'Bank Transfer', stripe: 'Stripe' }

function RiskMeter({ score }) {
  const color = score < 25 ? 'bg-eco-500' : score < 60 ? 'bg-amber-500' : 'bg-red-500'
  const label = score < 25 ? 'Low' : score < 60 ? 'Medium' : 'High'
  const labelColor = score < 25 ? 'text-eco-600' : score < 60 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold w-12 ${labelColor}`}>{label} {score}</span>
    </div>
  )
}

function ReviewModal({ payout, onClose, onApprove, onReject }) {
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const isSafe = payout.risk_score < 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Manual Review — {payout.id}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{payout.name} · ${payout.amount.toFixed(2)} via {RAIL_LABEL[payout.rail]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {/* Risk score */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Risk Score</span>
              <span className="font-bold text-slate-800">{payout.risk_score}/100</span>
            </div>
            <RiskMeter score={payout.risk_score} />
            <p className="text-xs text-slate-500 bg-white rounded-lg p-2 border border-slate-100">{payout.reason}</p>
          </div>

          {/* User details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'KYC Status',   value: payout.kyc,                  ok: payout.kyc === 'Verified' },
              { label: 'Account Age',  value: `${payout.account_age_days} days`, ok: payout.account_age_days > 30 },
              { label: 'Prior Withdrawals', value: payout.prior_withdrawals, ok: payout.prior_withdrawals > 0 },
              { label: 'User ID',      value: payout.user_id, ok: true },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-[11px] text-slate-400">{item.label}</p>
                <p className={`text-sm font-semibold mt-0.5 ${item.ok ? 'text-slate-800' : 'text-red-600'}`}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Internal note */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Internal Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add review note..."
              rows={2}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
          </div>

          <div className="flex items-start gap-2">
            <input type="checkbox" id="rev-confirm" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" />
            <label htmlFor="rev-confirm" className="text-xs text-slate-600 cursor-pointer">
              I have reviewed this payout request and accept responsibility for my decision
            </label>
          </div>

          <div className="flex gap-3">
            <button
              disabled={!confirmed}
              onClick={() => { onReject(payout.id); onClose() }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              <Ban className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              disabled={!confirmed}
              onClick={() => { onApprove(payout.id); onClose() }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-eco-700 hover:bg-eco-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PayoutApprovals() {
  const [queue, setQueue] = useState(PAYOUT_QUEUE)
  const [reviewTarget, setReviewTarget] = useState(null)

  const approve = (id) => setQueue(q => q.map(p => p.id === id ? { ...p, status: 'Approved' } : p))
  const reject  = (id) => setQueue(q => q.map(p => p.id === id ? { ...p, status: 'Rejected' } : p))
  const reverse = (id) => setQueue(q => q.map(p => p.id === id ? { ...p, status: 'Manual Review' } : p))

  const manual    = queue.filter(p => p.status === 'Manual Review')
  const approved  = queue.filter(p => p.status === 'Approved')
  const completed = queue.filter(p => p.status === 'Completed')
  const rejected  = queue.filter(p => p.status === 'Rejected')

  const pendingValue = manual.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payout Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manual review queue · Fraud holds · Reversal management</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-amber-600">${pendingValue.toLocaleString()}</p>
          <p className="text-xs text-slate-400">pending review value</p>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Manual Review', count: manual.length,    color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Approved',      count: approved.length,  color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Completed',     count: completed.length, color: 'text-eco-700',   bg: 'bg-eco-50' },
          { label: 'Rejected',      count: rejected.length,  color: 'text-red-600',   bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Manual Review queue */}
      {manual.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Manual Review Queue
          </h2>
          <div className="space-y-3">
            {manual.map(payout => (
              <div key={payout.id} className="bg-white rounded-2xl border border-amber-100 shadow-sm">
                <div className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{payout.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Manual Review</span>
                        {payout.kyc !== 'Verified' && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">KYC {payout.kyc}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{payout.id} · {RAIL_LABEL[payout.rail]} · {payout.user_id}</p>
                      <p className="text-xs text-amber-600 mt-1">{payout.reason}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-slate-900">${payout.amount.toFixed(2)}</p>
                    <p className="text-[11px] text-slate-400">payout amount</p>
                  </div>
                </div>
                <div className="px-5 pb-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Risk Score</span>
                  </div>
                  <RiskMeter score={payout.risk_score} />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => reject(payout.id)}
                      className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" /> Quick Reject
                    </button>
                    <button
                      onClick={() => setReviewTarget(payout)}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                    >
                      <Shield className="w-3.5 h-3.5" /> Full Review & Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other statuses */}
      {[...approved, ...completed, ...rejected].length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-3">Recent Decisions</h2>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {[...approved, ...completed, ...rejected].map(payout => {
              const s = STATUS_STYLE[payout.status]
              const StatusIcon = s.icon
              return (
                <div key={payout.id} className="flex items-center gap-3 px-5 py-3.5">
                  <StatusIcon className={`w-4 h-4 flex-shrink-0 ${
                    payout.status === 'Rejected' ? 'text-red-500' :
                    payout.status === 'Completed' ? 'text-eco-600' : 'text-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{payout.name}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.badge}`}>{payout.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{payout.id} · {RAIL_LABEL[payout.rail]} · {payout.reason}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold text-slate-700">${payout.amount.toFixed(2)}</span>
                    {(payout.status === 'Approved' || payout.status === 'Rejected') && (
                      <button
                        onClick={() => reverse(payout.id)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Reverse decision"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {reviewTarget && (
        <ReviewModal
          payout={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onApprove={approve}
          onReject={reject}
        />
      )}
    </div>
  )
}
