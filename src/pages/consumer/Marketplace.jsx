import React, { useState } from 'react'
import { Search, Filter, ShoppingBag, Tag, Sparkles, RefreshCw, CheckCircle, X, Star, Leaf, Zap } from 'lucide-react'
import {
  LISTINGS, MERCHANTS, MERCHANT_CAMPAIGNS, REDEMPTION_HISTORY,
  MEMBER_TIERS, ptsToAUD, PLATFORM_FEE_PCT,
} from '../../data/marketplace'

// Current user (Sarah M.) — Silver tier, 1,420 points
const CURRENT_USER = { name: 'Sarah M.', tier: 'silver', points: 1_420, lifetime_pts: 2_840 }

const CATEGORIES = [
  { id: 'all',         label: 'All',          icon: ShoppingBag },
  { id: 'electronics', label: 'Electronics',  icon: Zap },
  { id: 'food',        label: 'Food & Drink', icon: null },
  { id: 'lifestyle',   label: 'Lifestyle',    icon: null },
  { id: 'transport',   label: 'Transport',    icon: null },
  { id: 'home',        label: 'Home',         icon: null },
]

const TYPE_META = {
  product:    { label: 'Product',    color: 'bg-slate-100 text-slate-600',    icon: ShoppingBag },
  voucher:    { label: 'Voucher',    color: 'bg-violet-100 text-violet-700',  icon: Tag },
  experience: { label: 'Experience', color: 'bg-indigo-100 text-indigo-700',  icon: Sparkles },
  swap:       { label: 'Swap',       color: 'bg-eco-100 text-eco-700',        icon: RefreshCw },
}

const BADGE_META = {
  popular:   'bg-blue-100 text-blue-700',
  new:       'bg-eco-100 text-eco-700',
  value:     'bg-amber-100 text-amber-700',
  exclusive: 'bg-violet-100 text-violet-700',
  swap:      'bg-eco-100 text-eco-700',
}

const TIER_META = MEMBER_TIERS

function TierBadge({ tier }) {
  const t = TIER_META[tier]
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.badge_bg} ${t.badge_text}`}>
      {t.name}
    </span>
  )
}

function SustainabilityDot({ score }) {
  const color = score >= 90 ? 'bg-eco-500' : score >= 75 ? 'bg-amber-400' : 'bg-slate-400'
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-slate-400 font-semibold">{score}</span>
    </div>
  )
}

function RedeemModal({ listing, merchant, onClose, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false)
  const [done, setDone] = useState(false)
  const canAfford = CURRENT_USER.points >= listing.points_cost
  const remaining = CURRENT_USER.points - listing.points_cost

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
          <div className="w-16 h-16 bg-eco-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-eco-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Redeemed!</h2>
          <p className="text-sm text-slate-500 mb-4">
            Your <strong>{listing.name}</strong> from {merchant.name} is confirmed.
          </p>
          <div className="bg-slate-50 rounded-xl px-4 py-3 mb-5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Points spent</span>
              <span className="font-bold text-red-500">−{listing.points_cost.toLocaleString()} pts</span>
            </div>
            <div className="flex justify-between text-slate-600 mt-1">
              <span>Remaining balance</span>
              <span className="font-bold text-eco-700">{remaining.toLocaleString()} pts</span>
            </div>
          </div>
          <div className="bg-eco-50 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2">
            <Leaf className="w-4 h-4 text-eco-600 flex-shrink-0" />
            <p className="text-xs text-eco-700 font-medium">This redemption supports sustainable business. Thank you!</p>
          </div>
          <button onClick={onClose} className="w-full py-3 bg-eco-600 text-white font-bold rounded-xl hover:bg-eco-700 transition-colors">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Confirm Redemption</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Listing summary */}
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 ${listing.image_color} rounded-xl flex-shrink-0`} />
            <div>
              <p className="text-sm font-bold text-slate-900">{listing.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{merchant.name}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{listing.description}</p>
            </div>
          </div>

          {/* Points calc */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Your balance</span>
              <span className="font-bold text-slate-700">{CURRENT_USER.points.toLocaleString()} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cost</span>
              <span className="font-bold text-red-500">−{listing.points_cost.toLocaleString()} pts</span>
            </div>
            <div className="flex justify-between text-eco-700 border-t border-slate-200 pt-2 mt-1">
              <span className="font-semibold">Balance after</span>
              <span className={`font-bold ${remaining < 0 ? 'text-red-600' : 'text-eco-700'}`}>
                {remaining.toLocaleString()} pts
              </span>
            </div>
            <div className="flex justify-between text-slate-400 text-xs">
              <span>Equivalent value</span>
              <span className="font-semibold">${ptsToAUD(listing.points_cost)} AUD</span>
            </div>
          </div>

          {!canAfford && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold text-center">
              Insufficient points — you need {(listing.points_cost - CURRENT_USER.points).toLocaleString()} more pts
            </div>
          )}

          {canAfford && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 accent-eco-600" />
              <span className="text-sm text-slate-700">I confirm I want to redeem <strong>{listing.points_cost.toLocaleString()} pts</strong> for this reward.</span>
            </label>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200">Cancel</button>
            <button
              disabled={!canAfford || !confirmed}
              onClick={() => setDone(true)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                canAfford && confirmed ? 'bg-eco-600 text-white hover:bg-eco-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Redeem Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ListingCard({ listing, onRedeem }) {
  const merchant = MERCHANTS.find(m => m.id === listing.merchant_id)
  const typeMeta = TYPE_META[listing.type]
  const TypeIcon = typeMeta.icon
  const canAfford = CURRENT_USER.points >= listing.points_cost
  const stockLow = listing.stock <= 3 && listing.stock < 999

  // Check if there's an active campaign for this listing
  const campaign = MERCHANT_CAMPAIGNS.find(c =>
    c.merchant_id === listing.merchant_id &&
    c.status === 'active' &&
    (c.eligible_type === listing.type || c.eligible_type === 'all')
  )

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5 ${
      canAfford ? 'border-slate-100' : 'border-slate-100 opacity-75'
    }`}>
      {/* Image placeholder */}
      <div className={`${listing.image_color} h-28 flex items-center justify-center relative`}>
        <TypeIcon className="w-8 h-8 text-white/60" />
        {listing.badge && (
          <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_META[listing.badge]}`}>
            {listing.badge}
          </span>
        )}
        {campaign && (
          <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 bg-amber-400 text-white rounded-full">
            {campaign.uplift_label}
          </span>
        )}
        {stockLow && (
          <span className="absolute bottom-2 right-2 text-[9px] font-bold px-1.5 py-0.5 bg-red-500 text-white rounded-full">
            Only {listing.stock} left
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        {/* Merchant */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-4 h-4 ${merchant?.logo_color || 'bg-slate-400'} rounded-sm flex items-center justify-center`}>
              <span className="text-[7px] font-bold text-white">{merchant?.initials?.[0]}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-semibold truncate">{listing.merchant_name}</span>
          </div>
          {merchant && <SustainabilityDot score={merchant.sustainability_score} />}
        </div>

        <p className="text-sm font-bold text-slate-900 leading-snug flex-1">{listing.name}</p>

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${typeMeta.color}`}>{typeMeta.label}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-eco-50 text-eco-600">{listing.sustainability_tag}</span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className={`text-lg font-bold ${canAfford ? 'text-slate-900' : 'text-slate-400'}`}>
              {listing.points_cost.toLocaleString()} pts
            </p>
            <p className="text-[11px] text-slate-400">${ptsToAUD(listing.points_cost)} AUD value</p>
          </div>
          <button
            onClick={() => onRedeem(listing)}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
              canAfford
                ? 'bg-eco-600 text-white hover:bg-eco-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {canAfford ? 'Redeem' : 'Need pts'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Marketplace() {
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('popular')
  const [selected, setSelected] = useState(null)
  const tier = TIER_META[CURRENT_USER.tier]

  const filtered = LISTINGS
    .filter(l => {
      const merchantActive = MERCHANTS.find(m => m.id === l.merchant_id)?.status === 'active'
      if (!merchantActive) return false
      if (category !== 'all' && l.category !== category) return false
      if (query && !l.name.toLowerCase().includes(query.toLowerCase()) &&
          !l.merchant_name.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'popular')   return b.redeemed_total - a.redeemed_total
      if (sortBy === 'low_pts')   return a.points_cost - b.points_cost
      if (sortBy === 'high_pts')  return b.points_cost - a.points_cost
      return 0
    })

  const swapListings = LISTINGS.filter(l => l.type === 'swap')
  const activeM = MERCHANTS.filter(m => m.status === 'active')

  const redeemMerchant = selected ? MERCHANTS.find(m => m.id === selected.merchant_id) : null

  return (
    <div className="space-y-6">
      {selected && redeemMerchant && (
        <RedeemModal
          listing={selected}
          merchant={redeemMerchant}
          onClose={() => setSelected(null)}
          onConfirm={() => setSelected(null)}
        />
      )}

      {/* Hero */}
      <div className="bg-slate-900 rounded-2xl px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Eco Rewards Marketplace</h1>
          <p className="text-sm text-slate-400 mt-0.5">Spend your eco points at verified green merchants</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-eco-400">{CURRENT_USER.points.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400">Available points</p>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div className="text-right">
            <TierBadge tier={CURRENT_USER.tier} />
            <p className="text-[11px] text-slate-400 mt-0.5">{tier.multiplier}× multiplier</p>
          </div>
        </div>
      </div>

      {/* Active campaigns banner */}
      {MERCHANT_CAMPAIGNS.filter(c => c.status === 'active').length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex gap-3 pb-1">
            {MERCHANT_CAMPAIGNS.filter(c => c.status === 'active').slice(0, 4).map(c => (
              <div key={c.id} className="flex-shrink-0 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3 min-w-64">
                <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-900">{c.name}</p>
                  <p className="text-[10px] text-amber-700">{c.merchant_name} · ends {c.end_date}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-400 text-white rounded-full flex-shrink-0">{c.uplift_label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* E-Waste Swap Feature */}
      <div className="bg-eco-950 rounded-2xl px-5 py-5">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-5 h-5 text-eco-400" />
          <h2 className="font-bold text-white">Electronics Swap Program</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-eco-700 text-eco-300 rounded-full">Featured</span>
        </div>
        <p className="text-xs text-eco-300 mb-4">Trade in old devices at verified recyclers — earn credit toward certified refurbished tech</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {swapListings.map(l => (
            <button key={l.id} onClick={() => setSelected(l)}
              className="bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-3 text-left">
              <p className="text-sm font-bold text-white">{l.name}</p>
              <p className="text-[11px] text-eco-400 mt-0.5">{l.merchant_name}</p>
              <p className="text-sm font-bold text-eco-300 mt-2">{l.points_cost.toLocaleString()} pts</p>
            </button>
          ))}
        </div>
      </div>

      {/* Merchant strip */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-3">Verified Green Merchants</h2>
        <div className="overflow-x-auto">
          <div className="flex gap-3 pb-1">
            {activeM.map(m => (
              <div key={m.id} className="flex-shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3 min-w-48">
                <div className={`w-9 h-9 ${m.logo_color} rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {m.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{m.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <SustainabilityDot score={m.sustainability_score} />
                    {m.verified && <CheckCircle className="w-3 h-3 text-eco-500" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search listings or merchants…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eco-400 bg-white" />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-eco-400 text-slate-600">
          <option value="popular">Most Popular</option>
          <option value="low_pts">Lowest Points</option>
          <option value="high_pts">Highest Points</option>
        </select>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCategory(cat.id)}
            className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl border transition-colors ${
              category === cat.id
                ? 'bg-eco-600 text-white border-eco-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-eco-300 hover:text-eco-700'
            }`}>{cat.label}</button>
        ))}
      </div>

      {/* Listing grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(l => (
          <ListingCard key={l.id} listing={l} onRedeem={setSelected} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No listings found. Try a different category or search.</p>
          </div>
        )}
      </div>

      {/* Recent redemptions */}
      {REDEMPTION_HISTORY.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900">Your Recent Redemptions</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {REDEMPTION_HISTORY.map(r => (
              <div key={r.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{r.listing_name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{r.merchant_name} · {new Date(r.ts).toLocaleDateString('en-AU')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-700">−{r.points_spent} pts</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    r.status === 'fulfilled' ? 'bg-eco-100 text-eco-700' : 'bg-amber-100 text-amber-700'
                  }`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
