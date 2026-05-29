import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Shield, AlertTriangle, CheckCircle, Clock, X, Activity,
  RotateCcw, Megaphone, Eye, Database, Zap, User,
} from 'lucide-react'
import {
  SYSTEM_STATE, CAMPAIGNS, VOLATILITY_ALERTS, ROLES_CONFIG,
} from '../../data/override'
import { overrideQueue } from '../../lib/overrideQueue'
import { pricingEngine } from '../../lib/pricingEngine'
import { COMMODITIES } from '../../lib/marketFeed'

const MODE_STYLE = {
  ai_active:       { label: 'AI Engine Active',   bg: 'bg-eco-600',   ring: 'ring-eco-400',   dot: 'bg-eco-300 animate-pulse', text: 'text-eco-700',    card: 'border-eco-200 bg-eco-50' },
  frozen:          { label: 'SYSTEM FROZEN',       bg: 'bg-red-600',   ring: 'ring-red-400',   dot: 'bg-red-300 animate-pulse', text: 'text-red-700',     card: 'border-red-300 bg-red-50' },
  override_active: { label: 'Overrides Active',    bg: 'bg-amber-500', ring: 'ring-amber-400', dot: 'bg-amber-300',             text: 'text-amber-700',   card: 'border-amber-200 bg-amber-50' },
  campaign_active: { label: 'Campaign Active',     bg: 'bg-violet-600',ring: 'ring-violet-400',dot: 'bg-violet-300',            text: 'text-violet-700',  card: 'border-violet-200 bg-violet-50' },
}

const SEVERITY_STYLE = {
  critical: 'border-red-200 bg-red-50',
  high:     'border-amber-200 bg-amber-50',
  medium:   'border-amber-100 bg-amber-50',
  low:      'border-slate-100 bg-slate-50',
}

const STATUS_STYLE = {
  pending_approval: { badge: 'bg-amber-100 text-amber-700', icon: Clock },
  approved:         { badge: 'bg-blue-100 text-blue-700',   icon: CheckCircle },
  active:           { badge: 'bg-eco-100 text-eco-700',     icon: Activity },
  rejected:         { badge: 'bg-red-100 text-red-700',     icon: X },
  rolled_back:      { badge: 'bg-slate-100 text-slate-500', icon: RotateCcw },
}

function FreezeModal({ onClose, onFreeze }) {
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState('')
  const isReady = confirm === 'FREEZE' && reason.length > 10

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-red-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl ring-2 ring-red-500">
        <div className="bg-red-600 rounded-t-2xl px-5 py-4 flex items-center gap-3">
          <Shield className="w-5 h-5 text-white flex-shrink-0" />
          <div>
            <h3 className="text-base font-bold text-white">Emergency Pricing Freeze</h3>
            <p className="text-xs text-red-200">This halts all AI pricing. Last approved book will hold.</p>
          </div>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 space-y-1.5">
            <p className="font-bold">What happens when you freeze:</p>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>AI repricing halted immediately</li>
              <li>Live pricing book locked at BK-0088</li>
              <li>All pending overrides paused</li>
              <li>Only Commercial Director can lift freeze</li>
              <li>Freeze logged to immutable audit trail</li>
            </ul>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Reason for freeze <span className="text-red-500">*</span></label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Describe the market event or reason requiring emergency freeze..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
              Type <span className="font-mono text-red-600 bg-red-50 px-1.5 py-0.5 rounded">FREEZE</span> to confirm
            </label>
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="FREEZE"
              className="w-full text-sm font-mono border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
            <button
              disabled={!isReady}
              onClick={() => { onFreeze(reason); onClose() }}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              Freeze All Pricing
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TraderOverrideDashboard() {
  const [mode, setMode]             = useState(SYSTEM_STATE.mode)
  const [showFreeze, setShowFreeze] = useState(false)
  const [currentRole, setRole]      = useState('commercial_director')
  const [frozenReason, setFrozen]   = useState(null)
  const [livePending, setPending]   = useState([])
  const [liveOvrs, setLiveOvrs]     = useState({})

  useEffect(() => {
    function refresh() {
      setPending(overrideQueue.getQueue('pending'))
      setLiveOvrs(pricingEngine.getOverrides())
    }
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [])

  const modeStyle    = MODE_STYLE[mode]
  const roleConfig   = ROLES_CONFIG[currentRole]
  const canFreeze    = roleConfig.can.includes('freeze')
  const canLiftFreeze = roleConfig.can.includes('lift_freeze')

  const pending         = livePending
  const activeOverrides = Object.entries(liveOvrs)
  const openAlerts      = VOLATILITY_ALERTS.filter(a => a.status === 'open' || a.status === 'acknowledged')
  const activeCampaign  = CAMPAIGNS.find(c => c.status === 'active')

  const handleFreeze = (reason) => {
    setMode('frozen')
    setFrozen(reason)
  }
  const handleLiftFreeze = () => {
    setMode(activeOverrides.length ? 'override_active' : 'ai_active')
    setFrozen(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 bg-violet-600 rounded flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Human Trader Override Layer</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Override Command Centre</h1>
          <p className="text-sm text-slate-500 mt-0.5">Governance layer over the Pricing Intelligence Engine</p>
        </div>
        {/* Role switcher (demo) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <User className="w-4 h-4 text-slate-400" />
          <select
            value={currentRole}
            onChange={e => setRole(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
          >
            {Object.entries(ROLES_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${roleConfig.color}`}>{roleConfig.label}</span>
        </div>
      </div>

      {/* System mode banner */}
      <div className={`rounded-2xl border-2 ${modeStyle.card} px-5 py-4`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${modeStyle.bg} rounded-2xl flex items-center justify-center flex-shrink-0 ring-4 ${modeStyle.ring} ring-offset-2`}>
              <span className={`w-3 h-3 rounded-full ${modeStyle.dot}`} />
            </div>
            <div>
              <p className={`text-lg font-bold ${modeStyle.text}`}>{modeStyle.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {mode === 'frozen'
                  ? `Frozen — ${frozenReason?.slice(0, 60) ?? ''}...`
                  : `Book ${SYSTEM_STATE.last_approved_book} · AI ${SYSTEM_STATE.ai_book_version} · ${activeOverrides.length} active material override${activeOverrides.length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            {mode === 'frozen' && canLiftFreeze && (
              <button
                onClick={handleLiftFreeze}
                className="flex items-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                <Activity className="w-4 h-4" /> Lift Freeze
              </button>
            )}
            {mode !== 'frozen' && canFreeze && (
              <button
                onClick={() => setShowFreeze(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors ring-2 ring-red-300"
              >
                <Shield className="w-4 h-4" /> Emergency Freeze
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending Approvals', value: pending.length,        color: pending.length ? 'text-amber-600' : 'text-slate-400',  bg: pending.length ? 'bg-amber-50' : 'bg-slate-50' },
          { label: 'Active Overrides',  value: activeOverrides.length,color: activeOverrides.length ? 'text-violet-700' : 'text-slate-400', bg: activeOverrides.length ? 'bg-violet-50' : 'bg-slate-50' },
          { label: 'Open Alerts',       value: openAlerts.length,    color: openAlerts.some(a => a.severity === 'critical') ? 'text-red-600' : 'text-amber-600', bg: openAlerts.length ? 'bg-amber-50' : 'bg-slate-50' },
          { label: 'Active Campaign',   value: activeCampaign ? activeCampaign.name : 'None', color: activeCampaign ? 'text-violet-700' : 'text-slate-400', bg: activeCampaign ? 'bg-violet-50' : 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold truncate ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Volatility alerts */}
      {openAlerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Volatility Alerts Requiring Attention
          </h2>
          {openAlerts.map(alert => (
            <div key={alert.id} className={`flex items-start gap-3 border rounded-2xl px-4 py-3.5 ${SEVERITY_STYLE[alert.severity]}`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                alert.severity === 'critical' ? 'bg-red-500' :
                alert.severity === 'high' ? 'bg-amber-500' : 'bg-amber-400'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{alert.headline}</p>
                <p className="text-xs text-slate-500 mt-0.5">{alert.recommendation}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                    alert.action_required === 'mandatory_review' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{alert.action_required.replace('_', ' ')}</span>
                  <span className="text-[11px] text-slate-400 capitalize">{alert.status.replace('_', ' ')}</span>
                  {alert.actioned_ref && <span className="text-[11px] text-eco-600">→ {alert.actioned_ref}</span>}
                </div>
              </div>
              <Link to="/admin/exposure" className="text-xs text-violet-600 font-semibold flex-shrink-0 hover:underline">Exposure →</Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900">Pending Approvals</h2>
            <Link to="/admin/override-queue" className="text-xs text-violet-600 font-semibold hover:underline">Full queue →</Link>
          </div>
          {pending.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle className="w-8 h-8 text-eco-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No pending approvals</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pending.map(req => (
                <div key={req.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{COMMODITIES[req.material]?.label ?? req.material}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending approval</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{req.id} · {req.trader}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-slate-800">
                        ${req.currentRate.toFixed(4)} → <span className={req.proposedRate > req.currentRate ? 'text-eco-700' : 'text-red-600'}>${req.proposedRate.toFixed(4)}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">consumer rate /kg</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 line-clamp-2">{req.rationale || 'No rationale provided.'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active overrides + campaigns */}
        <div className="space-y-4">
          {/* Active overrides */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-bold text-slate-900">Active Overrides</h2>
              <Link to="/admin/override-queue" className="text-xs text-violet-600 font-semibold hover:underline">Manage →</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {activeOverrides.map(([material, ovr]) => (
                <div key={material} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-1.5 h-1.5 bg-eco-500 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{COMMODITIES[material]?.label ?? material}</p>
                    <p className="text-[11px] text-slate-400">by {ovr.actor} · applied {new Date(ovr.appliedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-eco-700">${ovr.ratePerKg.toFixed(4)}/kg</p>
                    <p className="text-[10px] text-slate-400">override rate</p>
                  </div>
                </div>
              ))}
              {activeOverrides.length === 0 && (
                <p className="px-5 py-4 text-sm text-slate-400">No active overrides</p>
              )}
            </div>
          </div>

          {/* Active campaign */}
          {activeCampaign && (
            <div className="bg-violet-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="w-4 h-4 text-violet-200" />
                <span className="text-xs font-bold text-violet-200 uppercase tracking-wider">Active Campaign</span>
              </div>
              <h3 className="text-lg font-bold">{activeCampaign.name}</h3>
              <p className="text-sm text-violet-200 mt-0.5">{activeCampaign.adjustments.length} device{activeCampaign.adjustments.length !== 1 ? 's' : ''} affected · ends {new Date(activeCampaign.end_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {activeCampaign.adjustments.map(adj => (
                  <span key={adj.device} className="text-[10px] font-semibold px-2 py-0.5 bg-white/20 rounded-full">
                    {adj.device.replace('_', ' ')} +{adj.value}%
                  </span>
                ))}
              </div>
              <Link to="/admin/campaigns" className="mt-3 inline-block text-xs text-violet-200 font-semibold hover:text-white hover:underline">Manage campaigns →</Link>
            </div>
          )}
        </div>
      </div>

      {/* Module quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/admin/override-queue', label: 'Override Queue',     icon: Clock,     color: 'bg-amber-600',  count: pending.length },
          { to: '/admin/campaigns',      label: 'Campaigns',          icon: Megaphone, color: 'bg-violet-600', count: null },
          { to: '/admin/exposure',       label: 'Exposure Dashboard', icon: Activity,  color: 'bg-blue-600',   count: openAlerts.length },
          { to: '/admin/audit',          label: 'Audit Trail',        icon: Shield,    color: 'bg-slate-700',  count: null },
        ].map(l => (
          <Link key={l.to} to={l.to}
            className="flex items-center gap-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5 hover:border-violet-200 hover:shadow-md transition-all group">
            <div className={`w-8 h-8 ${l.color} rounded-xl flex items-center justify-center flex-shrink-0 relative`}>
              <l.icon className="w-4 h-4 text-white" />
              {l.count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">{l.count}</span>
              )}
            </div>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{l.label}</span>
          </Link>
        ))}
      </div>

      {showFreeze && (
        <FreezeModal onClose={() => setShowFreeze(false)} onFreeze={handleFreeze} />
      )}
    </div>
  )
}
