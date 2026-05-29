import React, { useState, useEffect } from 'react'
import {
  Shield, AlertTriangle, CheckCircle, Clock, DollarSign,
  ChevronRight, FileText,
} from 'lucide-react'
import { RISK_THRESHOLDS, riskLevel, ACTION_META } from '../../data/fraudRisk'
import { fraudEngine, SIGNAL, getRiskLevel, getAction } from '../../lib/fraudEngine'
import { RiskScoreBadge } from './FraudDashboard'

function normalizeCase(a) {
  return {
    id: a.entityId,
    entity_id: a.entityId,
    entity_name: a.entityId,
    entity_type: a.entityId.startsWith('OPR') ? 'operator' : 'consumer',
    entity_ref: a.entityId,
    risk_score: a.score,
    primary_signal: a.signals[0]?.signalType?.toLowerCase() || 'suspicious_operator',
    status: a.action === 'suspend' ? 'suspended' : 'open',
    priority: a.score >= 75 ? 'critical' : a.score >= 50 ? 'high' : 'medium',
    description: `${a.signals.length} active signal(s) — action: ${a.action.replace(/_/g, ' ')}`,
    amount_at_risk_aud: 0,
    opened_at: a.signals[0]?.created_at || new Date().toISOString(),
    signals: a.signals,
  }
}

// ─── Signal / severity maps ──────────────────────────────────────────────────

const SIGNAL_DOT = {
  duplicate_scan:      'bg-indigo-500',
  fake_deposit:        'bg-red-500',
  abnormal_weight:     'bg-orange-500',
  gps_mismatch:        'bg-amber-500',
  referral_abuse:      'bg-violet-500',
  payout_abuse:        'bg-red-500',
  suspicious_operator: 'bg-red-600',
}

const SIGNAL_BAR = {
  duplicate_scan:      'bg-indigo-400',
  fake_deposit:        'bg-red-400',
  abnormal_weight:     'bg-orange-400',
  gps_mismatch:        'bg-amber-400',
  referral_abuse:      'bg-violet-400',
  payout_abuse:        'bg-red-400',
  suspicious_operator: 'bg-red-600',
}

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
}

const STATUS_COLORS = {
  open:      'bg-indigo-100 text-indigo-700',
  suspended: 'bg-red-100 text-red-700',
  resolved:  'bg-eco-100 text-eco-700',
}

const ENTITY_TYPE_BADGE = {
  consumer: 'bg-eco-100 text-eco-700',
  operator: 'bg-amber-100 text-amber-700',
  merchant: 'bg-violet-100 text-violet-700',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTs(ts) {
  const d = new Date(ts)
  return d.toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatDate(str) {
  return new Date(str).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Risk Gauge ───────────────────────────────────────────────────────────────

function RiskGauge({ score }) {
  const level = riskLevel(score)
  const COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' }
  const r = 38, cx = 50, cy = 55
  const circ = 2 * Math.PI * r
  const arcLen = circ * 0.75
  const filled = (score / 100) * arcLen
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28">
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="9"
        strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round"
        transform="rotate(135 50 55)"
      />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={COLORS[level]} strokeWidth="9"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform="rotate(135 50 55)"
      />
      <text x="50" y="52" textAnchor="middle" fill={COLORS[level]} style={{ fontSize: '22px', fontWeight: '800' }}>{score}</text>
      <text x="50" y="64" textAnchor="middle" fill="#94a3b8" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {RISK_THRESHOLDS[level].label}
      </text>
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FraudCaseViewer() {
  const [alerts, setAlerts] = useState(() => fraudEngine.getAllAlerts(0).map(normalizeCase))
  const [selectedId, setSelectedId] = useState(() => {
    const all = fraudEngine.getAllAlerts(0)
    return all.length > 0 ? all[0].entityId : null
  })
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [actionReason, setActionReason] = useState('')
  const [pendingAction, setPendingAction] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setAlerts(fraudEngine.getAllAlerts(0).map(normalizeCase)), 5000)
    return () => clearInterval(id)
  }, [])

  const filteredCases = alerts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false
    return true
  })

  const selected = alerts.find(c => c.id === selectedId) || null

  const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'resolved', label: 'Resolved' },
  ]

  // Signal breakdown: compute per-signal weight share from live signals
  function getSignalBreakdown(kase) {
    const totalWeight = kase.signals.reduce((sum, s) => sum + (s.weight ?? 0), 0)
    // Aggregate by signalType
    const byType = {}
    for (const s of kase.signals) {
      const key = s.signalType.toLowerCase()
      byType[key] = (byType[key] || 0) + (s.weight ?? 0)
    }
    return Object.entries(byType).map(([key, w]) => ({
      id: key,
      label: SIGNAL[key.toUpperCase()]?.label || key,
      pct: totalWeight > 0 ? Math.round((w / totalWeight) * 100) : 0,
    }))
  }

  function handleOpenCase() {
    if (!selected) return
    fraudEngine.openCase(selected.entity_id, 'admin')
    setAlerts(fraudEngine.getAllAlerts(0).map(normalizeCase))
  }

  function handleConfirmAction() {
    if (!pendingAction || !selected || actionReason.length < 10) return
    if (pendingAction === 'resolve') {
      fraudEngine.resolveCase(selected.id, actionReason, 'admin')
    }
    setPendingAction(null)
    setActionReason('')
    setAlerts(fraudEngine.getAllAlerts(0).map(normalizeCase))
  }

  return (
    <div className="flex gap-6 h-full">

      {/* ── LEFT PANEL ── */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900">Cases</h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
            {filteredCases.length}
          </span>
        </div>

        {/* Filters */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="w-full appearance-none text-xs font-semibold bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
            <ChevronRight className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
          </div>
        </div>

        {/* Case list */}
        <div className="flex-1 overflow-y-auto space-y-0">
          {filteredCases.length === 0 && (
            <div className="text-center text-sm text-slate-400 py-10">No cases match filters</div>
          )}
          {filteredCases.map(c => {
            const isSelected = c.id === selectedId
            const primarySigLabel = SIGNAL[c.primary_signal?.toUpperCase()]?.label ?? c.primary_signal
            return (
              <div
                key={c.id}
                onClick={() => { setSelectedId(c.id); setPendingAction(null); setActionReason('') }}
                className={`cursor-pointer rounded-xl p-3 border mb-2 transition-colors ${
                  isSelected
                    ? 'bg-violet-50 border-violet-200'
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
              >
                {/* Line 1 */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-mono text-[10px] text-slate-400">{c.id}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[c.priority]}`}>
                    {c.priority}
                  </span>
                </div>
                {/* Line 2 */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-semibold text-slate-800 truncate">{c.entity_name}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${ENTITY_TYPE_BADGE[c.entity_type]}`}>
                    {c.entity_type}
                  </span>
                </div>
                {/* Line 3 */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-slate-500 truncate">{primarySigLabel}</span>
                  <RiskScoreBadge score={c.risk_score} size="sm" />
                </div>
                {/* Line 4 */}
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>{formatDate(c.opened_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <Shield className="w-12 h-12 text-slate-200" />
            <p className="text-sm font-medium">Select a case to review</p>
          </div>
        ) : (
          <div className="space-y-4 pb-6">

            {/* ── Case Header Card ── */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <div className="flex items-start gap-5">
                {/* Gauge */}
                <div className="flex-shrink-0">
                  <RiskGauge score={selected.risk_score} />
                </div>

                {/* Meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-slate-400">{selected.id}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ENTITY_TYPE_BADGE[selected.entity_type]}`}>
                      {selected.entity_type}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 leading-tight">{selected.entity_name}</h2>
                  <p className="font-mono text-xs text-slate-400 mb-2">{selected.entity_ref}</p>
                  <p className="text-xs text-slate-500 mb-3">
                    Entity ID: <span className="font-semibold text-slate-700 font-mono">{selected.entity_id}</span>
                  </p>
                  <div className="flex items-center flex-wrap gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[selected.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {selected.status}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[selected.priority]}`}>
                      {selected.priority} priority
                    </span>
                  </div>
                </div>

                {/* Dates */}
                <div className="flex-shrink-0 text-right space-y-1">
                  <div className="flex items-center gap-1.5 justify-end text-[11px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>Opened {formatDate(selected.opened_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end text-[11px] text-slate-400">
                    <FileText className="w-3 h-3" />
                    <span>{selected.signals.length} signal{selected.signals.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className="mt-4 text-sm text-slate-600 leading-relaxed border-t border-slate-50 pt-4">
                {selected.description}
              </p>
            </div>

            {/* ── Signal Breakdown ── */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Signal Breakdown</h3>
              <div className="space-y-3">
                {getSignalBreakdown(selected).map(sig => (
                  <div key={sig.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SIGNAL_DOT[sig.id] ?? 'bg-slate-400'}`} />
                        <span className="text-xs font-semibold text-slate-700">{sig.label}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500">{sig.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${SIGNAL_BAR[sig.id] ?? 'bg-slate-400'} transition-all duration-500`}
                        style={{ width: `${sig.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
                {getSignalBreakdown(selected).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-2">No signals</p>
                )}
              </div>
            </div>

            {/* ── Live Signals Timeline ── */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-bold text-slate-900">Live Signals</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {selected.signals.length}
                </span>
              </div>

              <div className="space-y-0">
                {[...selected.signals]
                  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                  .map((sig, idx, arr) => {
                    const sigKey = sig.signalType.toLowerCase()
                    const sigLabel = SIGNAL[sig.signalType.toUpperCase()]?.label || sig.signalType
                    const isLast = idx === arr.length - 1
                    return (
                      <div key={idx} className="flex gap-3">
                        {/* Timeline spine */}
                        <div className="flex flex-col items-center flex-shrink-0 w-4">
                          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${SIGNAL_DOT[sigKey] ?? 'bg-slate-400'} mt-0.5`} />
                          {!isLast && <div className="w-px flex-1 bg-slate-100 mt-1 mb-1" />}
                        </div>
                        {/* Content */}
                        <div className="flex-1 pb-4">
                          <div className="flex items-center flex-wrap gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-slate-700">{sigLabel}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              weight: {sig.weight}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-auto">{formatTs(sig.created_at)}</span>
                          </div>
                          {sig.actor && (
                            <p className="text-xs text-slate-500">Actor: {sig.actor}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                {selected.signals.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No signals recorded</p>
                )}
              </div>
            </div>

            {/* ── Action Panel ── */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">Take Action</h3>
              </div>

              {selected.status === 'suspended' ? (
                <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs font-medium text-red-700">
                    This account is currently suspended. No further actions can be taken until the suspension is lifted.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {Object.entries(ACTION_META).map(([key, meta]) => (
                      <button
                        key={key}
                        onClick={() => { setPendingAction(key); setActionReason('') }}
                        className={`text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors ${meta.btn} ${pendingAction === key ? 'ring-2 ring-offset-1 ring-violet-400' : ''}`}
                      >
                        {meta.label}
                      </button>
                    ))}
                    <button
                      onClick={handleOpenCase}
                      className="text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    >
                      Open Case
                    </button>
                  </div>

                  {pendingAction && (
                    <div className="space-y-3 border-t border-slate-50 pt-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Reason for <span className="text-violet-700">{ACTION_META[pendingAction]?.label ?? pendingAction}</span>
                          <span className="text-slate-400 font-normal ml-1">(min 10 characters)</span>
                        </label>
                        <textarea
                          value={actionReason}
                          onChange={e => setActionReason(e.target.value)}
                          rows={3}
                          placeholder="Describe the reason for this action..."
                          className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 placeholder:text-slate-300"
                        />
                        <p className="text-[10px] text-slate-400 mt-0.5">{actionReason.length} / 10 min</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={actionReason.length < 10}
                          onClick={handleConfirmAction}
                          className="text-xs font-semibold px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Confirm {ACTION_META[pendingAction]?.label ?? pendingAction}
                        </button>
                        <button
                          onClick={() => { setPendingAction(null); setActionReason('') }}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
