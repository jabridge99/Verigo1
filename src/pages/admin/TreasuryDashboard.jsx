import React from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign, Shield, TrendingUp, AlertTriangle, CheckCircle,
  Zap, Building2, Landmark, CreditCard, Activity,
} from 'lucide-react'
import { TREASURY_SUMMARY, PAYMENT_RAILS, SETTLEMENT_BATCHES, WEBHOOKS } from '../../data/finance'

const RAIL_ICON = { stripe: CreditCard, airwallex: Zap, payid: Zap, bank: Landmark, crypto: Shield }
const RAIL_COLOR = { stripe: 'text-violet-600 bg-violet-50', airwallex: 'text-blue-600 bg-blue-50', payid: 'text-eco-600 bg-eco-50', bank: 'text-slate-600 bg-slate-100', crypto: 'text-slate-400 bg-slate-50' }

function FloatGauge({ ratio }) {
  const pct = Math.min((ratio / 1.5) * 100, 100)
  const color = ratio >= 1.2 ? 'bg-eco-500' : ratio >= 1.0 ? 'bg-amber-500' : 'bg-red-500'
  const label = ratio >= 1.2 ? 'Healthy' : ratio >= 1.0 ? 'Warning' : 'Critical'
  const labelColor = ratio >= 1.2 ? 'text-eco-700' : ratio >= 1.0 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-4xl font-bold text-slate-900">{ratio.toFixed(3)}</p>
          <p className="text-xs text-slate-400 mt-0.5">float ratio (must ≥ 1.000)</p>
        </div>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${
          ratio >= 1.2 ? 'bg-eco-100 text-eco-700' : ratio >= 1.0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        }`}>{label}</span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>0.000</span>
        <span className="text-slate-500 font-semibold">1.000 min</span>
        <span>1.500</span>
      </div>
    </div>
  )
}

function MiniBar({ values, color = 'bg-violet-500' }) {
  const max = Math.max(...values)
  return (
    <div className="flex items-end gap-1 h-12">
      {values.map((v, i) => (
        <div key={i} className={`flex-1 rounded-sm ${i === values.length - 1 ? color : 'bg-slate-200'}`}
          style={{ height: `${Math.round((v / max) * 100)}%` }} />
      ))}
    </div>
  )
}

export default function TreasuryDashboard() {
  const t = TREASURY_SUMMARY
  const activeBatch = SETTLEMENT_BATCHES.find(b => b.status === 'Executing')
  const pendingBatch = SETTLEMENT_BATCHES.find(b => b.status === 'Approved')
  const recentWebhooks = WEBHOOKS.slice(0, 6)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 bg-violet-600 rounded flex items-center justify-center">
              <DollarSign className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Enterprise Finance</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Treasury Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">System float position · Payment rails · Settlement activity</p>
        </div>
        <div className="text-xs text-slate-400 text-right">
          <p className="font-semibold text-slate-600">Thursday 28 May 2026</p>
          <p>Last reconciled: 10:42 AEST</p>
        </div>
      </div>

      {/* Float Position — primary panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Float Position</h2>
          <p className="text-xs text-slate-400 mt-0.5">Total bank assets must exceed total consumer liabilities</p>
        </div>
        <div className="px-5 py-5 grid md:grid-cols-2 gap-8">
          <FloatGauge ratio={t.float_ratio} />
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Total Bank Assets</span>
              <span className="font-bold text-slate-900">${t.total_bank_assets.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Consumer Liabilities</span>
              <span className="font-semibold text-red-600">−${t.total_consumer_liabilities.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-sm font-bold">
              <span className="text-slate-800">Float Buffer</span>
              <span className="text-eco-700">+${t.float_buffer.toLocaleString()}</span>
            </div>
            <div className="pt-1 space-y-2">
              {[
                { label: 'Consumer Pending',   value: t.consumer_pending_total,   color: 'bg-amber-400' },
                { label: 'Consumer Available', value: t.consumer_available_total,  color: 'bg-blue-400' },
                { label: 'Reserve Fund',       value: t.reserve_fund_total,       color: 'bg-red-400' },
                { label: 'Points Liability',   value: t.points_liability_total,   color: 'bg-amber-200' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-sm ${item.color}`} />
                  <span className="text-slate-500 flex-1">{item.label}</span>
                  <span className="font-semibold text-slate-700">${item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Revenue MTD',    value: `$${(t.platform_revenue_mtd / 1000).toFixed(1)}k`, color: 'text-eco-700',   trend: '+12%' },
          { label: 'Net Revenue',    value: `$${(t.net_revenue_mtd / 1000).toFixed(1)}k`,     color: 'text-eco-700',   trend: '+11%' },
          { label: 'Operator Payable', value: `$${t.operator_payable.toLocaleString()}`,      color: 'text-amber-600', trend: null },
          { label: 'Recycler Payable', value: `$${t.recycler_payable.toLocaleString()}`,      color: 'text-amber-600', trend: null },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[11px] text-slate-400 font-medium">{s.label}</p>
              {s.trend && <span className="text-[10px] font-bold text-eco-600">{s.trend}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Active batch alert */}
      {activeBatch && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-violet-600 animate-pulse" />
              <div>
                <p className="text-sm font-bold text-violet-800">Batch {activeBatch.id} executing — {activeBatch.type}</p>
                <p className="text-xs text-violet-600">{activeBatch.items_completed}/{activeBatch.count} payouts · ${activeBatch.total_amount.toLocaleString()} via {activeBatch.rail.toUpperCase()}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-violet-800">{activeBatch.progress_pct}%</p>
              <div className="w-24 h-1.5 bg-violet-200 rounded-full mt-1">
                <div className="h-full bg-violet-600 rounded-full" style={{ width: `${activeBatch.progress_pct}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Payment Rails */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900">Payment Rails</h2>
            <Link to="/admin/settlement" className="text-xs text-violet-600 font-semibold hover:underline">Settlement →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {Object.entries(PAYMENT_RAILS).map(([key, rail]) => {
              const Icon = RAIL_ICON[key] || CreditCard
              const colorClass = RAIL_COLOR[key] || 'text-slate-500 bg-slate-50'
              const isDisabled = rail.status === 'Disabled'
              return (
                <div key={key} className={`flex items-center gap-3 px-5 py-3.5 ${isDisabled ? 'opacity-50' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{rail.name}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                        rail.status === 'Operational' ? 'bg-eco-100 text-eco-700' :
                        rail.status === 'Disabled' ? 'bg-slate-100 text-slate-400' :
                        'bg-red-100 text-red-700'
                      }`}>{rail.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{rail.fee} · {rail.settlement_time}</p>
                  </div>
                  {rail.balance != null && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-800">${rail.balance.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-400">balance</p>
                    </div>
                  )}
                  {isDisabled && <span className="text-[10px] text-slate-400 font-semibold">PLACEHOLDER</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Webhook feed */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900">Webhook Events</h2>
            <Link to="/admin/settlement" className="text-xs text-violet-600 font-semibold hover:underline">All events →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentWebhooks.map(wh => (
              <div key={wh.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  wh.event.includes('dispute') ? 'bg-red-500' :
                  wh.event.includes('completed') || wh.event.includes('captured') ? 'bg-eco-500' : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{wh.event}</p>
                  <p className="text-[11px] text-slate-400">{wh.provider} · {wh.ref}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-slate-700">${wh.amount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(wh.ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue trend */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-4">7-Day Revenue vs Payouts</h2>
        <div className="flex gap-2 items-end">
          {t.days_7d.map((day, i) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: 80 }}>
                <div className="w-full bg-violet-500 rounded-sm" style={{ height: `${(t.revenue_7d[i] / 50000) * 80}px` }} />
              </div>
              <div className="w-full bg-slate-100 rounded-sm" style={{ height: `${(t.payout_7d[i] / 50000) * 50}px`, marginTop: 2 }} />
              <p className="text-[9px] text-slate-400 font-medium mt-1 text-center">{day.replace(' May', '')}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500 inline-block" />Revenue</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" />Payouts</span>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/admin/ledger',          label: 'Ledger',          icon: TrendingUp,  color: 'bg-violet-600' },
          { to: '/admin/payout-approvals', label: 'Payout Approvals', icon: CheckCircle, color: 'bg-amber-600' },
          { to: '/admin/reconciliation',  label: 'Reconciliation',  icon: Shield,      color: 'bg-slate-700' },
          { to: '/admin/settlement',      label: 'Settlement',      icon: DollarSign,  color: 'bg-eco-600' },
        ].map(l => (
          <Link key={l.to} to={l.to}
            className="flex items-center gap-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5 hover:border-violet-200 hover:shadow-md transition-all group">
            <div className={`w-8 h-8 ${l.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <l.icon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
