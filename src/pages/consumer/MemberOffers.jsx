import React from 'react'
import { Lock, CheckCircle, Star, ArrowRight, Zap, Crown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MEMBER_OFFERS, MEMBER_TIERS, MERCHANTS, ptsToAUD } from '../../data/marketplace'

const CURRENT_USER = { name: 'Sarah M.', tier: 'silver', points: 1_420, lifetime_pts: 2_840 }

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum']

function tierRank(tier) { return TIER_ORDER.indexOf(tier) }

const TIER_ICONS = { bronze: Star, silver: Star, gold: Crown, platinum: Crown }

function TierCard({ tierKey, tierData, isCurrentTier, isUnlocked, ptsSoFar }) {
  const TierIcon = TIER_ICONS[tierKey]
  const toNext = tierData.min_points_earned_lifetime - ptsSoFar
  const bgMap = { bronze: 'from-amber-50 to-amber-100', silver: 'from-slate-50 to-slate-200', gold: 'from-yellow-50 to-yellow-100', platinum: 'from-violet-50 to-violet-100' }
  const borderMap = { bronze: 'border-amber-200', silver: 'border-slate-300', gold: 'border-yellow-300', platinum: 'border-violet-300' }
  const iconMap = { bronze: 'text-amber-600', silver: 'text-slate-600', gold: 'text-yellow-600', platinum: 'text-violet-700' }

  return (
    <div className={`rounded-2xl border bg-gradient-to-b ${bgMap[tierKey]} ${borderMap[tierKey]} p-4 ${isCurrentTier ? 'ring-2 ring-eco-400' : ''} relative overflow-hidden`}>
      {isCurrentTier && (
        <div className="absolute top-3 right-3">
          <span className="text-[9px] font-bold px-2 py-0.5 bg-eco-500 text-white rounded-full">YOUR TIER</span>
        </div>
      )}
      <TierIcon className={`w-6 h-6 mb-2 ${iconMap[tierKey]}`} />
      <p className={`font-bold text-lg ${iconMap[tierKey]}`}>{tierData.name}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{tierData.multiplier}× earnings multiplier</p>
      {!isUnlocked && toNext > 0 && (
        <p className="text-[10px] text-slate-400 mt-1">{toNext.toLocaleString()} pts earned to unlock</p>
      )}
      <ul className="mt-3 space-y-1">
        {tierData.perks.map((perk, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
            {isUnlocked ? <CheckCircle className="w-3 h-3 text-eco-500 flex-shrink-0 mt-0.5" /> : <Lock className="w-3 h-3 text-slate-300 flex-shrink-0 mt-0.5" />}
            {perk}
          </li>
        ))}
      </ul>
    </div>
  )
}

function OfferCard({ offer }) {
  const merchant = MERCHANTS.find(m => m.id === offer.merchant_id)
  const userTierRank = tierRank(CURRENT_USER.tier)
  const requiredTierRank = tierRank(offer.tier_required)
  const isUnlocked = userTierRank >= requiredTierRank
  const requiredTier = MEMBER_TIERS[offer.tier_required]

  const BADGE_COLORS = {
    exclusive:    'bg-violet-100 text-violet-700',
    platinum:     'bg-violet-200 text-violet-800',
    limited:      'bg-red-100 text-red-700',
    'early-access': 'bg-indigo-100 text-indigo-700',
    member:       'bg-eco-100 text-eco-700',
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all ${
      isUnlocked ? 'border-slate-100 hover:shadow-md hover:-translate-y-0.5' : 'border-slate-100 opacity-60'
    }`}>
      <div className={`${offer.image_color} h-24 flex items-center justify-center relative`}>
        {!isUnlocked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center">
              <Lock className="w-6 h-6 text-white mx-auto mb-1" />
              <p className="text-[11px] font-bold text-white capitalize">{requiredTier.name}+ only</p>
            </div>
          </div>
        )}
        {offer.badge && (
          <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_COLORS[offer.badge] || 'bg-slate-100 text-slate-600'}`}>
            {offer.badge}
          </span>
        )}
        {offer.available_slots <= 5 && (
          <span className="absolute bottom-2 right-2 text-[9px] font-bold px-1.5 py-0.5 bg-red-500 text-white rounded-full">
            {offer.available_slots} slots left
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          {merchant && (
            <div className={`w-4 h-4 ${merchant.logo_color} rounded-sm flex items-center justify-center`}>
              <span className="text-[7px] font-bold text-white">{merchant.initials?.[0]}</span>
            </div>
          )}
          <span className="text-[11px] text-slate-500 font-semibold">{offer.merchant_name}</span>
        </div>

        <p className="text-sm font-bold text-slate-900 leading-snug flex-1">{offer.name}</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{offer.description}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div>
            <p className={`text-lg font-bold ${isUnlocked ? 'text-slate-900' : 'text-slate-400'}`}>
              {offer.points_cost.toLocaleString()} pts
            </p>
            <p className="text-[10px] text-slate-400">${ptsToAUD(offer.points_cost)} value · expires {offer.expires}</p>
          </div>
          {isUnlocked ? (
            <button className="px-3 py-2 bg-eco-600 text-white text-xs font-bold rounded-xl hover:bg-eco-700 transition-colors whitespace-nowrap">
              Redeem
            </button>
          ) : (
            <div className={`text-[10px] font-bold px-2 py-1 rounded-xl ${requiredTier.badge_bg} ${requiredTier.badge_text} whitespace-nowrap`}>
              {requiredTier.name} tier
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MemberOffers() {
  const navigate = useNavigate()
  const currentTierData = MEMBER_TIERS[CURRENT_USER.tier]
  const currentRank = tierRank(CURRENT_USER.tier)
  const nextTierKey = TIER_ORDER[currentRank + 1]
  const nextTier = nextTierKey ? MEMBER_TIERS[nextTierKey] : null
  const ptsToNextTier = nextTier ? nextTier.min_points_earned_lifetime - CURRENT_USER.lifetime_pts : 0
  const tierPct = nextTier
    ? Math.min(100, ((CURRENT_USER.lifetime_pts - currentTierData.min_points_earned_lifetime) /
        (nextTier.min_points_earned_lifetime - currentTierData.min_points_earned_lifetime)) * 100)
    : 100

  const unlockedOffers = MEMBER_OFFERS.filter(o => tierRank(o.tier_required) <= currentRank)
  const lockedOffers = MEMBER_OFFERS.filter(o => tierRank(o.tier_required) > currentRank)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Member Offers</h1>
        <p className="text-sm text-slate-500 mt-0.5">Exclusive rewards unlocked by your tier — the higher you go, the more you access</p>
      </div>

      {/* Tier status card */}
      <div className="bg-slate-900 rounded-2xl px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white font-bold text-lg">{CURRENT_USER.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentTierData.badge_bg} ${currentTierData.badge_text}`}>
                {currentTierData.name} Tier
              </span>
            </div>
            <p className="text-slate-400 text-sm">{currentTierData.multiplier}× earnings multiplier · {CURRENT_USER.lifetime_pts.toLocaleString()} pts earned lifetime</p>
          </div>
          {nextTier && (
            <div className="text-right">
              <p className="text-xs text-slate-400">To {nextTier.name}</p>
              <p className="text-xl font-bold text-eco-400">{ptsToNextTier.toLocaleString()} pts</p>
            </div>
          )}
        </div>

        {nextTier && (
          <>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-eco-400 rounded-full transition-all" style={{ width: `${tierPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>{currentTierData.name} ({currentTierData.min_points_earned_lifetime.toLocaleString()} pts)</span>
              <span>{nextTier.name} ({nextTier.min_points_earned_lifetime.toLocaleString()} pts)</span>
            </div>
          </>
        )}
      </div>

      {/* Tier comparison */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-3">All Membership Tiers</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {TIER_ORDER.map(tierKey => (
            <TierCard
              key={tierKey}
              tierKey={tierKey}
              tierData={MEMBER_TIERS[tierKey]}
              isCurrentTier={tierKey === CURRENT_USER.tier}
              isUnlocked={tierRank(tierKey) <= currentRank}
              ptsSoFar={CURRENT_USER.lifetime_pts}
            />
          ))}
        </div>
      </div>

      {/* Unlocked offers */}
      {unlockedOffers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-eco-500" />
            <h2 className="text-sm font-bold text-slate-700">Available to You — {currentTierData.name}+ Offers</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-eco-100 text-eco-700 rounded-full">{unlockedOffers.length} offers</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlockedOffers.map(o => <OfferCard key={o.id} offer={o} />)}
          </div>
        </div>
      )}

      {/* Locked offers */}
      {lockedOffers.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-700">Locked — Upgrade to Access</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lockedOffers.map(o => <OfferCard key={o.id} offer={o} />)}
          </div>
        </div>
      )}

      {/* Perks summary for current tier */}
      <div className="bg-eco-50 rounded-2xl border border-eco-100 px-5 py-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-eco-600" />
          <h2 className="font-bold text-eco-900">Your {currentTierData.name} Tier Benefits</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {currentTierData.perks.map((perk, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-eco-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-eco-800">{perk}</p>
            </div>
          ))}
        </div>
        {nextTier && (
          <div className="mt-4 pt-4 border-t border-eco-200">
            <p className="text-xs text-eco-700 font-semibold mb-1">Unlock {nextTier.name} tier for:</p>
            <div className="flex flex-wrap gap-2">
              {nextTier.perks.filter(p => !currentTierData.perks.includes(p)).map((perk, i) => (
                <span key={i} className="text-[11px] font-semibold px-2.5 py-1 bg-white border border-eco-200 text-eco-700 rounded-full">
                  {perk}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
