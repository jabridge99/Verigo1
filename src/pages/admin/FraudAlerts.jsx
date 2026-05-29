import React, { useState } from 'react'
import {
  ScanLine, Package, Scale, MapPin, GitBranch, DollarSign,
  AlertTriangle, CheckCircle2, Bell, Filter, ChevronDown,
} from 'lucide-react'
import {
  ALERT_QUEUE, SIGNAL_TYPES, RISK_THRESHOLDS, riskLevel, ACTION_META,
} from '../../data/fraudRisk'
import { RiskScoreBadge } from './FraudDashboard'

const SIGNAL_ICON = {
  duplicate_scan:      { Icon: ScanLine,      bg: 'bg-indigo-100', text: 'text-indigo-600' },
  fake_deposit:        { Icon: Package,       bg: 'bg-red-100',    text: 'text-red-600'    },
  abnormal_weight:     { Icon: Scale,         bg: 'bg-orange-100', text: 'text-orange-600' },
  gps_mismatch:        { Icon: MapPin,        bg: 'bg-amber-100',  text: 'text-amber-600'  },
  referral_abuse:      { Icon: GitBranch,     bg: 'bg-violet-100', text: 'text-violet-600' },
  payout_abuse:        { Icon: DollarSign,    bg: 'bg-red-100',    text: 'text-red-600'    },
  suspicious_operator: { Icon: AlertTriangle, bg: 'bg-red-100',    text: 'text-red-600'    },
}

const ENTITY_TYPE_BADGE = {
  consumer: 'bg-eco-100 text-eco-700',
  operator: 'bg-amber-100 text-amber-700',
  merchant: 'bg-violet-100 text-violet-700',
}

function formatTs(ts) {
  const d = new Date(ts)
  return d.toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

function StatusIndicator({ status }) {
  if (status === 'new') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-eco-500 animate-pulse flex-shrink-0" />
        <span className="text-[11px] font-semibold text-eco-700">New</span>
      </div>
    )
  }
  if (status === 'reviewing') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-amber-700">Reviewing</span>
      </div>
    )
  }
  if (status === 'actioned') {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-[11px] text-slate-400">Actioned</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-slate-300 line-through">Dismissed</span>
    </div>
  )
}

function AlertCard({ alert }) {
  const sigIcon = SIGNAL_ICON[alert.signal] || SIGNAL_ICON.suspicious_operator
  const { Icon } = sigIcon
  const sigLabel = SIGNAL_TYPES[alert.signal]?.label || alert.signal
  const action = ACTION_META[alert.recommended_action]
  const muted = alert.status === 'actioned' || alert.status === 'dismissed'

  return (
    <div className={`bg-white border rounded-2xl p-4 flex gap-4 items-start transition-opacity ${muted ? 'opacity-70' : ''} ${alert.status === 'new' ? 'border-violet-100' : 'border-slate-100'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sigIcon.bg}`}>
        <Icon className={`w-5 h-5 ${sigIcon.text}`} />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-slate-900">{alert.entity_name}</span>
          <span className="font-mono text-[10px] text-slate-400">{alert.entity_ref}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ENTITY_TYPE_BADGE[alert.entity_type]}`}>
            {alert.entity_type}
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-700">{sigLabel}</p>
        <p className="text-sm text-slate-600">{alert.message}</p>
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[10px] text-slate-400">{formatTs(alert.ts)}</span>
          {alert.location && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-[10px] text-slate-400">{alert.location}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <RiskScoreBadge score={alert.risk_score} size="sm" />

        {action && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${action.bg} ${action.text}`}>
            {action.label}
          </span>
        )}

        <StatusIndicator status={alert.status} />

        {alert.status === 'actioned' && alert.auto_actioned && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            Auto-actioned
          </span>
        )}

        {alert.status === 'new' && (
          <div className="flex items-center gap-2 mt-1">
            <button className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors">
              Take Action
            </button>
            <button className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FraudAlerts() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [signalFilter, setSignalFilter] = useState('all')
  const [typeFilter, setTypeFilter]     = useState('all')

  const filtered = ALERT_QUEUE.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (signalFilter !== 'all' && a.signal !== signalFilter) return false
    if (typeFilter !== 'all' && a.entity_type !== typeFilter) return false
    return true
  })

  const newCount     = ALERT_QUEUE.filter(a => a.status === 'new').length
  const autoActioned = ALERT_QUEUE.filter(a => a.auto_actioned).length

  const STATUS_TABS = [
    { key: 'all',       label: 'All'       },
    { key: 'new',       label: 'New'       },
    { key: 'reviewing', label: 'Reviewing' },
    { key: 'actioned',  label: 'Actioned'  },
    { key: 'dismissed', label: 'Dismissed' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Alert Queue</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
              {filtered.length}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time fraud signal feed — auto-rules fire on detection, manual review required for borderline cases
          </p>
        </div>
        <Bell className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === tab.key
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />

          <div className="relative">
            <select
              value={signalFilter}
              onChange={e => setSignalFilter(e.target.value)}
              className="appearance-none text-xs font-semibold bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="all">All Signals</option>
              {Object.values(SIGNAL_TYPES).map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="appearance-none text-xs font-semibold bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
            >
              <option value="all">All Types</option>
              <option value="consumer">Consumer</option>
              <option value="operator">Operator</option>
              <option value="merchant">Merchant</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span><span className="font-bold text-slate-700">{filtered.length}</span> alerts</span>
        <span className="text-slate-200">|</span>
        <span><span className="font-bold text-eco-600">{newCount}</span> new</span>
        <span className="text-slate-200">|</span>
        <span><span className="font-bold text-slate-600">{autoActioned}</span> auto-actioned</span>
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(alert => <AlertCard key={alert.id} alert={alert} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Filter className="w-10 h-10 text-slate-200" />
          <p className="text-sm font-medium">No alerts match the current filters</p>
        </div>
      )}
    </div>
  )
}
