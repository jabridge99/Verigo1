import React, { useState } from 'react'
import {
  Plus, TrendingUp, Star, Users, Zap, Package, X,
  ChevronDown, ChevronUp, CalendarDays, Target, Layers,
  BarChart2, AlertTriangle,
} from 'lucide-react'

// ── Static campaign data ─────────────────────────────────────────────────────

const PRODUCTS_LIST = [
  'Bamboo Kitchen Starter Kit',
  'Reusable Produce Bag Set (12-pack)',
  'Carbon Offset Certificate — 1 Tonne',
  'Charged Earth Coffee Voucher $20',
  'Stainless Steel Water Bottle 750ml',
  'Urban Beekeeping Workshop',
  'Zero-Waste Starter Box',
  'Forest Bathing Guided Walk',
]

const TYPE_META = {
  'Bonus Points':      { label: 'Bonus Points',      icon: TrendingUp, color: 'text-eco-700',    bg: 'bg-eco-50',     border: 'border-eco-200' },
  'Flash Sale':        { label: 'Flash Sale',         icon: Zap,        color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  'Featured Listing':  { label: 'Featured Listing',  icon: Star,        color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
  'Bundle':            { label: 'Bundle',             icon: Package,     color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200' },
}

const STATUS_META = {
  Active:    { label: 'Active',    color: 'bg-eco-100 text-eco-700',      dot: 'bg-eco-500 animate-pulse' },
  Scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
  Ended:     { label: 'Ended',     color: 'bg-slate-100 text-slate-500',  dot: 'bg-slate-400' },
  Paused:    { label: 'Paused',    color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
}

const TIERS = ['All', 'Silver', 'Gold', 'Platinum']
const MULTIPLIERS = ['1.5x', '2x', '3x']

// daily bars for active campaigns (7 values = last 7 days)
const INITIAL_CAMPAIGNS = [
  {
    id: 'CMP-001',
    name: 'Double Points Weekend',
    type: 'Bonus Points',
    status: 'Active',
    start: '2026-05-23',
    end: '2026-06-01',
    target: 'Gold',
    multiplier: '2x',
    budget: 20000,
    spent: 14200,
    redemptions: 284,
    impressions: 4120,
    products: ['Bamboo Kitchen Starter Kit', 'Zero-Waste Starter Box'],
    daily: [28, 34, 41, 38, 52, 44, 47],
    tierBreakdown: { Bronze: 8, Silver: 62, Gold: 148, Platinum: 66 },
  },
  {
    id: 'CMP-002',
    name: 'Winter Flash Sale — Water Bottles',
    type: 'Flash Sale',
    status: 'Active',
    start: '2026-05-27',
    end: '2026-05-30',
    target: 'All',
    multiplier: '1.5x',
    budget: 8000,
    spent: 6800,
    redemptions: 136,
    impressions: 3280,
    products: ['Stainless Steel Water Bottle 750ml'],
    daily: [18, 24, 37, 57],
    tierBreakdown: { Bronze: 34, Silver: 51, Gold: 29, Platinum: 22 },
  },
  {
    id: 'CMP-003',
    name: 'Carbon Offset Awareness Month',
    type: 'Featured Listing',
    status: 'Active',
    start: '2026-05-01',
    end: '2026-05-31',
    target: 'All',
    multiplier: '1.5x',
    budget: 15000,
    spent: 13400,
    redemptions: 312,
    impressions: 7940,
    products: ['Carbon Offset Certificate — 1 Tonne'],
    daily: [40, 44, 52, 48, 56, 60, 12],
    tierBreakdown: { Bronze: 88, Silver: 104, Gold: 72, Platinum: 48 },
  },
  {
    id: 'CMP-004',
    name: 'Eco Kitchen Bundle',
    type: 'Bundle',
    status: 'Scheduled',
    start: '2026-06-05',
    end: '2026-06-20',
    target: 'Platinum',
    multiplier: '3x',
    budget: 25000,
    spent: 0,
    redemptions: 0,
    impressions: 0,
    products: ['Bamboo Kitchen Starter Kit', 'Reusable Produce Bag Set (12-pack)', 'Stainless Steel Water Bottle 750ml'],
    daily: [],
    tierBreakdown: { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 },
  },
  {
    id: 'CMP-005',
    name: 'Experiences Triple Points',
    type: 'Bonus Points',
    status: 'Paused',
    start: '2026-04-15',
    end: '2026-05-15',
    target: 'Silver',
    multiplier: '3x',
    budget: 30000,
    spent: 19600,
    redemptions: 88,
    impressions: 2140,
    products: ['Urban Beekeeping Workshop', 'Forest Bathing Guided Walk'],
    daily: [14, 16, 12, 18, 11, 9, 8],
    tierBreakdown: { Bronze: 0, Silver: 54, Gold: 22, Platinum: 12 },
  },
  {
    id: 'CMP-006',
    name: 'New Member Welcome Offer',
    type: 'Featured Listing',
    status: 'Ended',
    start: '2026-04-01',
    end: '2026-04-30',
    target: 'All',
    multiplier: '1.5x',
    budget: 10000,
    spent: 10000,
    redemptions: 204,
    impressions: 6200,
    products: ['Charged Earth Coffee Voucher $20'],
    daily: [24, 28, 32, 36, 40, 28, 16],
    tierBreakdown: { Bronze: 82, Silver: 74, Gold: 30, Platinum: 18 },
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function MiniBarChart({ daily, color = 'bg-eco-500' }) {
  if (!daily || daily.length === 0) {
    return <p className="text-[10px] text-slate-300 italic">No data yet</p>
  }
  const max = Math.max(...daily, 1)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {daily.map((v, i) => (
        <div
          key={i}
          className={`flex-1 ${color} rounded-sm opacity-80`}
          style={{ height: `${Math.max(10, (v / max) * 32)}px` }}
        />
      ))}
    </div>
  )
}

function TierBar({ breakdown }) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0) || 1
  const config = {
    Bronze:   { color: 'bg-amber-600', text: 'text-amber-700' },
    Silver:   { color: 'bg-slate-400', text: 'text-slate-600' },
    Gold:     { color: 'bg-yellow-500', text: 'text-yellow-700' },
    Platinum: { color: 'bg-violet-500', text: 'text-violet-700' },
  }
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Tier Breakdown</p>
      {Object.entries(breakdown).map(([tier, count]) => {
        const pct = Math.round((count / total) * 100)
        return (
          <div key={tier}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className={`font-semibold ${config[tier].text}`}>{tier}</span>
              <span className="text-slate-400">{count} ({pct}%)</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${config[tier].color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Create Campaign Modal ────────────────────────────────────────────────────

const MODAL_STEPS = ['Campaign Type', 'Details', 'Schedule & Budget']

const EMPTY_FORM = {
  type: '', name: '', target: 'All', multiplier: '2x',
  start: '', end: '', budget: 10000, products: [],
}

function CreateCampaignModal({ onClose, onCreate }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function toggleProduct(name) {
    setForm(f => ({
      ...f,
      products: f.products.includes(name)
        ? f.products.filter(p => p !== name)
        : [...f.products, name],
    }))
  }

  const canNext0 = !!form.type
  const canNext1 = form.name.trim().length > 0
  const canSubmit = form.start && form.end && form.products.length > 0

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-4">
        {/* Header */}
        <div className="bg-slate-900 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">Create Campaign</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Step {step + 1} of {MODAL_STEPS.length} — {MODAL_STEPS[step]}
            </p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400 hover:text-white" /></button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-5 pt-4">
          {MODAL_STEPS.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? 'bg-eco-500' : 'bg-slate-100'}`} />
          ))}
        </div>

        <div className="p-5 space-y-5">
          {/* Step 0 — Type */}
          {step === 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Select campaign type</p>
              {Object.entries(TYPE_META).map(([key, meta]) => {
                const Icon = meta.icon
                const descs = {
                  'Bonus Points': 'Award extra points to users who redeem during the campaign window.',
                  'Flash Sale': 'Limited-time discount on points required — drives urgency.',
                  'Featured Listing': 'Promote your listing at the top of the marketplace feed.',
                  'Bundle': 'Group multiple products and offer a combined points deal.',
                }
                return (
                  <button key={key} onClick={() => set('type', key)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      form.type === key
                        ? `${meta.bg} ${meta.border}`
                        : 'border-slate-200 hover:border-slate-300'
                    }`}>
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
                    <div>
                      <p className={`text-sm font-bold ${meta.color}`}>{meta.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{descs[key]}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Step 1 — Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Campaign name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Double Points Weekend"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Target tier</label>
                  <div className="flex flex-col gap-1">
                    {TIERS.map(t => (
                      <button key={t} onClick={() => set('target', t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-left border transition-colors ${
                          form.target === t
                            ? 'bg-eco-50 border-eco-400 text-eco-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}>{t === 'All' ? 'All Members' : `${t} & above`}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Boost multiplier</label>
                  <div className="flex flex-col gap-1">
                    {MULTIPLIERS.map(m => (
                      <button key={m} onClick={() => set('multiplier', m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-left border transition-colors ${
                          form.multiplier === m
                            ? 'bg-eco-50 border-eco-400 text-eco-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}>{m} points multiplier</button>
                    ))}
                  </div>
                  {form.multiplier === '3x' && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-700">3x campaigns require EcoBin review before activation.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Schedule & Budget */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Start date *</label>
                  <input type="date" value={form.start} onChange={e => set('start', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">End date *</label>
                  <input type="date" value={form.end} onChange={e => set('end', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">Points budget *</label>
                  <span className="text-xs font-bold text-eco-700">{form.budget.toLocaleString()} pts</span>
                </div>
                <input type="range" min="1000" max="50000" step="1000" value={form.budget}
                  onChange={e => set('budget', parseInt(e.target.value))}
                  className="w-full accent-eco-600" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>1,000 pts</span><span>50,000 pts</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Link products *</label>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {PRODUCTS_LIST.map(name => (
                    <label key={name}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                        form.products.includes(name)
                          ? 'bg-eco-50 border-eco-300'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <input type="checkbox" checked={form.products.includes(name)}
                        onChange={() => toggleProduct(name)} className="accent-eco-600" />
                      <span className={`text-xs font-semibold ${form.products.includes(name) ? 'text-eco-700' : 'text-slate-600'}`}>
                        {name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5 text-xs">
                <p className="font-bold text-slate-700 mb-2">Campaign Summary</p>
                <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-semibold text-slate-700">{form.type}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-semibold text-slate-700 truncate ml-4">{form.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Target</span><span className="font-semibold text-slate-700">{form.target === 'All' ? 'All Members' : `${form.target} & above`}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Multiplier</span><span className="font-bold text-eco-700">{form.multiplier}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="font-semibold text-slate-700">{form.start && form.end ? `${form.start} → ${form.end}` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Budget</span><span className="font-semibold text-slate-700">{form.budget.toLocaleString()} pts</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Products</span><span className="font-semibold text-slate-700">{form.products.length} linked</span></div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-1">
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200">
                Back
              </button>
            ) : (
              <button onClick={onClose}
                className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200">
                Cancel
              </button>
            )}
            {step < MODAL_STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={(step === 0 && !canNext0) || (step === 1 && !canNext1)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                  (step === 0 && !canNext0) || (step === 1 && !canNext1)
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-eco-600 text-white hover:bg-eco-700'
                }`}>
                Continue
              </button>
            ) : (
              <button
                disabled={!canSubmit}
                onClick={() => {
                  onCreate(form)
                  onClose()
                }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                  canSubmit ? 'bg-eco-600 text-white hover:bg-eco-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}>
                Launch Campaign
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign }) {
  const [expanded, setExpanded] = useState(false)
  const meta = TYPE_META[campaign.type] || {}
  const sm = STATUS_META[campaign.status] || STATUS_META.Ended
  const Icon = meta.icon || Layers
  const budgetPct = campaign.budget > 0 ? Math.min(100, (campaign.spent / campaign.budget) * 100) : 0
  const ctr = campaign.impressions > 0 ? ((campaign.redemptions / campaign.impressions) * 100).toFixed(1) : '—'

  const chartColor = {
    Active: 'bg-eco-500',
    Scheduled: 'bg-blue-400',
    Ended: 'bg-slate-400',
    Paused: 'bg-amber-400',
  }[campaign.status] || 'bg-eco-500'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 ${meta.bg || 'bg-slate-50'} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${meta.color || 'text-slate-600'}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-slate-900">{campaign.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg || ''} ${meta.color || ''}`}>
                    {campaign.type}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {campaign.start} → {campaign.end}
                  </span>
                  {campaign.target !== 'All' && (
                    <span className="text-[10px] text-violet-600 font-semibold flex items-center gap-1">
                      <Target className="w-3 h-3" />{campaign.target}+
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${sm.dot}`} />
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sm.color}`}>{sm.label}</span>
              </div>
            </div>

            {/* Products included */}
            {campaign.products.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {campaign.products.slice(0, 2).map(p => (
                  <span key={p} className="text-[10px] bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full truncate max-w-[150px]">{p}</span>
                ))}
                {campaign.products.length > 2 && (
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-medium px-2 py-0.5 rounded-full">
                    +{campaign.products.length - 2} more
                  </span>
                )}
              </div>
            )}

            {/* Stats row */}
            <div className="flex gap-5 mt-3 text-xs text-slate-500 flex-wrap">
              <span><strong className="text-slate-700">{campaign.redemptions.toLocaleString()}</strong> redemptions</span>
              <span><strong className="text-slate-700">{campaign.impressions.toLocaleString()}</strong> impressions</span>
              <span>CTR: <strong className="text-eco-700">{ctr}{ctr !== '—' ? '%' : ''}</strong></span>
              <span className="font-bold text-eco-600">{campaign.multiplier}</span>
            </div>

            {/* Budget bar */}
            {campaign.budget > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Budget used</span>
                  <span>{campaign.spent.toLocaleString()} / {campaign.budget.toLocaleString()} pts ({budgetPct.toFixed(0)}%)</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${budgetPct > 85 ? 'bg-amber-500' : 'bg-eco-500'}`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Mini performance graph */}
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="flex-1">
                <p className="text-[10px] text-slate-400 mb-1">Daily redemptions</p>
                <MiniBarChart daily={campaign.daily} color={chartColor} />
              </div>
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-xs font-semibold text-eco-600 hover:text-eco-700 whitespace-nowrap">
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? 'Less' : 'Details'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-50 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Daily chart (full width) */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-3">Daily Redemption Trend</p>
            {campaign.daily.length > 0 ? (
              <div className="flex items-end gap-1 h-20">
                {campaign.daily.map((v, i) => {
                  const max = Math.max(...campaign.daily, 1)
                  const h = Math.max(6, (v / max) * 80)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <p className="text-[8px] text-slate-400">{v}</p>
                      <div className={`w-full ${chartColor} rounded-t-sm`} style={{ height: `${h}px` }} />
                      <p className="text-[8px] text-slate-300">D{i + 1}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-20 flex items-center justify-center bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-300">Campaign not started yet</p>
              </div>
            )}
          </div>

          {/* Tier breakdown */}
          <TierBar breakdown={campaign.tierBreakdown} />

          {/* Top products */}
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-slate-700 mb-2">Products in Campaign</p>
            <div className="space-y-1">
              {campaign.products.map((name, i) => (
                <div key={name} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                  <span className="font-medium text-slate-700">{name}</span>
                  <span className="text-eco-600 font-bold text-[10px]">
                    {i === 0 ? 'Top performer' : 'Linked'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState(INITIAL_CAMPAIGNS)
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)

  const active     = campaigns.filter(c => c.status === 'Active').length
  const redemptionsMTD = campaigns
    .filter(c => c.status === 'Active' || c.status === 'Paused')
    .reduce((s, c) => s + c.redemptions, 0)
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0)
  const totalRedemptions = campaigns.reduce((s, c) => s + c.redemptions, 0)
  const avgCTR = totalImpressions > 0
    ? ((totalRedemptions / totalImpressions) * 100).toFixed(1)
    : '0.0'

  const filterTabs = ['all', 'Active', 'Scheduled', 'Paused', 'Ended']
  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter)

  function handleCreate(form) {
    setCampaigns(prev => [{
      id: `CMP-${String(prev.length + 1).padStart(3, '0')}`,
      name: form.name,
      type: form.type,
      status: 'Scheduled',
      start: form.start,
      end: form.end,
      target: form.target,
      multiplier: form.multiplier,
      budget: form.budget,
      spent: 0,
      redemptions: 0,
      impressions: 0,
      products: form.products,
      daily: [],
      tierBreakdown: { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 },
    }, ...prev])
  }

  return (
    <div className="space-y-6">
      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">Drive redemptions · reward loyalty · grow your green community</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-eco-600 text-white text-sm font-bold rounded-xl hover:bg-eco-700 transition-colors">
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Campaigns',    value: active,                              color: 'text-eco-700',    bg: 'bg-eco-50' },
          { label: 'Redemptions MTD',     value: redemptionsMTD.toLocaleString(),     color: 'text-slate-800',  bg: 'bg-white' },
          { label: 'Total Impressions',   value: totalImpressions.toLocaleString(),   color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Avg CTR',             value: `${avgCTR}%`,                        color: 'text-blue-700',   bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-slate-100 overflow-x-auto">
        {filterTabs.map(tab => (
          <button key={tab} onClick={() => setFilter(tab)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px capitalize transition-colors whitespace-nowrap ${
              filter === tab
                ? 'border-eco-600 text-eco-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab === 'all' ? 'All Campaigns' : tab}
            <span className="ml-1.5 text-[10px] font-bold text-slate-400">
              {tab === 'all' ? campaigns.length : campaigns.filter(c => c.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Campaign cards */}
      <div className="space-y-4">
        {filtered.map(c => (
          <CampaignCard key={c.id} campaign={c} />
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
            <BarChart2 className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-400">No campaigns in this status</p>
            <p className="text-xs text-slate-300 mt-1">Create a new campaign to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}
