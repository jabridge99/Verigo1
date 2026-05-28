import React from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Package, Megaphone, BarChart2, ArrowRight, CheckCircle, Leaf, DollarSign } from 'lucide-react'
import { MERCHANTS, LISTINGS, MERCHANT_CAMPAIGNS, MERCHANT_ANALYTICS_7D, PLATFORM_FEE_PCT, ptsToAUD } from '../../data/marketplace'

const MERCHANT = MERCHANTS[0]  // The Green Cycle

const MAX_BAR = Math.max(...MERCHANT_ANALYTICS_7D.map(d => d.redemptions))

function BarChart({ data }) {
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map(d => {
        const h = Math.max(6, (d.redemptions / MAX_BAR) * 96)
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-eco-500 rounded-t-sm" style={{ height: `${h}px` }} title={`${d.redemptions} redemptions`} />
            <p className="text-[9px] text-slate-400">{d.day}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function MerchantDashboard() {
  const navigate = useNavigate()
  const myListings = LISTINGS.filter(l => l.merchant_id === MERCHANT.id)
  const myCampaigns = MERCHANT_CAMPAIGNS.filter(c => c.merchant_id === MERCHANT.id)
  const activeCampaigns = myCampaigns.filter(c => c.status === 'active')

  const week = MERCHANT_ANALYTICS_7D
  const weekRedemptions = week.reduce((s, d) => s + d.redemptions, 0)
  const weekPoints = week.reduce((s, d) => s + d.points, 0)
  const weekRevenue = week.reduce((s, d) => s + d.revenue, 0)
  const weekFee = weekRevenue * (PLATFORM_FEE_PCT / 100)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-8 h-8 ${MERCHANT.logo_color} rounded-lg flex items-center justify-center text-white text-xs font-bold`}>
              {MERCHANT.initials}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{MERCHANT.name}</h1>
            {MERCHANT.verified && (
              <CheckCircle className="w-5 h-5 text-eco-500" title="Verified Green Merchant" />
            )}
          </div>
          <p className="text-sm text-slate-500">{MERCHANT.tagline}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-eco-50 border border-eco-100 rounded-xl px-3 py-1.5">
            <Leaf className="w-3.5 h-3.5 text-eco-600" />
            <span className="text-xs font-bold text-eco-700">Sustainability Score: {MERCHANT.sustainability_score}/100</span>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Redemptions (7d)', value: weekRedemptions, color: 'text-eco-700', bg: 'bg-eco-50', icon: TrendingUp },
          { label: 'Pts Redeemed (7d)', value: weekPoints.toLocaleString(), color: 'text-violet-700', bg: 'bg-violet-50', icon: BarChart2 },
          { label: 'Gross Revenue (7d)', value: `$${weekRevenue.toLocaleString()}`, color: 'text-slate-800', bg: 'bg-slate-50', icon: DollarSign },
          { label: 'Platform Fee (7d)', value: `$${weekFee.toFixed(2)}`, color: 'text-amber-700', bg: 'bg-amber-50', icon: DollarSign },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
                </div>
                <Icon className={`w-4 h-4 ${s.color} opacity-50`} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-day chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Redemptions This Week</h2>
            <button onClick={() => navigate('/merchant/analytics')}
              className="text-xs text-eco-600 font-semibold flex items-center gap-1 hover:text-eco-800">
              Full analytics <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <BarChart data={MERCHANT_ANALYTICS_7D} />
          <div className="flex justify-between mt-4 text-xs text-slate-400">
            <span>Total this week: <strong className="text-slate-700">{weekRedemptions}</strong></span>
            <span>Revenue: <strong className="text-slate-700">${weekRevenue.toLocaleString()}</strong></span>
            <span>Fee: <strong className="text-amber-600">${weekFee.toFixed(2)}</strong></span>
          </div>
        </div>

        {/* Quick stats */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Catalogue Status</h3>
            {[
              { label: 'Active listings', value: myListings.length, color: 'text-eco-700' },
              { label: 'Total redeemed (all-time)', value: myListings.reduce((s, l) => s + l.redeemed_total, 0), color: 'text-slate-700' },
              { label: 'Active campaigns', value: activeCampaigns.length, color: 'text-violet-700' },
              { label: 'Platform fee rate', value: `${PLATFORM_FEE_PCT}%`, color: 'text-amber-700' },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-xs">
                <span className="text-slate-500">{s.label}</span>
                <span className={`font-bold ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-eco-950 rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-white">Sustainability Impact</h3>
            <div className="flex items-center gap-2 text-xs text-eco-300">
              <Leaf className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{MERCHANT.total_redemptions} total redemptions since joining</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-eco-300">
              <Leaf className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Est. {Math.round(MERCHANT.total_redemptions * 0.34)} devices diverted from landfill</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-eco-300">
              <Leaf className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Est. {Math.round(MERCHANT.total_redemptions * 68)} kg CO₂ saved</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active campaigns */}
      {activeCampaigns.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Active Campaigns</h2>
            <button onClick={() => navigate('/merchant/campaigns')}
              className="text-xs text-eco-600 font-semibold flex items-center gap-1 hover:text-eco-800">
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {activeCampaigns.map(c => {
              const budgetPct = c.budget_pts > 0 ? Math.min(100, (c.spent_pts / c.budget_pts) * 100) : 0
              return (
                <div key={c.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.id} · {c.start_date} → {c.end_date}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-eco-700">{c.redeemed_count} redeemed</p>
                      <p className="text-[11px] text-slate-400">{c.points_awarded.toLocaleString()} pts awarded</p>
                    </div>
                  </div>
                  {c.budget_pts > 0 && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Budget used</span>
                        <span>{c.spent_pts.toLocaleString()} / {c.budget_pts.toLocaleString()} pts</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-eco-500 rounded-full" style={{ width: `${budgetPct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Module quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Add New Listing', to: '/merchant/products', icon: Package, color: 'eco' },
          { label: 'Create Campaign', to: '/merchant/campaigns', icon: Megaphone, color: 'violet' },
          { label: 'View Analytics', to: '/merchant/analytics', icon: BarChart2, color: 'indigo' },
        ].map(m => {
          const Icon = m.icon
          return (
            <button key={m.to} onClick={() => navigate(m.to)}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4 text-left">
              <Icon className={`w-5 h-5 mb-2 ${m.color === 'eco' ? 'text-eco-600' : m.color === 'violet' ? 'text-violet-600' : 'text-indigo-600'}`} />
              <p className="text-sm font-bold text-slate-800">{m.label}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
