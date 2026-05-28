import React, { useState } from 'react'
import {
  CheckCircle, X, Clock, RotateCcw, Activity, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { OVERRIDES, ROLES_CONFIG } from '../../data/override'

const STATUS_STYLE = {
  pending_approval: { badge: 'bg-amber-100 text-amber-700', label: 'Pending Approval' },
  active:           { badge: 'bg-eco-100 text-eco-700',     label: 'Active' },
  approved:         { badge: 'bg-blue-100 text-blue-700',   label: 'Approved' },
  rejected:         { badge: 'bg-red-100 text-red-700',     label: 'Rejected' },
  rolled_back:      { badge: 'bg-slate-100 text-slate-500', label: 'Rolled Back' },
}

const DEVICE_LABELS = {
  smartphone: 'Smartphone', laptop: 'Laptop', desktop: 'Desktop PC',
  tablet: 'Tablet', tv_monitor: 'TV / Monitor', large_appliance: 'Large Appliance',
  mixed_ewaste: 'Mixed E-Waste',
}

function SimulationPanel({ ovr }) {
  const newMargin = ((ovr.net_recovery - ovr.proposed_value) / ovr.net_recovery * 100)
  const aiMargin  = ((ovr.net_recovery - ovr.ai_value) / ovr.net_recovery * 100)
  const isSafe = newMargin >= 20
  const isNegative = newMargin < 0
  return (
    <div className="bg-slate-900 rounded-xl p-4 mt-3 space-y-3">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Simulation Preview</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'AI Offer',    value: `$${ovr.ai_value.toFixed(2)}`,       sub: `${aiMargin.toFixed(1)}% margin`,   color: 'text-slate-300' },
          { label: 'Proposed',    value: `$${ovr.proposed_value.toFixed(2)}`, sub: `${newMargin.toFixed(1)}% margin`,   color: isNegative ? 'text-red-400' : isSafe ? 'text-eco-400' : 'text-amber-400' },
          { label: 'Net Recovery',value: `$${ovr.net_recovery.toFixed(2)}`,   sub: 'before offer',                     color: 'text-violet-300' },
        ].map(s => (
          <div key={s.label} className="bg-white/5 rounded-lg p-3">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
            <p className={`text-[10px] font-semibold mt-0.5 ${s.color}`}>{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {isNegative && <span className="text-[11px] font-bold text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />NEGATIVE MARGIN — LOSS POSITION</span>}
        {!isNegative && !isSafe && <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Below 20% minimum — requires Director approval</span>}
        {isSafe && <span className="text-[11px] font-bold text-eco-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Within 20-45% margin band</span>}
      </div>
    </div>
  )
}

function ApproveModal({ ovr, onClose, onAction }) {
  const [note, setNote] = useState('')
  const [rollbackReason, setRollbackReason] = useState('')
  const [tab, setTab] = useState('approve')

  const newMargin = ((ovr.net_recovery - ovr.proposed_value) / ovr.net_recovery * 100)
  const isLoss = newMargin < 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Review Override — {ovr.id}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{ovr.device_label} · Proposed by {ovr.submitted_by}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        {(ovr.status === 'active') && (
          <div className="flex border-b border-slate-100">
            {['approve', 'rollback'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${
                  tab === t ? 'text-violet-700 border-b-2 border-violet-600' : 'text-slate-500 hover:text-slate-700'
                }`}>{t === 'rollback' ? 'Rollback to AI' : 'View Detail'}</button>
            ))}
          </div>
        )}

        <div className="px-5 py-5 space-y-4">
          {/* Price summary */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Device</p>
              <p className="text-sm font-bold text-slate-900">{ovr.device_label}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Current (AI)</p>
              <p className="text-xl font-bold text-slate-500">${ovr.ai_value.toFixed(2)}</p>
            </div>
            <div className="text-2xl text-slate-300">→</div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Proposed</p>
              <p className={`text-xl font-bold ${ovr.proposed_value > ovr.ai_value ? 'text-eco-700' : 'text-red-600'}`}>${ovr.proposed_value.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">New Margin</p>
              <p className={`text-sm font-bold ${isLoss ? 'text-red-600' : newMargin < 20 ? 'text-amber-600' : 'text-eco-700'}`}>
                {newMargin.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Proposer reason */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Reason provided by {ovr.submitted_by}</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3">{ovr.reason}</p>
          </div>

          {isLoss && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-semibold">This override would result in a net loss. Approval is strongly inadvisable.</p>
            </div>
          )}

          {tab === 'rollback' && ovr.status === 'active' ? (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Reason for rollback <span className="text-red-500">*</span></label>
                <textarea value={rollbackReason} onChange={e => setRollbackReason(e.target.value)} rows={3}
                  placeholder="Why are you reverting to the AI price?"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
                <button
                  disabled={rollbackReason.length < 10}
                  onClick={() => { onAction('rollback', ovr.id, rollbackReason); onClose() }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Rollback to AI
                </button>
              </div>
            </>
          ) : ovr.status === 'pending_approval' ? (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Approver note <span className="text-red-500">*</span></label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="Add your review note — required for audit trail..."
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
              </div>
              <div className="flex gap-3">
                <button
                  disabled={note.length < 5}
                  onClick={() => { onAction('reject', ovr.id, note); onClose() }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  disabled={note.length < 5 || isLoss}
                  onClick={() => { onAction('approve', ovr.id, note); onClose() }}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-eco-700 hover:bg-eco-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Approve Override
                </button>
              </div>
            </>
          ) : (
            <div className="flex justify-end">
              <button onClick={onClose} className="bg-slate-100 text-slate-700 font-semibold px-5 py-2.5 rounded-xl text-sm">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OverrideQueue() {
  const [queue, setQueue] = useState(OVERRIDES)
  const [reviewTarget, setReviewTarget] = useState(null)
  const [filter, setFilter] = useState('all')
  const [expandedSim, setExpandedSim] = useState(null)
  const [currentRole, setCurrentRole] = useState('commercial_director')

  const handleAction = (action, id, note) => {
    setQueue(q => q.map(o => {
      if (o.id !== id) return o
      if (action === 'approve') return { ...o, status: 'active', approved_by: 'You', approved_at: new Date().toISOString(), approver_note: note }
      if (action === 'reject')  return { ...o, status: 'rejected', rejected_by: 'You', rejected_at: new Date().toISOString(), rejection_reason: note }
      if (action === 'rollback') return { ...o, status: 'rolled_back', rolled_back_by: 'You', rolled_back_at: new Date().toISOString(), rollback_reason: note }
      return o
    }))
  }

  const filtered = filter === 'all' ? queue : queue.filter(o => o.status === filter)
  const roleConfig = ROLES_CONFIG[currentRole]
  const canApprove = roleConfig.can.includes('approve_override')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Override Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">Approval workflow · Simulation · Rollback management</p>
        </div>
        <select value={currentRole} onChange={e => setCurrentRole(e.target.value)}
          className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none bg-white w-fit">
          {Object.entries(ROLES_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all',              label: 'All',          count: queue.length },
          { id: 'pending_approval', label: 'Pending',      count: queue.filter(o => o.status === 'pending_approval').length },
          { id: 'active',           label: 'Active',       count: queue.filter(o => o.status === 'active').length },
          { id: 'rejected',         label: 'Rejected',     count: queue.filter(o => o.status === 'rejected').length },
          { id: 'rolled_back',      label: 'Rolled Back',  count: queue.filter(o => o.status === 'rolled_back').length },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              filter === f.id ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {f.label}
            {f.count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === f.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{f.count}</span>}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(ovr => {
          const ss = STATUS_STYLE[ovr.status]
          const showSim = expandedSim === ovr.id
          return (
            <div key={ovr.id} className={`bg-white rounded-2xl border shadow-sm ${
              ovr.status === 'pending_approval' ? 'border-amber-200' :
              ovr.status === 'active' ? 'border-eco-200' : 'border-slate-100'
            }`}>
              <div className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-slate-900">{ovr.device_label}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ss.badge}`}>{ss.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{ovr.id}</span>
                    {ovr.flag === 'self_approved' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Self-approved</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {ovr.submitted_by} ({ovr.submitted_role}) · {new Date(ovr.submitted_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">{ovr.reason}</p>
                  {ovr.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1 bg-red-50 rounded-lg px-2.5 py-1.5">Rejected: {ovr.rejection_reason}</p>
                  )}
                  {ovr.rollback_reason && (
                    <p className="text-xs text-amber-600 mt-1 bg-amber-50 rounded-lg px-2.5 py-1.5">Rolled back: {ovr.rollback_reason}</p>
                  )}
                  {showSim && <SimulationPanel ovr={ovr} />}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">
                      ${ovr.ai_value.toFixed(2)} → <span className={ovr.proposed_value > ovr.ai_value ? 'text-eco-700' : 'text-red-600'}>${ovr.proposed_value.toFixed(2)}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">{ovr.impact_type.replace('_', ' ')}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setExpandedSim(showSim ? null : ovr.id)}
                      className="flex items-center gap-1 text-[11px] text-violet-600 font-semibold px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                    >
                      Simulate {showSim ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {(ovr.status === 'pending_approval' || ovr.status === 'active') && canApprove && (
                      <button
                        onClick={() => setReviewTarget(ovr)}
                        className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                          ovr.status === 'active'
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'text-white bg-eco-700 hover:bg-eco-800'
                        }`}
                      >
                        {ovr.status === 'active' ? 'Rollback' : 'Review'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-slate-50 rounded-2xl border border-slate-100 px-5 py-10 text-center">
            <p className="text-sm text-slate-400">No overrides in this category</p>
          </div>
        )}
      </div>

      {reviewTarget && (
        <ApproveModal ovr={reviewTarget} onClose={() => setReviewTarget(null)} onAction={handleAction} />
      )}
    </div>
  )
}
