import React, { useState, useEffect } from 'react'
import {
  DollarSign, TrendingUp, Calendar, Download, CheckCircle,
  Clock, AlertCircle, Award, ChevronRight,
} from 'lucide-react'
import { slaEngine, SLA_TIERS } from '../../lib/slaEngine'
import { ledger } from '../../lib/ledger'

// ── Synthetic station data ────────────────────────────────────────────────────

const STATIONS = [
  { id: 'ST-001', name: 'Surry Hills Hub',    collectionsThisMonth: 48, kgCollected: 2640 },
  { id: 'ST-002', name: 'Redfern Node',       collectionsThisMonth: 62, kgCollected: 3410 },
  { id: 'ST-004', name: 'Marrickville Hub',   collectionsThisMonth: 55, kgCollected: 3020 },
  { id: 'ST-005', name: 'Glebe Point',        collectionsThisMonth: 31, kgCollected: 1680 },
  { id: 'ST-006', name: 'Alexandria Depot',   collectionsThisMonth: 79, kgCollected: 4350 },
  { id: 'ST-007', name: 'Chippendale Drop',   collectionsThisMonth: 22, kgCollected: 1190 },
]

const TOTAL_COLLECTIONS = STATIONS.reduce((s, st) => s + st.collectionsThisMonth, 0)
const TOTAL_KG          = STATIONS.reduce((s, st) => s + st.kgCollected, 0)

function genPayouts() {
  const statuses = ['Paid', 'Paid', 'Paid', 'Processing', 'Pending']
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(2026, 4, 1)
    d.setMonth(d.getMonth() - i)
    const month = d.toLocaleString('default', { month: 'long', year: 'numeric' })
    const amount = 2800 + Math.round(Math.sin(i) * 600 + 800)
    return {
      id:     `STL-${String(200 - i).padStart(4, '0')}`,
      period: month,
      amount,
      status: i === 0 ? 'Pending' : i === 1 ? 'Processing' : 'Paid',
      date:   i === 0 ? 'Pending' : new Date(2026, 4 - i + 1, 1).toLocaleDateString('en-AU'),
    }
  })
}

const PAYOUTS   = genPayouts()
const MONTHLY   = [
  { month: 'Dec', value: 2680 }, { month: 'Jan', value: 2920 },
  { month: 'Feb', value: 3150 }, { month: 'Mar', value: 3480 },
  { month: 'Apr', value: 3760 }, { month: 'May', value: null, projected: true },
]

const STATUS_STYLE = {
  Paid:       'bg-eco-100 text-eco-700',
  Processing: 'bg-amber-100 text-amber-700',
  Pending:    'bg-slate-100 text-slate-500',
}
const STATUS_ICON = { Paid: CheckCircle, Processing: Clock, Pending: AlertCircle }

// ── Component ────────────────────────────────────────────────────────────────

export default function OperatorEarnings() {
  const [ledgerBalance, setLedgerBalance] = useState(null)

  useEffect(() => {
    try {
      const bal = ledger.balance()
      setLedgerBalance(bal.operator_payable ?? null)
    } catch { /* ledger may be empty on first load */ }
  }, [])

  const tierInfo   = slaEngine.getTier(TOTAL_COLLECTIONS)
  const earnings   = slaEngine.computeEarnings({ collectionsCount: TOTAL_COLLECTIONS, totalKg: TOTAL_KG })
  const maxMonthly = Math.max(...MONTHLY.filter(m => m.value).map(m => m.value))

  const thisWeekKg = Math.round(TOTAL_KG * 7 / 31)
  const thisWeekAud = Math.round(thisWeekKg * 0.18 * tierInfo.multiplier * 100) / 100

  const pendingPayout = PAYOUTS.find(p => p.status === 'Pending')?.amount ?? 0
  const processingPayout = PAYOUTS.find(p => p.status === 'Processing')?.amount ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Earnings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Revenue and financial settlement history</p>
        </div>
        <button className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-lg text-sm hover:border-slate-300 transition-colors">
          <Download className="w-4 h-4" /> Export Statement
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Earned (Month)',
            value: `$${earnings.totalAud.toLocaleString()}`,
            sub: `${TOTAL_COLLECTIONS} collections · ${TOTAL_KG.toLocaleString()} kg`,
            icon: DollarSign, iconBg: 'bg-eco-100', iconColor: 'text-eco-700',
          },
          {
            label: 'This Week',
            value: `$${thisWeekAud.toLocaleString()}`,
            sub: `~${thisWeekKg.toLocaleString()} kg collected`,
            icon: TrendingUp, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700',
          },
          {
            label: 'Pending Payout',
            value: `$${(pendingPayout + processingPayout).toLocaleString()}`,
            sub: pendingPayout > 0 ? 'Processing + Pending' : 'In processing',
            icon: Clock, iconBg: 'bg-amber-100', iconColor: 'text-amber-700',
          },
          {
            label: 'Ledger Balance',
            value: ledgerBalance != null ? `$${Math.abs(ledgerBalance).toFixed(2)}` : '—',
            sub: 'operator_payable account',
            icon: Calendar, iconBg: 'bg-violet-100', iconColor: 'text-violet-700',
          },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
              <c.icon className={`w-5 h-5 ${c.iconColor}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">{c.value}</div>
              <div className="text-xs font-semibold text-slate-600 mt-0.5">{c.label}</div>
              <div className="text-[11px] text-slate-400">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* SLA Tier + Monthly chart */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Monthly bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Monthly Earnings (AUD)</h2>
          <div className="flex items-end gap-4 h-40">
            {MONTHLY.map(m => {
              const h = m.value ? (m.value / maxMonthly) * 140 : 0
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    {m.value ? `$${(m.value / 1000).toFixed(1)}k` : 'proj.'}
                  </span>
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      m.projected
                        ? 'bg-indigo-200 border-2 border-dashed border-indigo-400'
                        : 'bg-indigo-600'
                    }`}
                    style={{ height: `${h || 80}px` }}
                  />
                  <span className={`text-xs font-medium ${m.projected ? 'text-indigo-500' : 'text-slate-500'}`}>
                    {m.month}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* SLA tier card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">SLA Tier</h2>
            <Award className="w-5 h-5 text-slate-400" />
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border ${tierInfo.bg} ${tierInfo.color} ${tierInfo.border}`}>
            <Award className="w-4 h-4" />
            {tierInfo.label}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{TOTAL_COLLECTIONS} collections this month</span>
              {tierInfo.nextTier && <span>{tierInfo.collectionsToNext} to {tierInfo.nextTier.label}</span>}
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.min(100, tierInfo.progressPct)}%` }}
              />
            </div>
          </div>
          <div className="text-sm font-semibold text-slate-700">
            {tierInfo.multiplier}× earnings multiplier
          </div>
        </div>
      </div>

      {/* SLA tier table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">SLA Tier Schedule</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Tier', 'Collections/Month', 'Rate Multiplier', 'Base Rate', 'Effective Rate'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {SLA_TIERS.map(t => {
                const isActive = t.tier === tierInfo.tier
                return (
                  <tr key={t.tier} className={`transition-colors ${isActive ? 'bg-indigo-50' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${t.bg} ${t.color} ${t.border}`}>
                        <Award className="w-3 h-3" /> {t.label}
                        {isActive && <span className="ml-1 text-[10px]">← you</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium">
                      {t.max === Infinity ? `${t.min}+` : `${t.min}–${t.max}`}
                    </td>
                    <td className="px-6 py-4 font-bold text-indigo-700">{t.multiplier.toFixed(2)}×</td>
                    <td className="px-6 py-4 text-slate-500">$0.18 / kg</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      ${(0.18 * t.multiplier).toFixed(4)} / kg
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-station breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Station Breakdown — May 2026</h2>
          <span className="text-xs text-slate-400">{tierInfo.multiplier}× multiplier applied</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Station', 'Collections', 'kg Collected', 'Base Rate', 'Earned (AUD)'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {STATIONS.map(st => {
                const stEarnings = slaEngine.computeEarnings({
                  collectionsCount: TOTAL_COLLECTIONS,
                  totalKg: st.kgCollected,
                })
                return (
                  <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{st.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{st.id}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">{st.collectionsThisMonth}</td>
                    <td className="px-6 py-4 text-slate-700">{st.kgCollected.toLocaleString()} kg</td>
                    <td className="px-6 py-4 text-slate-500">$0.18 × {tierInfo.multiplier}×</td>
                    <td className="px-6 py-4 font-bold text-eco-700">${stEarnings.totalAud.toFixed(2)}</td>
                  </tr>
                )
              })}
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td className="px-6 py-4 font-bold text-slate-900">TOTAL</td>
                <td className="px-6 py-4 font-bold text-slate-900">{TOTAL_COLLECTIONS}</td>
                <td className="px-6 py-4 font-bold text-slate-900">{TOTAL_KG.toLocaleString()} kg</td>
                <td className="px-6 py-4" />
                <td className="px-6 py-4 font-bold text-eco-700 text-base">${earnings.totalAud.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout history */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Payout History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Reference', 'Period', 'Amount', 'Status', 'Date', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {PAYOUTS.map(p => {
                const Icon = STATUS_ICON[p.status]
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">{p.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{p.period}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">${p.amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>
                        <Icon className="w-3 h-3" /> {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">{p.date}</td>
                    <td className="px-6 py-4">
                      {p.status === 'Paid' && (
                        <button className="text-xs text-indigo-600 font-semibold hover:underline">Download</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
