import React, { useState } from 'react'
import { Gift, Star, ShoppingBag, Coffee, Zap, Heart, Globe, Search } from 'lucide-react'

const CATEGORIES = [
  { id: 'all',         label: 'All',            icon: Gift },
  { id: 'grocery',    label: 'Grocery & Food',  icon: ShoppingBag },
  { id: 'cafe',       label: 'Cafés & Dining',  icon: Coffee },
  { id: 'energy',     label: 'Green Energy',    icon: Zap },
  { id: 'charity',    label: 'Charity',         icon: Heart },
  { id: 'travel',     label: 'Travel',          icon: Globe },
]

const OFFERS = [
  { id: 1, brand: 'Woolworths',    category: 'grocery', offer: '5% back on groceries',     min: '$5.00',  rating: 4.8, tag: 'Popular' },
  { id: 2, brand: 'Coles',        category: 'grocery', offer: '$10 gift card',              min: '$10.00', rating: 4.7, tag: null },
  { id: 3, brand: 'Harris Farm',  category: 'grocery', offer: '10% off fresh produce',      min: '$3.00',  rating: 4.9, tag: 'New' },
  { id: 4, brand: 'Single O',     category: 'cafe',    offer: 'Free coffee with any brew',  min: '$2.50',  rating: 4.9, tag: 'Popular' },
  { id: 5, brand: 'GYG',         category: 'cafe',    offer: '$5 meal voucher',             min: '$5.00',  rating: 4.6, tag: null },
  { id: 6, brand: 'AGL Green',   category: 'energy',  offer: 'Credit toward green energy bill', min: '$1.00', rating: 4.5, tag: null },
  { id: 7, brand: 'Greenpeace',  category: 'charity', offer: 'Donate any amount',           min: '$0.50',  rating: 5.0, tag: 'Verified' },
  { id: 8, brand: 'WWF Australia', category: 'charity', offer: 'Plant a tree per $1',       min: '$1.00',  rating: 4.9, tag: 'Verified' },
  { id: 9, brand: 'Jetstar',     category: 'travel',  offer: 'Flight credit exchange',      min: '$20.00', rating: 4.3, tag: null },
  { id: 10, brand: 'Opal Travel', category: 'travel', offer: 'Top-up your Opal card',       min: '$5.00',  rating: 4.8, tag: 'Popular' },
  { id: 11, brand: 'Patagonia',  category: 'grocery', offer: '10% off sustainble apparel',  min: '$10.00', rating: 4.8, tag: 'New' },
  { id: 12, brand: 'Who Gives A Crap', category: 'grocery', offer: '15% off eco products', min: '$3.00',  rating: 5.0, tag: 'Popular' },
]

const TAG_STYLE = {
  Popular:  'bg-blue-100 text-blue-700',
  New:      'bg-eco-100 text-eco-700',
  Verified: 'bg-purple-100 text-purple-700',
}

export default function EcoRewards() {
  const [cat, setCat]     = useState('all')
  const [query, setQuery] = useState('')

  const filtered = OFFERS.filter(o =>
    (cat === 'all' || o.category === cat) &&
    (o.brand.toLowerCase().includes(query.toLowerCase()) ||
      o.offer.toLowerCase().includes(query.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Eco Rewards Marketplace</h1>
          <p className="text-sm text-slate-500 mt-1">
            Spend your recovered value across 100+ partner brands.
          </p>
        </div>
        <div className="bg-slate-900 text-white rounded-2xl px-5 py-4 text-center flex-shrink-0">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Available Balance</div>
          <div className="text-2xl font-bold text-eco-400 mt-0.5">$14.20</div>
        </div>
      </div>

      {/* Search + categories */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search rewards…"
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                cat === c.id
                  ? 'border-eco-700 bg-eco-700 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-eco-300'
              }`}
            >
              <c.icon className="w-3.5 h-3.5" />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Offer grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(o => (
          <div
            key={o.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-eco-200 hover:shadow-md transition-all flex flex-col"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="font-bold text-slate-900 text-sm">{o.brand}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs text-slate-500">{o.rating}</span>
                </div>
              </div>
              {o.tag && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TAG_STYLE[o.tag]}`}>
                  {o.tag}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700 flex-1">{o.offer}</p>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
              <span className="text-xs text-slate-400">Min. {o.min}</span>
              <button className="bg-eco-700 hover:bg-eco-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                Redeem
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Gift className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No rewards found</p>
          <p className="text-sm mt-1">Try a different search or category.</p>
        </div>
      )}
    </div>
  )
}
