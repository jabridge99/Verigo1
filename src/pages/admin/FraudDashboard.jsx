import React from 'react'
import { ShieldAlert, DollarSign, TrendingUp, Zap } from 'lucide-react'
import {
  FRAUD_STATS, PAYOUT_HOLDS, RISK_ENTITIES, ALERT_QUEUE, SIGNAL_TYPES,
  RISK_THRESHOLDS, riskLevel, ACTION_META,
} from '../../data/fraudRisk'

export function RiskScoreBadge({ score, size = 'sm' }) {
  const level = riskLevel(score)
  const t = RISK_THRESHOLDS[level]
  const sizeClass = size === 'lg'
    ? 'text-sm px-3 py-1 font-bold'
    : 'text-xs px-2 py-0.5 font-bold'
  return (
    <span className={`rounded-full ${t.bg} ${t.text} ${sizeClass}`}>{score}</span>
  )
}

const ENTITY_TYPE_BADGE = {
  consumer: 'bg-eco-100 text-eco-700',
  operator: 'bg-amber-100 text-amber-700',
  merchant: 'bg-violet-100 text-violet-700',
}

const STATUS_BADGE = {
  suspended: 'bg-red-100 text-red-700',
  review:    'bg-amber-100 text-amber-700',
  active:    'bg-eco-100 text-eco-700',
}

function KpiCard({ label, value, sub, icon: Icon, iconColor, subColor }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-[11px] font-semibold text-slate-500 mt-1">{label}</p>
        {sub && <p className={`text-[11px] mt-0.5 ${subColor || 'text-slate-400'}`}>{sub}</p>}
      </div>
    </div>
  )
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.count))
  return (
    <div className="flex items-end gap-2 h-[120px]">
      {data.map(d => {
        const pct = max > 0 ? (d.count / max) * 100 : 0
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-slate-400 font-medium">{d.count}</span>
            <div className="w-full flex items-end" style={{ height: 96 }}>
              <div
                className="w-full bg-violet-500 rounded-t-md"
                style={{ height: `${pct}%`, minHeight: 4 }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{d.day}</span>
          </div>
        )
      })}
    </div>
  )
}

function PayoutHoldsCard() {
  const total = PAYOUT_HOLDS.reduce((s, h) => s + h.amount_aud, 0)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50">
        <h3 className="text-sm font-bold text-slate-800">Payout Holds</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-50">
            <th className="px-5 py-2 text-left font-semibold text-slate-400">Entity</th>
            <th className="px-3 py-2 text-right font-semibold text-slate-400">Amount</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-400">Since</th>
            <th className="px-5 py-2 text-left font-semibold text-slate-400">Case</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {PAYOUT_HOLDS.map(h => (
            <tr key={h.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-5 py-2.5">
                <p className="font-semibold text-slate-800 leading-none">{h.entity_name}</p>
                <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ENTITY_TYPE_BADGE[h.entity_type]}`}>
                  {h.entity_type}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                ${h.amount_aud.toLocaleString()}
              </td>
              <td className="px-3 py-2.5 text-slate-400">{h.held_since}</td>
              <td className="px-5 py-2.5 font-mono text-violet-600">{h.case_id}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-amber-50">
            <td className="px-5 py-2.5 font-bold text-slate-700">Total</td>
            <td className="px-3 py-2.5 text-right font-bold text-amber-700">
              ${total.toLocaleString()}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function IntegrationPanel() {
  const rows = [
    { label: 'Deposits quarantined from pricing pipeline', value: FRAUD_STATS.deposits_quarantined_pricing },
    { label: 'Settlement batches on hold',                 value: FRAUD_STATS.settlement_holds },
    { label: 'Wallet transactions frozen',                 value: FRAUD_STATS.wallet_freezes },
  ]
  return (
    <div className="bg-slate-900 rounded-2xl p-5 space-y-3">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pipeline Integration</h3>
      {rows.map(r => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400 leading-tight">{r.label}</span>
          <span className="text-base font-bold text-white flex-shrink-0">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function SignalTable() {
  const tpBarColor = (rate) => {
    if (rate >= 0.9) return 'bg-eco-500'
    if (rate >= 0.7) return 'bg-amber-500'
    return 'bg-red-500'
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50">
        <h3 className="text-sm font-bold text-slate-800">Signal Performance — 30 Days</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-50">
            <th className="px-5 py-2 text-left font-semibold text-slate-400">Signal</th>
            <th className="px-4 py-2 text-right font-semibold text-slate-400">Triggered (30d)</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-400 w-48">True Positive Rate</th>
            <th className="px-5 py-2 text-left font-semibold text-slate-400">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {FRAUD_STATS.signals_30d.map(row => {
            const sig = SIGNAL_TYPES[row.signal]
            const pct = Math.round(row.true_positive_rate * 100)
            return (
              <tr key={row.signal} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-semibold text-slate-800">{sig.label}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-700">{row.count.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${tpBarColor(row.true_positive_rate)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 w-8 text-right">{pct}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                    {sig.category}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EntityCard({ entity }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{entity.name}</p>
          <p className="text-[10px] font-mono text-slate-400">{entity.ref}</p>
        </div>
        <RiskScoreBadge score={entity.risk_score} size="sm" />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ENTITY_TYPE_BADGE[entity.type]}`}>
          {entity.type}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[entity.status]}`}>
          {entity.status}
        </span>
      </div>
      {entity.held_payout_aud > 0 && (
        <p className="text-[11px] font-semibold text-amber-700">
          ${entity.held_payout_aud.toLocaleString()} held
        </p>
      )}
    </div>
  )
}

export default function FraudDashboard() {
  const sortedEntities = [...RISK_ENTITIES]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fraud & Risk Engine</h1>
        <p className="text-sm text-slate-500 mt-0.5">Live overview — signals, holds, entity risk, and pipeline integration</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Open Cases"
          value={FRAUD_STATS.total_cases_open}
          sub={`${FRAUD_STATS.critical_open} critical · ${FRAUD_STATS.high_open} high`}
          icon={ShieldAlert}
          iconColor="bg-red-100 text-red-600"
          subColor="text-red-500"
        />
        <KpiCard
          label="Total Held"
          value={`$${FRAUD_STATS.total_held_aud.toLocaleString()} AUD`}
          sub="Across all payout holds"
          icon={DollarSign}
          iconColor="bg-amber-100 text-amber-600"
        />
        <KpiCard
          label="Fraud Prevented (30d)"
          value={`$${FRAUD_STATS.fraud_prevented_aud_30d.toLocaleString()}`}
          sub="Estimated loss avoided"
          icon={TrendingUp}
          iconColor="bg-eco-100 text-eco-600"
        />
        <KpiCard
          label="Auto-Actioned (30d)"
          value={FRAUD_STATS.auto_actioned_30d}
          sub="alerts auto-resolved"
          icon={Zap}
          iconColor="bg-violet-100 text-violet-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Daily Alert Volume — 7 Days</h3>
            <BarChart data={FRAUD_STATS.daily_alerts_7d} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Risk Score Distribution</h3>
            <div className="space-y-2">
              {FRAUD_STATS.score_distribution.map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-slate-600 w-14 flex-shrink-0">{row.label}</span>
                  <span className="text-[10px] text-slate-400 w-12 flex-shrink-0">{row.range}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 w-8 text-right">{row.pct}%</span>
                  <span className="text-[11px] text-slate-400 w-16 text-right">{row.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <PayoutHoldsCard />
          <IntegrationPanel />
        </div>
      </div>

      <SignalTable />

      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Highest Risk Entities</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {sortedEntities.map(e => <EntityCard key={e.id} entity={e} />)}
        </div>
      </div>
    </div>
  )
}
