import React, { useState } from 'react'
import {
  Play, CheckCircle, Clock, X, AlertTriangle,
  CreditCard, Zap, Landmark, Shield, Activity,
} from 'lucide-react'
import { SETTLEMENT_BATCHES, WEBHOOKS, PAYMENT_RAILS } from '../../data/finance'

const STATUS_STYLE = {
  Executing:  { badge: 'bg-violet-100 text-violet-700', icon: Activity },
  Approved:   { badge: 'bg-blue-100 text-blue-700',     icon: CheckCircle },
  Completed:  { badge: 'bg-eco-100 text-eco-700',       icon: CheckCircle },
  Failed:     { badge: 'bg-red-100 text-red-700',       icon: X },
  Pending:    { badge: 'bg-amber-100 text-amber-700',   icon: Clock },
}

const RAIL_ICON = { payid: Zap, airwallex: Zap, bank: Landmark, stripe: CreditCard, crypto: Shield }
const RAIL_COLOR = {
  payid: 'bg-eco-100 text-eco-700',
  airwallex: 'bg-blue-100 text-blue-700',
  bank: 'bg-slate-100 text-slate-700',
  stripe: 'bg-violet-100 text-violet-700',
}

function BatchCard({ batch }) {
  const s = STATUS_STYLE[batch.status] || STATUS_STYLE.Pending
  const StatusIcon = s.icon
  const RailIcon = RAIL_ICON[batch.rail] || CreditCard
  const isExecuting = batch.status === 'Executing'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm ${
      isExecuting ? 'border-violet-200' : 'border-slate-100'
    }`}>
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isExecuting ? 'bg-violet-50' :
            batch.status === 'Completed' ? 'bg-eco-50' :
            batch.status === 'Approved' ? 'bg-blue-50' : 'bg-slate-50'
          }`}>
            <StatusIcon className={`w-5 h-5 ${
              isExecuting ? 'text-violet-600 animate-pulse' :
              batch.status === 'Completed' ? 'text-eco-600' :
              batch.status === 'Approved' ? 'text-blue-600' : 'text-slate-500'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">{batch.id}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.badge}`}>{batch.status}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${RAIL_COLOR[batch.rail] || 'bg-slate-100 text-slate-600'}`}>
                {batch.rail.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{batch.type}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {new Date(batch.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {batch.approved_by && ` · Approved by ${batch.approved_by}`}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold text-slate-900">${batch.total_amount.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400">{batch.count} payouts</p>
        </div>
      </div>

      <div className="px-5 pb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Completed', value: batch.items_completed, color: 'text-eco-700',  bg: 'bg-eco-50' },
          { label: 'Failed',    value: batch.items_failed,    color: 'text-red-600',  bg: 'bg-red-50' },
          { label: 'Pending',   value: batch.items_pending,   color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl px-3 py-2.5 text-center`}>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {isExecuting && (
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>{batch.progress_pct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${batch.progress_pct}%` }} />
          </div>
        </div>
      )}

      {batch.rail_fee > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[11px] text-slate-400">
            Rail fee: <span className="text-slate-600 font-semibold">${batch.rail_fee.toFixed(2)}</span>
            {batch.status === 'Completed' && batch.completed_at && (
              <> · Completed {new Date(batch.completed_at).toLocaleString('en-AU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

export default function SettlementBatching() {
  const [activeTab, setActiveTab] = useState('batches')

  const executing  = SETTLEMENT_BATCHES.filter(b => b.status === 'Executing')
  const approved   = SETTLEMENT_BATCHES.filter(b => b.status === 'Approved')
  const completed  = SETTLEMENT_BATCHES.filter(b => b.status === 'Completed')
  const totalVolume = SETTLEMENT_BATCHES.reduce((s, b) => s + b.total_amount, 0)
  const totalFees  = SETTLEMENT_BATCHES.reduce((s, b) => s + b.rail_fee, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settlement & Batching</h1>
          <p className="text-sm text-slate-500 mt-0.5">Batch management · Rail selection · Webhook event log</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <Play className="w-4 h-4" /> Create Batch
        </button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Executing',    value: executing.length,           color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Awaiting Exec',value: approved.length,            color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Total Volume', value: `$${(totalVolume/1000).toFixed(1)}k`, color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Total Rail Fees', value: `$${totalFees.toFixed(2)}`,       color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100">
        {[
          { id: 'batches',  label: 'Batches' },
          { id: 'webhooks', label: 'Webhook Log' },
          { id: 'rails',    label: 'Rail Health' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >{tab.label}</button>
        ))}
      </div>

      {activeTab === 'batches' && (
        <div className="space-y-4">
          {SETTLEMENT_BATCHES.map(batch => <BatchCard key={batch.id} batch={batch} />)}
        </div>
      )}

      {activeTab === 'webhooks' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Webhook Events</h2>
            <span className="text-xs text-slate-400">{WEBHOOKS.length} events</span>
          </div>
          <div className="divide-y divide-slate-50">
            {WEBHOOKS.map(wh => (
              <div key={wh.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  wh.event.includes('dispute') ? 'bg-red-500' :
                  wh.event.includes('completed') || wh.event.includes('captured') ? 'bg-eco-500' :
                  wh.event.includes('failed') ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 font-mono">{wh.event}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-eco-100 text-eco-700">{wh.status}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{wh.provider} · {wh.ref} · {wh.id}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-700">${wh.amount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(wh.ts).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'rails' && (
        <div className="space-y-4">
          {Object.entries(PAYMENT_RAILS).map(([key, rail]) => {
            const RailIcon = RAIL_ICON[key] || CreditCard
            const isDisabled = rail.status === 'Disabled'
            return (
              <div key={key} className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${isDisabled ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${RAIL_COLOR[key] || 'bg-slate-100 text-slate-500'}`}>
                      <RailIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{rail.name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          rail.status === 'Operational' ? 'bg-eco-100 text-eco-700' :
                          rail.status === 'Disabled' ? 'bg-slate-100 text-slate-400' : 'bg-red-100 text-red-700'
                        }`}>{rail.status}</span>
                        {isDisabled && <span className="text-[10px] text-slate-400 font-semibold">PLACEHOLDER</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{rail.fee} · {rail.settlement_time}</p>
                    </div>
                  </div>
                  {rail.balance != null && (
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-800">${rail.balance.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-400">balance</p>
                    </div>
                  )}
                </div>
                {!isDisabled && rail.success_rate != null && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-base font-bold text-slate-800">{rail.success_rate}%</p>
                      <p className="text-[10px] text-slate-400">Success Rate</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-base font-bold text-slate-800">
                        {rail.avg_latency_ms ? `${rail.avg_latency_ms}ms` : 'N/A'}
                      </p>
                      <p className="text-[10px] text-slate-400">Avg Latency</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-base font-bold text-slate-800">${(rail.monthly_volume / 1000).toFixed(0)}k</p>
                      <p className="text-[10px] text-slate-400">Monthly Vol.</p>
                    </div>
                  </div>
                )}
                {!isDisabled && rail.use_for.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {rail.use_for.map(u => (
                      <span key={u} className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {u.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {rail.failover && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full">
                        failover → {rail.failover}
                      </span>
                    )}
                  </div>
                )}
                {isDisabled && rail.note && (
                  <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-4 py-3">{rail.note}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
