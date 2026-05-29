import React, { useState, useEffect } from 'react'
import { Zap, CheckCircle, XCircle, AlertTriangle, RotateCcw, ChevronRight, Clock, Shield } from 'lucide-react'
import { ACTIVE_ROLLOUT, ROLLOUT_STAGES, ROLLOUT_HEALTH_GATES, ROLLOUT_HISTORY, SHADOW_MODELS } from '../../data/shadowLab'
import { pricingEngine } from '../../lib/pricingEngine'
import { fraudEngine } from '../../lib/fraudEngine'
import { queue, JOB_TYPES } from '../../lib/queue'

const GATE_META = {
  margin:    { label: 'Margin floor',   floor_key: 'margin_floor_pct',       fmt: v => v.toFixed(1) + '%',   metric_key: 'margin_pct',      higherNeeded: true },
  fraud:     { label: 'Fraud ceiling',  floor_key: 'fraud_ceiling_pct',      fmt: v => v.toFixed(2) + '%',   metric_key: 'fraud_rate_pct',  higherNeeded: false },
  volume:    { label: 'Volume floor',   floor_key: 'volume_floor_units_wk',  fmt: v => v.toLocaleString(),   metric_key: 'volume_units',    higherNeeded: true },
  logistics: { label: 'Logistics ceil', floor_key: 'logistics_ceiling_load', fmt: v => v.toFixed(1),         metric_key: 'logistics_load',  higherNeeded: false },
}

const OUTCOME_META = {
  advancing:   { label: 'Advancing',    color: 'bg-eco-100 text-eco-700',    dot: 'bg-eco-500 animate-pulse' },
  paused:      { label: 'Paused',       color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  rolled_back: { label: 'Rolled Back',  color: 'bg-red-100 text-red-700',    dot: 'bg-red-400' },
  completed:   { label: 'Completed',    color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  paused_hist: { label: 'Paused',       color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  archived:    { label: 'Archived',     color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
}

function GateIndicator({ gate, status, current, limit, higherNeeded, fmt }) {
  const pass = status === 'pass'
  return (
    <div className={`rounded-xl px-4 py-3 border ${pass ? 'bg-eco-50 border-eco-100' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-slate-600 capitalize">{gate}</p>
        {pass
          ? <CheckCircle className="w-4 h-4 text-eco-500" />
          : <XCircle className="w-4 h-4 text-red-500" />}
      </div>
      <p className={`text-lg font-bold ${pass ? 'text-eco-700' : 'text-red-600'}`}>{fmt(current)}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">
        {higherNeeded ? 'Min' : 'Max'}: {fmt(limit)}
      </p>
    </div>
  )
}

function RollbackModal({ onClose, modelName }) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const canSubmit = reason.trim().length >= 10 && confirmed

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-red-600 px-5 py-4">
          <p className="font-bold text-white text-lg">Emergency Rollback</p>
          <p className="text-red-100 text-sm mt-0.5">Model: {modelName} → Revert to MDL-001 AI Default</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">Rollback immediately restores MDL-001 (AI Default) as the active production model for all traffic. This action is logged in the immutable audit trail.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Rollback reason (min. 10 chars) *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              placeholder="Describe why you are rolling back this model…"
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 accent-red-600" />
            <span className="text-xs text-slate-600">I understand this will immediately halt the rollout and revert all traffic to the production baseline.</span>
          </label>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
            <button disabled={!canSubmit}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${canSubmit ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-200 text-red-400 cursor-not-allowed'}`}>
              Confirm Rollback
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GradualRollout() {
  const [showRollback, setShowRollback] = useState(false)
  const [liveMarginPct, setLiveMarginPct] = useState(null)
  const [fraudAlerts, setFraudAlerts] = useState(0)
  const [queueStatus, setQueueStatus] = useState(null)

  useEffect(() => {
    pricingEngine.start()
    const unsub = pricingEngine.subscribe(s => setLiveMarginPct(s.weightedMarginPct ?? null))
    return () => { unsub(); pricingEngine.stop() }
  }, [])

  useEffect(() => {
    const refresh = () => {
      setFraudAlerts(fraudEngine.getAllAlerts(50).length)
      setQueueStatus(queue.status())
    }
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [])

  const model = SHADOW_MODELS.find(m => m.id === ACTIVE_ROLLOUT.model_id)
  const currentStage = ROLLOUT_STAGES[ACTIVE_ROLLOUT.current_stage - 1]
  const nextStage = ROLLOUT_STAGES[ACTIVE_ROLLOUT.current_stage] || null

  const liveMetrics = {
    margin_pct: liveMarginPct ?? ACTIVE_ROLLOUT.current_metrics.margin_pct,
    fraud_rate_pct: ACTIVE_ROLLOUT.current_metrics.fraud_rate_pct,
    volume_units: ACTIVE_ROLLOUT.current_metrics.volume_units,
    logistics_load: ACTIVE_ROLLOUT.current_metrics.logistics_load,
  }

  const liveGateStatus = {
    margin: liveMarginPct != null
      ? (liveMarginPct >= ROLLOUT_HEALTH_GATES.margin_floor_pct ? 'pass' : 'fail')
      : ACTIVE_ROLLOUT.gate_status.margin,
    fraud: ACTIVE_ROLLOUT.gate_status.fraud,
    volume: ACTIVE_ROLLOUT.gate_status.volume,
    logistics: ACTIVE_ROLLOUT.gate_status.logistics,
  }

  return (
    <div className="space-y-6">
      {showRollback && <RollbackModal onClose={() => setShowRollback(false)} modelName={model?.name} />}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gradual Rollout</h1>
          <p className="text-sm text-slate-500 mt-0.5">Stage-gated model promotion · automated health checks · one-click rollback</p>
        </div>
        <button
          onClick={() => setShowRollback(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors ring-2 ring-red-300">
          <RotateCcw className="w-4 h-4" />
          Emergency Rollback
        </button>
      </div>

      {/* Active rollout card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 bg-slate-900 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">Active Rollout — {ACTIVE_ROLLOUT.model_name}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{ACTIVE_ROLLOUT.id} · started {ACTIVE_ROLLOUT.started}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-eco-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-eco-400 font-bold uppercase">Advancing</span>
          </div>
        </div>

        {/* Stage progress */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-1 mb-4">
            {ROLLOUT_STAGES.map((stage, i) => {
              const done = i < ACTIVE_ROLLOUT.current_stage
              const current = i === ACTIVE_ROLLOUT.current_stage - 1
              return (
                <React.Fragment key={stage.stage}>
                  <div className={`flex-1 flex flex-col items-center`}>
                    <div className={`w-full h-2.5 rounded-full transition-all ${
                      done ? 'bg-eco-500' : current ? 'bg-violet-500 animate-pulse' : 'bg-slate-100'
                    }`} />
                    <p className={`text-[9px] mt-1 font-semibold ${current ? 'text-violet-700' : done ? 'text-eco-600' : 'text-slate-300'}`}>
                      {stage.label}
                    </p>
                  </div>
                  {i < ROLLOUT_STAGES.length - 1 && <div className="w-1 flex-shrink-0" />}
                </React.Fragment>
              )
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="bg-violet-50 rounded-xl px-4 py-3">
              <p className="text-[10px] text-slate-400 mb-0.5">Current stage</p>
              <p className="text-xl font-bold text-violet-700">{ACTIVE_ROLLOUT.current_stage} / 8</p>
              <p className="text-xs text-slate-500 mt-0.5">{currentStage.label}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] text-slate-400 mb-0.5">Allocation</p>
              <p className="text-xl font-bold text-slate-800">{ACTIVE_ROLLOUT.current_allocation_pct}%</p>
              <p className="text-xs text-slate-500 mt-0.5">of new quotes</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] text-slate-400 mb-0.5">Next stage</p>
              {nextStage ? (
                <>
                  <p className="text-xl font-bold text-slate-800">{nextStage.allocation_pct}%</p>
                  <p className="text-xs text-slate-500 mt-0.5">{nextStage.label} — min {nextStage.min_hours}h</p>
                </>
              ) : (
                <p className="text-xl font-bold text-eco-700">Full</p>
              )}
            </div>
            <div className="bg-eco-50 rounded-xl px-4 py-3">
              <p className="text-[10px] text-slate-400 mb-0.5">Auto-advance</p>
              <p className="text-xl font-bold text-eco-700">{ACTIVE_ROLLOUT.auto_advance ? 'ON' : 'OFF'}</p>
              <p className="text-xs text-slate-500 mt-0.5">eligible 29 May 08:00</p>
            </div>
          </div>

          {/* Health gates */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-bold text-slate-600">Health Gates</p>
              {Object.values(liveGateStatus).every(s => s === 'pass')
                ? <span className="text-[10px] font-semibold px-2 py-0.5 bg-eco-100 text-eco-700 rounded-full">All passing</span>
                : <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Gates failing</span>
              }
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <GateIndicator gate="margin" status={liveGateStatus.margin}
                current={liveMetrics.margin_pct}
                limit={ROLLOUT_HEALTH_GATES.margin_floor_pct}
                higherNeeded={true} fmt={v => v.toFixed(1) + '%'} />
              <GateIndicator gate="fraud" status={liveGateStatus.fraud}
                current={liveMetrics.fraud_rate_pct}
                limit={ROLLOUT_HEALTH_GATES.fraud_ceiling_pct}
                higherNeeded={false} fmt={v => v.toFixed(2) + '%'} />
              <GateIndicator gate="volume" status={liveGateStatus.volume}
                current={liveMetrics.volume_units}
                limit={ROLLOUT_HEALTH_GATES.volume_floor_units_wk}
                higherNeeded={true} fmt={v => v.toLocaleString()} />
              <GateIndicator gate="logistics" status={liveGateStatus.logistics}
                current={liveMetrics.logistics_load}
                limit={ROLLOUT_HEALTH_GATES.logistics_ceiling_load}
                higherNeeded={false} fmt={v => v.toFixed(1)} />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => queue.enqueue(JOB_TYPES.PRICING_RECALCULATE, { modelId: ACTIVE_ROLLOUT.model_id, stage: ACTIVE_ROLLOUT.current_stage + 1 })}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors">
              <ChevronRight className="w-4 h-4" />
              Advance to Stage {ACTIVE_ROLLOUT.current_stage + 1} ({nextStage?.allocation_pct}%)
            </button>
            <button className="px-5 py-2.5 bg-amber-100 text-amber-700 text-sm font-bold rounded-xl hover:bg-amber-200 transition-colors">
              Pause
            </button>
          </div>

          {ACTIVE_ROLLOUT.notes && (
            <p className="text-xs text-slate-500 mt-3 bg-slate-50 rounded-xl px-3 py-2">{ACTIVE_ROLLOUT.notes}</p>
          )}
        </div>
      </div>

      {/* Stage reference table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Stage Reference</h2>
          <p className="text-xs text-slate-400 mt-0.5">Minimum dwell time per stage before auto-advance is eligible</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-50">
                <th className="text-left px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Stage</th>
                <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Name</th>
                <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Allocation</th>
                <th className="text-right px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Min dwell</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ROLLOUT_STAGES.map((s, i) => {
                const isCurrent = i === ACTIVE_ROLLOUT.current_stage - 1
                const isPast = i < ACTIVE_ROLLOUT.current_stage - 1
                return (
                  <tr key={s.stage} className={isCurrent ? 'bg-violet-50/40' : isPast ? 'opacity-60' : ''}>
                    <td className="px-5 py-3 font-mono font-bold text-slate-600">{s.stage}</td>
                    <td className="px-3 py-3 text-slate-700 font-semibold">
                      {s.label}
                      {isCurrent && <span className="ml-2 text-[9px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">CURRENT</span>}
                      {isPast && <span className="ml-2 text-[9px] font-bold bg-eco-100 text-eco-600 px-1.5 py-0.5 rounded-full">PASSED</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-700">{s.allocation_pct}%</td>
                    <td className="px-5 py-3 text-right text-slate-500">
                      {s.min_hours > 0 ? `${s.min_hours}h` : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Job Queue */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Live Job Queue</h2>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-eco-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-eco-500 uppercase">Live</span>
          </div>
        </div>
        <div className="px-5 py-4">
          {queueStatus ? (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Pending', value: queueStatus.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Processing', value: queueStatus.processing, color: 'text-violet-600', bg: 'bg-violet-50' },
                { label: 'Dead Letter', value: queueStatus.deadLetter, color: 'text-red-600', bg: 'bg-red-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 text-center`}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Loading queue status…</p>
          )}
          {fraudAlerts > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <p className="text-xs text-red-700 font-semibold">{fraudAlerts} high-risk fraud alert{fraudAlerts !== 1 ? 's' : ''} active — review before advancing</p>
            </div>
          )}
        </div>
      </div>

      {/* Rollout history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Rollout History</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {ROLLOUT_HISTORY.map(r => {
            const outMeta = OUTCOME_META[r.outcome] || OUTCOME_META.archived
            return (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-slate-800">{r.model_name}</p>
                      <span className="text-[10px] font-mono text-slate-400">{r.id}</span>
                    </div>
                    <p className="text-xs text-slate-500">{r.started} → {r.ended} · Peak: {r.peak_allocation_pct}% · Stage {r.final_stage}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${outMeta.dot}`} />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${outMeta.color}`}>{outMeta.label}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2">{r.reason}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
