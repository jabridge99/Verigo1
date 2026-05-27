import React, { useState } from 'react'
import {
  DollarSign, CheckCircle, Clock, Play, X, Download,
  AlertTriangle, TrendingUp, Package,
} from 'lucide-react'
import { SETTLEMENTS } from '../../data/woms'

const STATUS_STYLE = {
  'Pending Approval': { badge: 'bg-amber-100 text-amber-700', icon: Clock },
  Approved:           { badge: 'bg-blue-100 text-blue-700',   icon: CheckCircle },
  Paid:               { badge: 'bg-eco-100 text-eco-700',     icon: CheckCircle },
}

const MATERIAL_COLOR = {
  'Aluminium':   'bg-slate-400',
  'PET Plastic': 'bg-blue-400',
  'HDPE':        'bg-amber-400',
  'Glass':       'bg-eco-400',
  'Steel':       'bg-rose-400',
  'Cardboard':   'bg-orange-400',
}

function ApproveModal({ settlement, onClose }) {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Approve Settlement</h3>
            <p className="text-xs text-slate-400 mt-0.5">{settlement.settlement_id} · {settlement.recycler}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {/* Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Recycler</span>
              <span className="font-semibold text-slate-800">{settlement.recycler}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ABN</span>
              <span className="font-mono text-slate-700">{settlement.recycler_abn}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Period</span>
              <span className="font-semibold text-slate-800">{settlement.period}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Gross Amount</span>
              <span className="font-semibold text-slate-800">${settlement.gross_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">— Logistics Cost</span>
              <span className="text-slate-500">-${settlement.logistics_cost}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">— Platform Fee (5%)</span>
              <span className="text-slate-500">-${settlement.platform_fee}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-900">Net Payout</span>
              <span className="font-bold text-eco-700 text-base">${settlement.net_payout.toLocaleString()}</span>
            </div>
          </div>

          {/* Materials breakdown */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Material Breakdown</p>
            <div className="space-y-2">
              {settlement.materials.map(m => (
                <div key={m.material} className="flex items-center gap-2 text-xs">
                  <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${MATERIAL_COLOR[m.material] || 'bg-slate-300'}`} />
                  <span className="text-slate-600 flex-1">{m.material}</span>
                  <span className="text-slate-400">{m.quantity_t}t × ${m.unit_price}/t</span>
                  <span className="font-semibold text-slate-800">${m.subtotal.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Confirm checkbox */}
          <div className="flex items-start gap-2">
            <input type="checkbox" id="confirm" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" />
            <label htmlFor="confirm" className="text-xs text-slate-600 cursor-pointer">
              I confirm this settlement is correct and authorise the net payout of{' '}
              <span className="font-bold text-eco-700">${settlement.net_payout.toLocaleString()}</span>{' '}
              to {settlement.recycler}
            </label>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl text-sm">Cancel</button>
            <button
              disabled={!confirmed}
              onClick={onClose}
              className="flex-1 bg-eco-700 hover:bg-eco-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              Approve & Queue Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RecyclerSettlement() {
  const [approveTarget, setApproveTarget] = useState(null)

  const totalGross = SETTLEMENTS.reduce((a, s) => a + s.gross_amount, 0)
  const totalNet = SETTLEMENTS.reduce((a, s) => a + s.net_payout, 0)
  const pendingValue = SETTLEMENTS.filter(s => s.status === 'Pending Approval').reduce((a, s) => a + s.net_payout, 0)
  const paidValue = SETTLEMENTS.filter(s => s.status === 'Paid').reduce((a, s) => a + s.net_payout, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recycler Settlement</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Material sales to recycler partners — logistics deductions and payout approval
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <Play className="w-4 h-4" /> Generate Settlement
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Gross',       value: `$${totalGross.toLocaleString()}`,  color: 'text-slate-800' },
          { label: 'Net Payouts Total', value: `$${totalNet.toLocaleString()}`,    color: 'text-eco-700' },
          { label: 'Pending Approval',  value: `$${pendingValue.toLocaleString()}`, color: 'text-amber-600' },
          { label: 'Paid (April)',       value: `$${paidValue.toLocaleString()}`,   color: 'text-eco-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Settlement list */}
      <div className="space-y-4">
        {SETTLEMENTS.map(s => {
          const statusStyle = STATUS_STYLE[s.status]
          const StatusIcon = statusStyle.icon
          const isPending = s.status === 'Pending Approval'

          return (
            <div key={s.settlement_id} className={`bg-white rounded-2xl border shadow-sm ${isPending ? 'border-amber-100' : 'border-slate-100'}`}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    s.status === 'Paid' ? 'bg-eco-100' : isPending ? 'bg-amber-100' : 'bg-blue-100'
                  }`}>
                    <StatusIcon className={`w-4 h-4 ${
                      s.status === 'Paid' ? 'text-eco-600' : isPending ? 'text-amber-600' : 'text-blue-600'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{s.recycler}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusStyle.badge}`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.settlement_id} · {s.period} · ABN {s.recycler_abn}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-bold text-eco-700">${s.net_payout.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400">net payout</p>
                </div>
              </div>

              <div className="px-5 py-4 grid sm:grid-cols-2 gap-6">
                {/* Material breakdown */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Materials</p>
                  <div className="space-y-2">
                    {s.materials.map(m => (
                      <div key={m.material} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${MATERIAL_COLOR[m.material] || 'bg-slate-300'}`} />
                        <span className="text-xs text-slate-600 flex-1">{m.material}</span>
                        <span className="text-[11px] text-slate-400">{m.quantity_t}t</span>
                        <span className="text-xs font-semibold text-slate-800">${m.subtotal.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fee breakdown */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cost Deductions</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Material Value</span>
                      <span className="font-semibold text-slate-800">${s.gross_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>— Logistics Cost</span>
                      <span>-${s.logistics_cost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>— Platform Fee (5%)</span>
                      <span>-${s.platform_fee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-sm">
                      <span className="text-slate-800">Net Payout</span>
                      <span className="text-eco-700">${s.net_payout.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Margin: {(((s.gross_amount - s.logistics_cost - s.platform_fee) / s.gross_amount) * 100).toFixed(0)}% of gross
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-slate-50 flex items-center justify-between gap-4">
                <div className="text-[11px] text-slate-400">
                  {s.status === 'Paid'
                    ? `Paid ${new Date(s.paid_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `Created ${new Date(s.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
                  }
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                  {isPending && (
                    <button
                      onClick={() => setApproveTarget(s)}
                      className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve Payout
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {approveTarget && (
        <ApproveModal settlement={approveTarget} onClose={() => setApproveTarget(null)} />
      )}
    </div>
  )
}
