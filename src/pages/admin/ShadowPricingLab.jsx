import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Activity, BarChart2, GitBranch, Globe, TrendingUp, TrendingDown, Zap, ArrowRight, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { SHADOW_MODELS, LAB_SUMMARY, PERFORMANCE_METRICS, ACTIVE_ROLLOUT, AB_TESTS } from '../../data/shadowLab'

const MODEL_STATUS_META = {
  production:    { label: 'Production',    color: 'bg-eco-100 text-eco-700',      dot: 'bg-eco-500' },
  shadow_active: { label: 'Shadow Active', color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  shadow_paused: { label: 'Paused',        color: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400' },
}

const MODEL_RING = {
  eco:    'ring-eco-300',
  violet: 'ring-violet-300',
  amber:  'ring-amber-300',
  red:    'ring-red-300',
  indigo: 'ring-indigo-300',
}
const MODEL_BG = {
  eco:    'bg-eco-50',
  violet: 'bg-violet-50',
  amber:  'bg-amber-50',
  red:    'bg-red-50',
  indigo: 'bg-indigo-50',
}

function DeltaBadge({ base, value, suffix = '%', invert = false }) {
  const delta = value - base
  const positive = invert ? delta < 0 : delta > 0
  if (Math.abs(delta) < 0.05) return <span className="text-[10px] text-slate-400">≈ flat</span>
  return (
    <span className={`text-[10px] font-bold ${positive ? 'text-eco-600' : 'text-red-500'}`}>
      {delta > 0 ? '+' : ''}{delta.toFixed(1)}{suffix}
    </span>
  )
}

export default function ShadowPricingLab() {
  const navigate = useNavigate()
  const prodMetrics = PERFORMANCE_METRICS['MDL-001']['30d']
  const activeTests = AB_TESTS.filter(t => t.status === 'active')

  const modules = [
    { label: 'A/B Pricing Tests',     to: '/admin/ab-tests',      icon: GitBranch, desc: `${activeTests.length} active`, color: 'violet' },
    { label: 'Elasticity Model',      to: '/admin/elasticity',     icon: TrendingUp, desc: '7 device curves', color: 'indigo' },
    { label: 'Market Twin',           to: '/admin/market-twin',    icon: Globe,     desc: `${5} scenarios run`, color: 'amber' },
    { label: 'Scenario Simulator',    to: '/admin/scenarios',      icon: FlaskConical, desc: '7 / 30 / 90 / 180d', color: 'eco' },
    { label: 'Gradual Rollout',       to: '/admin/rollout',        icon: Zap,       desc: `Stage ${ACTIVE_ROLLOUT.current_stage} active`, color: 'violet' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-violet-600" />
            <h1 className="text-2xl font-bold text-slate-900">Pricing Innovation Lab</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Shadow mode · All alternative prices are simulation-only — consumers always receive production offers</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 text-white rounded-xl px-4 py-2.5 text-xs font-semibold">
          <div className="w-2 h-2 bg-eco-400 rounded-full animate-pulse" />
          Shadow engine running · {LAB_SUMMARY.active_shadow_models} models active
        </div>
      </div>

      {/* Shadow mode notice */}
      <div className="bg-violet-950 rounded-2xl px-5 py-4 flex items-start gap-3">
        <FlaskConical className="w-5 h-5 text-violet-300 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-white">Shadow Mode Active</p>
          <p className="text-xs text-violet-300 mt-0.5">
            Alternative pricing models compute quotes silently in parallel with production. No shadow price is ever returned to a consumer.
            All outcomes are logged for statistical comparison only. A model must pass all health gates before any gradual rollout begins.
          </p>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Shadow Models Running', value: LAB_SUMMARY.active_shadow_models, color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Active A/B Tests',      value: LAB_SUMMARY.active_ab_tests,      color: 'text-indigo-700', bg: 'bg-indigo-50' },
          { label: 'Rollout (Stage / %)',   value: `${LAB_SUMMARY.rollout_stage} · ${LAB_SUMMARY.rollout_pct}%`, color: 'text-eco-700', bg: 'bg-eco-50' },
          { label: 'Days Since Rollback',   value: LAB_SUMMARY.days_since_last_rollback, color: 'text-slate-700', bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Model cards */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-3">Pricing Models</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SHADOW_MODELS.map(m => {
            const metrics = PERFORMANCE_METRICS[m.id]['30d']
            const statusMeta = MODEL_STATUS_META[m.status]
            return (
              <div key={m.id} className={`bg-white rounded-2xl border border-slate-100 shadow-sm ring-2 ${MODEL_RING[m.color]} ring-opacity-50 overflow-hidden`}>
                <div className={`${MODEL_BG[m.color]} px-4 pt-4 pb-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{m.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{m.id}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusMeta.color}`}>{statusMeta.label}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{m.short}</p>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400">Margin (30d)</p>
                    <p className="font-bold text-slate-800">{metrics.margin_pct.toFixed(1)}%
                      {' '}<DeltaBadge base={prodMetrics.margin_pct} value={metrics.margin_pct} />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Volume (30d)</p>
                    <p className="font-bold text-slate-800">{metrics.volume_units.toLocaleString()}u
                      {' '}<DeltaBadge base={prodMetrics.volume_units} value={metrics.volume_units} suffix=" u" />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Fraud rate</p>
                    <p className="font-bold text-slate-800">{metrics.fraud_rate_pct.toFixed(2)}%
                      {' '}<DeltaBadge base={prodMetrics.fraud_rate_pct} value={metrics.fraud_rate_pct} invert />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Op. growth</p>
                    <p className="font-bold text-slate-800">{metrics.operator_growth_pct.toFixed(1)}% MoM
                      {' '}<DeltaBadge base={prodMetrics.operator_growth_pct} value={metrics.operator_growth_pct} />
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rollout status strip */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Active Rollout — {ACTIVE_ROLLOUT.model_name}</p>
            <p className="text-xs text-slate-400">{ACTIVE_ROLLOUT.id} · Stage {ACTIVE_ROLLOUT.current_stage} of 8 · {ACTIVE_ROLLOUT.current_allocation_pct}% allocation</p>
          </div>
          <button onClick={() => navigate('/admin/rollout')}
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:text-violet-900 transition-colors">
            Manage <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i < ACTIVE_ROLLOUT.current_stage ? 'bg-violet-500' : 'bg-slate-100'}`} />
          ))}
        </div>
        <div className="flex gap-4 flex-wrap mt-3">
          {Object.entries(ACTIVE_ROLLOUT.gate_status).map(([gate, status]) => (
            <div key={gate} className="flex items-center gap-1.5 text-xs">
              {status === 'pass'
                ? <CheckCircle className="w-3.5 h-3.5 text-eco-500" />
                : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              <span className="capitalize text-slate-600">{gate}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
            <Clock className="w-3.5 h-3.5" />
            Next advance eligible: 29 May 08:00
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-3">Lab Modules</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {modules.map(m => {
            const Icon = m.icon
            return (
              <button key={m.to} onClick={() => navigate(m.to)}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4 text-left">
                <Icon className={`w-5 h-5 mb-2 ${
                  m.color === 'violet' ? 'text-violet-500' :
                  m.color === 'indigo' ? 'text-indigo-500' :
                  m.color === 'amber'  ? 'text-amber-500' :
                  m.color === 'eco'    ? 'text-eco-500' : 'text-slate-500'
                }`} />
                <p className="text-sm font-bold text-slate-800 leading-tight">{m.label}</p>
                <p className="text-[11px] text-slate-400 mt-1">{m.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Active A/B tests quick view */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Active A/B Tests</h2>
          <button onClick={() => navigate('/admin/ab-tests')}
            className="text-xs font-semibold text-violet-700 hover:text-violet-900 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {activeTests.map(t => {
            const volDelta = ((t.variant_metrics.volume_units - t.control_metrics.volume_units) / t.control_metrics.volume_units * 100)
            const mgnDelta = t.variant_metrics.margin_pct - t.control_metrics.margin_pct
            return (
              <div key={t.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t.id} · {t.allocation_pct}% allocation · ends {t.ends}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] font-bold text-slate-500 mb-0.5">Significance</div>
                    <div className={`text-sm font-bold ${t.significance >= t.significance_target ? 'text-eco-600' : 'text-amber-600'}`}>
                      {(t.significance * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className={`font-semibold ${mgnDelta > 0 ? 'text-eco-600' : 'text-red-500'}`}>
                    Margin {mgnDelta > 0 ? '+' : ''}{mgnDelta.toFixed(1)}pp
                  </span>
                  <span className={`font-semibold ${volDelta > 0 ? 'text-eco-600' : 'text-red-500'}`}>
                    Volume {volDelta > 0 ? '+' : ''}{volDelta.toFixed(1)}%
                  </span>
                  <span className="text-slate-400">{t.notes.slice(0, 60)}…</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
