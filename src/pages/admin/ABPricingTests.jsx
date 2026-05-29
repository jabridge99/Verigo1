import React, { useState, useEffect } from 'react'
import { GitBranch, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { AB_TESTS, SHADOW_MODELS } from '../../data/shadowLab'
import { pricingEngine } from '../../lib/pricingEngine'
import { marketFeed, COMMODITIES } from '../../lib/marketFeed'
import { queue, JOB_TYPES } from '../../lib/queue'

const STATUS_META = {
  active:    { label: 'Active',    color: 'bg-eco-100 text-eco-700',     dot: 'bg-eco-500 animate-pulse' },
  completed: { label: 'Completed', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  paused:    { label: 'Paused',    color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
}

const DECISION_META = {
  promote: { label: 'Promoted', color: 'bg-eco-100 text-eco-700', icon: CheckCircle },
  archive: { label: 'Archived', color: 'bg-slate-100 text-slate-500', icon: XCircle },
  rollback:{ label: 'Rolled Back', color: 'bg-red-100 text-red-700', icon: XCircle },
}

function SignificanceBar({ value, target }) {
  const pct = Math.min(100, value * 100)
  const reached = value >= target
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${reached ? 'bg-eco-500' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${reached ? 'text-eco-600' : 'text-amber-600'}`}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  )
}

function MetricDelta({ control, variant, label, invert = false, fmt = v => v.toFixed(1) }) {
  const delta = variant - control
  const positive = invert ? delta < 0 : delta > 0
  const Icon = positive ? TrendingUp : delta === 0 ? null : TrendingDown
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      <p className="text-xs font-bold text-slate-700">{fmt(variant)}</p>
      <div className={`flex items-center justify-center gap-0.5 text-[10px] font-bold mt-0.5 ${positive ? 'text-eco-600' : Math.abs(delta) < 0.05 ? 'text-slate-400' : 'text-red-500'}`}>
        {Icon && <Icon className="w-3 h-3" />}
        {delta > 0 ? '+' : ''}{fmt(delta)}
      </div>
    </div>
  )
}

function TestCard({ test, liveExp }) {
  const [expanded, setExpanded] = useState(false)
  const statusMeta = STATUS_META[test.status]
  const decisionMeta = test.decision ? DECISION_META[test.decision] : null
  const model = SHADOW_MODELS.find(m => m.id === test.variant_model)
  const revDelta = ((test.variant_metrics.revenue_aud - test.control_metrics.revenue_aud) / test.control_metrics.revenue_aud * 100)

  const liveControlMargin = (test.status === 'active' && liveExp) ? liveExp.weightedMarginPct : null
  const controlMargin = liveControlMargin ?? test.control_metrics.margin_pct

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}</div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-slate-900">{test.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{test.id} · {test.allocation_pct}% traffic · {test.started} → {test.ends}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {decisionMeta && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${decisionMeta.color}`}>{decisionMeta.label}</span>
                )}
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusMeta.color}`}>{statusMeta.label}</span>
                </div>
              </div>
            </div>

            {/* Quick metrics row */}
            <div className="grid grid-cols-4 gap-3 mt-3">
              <MetricDelta control={controlMargin} variant={test.variant_metrics.margin_pct}
                label={liveControlMargin != null ? "Margin % (live ctrl)" : "Margin %"} fmt={v => v.toFixed(1) + '%'} />
              <MetricDelta control={test.control_metrics.volume_units} variant={test.variant_metrics.volume_units}
                label="Volume" fmt={v => v.toLocaleString()} />
              <MetricDelta control={test.control_metrics.fraud_rate_pct} variant={test.variant_metrics.fraud_rate_pct}
                label="Fraud %" invert fmt={v => v.toFixed(2) + '%'} />
              <MetricDelta control={test.control_metrics.revenue_aud} variant={test.variant_metrics.revenue_aud}
                label="Revenue" fmt={v => `$${(v / 1000).toFixed(0)}k`} />
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-50 px-5 py-4 bg-slate-50 space-y-4">
          {/* Statistical significance */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600">Statistical Significance</p>
              <span className={`text-xs font-bold ${test.significance >= test.significance_target ? 'text-eco-600' : 'text-amber-600'}`}>
                {test.significance >= test.significance_target ? '✓ Significance reached' : `${((test.significance_target - test.significance) * 100).toFixed(0)}pp to target`}
              </span>
            </div>
            <SignificanceBar value={test.significance} target={test.significance_target} />
            <p className="text-[10px] text-slate-400 mt-1">Target: {(test.significance_target * 100).toFixed(0)}% · Current: {(test.significance * 100).toFixed(0)}%</p>
          </div>

          {/* Variant model info */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Control (Production)</p>
              <p className="font-bold text-slate-700">MDL-001 — AI Default</p>
              <p className="text-slate-500 mt-1">
                {liveControlMargin != null
                  ? <span className="text-eco-600 font-semibold">Live margin: {liveControlMargin.toFixed(1)}%</span>
                  : `Revenue: $${test.control_metrics.revenue_aud.toLocaleString()}`
                }
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Variant (Shadow)</p>
              <p className="font-bold text-slate-700">{model?.id} — {model?.name}</p>
              <p className="text-slate-500 mt-1">Revenue: ${test.variant_metrics.revenue_aud.toLocaleString()}
                <span className={`ml-1 font-bold ${revDelta > 0 ? 'text-eco-600' : 'text-red-500'}`}>
                  ({revDelta > 0 ? '+' : ''}{revDelta.toFixed(1)}%)
                </span>
              </p>
            </div>
          </div>

          {/* Scope */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Scope</p>
            <div className="flex flex-wrap gap-1.5">
              {test.device_scope.map(d => (
                <span key={d} className="text-[10px] font-semibold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">{d.replace(/_/g, ' ')}</span>
              ))}
              {test.region_scope.map(r => (
                <span key={r} className="text-[10px] font-semibold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded">{r}</span>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Analyst Notes</p>
            <p className="text-xs text-slate-600">{test.notes}</p>
          </div>

          {/* Actions */}
          {test.status === 'active' && (
            <div className="flex gap-2">
              <button
                onClick={() => queue.enqueue(JOB_TYPES.PRICING_RECALCULATE, { testId: test.id, variantModel: test.variant_model, action: 'promote' })}
                className="flex-1 text-xs font-bold py-2 bg-eco-600 text-white rounded-xl hover:bg-eco-700 transition-colors">
                Promote Variant to Rollout
              </button>
              <button
                onClick={() => queue.enqueue(JOB_TYPES.PRICING_RECALCULATE, { testId: test.id, action: 'end' })}
                className="text-xs font-bold px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors">
                End Test
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ABPricingTests() {
  const [filter, setFilter] = useState('all')
  const [liveExp, setLiveExp] = useState(null)
  const [liveRates, setLiveRates] = useState({})
  const [queueStatus, setQueueStatus] = useState(null)

  useEffect(() => {
    pricingEngine.start()
    marketFeed.start()
    const unsubP = pricingEngine.subscribe(s => setLiveExp(s))
    const unsubM = marketFeed.subscribe(null, r => setLiveRates(prev => ({ ...prev, [r.material]: r })))
    const id = setInterval(() => setQueueStatus(queue.status()), 3000)
    setQueueStatus(queue.status())
    return () => { unsubP(); unsubM(); clearInterval(id); pricingEngine.stop(); marketFeed.stop() }
  }, [])

  const filtered = filter === 'all' ? AB_TESTS : AB_TESTS.filter(t => t.status === filter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">A/B Pricing Tests</h1>
        <p className="text-sm text-slate-500 mt-0.5">Shadow model vs production — statistically rigorous comparison · consumers always see production offers</p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Tests',    value: AB_TESTS.filter(t => t.status === 'active').length,    color: 'text-eco-700', bg: 'bg-eco-50' },
          { label: 'Completed',       value: AB_TESTS.filter(t => t.status === 'completed').length,  color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Tests Promoted',  value: AB_TESTS.filter(t => t.decision === 'promote').length,  color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Tests Archived',  value: AB_TESTS.filter(t => t.decision === 'archive').length,  color: 'text-slate-500', bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Live platform context strip */}
      {(liveExp || Object.keys(liveRates).length > 0) && (
        <div className="bg-slate-900 rounded-2xl px-5 py-3 flex items-center gap-5 overflow-x-auto">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-2 h-2 bg-eco-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-eco-400 uppercase tracking-wide">Live Platform</span>
          </div>
          {liveExp && (
            <>
              <div className="flex-shrink-0 text-center">
                <p className="text-[10px] text-slate-400">Prod Margin</p>
                <p className="text-xs font-bold text-white">{liveExp.weightedMarginPct?.toFixed(1) ?? '—'}%</p>
              </div>
              <div className="flex-shrink-0 text-center">
                <p className="text-[10px] text-slate-400">At-Risk Items</p>
                <p className="text-xs font-bold text-amber-400">{liveExp.atRiskCount ?? '—'}</p>
              </div>
              <div className="flex-shrink-0 text-center">
                <p className="text-[10px] text-slate-400">Notional AUD</p>
                <p className="text-xs font-bold text-white">${liveExp.totalNotionalAud != null ? (liveExp.totalNotionalAud / 1000).toFixed(0) + 'k' : '—'}</p>
              </div>
            </>
          )}
          {Object.entries(liveRates).slice(0, 4).map(([k, r]) => {
            const mat = COMMODITIES[k]
            if (!mat) return null
            return (
              <div key={k} className="flex-shrink-0 text-center border-l border-slate-700 pl-4">
                <p className="text-[10px] text-slate-400">{mat.label}</p>
                <p className="text-xs font-bold text-white">${r.spot?.toFixed(2) ?? '—'}</p>
                <p className="text-[10px] text-eco-400">${r.consumer_rate?.toFixed(2) ?? '—'} paid</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-slate-100">
        {[
          { id: 'all', label: 'All Tests' },
          { id: 'active', label: 'Active' },
          { id: 'completed', label: 'Completed' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilter(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              filter === tab.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>{tab.label}</button>
        ))}
      </div>

      {/* Test cards */}
      <div className="space-y-4">
        {filtered.map(t => <TestCard key={t.id} test={t} liveExp={liveExp} />)}
      </div>
    </div>
  )
}
