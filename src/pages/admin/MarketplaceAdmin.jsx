import React, { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Clock, TrendingUp, ShoppingBag, DollarSign, Users, BarChart2, Search } from 'lucide-react'
import {
  MERCHANTS, LISTINGS, MERCHANT_CAMPAIGNS, GROUP_REWARDS,
  MARKETPLACE_SUMMARY, PLATFORM_FEE_BREAKDOWN_30D,
  PLATFORM_FEE_PCT, ptsToAUD,
} from '../../data/marketplace'

const MERCHANT_STATUS_META = {
  active:           { label: 'Active',           color: 'bg-eco-100 text-eco-700',      dot: 'bg-eco-500' },
  pending_approval: { label: 'Pending Review',   color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400 animate-pulse' },
  suspended:        { label: 'Suspended',        color: 'bg-red-100 text-red-700',      dot: 'bg-red-400' },
}

function MerchantRow({ merchant }) {
  const [expanded, setExpanded] = useState(false)
  const statusMeta = MERCHANT_STATUS_META[merchant.status]
  const myListings = LISTINGS.filter(l => l.merchant_id === merchant.id)
  const myCampaigns = MERCHANT_CAMPAIGNS.filter(c => c.merchant_id === merchant.id && c.status === 'active')

  return (
    <>
      <tr className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 ${merchant.logo_color} rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {merchant.initials}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{merchant.name}</p>
              <p className="text-[11px] text-slate-400">{merchant.category} · {merchant.location}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-3.5">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusMeta.color}`}>{statusMeta.label}</span>
          </div>
        </td>
        <td className="px-3 py-3.5 text-center">
          <p className="text-sm font-bold text-eco-700">{merchant.sustainability_score}</p>
          {merchant.verified && <CheckCircle className="w-3.5 h-3.5 text-eco-500 mx-auto mt-0.5" />}
        </td>
        <td className="px-3 py-3.5 text-right text-sm text-slate-600">{merchant.active_listings}</td>
        <td className="px-3 py-3.5 text-right text-sm text-slate-600">{merchant.total_redemptions.toLocaleString()}</td>
        <td className="px-3 py-3.5 text-right font-bold text-amber-600">${merchant.platform_fee_aud.toFixed(2)}</td>
        <td className="px-5 py-3.5">
          {merchant.status === 'pending_approval' ? (
            <div className="flex gap-1.5">
              <button className="text-[10px] font-bold px-2.5 py-1.5 bg-eco-600 text-white rounded-lg hover:bg-eco-700" onClick={e => e.stopPropagation()}>
                Approve
              </button>
              <button className="text-[10px] font-bold px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" onClick={e => e.stopPropagation()}>
                Reject
              </button>
            </div>
          ) : merchant.status === 'active' ? (
            <button className="text-[10px] font-semibold px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors" onClick={e => e.stopPropagation()}>
              Suspend
            </button>
          ) : (
            <button className="text-[10px] font-semibold px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-eco-50 hover:text-eco-700 transition-colors" onClick={e => e.stopPropagation()}>
              Reinstate
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-slate-400 font-semibold mb-1">Certifications</p>
                <div className="flex flex-wrap gap-1">
                  {merchant.certifications.length > 0
                    ? merchant.certifications.map(c => (
                        <span key={c} className="px-1.5 py-0.5 bg-eco-100 text-eco-700 rounded font-semibold text-[10px]">{c}</span>
                      ))
                    : <span className="text-slate-400 italic">None submitted</span>}
                </div>
              </div>
              <div>
                <p className="text-slate-400 font-semibold mb-1">Active campaigns</p>
                <p className="font-bold text-slate-700">{myCampaigns.length}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold mb-1">Points redeemed (all-time)</p>
                <p className="font-bold text-slate-700">{merchant.total_points_redeemed.toLocaleString()} pts</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold mb-1">Joined</p>
                <p className="font-bold text-slate-700">{merchant.joined}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">{merchant.description}</p>
          </td>
        </tr>
      )}
    </>
  )
}

export default function MarketplaceAdmin() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView] = useState('merchants')

  const filtered = MERCHANTS.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (query && !m.name.toLowerCase().includes(query.toLowerCase()) && !m.category.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  const pending = MERCHANTS.filter(m => m.status === 'pending_approval')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Marketplace Admin</h1>
        <p className="text-sm text-slate-500 mt-0.5">Eco Rewards Marketplace · {PLATFORM_FEE_PCT}% platform fee · merchant oversight</p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Merchants',     value: MARKETPLACE_SUMMARY.active_merchants,                   color: 'text-eco-700',    bg: 'bg-eco-50',    icon: Users },
          { label: 'Platform Fees (30d)',  value: `$${MARKETPLACE_SUMMARY.platform_fees_30d_aud.toFixed(0)}`, color: 'text-amber-700', bg: 'bg-amber-50', icon: DollarSign },
          { label: 'Redemptions (30d)',    value: MARKETPLACE_SUMMARY.total_redemptions_30d.toLocaleString(), color: 'text-violet-700', bg: 'bg-violet-50', icon: ShoppingBag },
          { label: 'Active Campaigns',     value: MARKETPLACE_SUMMARY.active_campaigns,                   color: 'text-indigo-700', bg: 'bg-indigo-50', icon: BarChart2 },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
                </div>
                <Icon className={`w-4 h-4 ${s.color} opacity-40`} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Pending approval alert */}
      {pending.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">{pending.length} merchant{pending.length > 1 ? 's' : ''} pending review</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {pending.map(m => m.name).join(', ')} — sustainability credentials require verification
            </p>
          </div>
          <button onClick={() => setStatusFilter('pending_approval')}
            className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1">
            Review <TrendingUp className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-100">
        {[
          { id: 'merchants', label: 'Merchants' },
          { id: 'fees',      label: 'Fee Ledger (30d)' },
          { id: 'campaigns', label: 'Campaigns' },
          { id: 'groups',    label: 'Group Rewards' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              view === tab.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>{tab.label}</button>
        ))}
      </div>

      {/* Merchants tab */}
      {view === 'merchants' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search merchants…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white" />
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {[
                { id: 'all',              label: 'All' },
                { id: 'active',           label: 'Active' },
                { id: 'pending_approval', label: 'Pending' },
              ].map(f => (
                <button key={f.id} onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    statusFilter === f.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                  }`}>{f.label}</button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 bg-slate-900">
              <h2 className="font-bold text-white">Merchant Registry — {filtered.length} merchants</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Merchant</th>
                    <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Status</th>
                    <th className="text-center px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Score</th>
                    <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Listings</th>
                    <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Redemptions</th>
                    <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Fees Paid</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => <MerchantRow key={m.id} merchant={m} />)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Fee ledger tab */}
      {view === 'fees' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 bg-slate-900">
              <h2 className="font-bold text-white">Platform Fee Ledger — Last 30 Days</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{PLATFORM_FEE_PCT}% fee on all points redemptions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Merchant</th>
                    <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Redemptions</th>
                    <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Pts Redeemed</th>
                    <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Gross (AUD)</th>
                    <th className="text-right px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Platform Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {PLATFORM_FEE_BREAKDOWN_30D.map(row => (
                    <tr key={row.merchant} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{row.merchant}</td>
                      <td className="px-3 py-3.5 text-right text-slate-600">{row.redemptions.toLocaleString()}</td>
                      <td className="px-3 py-3.5 text-right text-violet-700 font-semibold">{row.pts_redeemed.toLocaleString()}</td>
                      <td className="px-3 py-3.5 text-right text-slate-600">${(row.pts_redeemed * 0.05).toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-amber-600">${row.fee_aud.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-amber-50 border-t-2 border-amber-200">
                    <td className="px-5 py-3 font-bold text-slate-800">Total</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-700">
                      {PLATFORM_FEE_BREAKDOWN_30D.reduce((s, r) => s + r.redemptions, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-violet-700">
                      {PLATFORM_FEE_BREAKDOWN_30D.reduce((s, r) => s + r.pts_redeemed, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-700">
                      ${(PLATFORM_FEE_BREAKDOWN_30D.reduce((s, r) => s + r.pts_redeemed, 0) * 0.05).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-amber-700 text-base">
                      ${PLATFORM_FEE_BREAKDOWN_30D.reduce((s, r) => s + r.fee_aud, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns tab */}
      {view === 'campaigns' && (
        <div className="space-y-3">
          {MERCHANT_CAMPAIGNS.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.merchant_name} · {c.id} · {c.start_date} → {c.end_date}</p>
                  <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.status === 'active' ? 'bg-eco-100 text-eco-700' :
                    c.status === 'scheduled' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                  }`}>{c.status}</span>
                  {c.uplift_label && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{c.uplift_label}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span><strong className="text-slate-700">{c.redeemed_count}</strong> redeemed</span>
                <span><strong className="text-violet-700">{c.points_awarded.toLocaleString()}</strong> pts awarded</span>
                {c.budget_pts > 0 && <span><strong className="text-amber-600">{Math.round(c.spent_pts / c.budget_pts * 100)}%</strong> budget used</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Group rewards tab */}
      {view === 'groups' && (
        <div className="space-y-3">
          {GROUP_REWARDS.map(g => {
            const pct = Math.min(100, Math.round(g.current_points / g.target_points * 100))
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{g.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{g.merchant_name} · {g.participants} participants · deadline {g.deadline}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate max-w-md">{g.reward}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-eco-700">{pct}%</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${g.status === 'active' ? 'bg-eco-100 text-eco-700' : 'bg-slate-100 text-slate-500'}`}>{g.status}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-eco-500' : 'bg-violet-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>{g.current_points.toLocaleString()} pts raised</span>
                    <span>{g.target_points.toLocaleString()} pts goal</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
