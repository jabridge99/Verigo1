import React, { useState } from 'react'
import {
  Plus, LayoutGrid, List, Star, X, Edit2, Pause, Trash2,
  AlertTriangle, ImagePlus, Package, Zap, Gift, ChevronDown,
} from 'lucide-react'

// ── Static product data ──────────────────────────────────────────────────────

const CATEGORIES = ['Physical', 'Digital', 'Experience']

const INITIAL_PRODUCTS = [
  {
    id: 'P-001', name: 'Bamboo Kitchen Starter Kit', category: 'Physical',
    description: 'Complete bamboo kitchen set: cutting board, utensils, dish brush. Fully compostable.',
    points: 1200, aud: 60, stock: 48, redemptions: 134,
    status: 'Active', sustainability: 5,
    image_color: 'bg-eco-600',
  },
  {
    id: 'P-002', name: 'Reusable Produce Bag Set (12-pack)', category: 'Physical',
    description: 'Organic cotton mesh bags in 3 sizes. Machine washable, replaces 500 plastic bags/year.',
    points: 600, aud: 30, stock: 112, redemptions: 89,
    status: 'Active', sustainability: 5,
    image_color: 'bg-teal-600',
  },
  {
    id: 'P-003', name: 'Carbon Offset Certificate — 1 Tonne', category: 'Digital',
    description: 'Verified Gold Standard carbon offset. Instantly delivered PDF certificate.',
    points: 800, aud: 40, stock: 999, redemptions: 312,
    status: 'Active', sustainability: 5,
    image_color: 'bg-slate-700',
  },
  {
    id: 'P-004', name: 'Charged Earth Coffee Voucher $20', category: 'Digital',
    description: '$20 credit at any Charged Earth Coffee location. Carbon-neutral roastery.',
    points: 400, aud: 20, stock: 999, redemptions: 504,
    status: 'Active', sustainability: 4,
    image_color: 'bg-amber-700',
  },
  {
    id: 'P-005', name: 'Stainless Steel Water Bottle 750ml', category: 'Physical',
    description: 'Double-wall vacuum insulated. Lifetime guarantee. Replaces ~500 plastic bottles/year.',
    points: 900, aud: 45, stock: 27, redemptions: 76,
    status: 'Active', sustainability: 4,
    image_color: 'bg-blue-600',
  },
  {
    id: 'P-006', name: 'Urban Beekeeping Workshop', category: 'Experience',
    description: '3-hour hands-on workshop with a master beekeeper. Includes honey jar to take home.',
    points: 2000, aud: 100, stock: 8, redemptions: 22,
    status: 'Active', sustainability: 4,
    image_color: 'bg-yellow-600',
  },
  {
    id: 'P-007', name: 'Beeswax Wrap Set (3-pack)', category: 'Physical',
    description: 'Handmade beeswax wraps. Replaces cling film for 12+ months.',
    points: 500, aud: 25, stock: 0, redemptions: 61,
    status: 'Active', sustainability: 5,
    image_color: 'bg-yellow-500',
  },
  {
    id: 'P-008', name: 'Solar Phone Charger 10,000mAh', category: 'Physical',
    description: 'Dual USB solar charging bank. Certified recycled plastic casing.',
    points: 1800, aud: 90, stock: 15, redemptions: 43,
    status: 'Pending Review', sustainability: 4,
    image_color: 'bg-orange-600',
  },
  {
    id: 'P-009', name: 'Zero-Waste Starter Box', category: 'Physical',
    description: 'Curated box: shampoo bar, bamboo toothbrush, compost bin liner, seed packet.',
    points: 1600, aud: 80, stock: 34, redemptions: 58,
    status: 'Paused', sustainability: 5,
    image_color: 'bg-eco-700',
  },
  {
    id: 'P-010', name: 'Forest Bathing Guided Walk', category: 'Experience',
    description: '2-hour guided shinrin-yoku session in Blue Mountains. Group of up to 8.',
    points: 2400, aud: 120, stock: 4, redemptions: 11,
    status: 'Active', sustainability: 5,
    image_color: 'bg-emerald-700',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_FEE_PCT = 5

const STATUS_META = {
  Active:         { label: 'Active',          color: 'bg-eco-100 text-eco-700',    dot: 'bg-eco-500 animate-pulse' },
  'Pending Review': { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
  Paused:         { label: 'Paused',          color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  'Out of Stock': { label: 'Out of Stock',    color: 'bg-red-100 text-red-600',     dot: 'bg-red-500' },
}

const CAT_COLOR = {
  Physical:   'bg-slate-100 text-slate-700',
  Digital:    'bg-violet-100 text-violet-700',
  Experience: 'bg-indigo-100 text-indigo-700',
}

function statusOf(p) {
  if (p.stock === 0 && p.category !== 'Digital') return 'Out of Stock'
  return p.status
}

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange && onChange(n)}>
          <Star
            className={`w-5 h-5 transition-colors ${
              n <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'
            } ${onChange ? 'hover:text-amber-300' : ''}`}
          />
        </button>
      ))}
    </div>
  )
}

// ── Product Form Modal ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '', description: '', category: 'Physical',
  points: '', aud: '', stock: '', sustainability: 3,
}

function ProductModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const set = (k, v) => setForm(f => ({
    ...f, [k]: v,
    ...(k === 'aud'    ? { points: v ? String(Math.round(parseFloat(v) / 0.05)) : '' } : {}),
    ...(k === 'points' ? { aud: v    ? String((parseInt(v) * 0.05).toFixed(2))   : '' } : {}),
  }))

  const isEdit = !!initial
  const valid = form.name.trim() && form.points && form.aud && (form.category === 'Digital' || form.stock !== '')
  const fee = form.aud ? (parseFloat(form.aud) * PLATFORM_FEE_PCT / 100).toFixed(2) : null
  const net = fee ? (parseFloat(form.aud) - parseFloat(fee)).toFixed(2) : null

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-4">
        {/* Header */}
        <div className="bg-slate-900 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">{isEdit ? 'Edit Product Listing' : 'Create Product Listing'}</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Image placeholder */}
          <div className="border-2 border-dashed border-slate-200 rounded-2xl h-32 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-eco-300 hover:text-eco-500 transition-colors cursor-pointer">
            <ImagePlus className="w-7 h-7" />
            <p className="text-xs font-semibold">Click to upload product images</p>
            <p className="text-[10px]">PNG, JPG up to 10MB each</p>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Product title *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Bamboo Kitchen Starter Kit"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="What does the customer get? Include sustainability impact."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400 resize-none" />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-2">Category *</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const icons = { Physical: Package, Digital: Zap, Experience: Gift }
                const Icon = icons[cat]
                return (
                  <button key={cat} type="button" onClick={() => set('category', cat)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      form.category === cat
                        ? 'bg-eco-50 border-eco-400 text-eco-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    <Icon className="w-4 h-4" />
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">AUD value *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                <input type="number" min="1" step="0.5" value={form.aud}
                  onChange={e => set('aud', e.target.value)}
                  placeholder="25.00"
                  className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Points required *</label>
              <input type="number" min="1" value={form.points}
                onChange={e => set('points', e.target.value)}
                placeholder="500"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
            </div>
          </div>

          {/* Fee preview */}
          {fee && (
            <div className="bg-slate-50 rounded-xl px-4 py-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-slate-400">Customer pays</p>
                <p className="font-bold text-slate-700 mt-0.5">{parseInt(form.points).toLocaleString()} pts</p>
              </div>
              <div>
                <p className="text-amber-500">Platform fee ({PLATFORM_FEE_PCT}%)</p>
                <p className="font-bold text-amber-600 mt-0.5">−${fee}</p>
              </div>
              <div>
                <p className="text-eco-600">You receive</p>
                <p className="font-bold text-eco-700 mt-0.5">${net}</p>
              </div>
            </div>
          )}

          {/* Stock + Sustainability */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Stock qty {form.category !== 'Digital' ? '*' : ''}
              </label>
              <input type="number" min="0" value={form.stock}
                onChange={e => set('stock', e.target.value)}
                placeholder={form.category === 'Digital' ? 'unlimited' : '100'}
                disabled={form.category === 'Digital'}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400 disabled:bg-slate-50 disabled:text-slate-400" />
              {form.category === 'Digital' && (
                <p className="text-[10px] text-slate-400 mt-1">Digital products have unlimited stock</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">Sustainability score *</label>
              <StarRating value={form.sustainability} onChange={v => set('sustainability', v)} />
              <p className="text-[10px] text-slate-400 mt-1">Rate 1–5 stars</p>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">All listings are reviewed by the EcoBin team before going live. Sustainability claims must be verifiable.</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200">
              Cancel
            </button>
            <button
              disabled={!valid}
              onClick={() => { onSave(form); onClose() }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                valid ? 'bg-eco-600 text-white hover:bg-eco-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}>
              {isEdit ? 'Save Changes' : 'Submit for Review'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Confirm delete dialog ────────────────────────────────────────────────────

function ConfirmDeleteModal({ product, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900">Delete listing?</p>
            <p className="text-xs text-slate-500 mt-0.5">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          You are about to permanently delete <strong>{product.name}</strong>.
          Past redemption records will be retained.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Products() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [viewMode, setViewMode] = useState('list')         // 'list' | 'grid'
  const [showCreate, setShowCreate] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [deleteProduct, setDeleteProduct] = useState(null)

  const activeListings = products.filter(p => p.status === 'Active').length
  const pendingReview  = products.filter(p => p.status === 'Pending Review').length
  const totalRedemptions = products.reduce((s, p) => s + p.redemptions, 0)
  const avgRating = (products.reduce((s, p) => s + p.sustainability, 0) / products.length).toFixed(1)

  const filters = ['All', ...CATEGORIES]
  const filtered = categoryFilter === 'All'
    ? products
    : products.filter(p => p.category === categoryFilter)

  function handleSaveNew(form) {
    setProducts(prev => [...prev, {
      ...form,
      id: `P-${String(prev.length + 1).padStart(3, '0')}`,
      points: parseInt(form.points),
      aud: parseFloat(form.aud),
      stock: form.category === 'Digital' ? 999 : parseInt(form.stock) || 0,
      redemptions: 0,
      status: 'Pending Review',
      image_color: 'bg-eco-600',
    }])
  }

  function handleSaveEdit(form) {
    setProducts(prev => prev.map(p =>
      p.id === editProduct.id
        ? { ...p, ...form, points: parseInt(form.points), aud: parseFloat(form.aud), stock: form.category === 'Digital' ? 999 : parseInt(form.stock) || 0 }
        : p
    ))
  }

  function handleDelete(id) {
    setProducts(prev => prev.filter(p => p.id !== id))
    setDeleteProduct(null)
  }

  function handleTogglePause(id) {
    setProducts(prev => prev.map(p => {
      if (p.id !== id) return p
      const next = p.status === 'Paused' ? 'Active' : 'Paused'
      return { ...p, status: next }
    }))
  }

  return (
    <div className="space-y-6">
      {showCreate && (
        <ProductModal onClose={() => setShowCreate(false)} onSave={handleSaveNew} />
      )}
      {editProduct && (
        <ProductModal
          initial={editProduct}
          onClose={() => setEditProduct(null)}
          onSave={handleSaveEdit}
        />
      )}
      {deleteProduct && (
        <ConfirmDeleteModal
          product={deleteProduct}
          onConfirm={() => handleDelete(deleteProduct.id)}
          onClose={() => setDeleteProduct(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Listings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your marketplace listings · {PLATFORM_FEE_PCT}% platform fee on all redemptions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-eco-600 text-white text-sm font-bold rounded-xl hover:bg-eco-700 transition-colors">
          <Plus className="w-4 h-4" /> Create Listing
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Listings',    value: activeListings,                    color: 'text-eco-700',    bg: 'bg-eco-50' },
          { label: 'Pending Review',     value: pendingReview,                     color: 'text-amber-700',  bg: 'bg-amber-50' },
          { label: 'Total Redemptions',  value: totalRedemptions.toLocaleString(), color: 'text-slate-800',  bg: 'bg-white' },
          { label: 'Avg Sustainability', value: `${avgRating} / 5`,               color: 'text-violet-700', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 border-b border-slate-100">
          {filters.map(f => (
            <button key={f} onClick={() => setCategoryFilter(f)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                categoryFilter === f ? 'border-eco-600 text-eco-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {f}
              <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                {f === 'All' ? products.length : products.filter(p => p.category === f).length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── List view ── */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Product</th>
                  <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Category</th>
                  <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Points</th>
                  <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">AUD Equiv.</th>
                  <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Stock</th>
                  <th className="text-right px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Redemptions</th>
                  <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Rating</th>
                  <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Status</th>
                  <th className="px-5 py-3 text-[10px] text-slate-400 font-semibold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => {
                  const status = statusOf(p)
                  const sm = STATUS_META[status]
                  const stockLow = p.stock > 0 && p.stock < 10 && p.category !== 'Digital'
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 ${p.image_color} rounded-xl flex-shrink-0`} />
                          <div>
                            <p className="font-semibold text-slate-800 leading-tight">{p.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]">{p.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLOR[p.category]}`}>
                          {p.category}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold text-slate-700">
                        {p.points.toLocaleString()}
                      </td>
                      <td className="px-3 py-3.5 text-right text-slate-500">${p.aud}</td>
                      <td className="px-3 py-3.5 text-right">
                        <span className={`font-semibold ${stockLow ? 'text-amber-600' : p.stock === 0 ? 'text-red-600' : 'text-slate-700'}`}>
                          {p.category === 'Digital' ? '∞' : p.stock.toLocaleString()}
                        </span>
                        {stockLow && <p className="text-[9px] text-amber-500">Low</p>}
                      </td>
                      <td className="px-3 py-3.5 text-right font-bold text-eco-700">{p.redemptions}</td>
                      <td className="px-3 py-3.5">
                        <StarRating value={p.sustainability} />
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.color}`}>{sm.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditProduct(p)}
                            title="Edit"
                            className="p-1.5 rounded-lg hover:bg-eco-50 text-slate-400 hover:text-eco-700 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleTogglePause(p.id)}
                            title={p.status === 'Paused' ? 'Resume' : 'Pause'}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteProduct(p)}
                            title="Delete"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Grid view ── */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const status = statusOf(p)
            const sm = STATUS_META[status]
            const stockLow = p.stock > 0 && p.stock < 10 && p.category !== 'Digital'
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Image area */}
                <div className={`${p.image_color} h-28 relative`}>
                  <div className="absolute top-3 left-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CAT_COLOR[p.category]}`}>
                      {p.category}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                    <span className="text-[10px] font-bold text-slate-700">{sm.label}</span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <p className="font-bold text-slate-900 leading-tight">{p.name}</p>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{p.description}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{p.points.toLocaleString()} pts</p>
                      <p className="text-[10px] text-slate-400">${p.aud} AUD</p>
                    </div>
                    <StarRating value={p.sustainability} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                      <p className="text-slate-400">Stock</p>
                      <p className={`font-bold ${stockLow ? 'text-amber-600' : p.stock === 0 ? 'text-red-600' : 'text-slate-700'}`}>
                        {p.category === 'Digital' ? '∞' : p.stock}
                        {stockLow && ' — Low'}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                      <p className="text-slate-400">Redemptions</p>
                      <p className="font-bold text-eco-700">{p.redemptions}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 pt-1 border-t border-slate-50">
                    <button onClick={() => setEditProduct(p)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-eco-700 hover:bg-eco-50 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleTogglePause(p.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                      <Pause className="w-3.5 h-3.5" /> {p.status === 'Paused' ? 'Resume' : 'Pause'}
                    </button>
                    <button onClick={() => setDeleteProduct(p)}
                      className="flex items-center justify-center p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
