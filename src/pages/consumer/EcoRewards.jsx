import React, { useState } from 'react'
import {
  Gift, Star, ShoppingBag, Coffee, Zap, Heart, Globe, Search,
  X, CheckCircle, AlertCircle, Clock, TrendingUp,
} from 'lucide-react'

const INITIAL_BALANCE_AUD = 14.20  // demo starting balance
const AUD_TO_PTS = 20              // $1 AUD = 20 points display

const CATEGORIES = [
  { id: 'all',      label: 'All',           icon: Gift      },
  { id: 'grocery',  label: 'Grocery',       icon: ShoppingBag },
  { id: 'cafe',     label: 'Cafés',         icon: Coffee    },
  { id: 'energy',   label: 'Green Energy',  icon: Zap       },
  { id: 'charity',  label: 'Charity',       icon: Heart     },
  { id: 'travel',   label: 'Travel',        icon: Globe     },
]

const OFFERS = [
  { id: 1,  brand: 'Woolworths',        category: 'grocery', offer: '5% back on groceries',           costAud: 5.00,  rating: 4.8, tag: 'Popular'  },
  { id: 2,  brand: 'Coles',             category: 'grocery', offer: '$10 gift card',                  costAud: 10.00, rating: 4.7, tag: null        },
  { id: 3,  brand: 'Harris Farm',       category: 'grocery', offer: '10% off fresh produce',          costAud: 3.00,  rating: 4.9, tag: 'New'       },
  { id: 4,  brand: 'Single O Coffee',   category: 'cafe',    offer: 'Free coffee with any brew',       costAud: 2.50,  rating: 4.9, tag: 'Popular'  },
  { id: 5,  brand: 'GYG',              category: 'cafe',    offer: '$5 meal voucher',                 costAud: 5.00,  rating: 4.6, tag: null        },
  { id: 6,  brand: 'AGL Green',        category: 'energy',  offer: 'Credit toward green energy bill', costAud: 1.00,  rating: 4.5, tag: null        },
  { id: 7,  brand: 'Greenpeace',       category: 'charity', offer: 'Donate any amount',               costAud: 0.50,  rating: 5.0, tag: 'Verified' },
  { id: 8,  brand: 'WWF Australia',    category: 'charity', offer: 'Plant a tree per $1',             costAud: 1.00,  rating: 4.9, tag: 'Verified' },
  { id: 9,  brand: 'Jetstar',          category: 'travel',  offer: 'Flight credit exchange',          costAud: 20.00, rating: 4.3, tag: null        },
  { id: 10, brand: 'Opal Travel',      category: 'travel',  offer: 'Top-up your Opal card',           costAud: 5.00,  rating: 4.8, tag: 'Popular'  },
  { id: 11, brand: 'Patagonia',        category: 'grocery', offer: '10% off sustainable apparel',     costAud: 10.00, rating: 4.8, tag: 'New'       },
  { id: 12, brand: 'Who Gives A Crap', category: 'grocery', offer: '15% off eco products',            costAud: 3.00,  rating: 5.0, tag: 'Popular'  },
]

const TAG_STYLE = {
  Popular:  'bg-blue-100 text-blue-700',
  New:      'bg-eco-100 text-eco-700',
  Verified: 'bg-purple-100 text-purple-700',
}

const BRAND_INITIALS = brand => brand.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const BRAND_COLORS = ['bg-eco-600','bg-indigo-600','bg-amber-600','bg-teal-600','bg-violet-600','bg-rose-600','bg-blue-600','bg-slate-700']

// ── Redeem modal ──────────────────────────────────────────────────────────────

function RedeemModal({ offer, balance, onClose, onConfirm }) {
  const [amount, setAmount] = useState(offer.costAud.toFixed(2))
  const [done, setDone] = useState(false)
  const [voucher] = useState(() => 'ECO-' + Math.random().toString(36).slice(2, 8).toUpperCase())

  const aud = parseFloat(amount) || 0
  const canRedeem = aud >= offer.costAud && aud <= balance

  function confirm() {
    if (!canRedeem) return
    setDone(true)
    onConfirm(aud)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Redeem Reward</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-eco-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 text-eco-700" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Redeemed!</h3>
              <p className="text-sm text-slate-500 mt-1">{offer.brand} — {offer.offer}</p>
            </div>
            <div className="bg-slate-900 text-white rounded-xl p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">Voucher Code</div>
              <div className="text-xl font-bold tracking-widest text-eco-400">{voucher}</div>
              <div className="text-xs text-slate-400 mt-1">Valid 90 days · show at checkout</div>
            </div>
            <button onClick={onClose}
              className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="font-bold text-slate-900">{offer.brand}</div>
              <div className="text-sm text-slate-500 mt-0.5">{offer.offer}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Amount (AUD)
              </label>
              <input
                type="number"
                step="0.50"
                min={offer.costAud}
                max={balance}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>Min. ${offer.costAud.toFixed(2)}</span>
                <span>Max (balance): ${balance.toFixed(2)}</span>
              </div>
            </div>
            {aud > balance && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Insufficient balance
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-xl text-sm hover:border-slate-300">
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={!canRedeem}
                className="flex-1 bg-eco-700 hover:bg-eco-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              >
                Confirm — ${aud.toFixed(2)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EcoRewards() {
  const [cat,     setCat]     = useState('all')
  const [query,   setQuery]   = useState('')
  const [balance, setBalance] = useState(INITIAL_BALANCE_AUD)
  const [active,  setActive]  = useState(null)   // offer being redeemed
  const [history, setHistory] = useState([])

  const filtered = OFFERS.filter(o =>
    (cat === 'all' || o.category === cat) &&
    (o.brand.toLowerCase().includes(query.toLowerCase()) ||
      o.offer.toLowerCase().includes(query.toLowerCase())),
  )

  function handleConfirm(aud) {
    setBalance(b => Math.round((b - aud) * 100) / 100)
    setHistory(h => [{
      id: Date.now(),
      brand: active.brand,
      offer: active.offer,
      aud,
      when: new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    }, ...h])
    setTimeout(() => setActive(null), 1600)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Eco Rewards</h1>
          <p className="text-sm text-slate-500 mt-1">Spend your recovered value across partner brands.</p>
        </div>
        <div className="bg-slate-900 text-white rounded-2xl px-5 py-4 text-right flex-shrink-0 min-w-[140px]">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Available Balance</div>
          <div className="text-2xl font-bold text-eco-400 mt-0.5">${balance.toFixed(2)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">≈ {Math.round(balance * AUD_TO_PTS).toLocaleString()} pts</div>
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
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                cat === c.id ? 'border-eco-700 bg-eco-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-eco-300'
              }`}
            >
              <c.icon className="w-3.5 h-3.5" /> {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Offer grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((o, idx) => {
          const canAfford = o.costAud <= balance
          return (
            <div
              key={o.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col transition-all ${
                canAfford ? 'border-slate-100 hover:border-eco-200 hover:shadow-md' : 'border-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${BRAND_COLORS[idx % BRAND_COLORS.length]}`}>
                  {BRAND_INITIALS(o.brand)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div className="font-bold text-slate-900 text-sm leading-tight">{o.brand}</div>
                    {o.tag && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${TAG_STYLE[o.tag]}`}>
                        {o.tag}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs text-slate-500">{o.rating}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-700 flex-1 mb-4">{o.offer}</p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-xs font-semibold text-slate-500">from ${o.costAud.toFixed(2)}</span>
                <button
                  onClick={() => setActive(o)}
                  disabled={!canAfford}
                  className="bg-eco-700 hover:bg-eco-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {canAfford ? 'Redeem' : 'Insufficient'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Gift className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No rewards found</p>
          <p className="text-sm mt-1">Try a different search or category.</p>
        </div>
      )}

      {/* Redemption history */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900 text-sm">Redemption History</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {history.map(h => (
              <div key={h.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-8 h-8 bg-eco-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-eco-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{h.brand}</div>
                  <div className="text-xs text-slate-400">{h.offer} · {h.when}</div>
                </div>
                <div className="text-sm font-bold text-eco-700">-${h.aud.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redeem modal */}
      {active && (
        <RedeemModal
          offer={active}
          balance={balance}
          onClose={() => setActive(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  )
}
