import React, { useState, useEffect } from 'react'
import {
  CheckCircle, X, Clock, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { overrideQueue } from '../../lib/overrideQueue'
import { marketFeed, COMMODITIES } from '../../lib/marketFeed'
import { computeExposure } from '../../lib/pricingEngine'
import { ROLES_CONFIG } from '../../data/override'

const STATUS_STYLE = {
  pending:  { badge: 'bg-amber-100 text-amber-700', label: 'Pending Approval', border: 'border-amber-200' },
  approved: { badge: 'bg-eco-100 text-eco-700',     label: 'Approved',         border: 'border-eco-200'   },
  rejected: { badge: 'bg-red-100 text-red-700',     label: 'Rejected',         border: 'border-slate-100' },
}

function SimulationPanel({ req }) {
  const price = marketFeed.getPrice(req.material)
  const spot  = price?.spot ?? COMMODITIES[req.material]?.base ?? 0
  const curr  = computeExposure(req.material, spot, 1000, req.currentRate)
  const prop  = computeExposure(req.material, spot, 1000, req.proposedRate)
  const safe  = prop.marginPct >= 15
  const loss  = prop.marginPct < 0
  return (
    <div className="bg-slate-900 rounded-xl p-4 mt-3 space-y-3">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Simulation Preview — 1,000 kg notional</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Current Rate',  value: `$${req.currentRate.toFixed(4)}/kg`,  sub: `${curr.marginPct.toFixed(1)}% margin`, color: 'text-slate-300' },
          { label: 'Proposed Rate', value: `$${req.proposedRate.toFixed(4)}/kg`, sub: `${prop.marginPct.toFixed(1)}% margin`, color: loss ? 'text-red-400' : safe ? 'text-eco-400' : 'text-amber-400' },
          { label: 'Spot (AUD/t)',  value: `$${spot.toLocaleString()}`,           sub: COMMODITIES[req.material]?.exchange ?? '', color: 'text-violet-300' },
        ].map(s => (
          <div key={s.label} className="bg-white/5 rounded-lg p-3">
            <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
            <p className={`text-[10px] font-semibold mt-0.5 ${s.color}`}>{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {loss && <span className="text-[11px] font-bold text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />NEGATIVE MARGIN — LOSS POSITION</span>}
        {!loss && !safe && <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Below 15% risk threshold</span>}
        {safe && <span className="text-[11px] font-bold text-eco-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Within safe margin band</span>}
      </div>
    </div>
  )
}

function ReviewModal({ req, onClose, onAction }) {
  const [note, setNote] = useState('')
  const price = marketFeed.getPrice(req.material)
  const spot  = price?.spot ?? 0
  const prop  = computeExposure(req.material, spot, 1000, req.proposedRate)
  const loss  = prop.marginPct < 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Review Override — {req.id}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{COMMODITIES[req.material]?.label} · Submitted by {req.trader}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-xs text-slate-400">Material</p>
              <p className="text-sm font-bold text-slate-900">{COMMODITIES[req.material]?.label}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Current Rate</p>
              <p className="text-lg font-bold text-slate-500">${req.currentRate.toFixed(4)}/kg</p>
            </div>
            <div className="text-xl text-slate-300">→</div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Proposed</p>
              <p className={`text-lg font-bold ${req.proposedRate > req.currentRate ? 'text-eco-700' : 'text-red-600'}`}>${req.proposedRate.toFixed(4)}/kg</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">New Margin</p>
              <p className={`text-sm font-bold ${loss ? 'text-red-600' : prop.marginPct < 15 ? 'text-amber-600' : 'text-eco-700'}`}>
                {prop.marginPct.toFixed(1)}%
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Rationale from {req.trader}</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3">{req.rationale || 'No rationale provided.'}</p>
          </div>
          {loss && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-semibold">This override would result in a net loss. Approval is strongly inadvisable.</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Approver note <span className="text-red-500">*</span></label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Add your review note — required for audit trail..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
          </div>
          <div className="flex gap-3">
            <button
              disabled={note.length < 5}
              onClick={() => { onAction('reject', req.id, note); onClose() }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              disabled={note.length < 5 || loss}
              onClick={() => { onAction('approve', req.id, note); onClose() }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-eco-700 hover:bg-eco-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OverrideQueuePage() {
  const [queue, setQueue]           = useState([])
  const [reviewTarget, setReview]   = useState(null)
  const [filter, setFilter]         = useState('all')
  const [expandedSim, setExpanded]  = useState(null)
  const [currentRole, setRole]      = useState('commercial_director')
  const [actionError, setError]     = useState(null)

  function refresh() { setQueue(overrideQueue.getQueue()) }

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [])

  function handleAction(action, id, note) {
    try {
      const actor = ROLES_CONFIG[currentRole]?.label ?? currentRole
      if (action === 'approve') overrideQueue.approve(id, actor)
      if (action === 'reject')  overrideQueue.reject(id, actor, note)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
    refresh()
  }

  const counts = {
    all:      queue.length,
    pending:  queue.filter(o => o.status === 'pending').length,
    approved: queue.filter(o => o.status === 'approved').length,
    rejected: queue.filter(o => o.status === 'rejected').length,
  }
  const filtered    = filter === 'all' ? queue : queue.filter(o => o.status === filter)
  const roleConfig  = ROLES_CONFIG[currentRole]
  const canApprove  = roleConfig?.can.includes('approve_override')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Override Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live approval workflow · Material consumer rate overrides</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-eco-600 font-semibold">
            <span className="w-2 h-2 bg-eco-500 rounded-full animate-pulse" /> Live · polls 3s
          </div>
          <select value={currentRole} onChange={e => setRole(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none bg-white">
            {Object.entries(ROLES_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {actionError}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all',      label: 'All',      count: counts.all },
          { id: 'pending',  label: 'Pending',  count: counts.pending },
          { id: 'approved', label: 'Approved', count: counts.approved },
          { id: 'rejected', label: 'Rejected', count: counts.rejected },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              filter === f.id ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === f.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(req => {
          const ss      = STATUS_STYLE[req.status] ?? STATUS_STYLE.rejected
          const showSim = expandedSim === req.id
          return (
            <div key={req.id} className={`bg-white rounded-2xl border shadow-sm ${ss.border}`}>
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-slate-900">{COMMODITIES[req.material]?.label ?? req.material}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ss.badge}`}>{ss.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{req.id}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {req.trader} · {new Date(req.createdAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">{req.rationale || 'No rationale provided.'}</p>
                  {req.rejectReason && (
                    <p className="text-xs text-red-600 mt-1 bg-red-50 rounded-lg px-2.5 py-1.5">Rejected: {req.rejectReason}</p>
                  )}
                  {req.approver && req.status === 'approved' && (
                    <p className="text-xs text-eco-600 mt-1 bg-eco-50 rounded-lg px-2.5 py-1.5">Approved by {req.approver}</p>
                  )}
                  {showSim && <SimulationPanel req={req} />}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-base font-bold text-slate-800">
                      ${req.currentRate.toFixed(4)} → <span className={req.proposedRate > req.currentRate ? 'text-eco-700' : 'text-red-600'}>${req.proposedRate.toFixed(4)}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">/kg consumer rate</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setExpanded(showSim ? null : req.id)}
                      className="flex items-center gap-1 text-[11px] text-violet-600 font-semibold px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                    >
                      Simulate {showSim ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {req.status === 'pending' && canApprove && (
                      <button
                        onClick={() => setReview(req)}
                        className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-white bg-eco-700 hover:bg-eco-800 transition-colors"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-slate-50 rounded-2xl border border-slate-100 px-5 py-12 text-center">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">No overrides in this category</p>
            {filter === 'all' && (
              <p className="text-xs text-slate-400 mt-1">Submit an override from the Trader Dashboard to see it here.</p>
            )}
          </div>
        )}
      </div>

      {reviewTarget && (
        <ReviewModal req={reviewTarget} onClose={() => setReview(null)} onAction={handleAction} />
      )}
    </div>
  )
}
