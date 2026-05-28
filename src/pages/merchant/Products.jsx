import React, { useState } from 'react'
import { Plus, Package, Tag, Sparkles, RefreshCw, X, CheckCircle, AlertTriangle } from 'lucide-react'
import { MERCHANTS, LISTINGS, PLATFORM_FEE_PCT, ptsToAUD, audToPts } from '../../data/marketplace'

const MERCHANT = MERCHANTS[0]

const TYPE_META = {
  product:    { label: 'Product',    color: 'bg-slate-100 text-slate-700',  icon: Package },
  voucher:    { label: 'Voucher',    color: 'bg-violet-100 text-violet-700', icon: Tag },
  experience: { label: 'Experience', color: 'bg-indigo-100 text-indigo-700', icon: Sparkles },
  swap:       { label: 'Swap',       color: 'bg-eco-100 text-eco-700',      icon: RefreshCw },
}

const BADGE_META = {
  popular:  'bg-blue-100 text-blue-700',
  new:      'bg-eco-100 text-eco-700',
  value:    'bg-amber-100 text-amber-700',
  exclusive:'bg-violet-100 text-violet-700',
  swap:     'bg-eco-100 text-eco-700',
}

const SUST_TAGS = ['refurbished', 'voucher', 'swap', 'plastic-free', 'zero-waste', 'carbon-neutral', 'organic', 'secondhand', 'solar', 'zero-emission', 'regenerative-farm']

function FeeBreakdown({ pts, aud }) {
  const fee = (aud * PLATFORM_FEE_PCT / 100).toFixed(2)
  const net = (aud - parseFloat(fee)).toFixed(2)
  return (
    <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5 text-xs">
      <div className="flex justify-between">
        <span className="text-slate-500">Consumer pays</span>
        <span className="font-bold text-slate-700">{pts.toLocaleString()} pts (${aud} AUD equivalent)</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Platform fee ({PLATFORM_FEE_PCT}%)</span>
        <span className="font-bold text-amber-600">−${fee}</span>
      </div>
      <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
        <span className="font-semibold text-slate-600">You receive</span>
        <span className="font-bold text-eco-700">${net}</span>
      </div>
    </div>
  )
}

function AddListingModal({ onClose }) {
  const [form, setForm] = useState({
    name: '', type: 'product', description: '',
    aud_value: '', points_cost: '', stock: '', sustainability_tag: 'refurbished',
  })

  const set = (k, v) => setForm(f => ({
    ...f, [k]: v,
    ...(k === 'aud_value' ? { points_cost: v ? audToPts(parseFloat(v)) : '' } : {}),
    ...(k === 'points_cost' ? { aud_value: v ? (parseInt(v) * 0.05).toFixed(2) : '' } : {}),
  }))

  const valid = form.name.trim() && form.aud_value && form.stock

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="bg-slate-900 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Add New Listing</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-2">Listing type</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(TYPE_META).map(([key, meta]) => {
                const Icon = meta.icon
                return (
                  <button key={key} onClick={() => set('type', key)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      form.type === key ? 'bg-eco-50 border-eco-400 text-eco-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    <Icon className="w-4 h-4" />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Listing name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. $25 Store Voucher"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="What does the customer get? Include sustainability impact."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400 resize-none" />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">AUD value *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                <input type="number" min="1" step="0.50" value={form.aud_value}
                  onChange={e => set('aud_value', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400"
                  placeholder="25.00" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Points cost *</label>
              <input type="number" min="1" value={form.points_cost}
                onChange={e => set('points_cost', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400"
                placeholder="500" />
            </div>
          </div>

          {form.aud_value && form.points_cost && (
            <FeeBreakdown pts={parseInt(form.points_cost) || 0} aud={parseFloat(form.aud_value) || 0} />
          )}

          {/* Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Stock / quantity *</label>
              <input type="number" min="1" value={form.stock} onChange={e => set('stock', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400"
                placeholder="100" />
              <p className="text-[10px] text-slate-400 mt-1">Use 999 for unlimited vouchers</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Sustainability tag</label>
              <select value={form.sustainability_tag} onChange={e => set('sustainability_tag', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400">
                {SUST_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">All listings are reviewed by the EcoBin team before going live. Sustainability claims must be verifiable.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200">Cancel</button>
            <button disabled={!valid}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${valid ? 'bg-eco-600 text-white hover:bg-eco-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
              Submit for Review
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Products() {
  const [filterType, setFilterType] = useState('all')
  const [showAdd, setShowAdd] = useState(false)

  const myListings = LISTINGS.filter(l => l.merchant_id === MERCHANT.id)
  const filtered = filterType === 'all' ? myListings : myListings.filter(l => l.type === filterType)

  return (
    <div className="space-y-6">
      {showAdd && <AddListingModal onClose={() => setShowAdd(false)} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products & Vouchers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your marketplace listings · 5% platform fee on all redemptions</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-eco-600 text-white text-sm font-bold rounded-xl hover:bg-eco-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Listing
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const count = myListings.filter(l => l.type === type).length
          return (
            <div key={type} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xl font-bold text-slate-800">{count}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{meta.label}s</p>
            </div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-slate-100">
        {[{ id: 'all', label: 'All Listings' }, ...Object.entries(TYPE_META).map(([id, m]) => ({ id, label: `${m.label}s` }))].map(tab => (
          <button key={tab.id} onClick={() => setFilterType(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              filterType === tab.id ? 'border-eco-600 text-eco-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>{tab.label}</button>
        ))}
      </div>

      {/* Listings */}
      <div className="space-y-3">
        {filtered.map(l => {
          const meta = TYPE_META[l.type]
          const Icon = meta.icon
          const fee = (l.aud_value * PLATFORM_FEE_PCT / 100).toFixed(2)
          const net = (l.aud_value - parseFloat(fee)).toFixed(2)
          const stockLow = l.stock < 5 && l.stock < 999
          return (
            <div key={l.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 ${l.image_color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{l.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                        {l.badge && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_META[l.badge]}`}>{l.badge}</span>}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-eco-50 text-eco-600">{l.sustainability_tag}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-800">{l.points_cost.toLocaleString()} pts</p>
                      <p className="text-xs text-slate-400">${l.aud_value} AUD value</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 mt-3 text-xs text-slate-500 flex-wrap">
                    <span>Stock: <strong className={`${stockLow ? 'text-red-600' : 'text-slate-700'}`}>{l.stock === 999 ? 'Unlimited' : l.stock}</strong>{stockLow && ' — Low'}</span>
                    <span>Redeemed: <strong className="text-slate-700">{l.redeemed_total}</strong></span>
                    <span>Fee: <strong className="text-amber-600">${fee}</strong></span>
                    <span>You receive: <strong className="text-eco-700">${net}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
