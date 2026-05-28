import React, { useState } from 'react'
import { Plus, Megaphone, X, TrendingUp, Users, Star, RefreshCw, AlertTriangle } from 'lucide-react'
import { MERCHANTS, MERCHANT_CAMPAIGNS } from '../../data/marketplace'

const MERCHANT = MERCHANTS[0]

const TYPE_META = {
  points_multiplier: { label: 'Points Multiplier', icon: TrendingUp, color: 'text-eco-600',   bg: 'bg-eco-50',    desc: 'Boost earning rate on specific listings or categories' },
  bonus_offer:       { label: 'Bonus Offer',        icon: Star,       color: 'text-amber-600', bg: 'bg-amber-50',  desc: 'One-time bonus for completing a specific action' },
  exclusive_access:  { label: 'Exclusive Access',   icon: Users,      color: 'text-violet-600',bg: 'bg-violet-50', desc: 'Early or member-only access to listings or drops' },
  group_buy:         { label: 'Group Buy',           icon: Users,      color: 'text-indigo-600',bg: 'bg-indigo-50', desc: 'Unlock a deal when minimum participant threshold is met' },
  swap_drive:        { label: 'Swap Drive',          icon: RefreshCw,  color: 'text-eco-700',   bg: 'bg-eco-50',    desc: 'E-waste trade-in campaign with bonus points for swaps' },
}

const STATUS_META = {
  active:    { label: 'Active',     color: 'bg-eco-100 text-eco-700',      dot: 'bg-eco-500 animate-pulse' },
  scheduled: { label: 'Scheduled',  color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400' },
  ended:     { label: 'Ended',      color: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400' },
  paused:    { label: 'Paused',     color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
}

const STEPS = ['Campaign Type', 'Details', 'Schedule & Budget']

function CreateCampaignModal({ onClose }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    type: '', name: '', description: '', uplift_pct: 50,
    start_date: '', end_date: '', budget_pts: 10000,
    eligible_type: 'all', requires_director: false,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const highUplift = form.uplift_pct > 150

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="bg-slate-900 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">Create Campaign</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-5 pt-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-eco-500' : 'bg-slate-100'}`} />
          ))}
        </div>

        <div className="p-5 space-y-4">
          {step === 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 mb-3">Select campaign type</p>
              {Object.entries(TYPE_META).map(([key, meta]) => {
                const Icon = meta.icon
                return (
                  <button key={key} onClick={() => set('type', key)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      form.type === key ? `${meta.bg} border-eco-300` : 'border-slate-200 hover:border-slate-300'
                    }`}>
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
                    <div>
                      <p className={`text-sm font-bold ${meta.color}`}>{meta.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{meta.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Campaign name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. BYO Cup Double Points Week"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                  placeholder="What does the consumer get? How does it work?"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400 resize-none" />
              </div>
              {(form.type === 'points_multiplier') && (
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-600">Points uplift</label>
                    <span className={`text-xs font-bold ${highUplift ? 'text-amber-600' : 'text-eco-600'}`}>
                      {1 + form.uplift_pct / 100}× multiplier
                    </span>
                  </div>
                  <input type="range" min="10" max="300" step="10"
                    value={form.uplift_pct} onChange={e => set('uplift_pct', parseInt(e.target.value))}
                    className="w-full accent-eco-600" />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>+10% (1.1×)</span><span>+300% (4×)</span></div>
                  {highUplift && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700">Uplifts above 2.5× require EcoBin platform review before activation.</p>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Applies to</label>
                <select value={form.eligible_type} onChange={e => set('eligible_type', e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400">
                  <option value="all">All listings</option>
                  <option value="product">Products only</option>
                  <option value="voucher">Vouchers only</option>
                  <option value="experience">Experiences only</option>
                  <option value="swap">Swaps only</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Start date *</label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">End date *</label>
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">Points budget</label>
                  <span className="text-xs font-bold text-slate-700">{form.budget_pts.toLocaleString()} pts</span>
                </div>
                <input type="range" min="1000" max="200000" step="1000"
                  value={form.budget_pts} onChange={e => set('budget_pts', parseInt(e.target.value))}
                  className="w-full accent-eco-600" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>1,000</span><span>200,000 pts</span></div>
              </div>

              <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5 text-xs">
                <p className="font-bold text-slate-700 mb-2">Campaign Summary</p>
                <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-semibold text-slate-700">{TYPE_META[form.type]?.label || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-semibold text-slate-700 truncate ml-4">{form.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="font-semibold text-slate-700">{form.start_date && form.end_date ? `${form.start_date} → ${form.end_date}` : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Budget</span><span className="font-semibold text-slate-700">{form.budget_pts.toLocaleString()} pts</span></div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200">
                Back
              </button>
            )}
            {step === 0 && <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200">Cancel</button>}
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !form.type}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${step === 0 && !form.type ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-eco-600 text-white hover:bg-eco-700'}`}>
                Continue
              </button>
            ) : (
              <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-eco-600 text-white hover:bg-eco-700 transition-colors">
                Submit Campaign
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Campaigns() {
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)

  const myCampaigns = MERCHANT_CAMPAIGNS.filter(c => c.merchant_id === MERCHANT.id)
  const filtered = filter === 'all' ? myCampaigns : myCampaigns.filter(c => c.status === filter)

  return (
    <div className="space-y-6">
      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} />}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">Drive redemptions · reward loyalty · grow your green community</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-eco-600 text-white text-sm font-bold rounded-xl hover:bg-eco-700 transition-colors">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active',    value: myCampaigns.filter(c => c.status === 'active').length,    color: 'text-eco-700',    bg: 'bg-eco-50' },
          { label: 'Scheduled', value: myCampaigns.filter(c => c.status === 'scheduled').length, color: 'text-indigo-700', bg: 'bg-indigo-50' },
          { label: 'Total Redeemed', value: myCampaigns.reduce((s, c) => s + c.redeemed_count, 0), color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Points Awarded', value: myCampaigns.reduce((s, c) => s + c.points_awarded, 0).toLocaleString(), color: 'text-violet-700', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-slate-100">
        {['all', 'active', 'scheduled', 'ended'].map(tab => (
          <button key={tab} onClick={() => setFilter(tab)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px capitalize transition-colors ${
              filter === tab ? 'border-eco-600 text-eco-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>{tab === 'all' ? 'All Campaigns' : tab}</button>
        ))}
      </div>

      {/* Campaign cards */}
      <div className="space-y-4">
        {filtered.map(c => {
          const meta = TYPE_META[c.type]
          const statusMeta = STATUS_META[c.status]
          const budgetPct = c.budget_pts > 0 ? Math.min(100, (c.spent_pts / c.budget_pts) * 100) : 0
          const Icon = meta?.icon || Megaphone

          return (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 ${meta?.bg || 'bg-slate-50'} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${meta?.color || 'text-slate-600'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.id} · {c.start_date} → {c.end_date}</p>
                      <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusMeta.color}`}>{statusMeta.label}</span>
                    </div>
                  </div>
                  <div className="flex gap-6 mt-3 text-xs text-slate-500 flex-wrap">
                    <span><strong className="text-slate-700">{c.redeemed_count}</strong> redeemed</span>
                    <span><strong className="text-violet-700">{c.points_awarded.toLocaleString()}</strong> pts awarded</span>
                    {c.uplift_label && <span className={`font-bold ${meta?.color}`}>{c.uplift_label}</span>}
                  </div>
                  {c.budget_pts > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Budget</span>
                        <span>{c.spent_pts.toLocaleString()} / {c.budget_pts.toLocaleString()} pts ({budgetPct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${budgetPct > 80 ? 'bg-amber-500' : 'bg-eco-500'}`} style={{ width: `${budgetPct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
