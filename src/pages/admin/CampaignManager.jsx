import React, { useState, useEffect } from 'react'
import {
  Megaphone, CheckCircle, Clock, X, Play, Calendar,
  TrendingUp, BarChart2, AlertTriangle,
} from 'lucide-react'
import { CAMPAIGNS, ROLES_CONFIG } from '../../data/override'
import { queue, JOB_TYPES } from '../../lib/queue'
import { ledger } from '../../lib/ledger'
import { marketFeed, COMMODITIES } from '../../lib/marketFeed'

const STATUS_STYLE = {
  active:           { badge: 'bg-eco-100 text-eco-700',     card: 'border-eco-200' },
  approved:         { badge: 'bg-blue-100 text-blue-700',   card: 'border-blue-100' },
  pending_approval: { badge: 'bg-amber-100 text-amber-700', card: 'border-amber-200' },
  completed:        { badge: 'bg-slate-100 text-slate-500', card: 'border-slate-100' },
  rejected:         { badge: 'bg-red-100 text-red-700',     card: 'border-red-100' },
}

const TEMPLATE_OPTIONS = [
  {
    id: 'material_uplift',
    label: 'Material Uplift',
    icon: TrendingUp,
    color: 'bg-orange-100 text-orange-700',
    description: 'Boost offers on devices rich in a specific metal. e.g. "Copper Week" increases Cu-dominant device offers.',
    examples: ['Copper Week', 'Gold Rush', 'Palladium Push'],
  },
  {
    id: 'device_campaign',
    label: 'Device Campaign',
    icon: Megaphone,
    color: 'bg-violet-100 text-violet-700',
    description: 'Target specific device categories with time-limited offer uplift.',
    examples: ['PCB Recovery Drive', 'Smartphone Weekend', 'Laptop Month'],
  },
  {
    id: 'regional_incentive',
    label: 'Regional Incentive',
    icon: BarChart2,
    color: 'bg-eco-100 text-eco-700',
    description: 'Geo-targeted uplift for specific stations or regions to boost local collection volume.',
    examples: ['Sydney Inner West', 'Melbourne CBD Blitz', 'Brisbane North'],
  },
]

function CreateCampaignModal({ onClose, onSubmit }) {
  const [step, setStep] = useState(1)
  const [template, setTemplate] = useState(null)
  const [name, setName] = useState('')
  const [uplift, setUplift] = useState(10)
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('2026-06-14')
  const [endDate, setEndDate] = useState('2026-06-21')

  const canProceed = {
    1: !!template,
    2: name.length >= 3 && description.length >= 10,
    3: true,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-violet-600 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Create Campaign</h3>
            <p className="text-xs text-violet-200">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-violet-300 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1 ${s <= step ? 'bg-violet-500' : 'bg-slate-200'} ${s === 1 ? '' : 'ml-0.5'}`} />
          ))}
        </div>

        <div className="px-5 py-5">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 mb-3">Select campaign template</p>
              {TEMPLATE_OPTIONS.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.id} onClick={() => setTemplate(t.id)}
                    className={`w-full flex items-start gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                      template === t.id ? 'border-violet-500 bg-violet-50' : 'border-slate-100 hover:border-slate-200'
                    }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${t.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{t.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                      <p className="text-[11px] text-slate-400 mt-1">e.g. {t.examples.join(', ')}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Campaign Name <span className="text-red-500">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder='e.g. "Copper Week", "PCB Recovery Drive"'
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Offer Uplift %</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="1" max="40" value={uplift}
                    onChange={e => setUplift(Number(e.target.value))} className="flex-1 accent-violet-600" />
                  <div className="flex items-center border border-slate-200 rounded-lg px-3 py-1.5 w-16 text-center">
                    <span className="text-sm font-bold text-slate-900">{uplift}%</span>
                  </div>
                </div>
                {uplift > 25 && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> High uplift — margin impact requires Director approval
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Description / Business Justification <span className="text-red-500">*</span></label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder="Describe the strategic rationale for this campaign..."
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-700">Set campaign dates</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1.5 block">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>
              {/* Preview */}
              <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Campaign Summary</p>
                <p className="text-sm font-bold text-slate-900">{name || '—'}</p>
                <p className="text-xs text-slate-600">{description?.slice(0, 80) || '—'}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { label: 'Template', value: TEMPLATE_OPTIONS.find(t => t.id === template)?.label },
                    { label: 'Uplift', value: `+${uplift}%` },
                    { label: 'Duration', value: `${startDate} → ${endDate}` },
                  ].map(item => (
                    <span key={item.label} className="text-[11px] bg-white border border-violet-100 text-violet-700 font-semibold px-2 py-0.5 rounded-full">
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 bg-slate-50 rounded-xl px-3 py-2">
                Campaign will be submitted for approval. All details will be logged to the audit trail. Pricing won't change until approved.
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-5">
            {step > 1 && <button onClick={() => setStep(s => s - 1)} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm">Back</button>}
            {step < 3
              ? <button disabled={!canProceed[step]} onClick={() => setStep(s => s + 1)}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                  Continue
                </button>
              : <button onClick={() => { onSubmit?.({ name, template, uplift, description, startDate, endDate }); onClose() }}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  <Play className="w-3.5 h-3.5" /> Submit for Approval
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CampaignManager() {
  const [showCreate, setShowCreate] = useState(false)
  const [currentRole, setCurrentRole] = useState('commercial_director')
  const [queueStatus, setQueueStatus] = useState(null)
  const [float, setFloat] = useState(null)
  const [liveRates, setLiveRates] = useState({})

  useEffect(() => {
    marketFeed.start()
    const unsub = marketFeed.subscribe(null, r => setLiveRates(prev => ({ ...prev, [r.material]: r })))
    const id = setInterval(() => {
      setQueueStatus(queue.status())
      try { setFloat(ledger.balance('float_reserve')) } catch { /* not seeded yet */ }
    }, 3000)
    setQueueStatus(queue.status())
    try { setFloat(ledger.balance('float_reserve')) } catch { /* not seeded yet */ }
    return () => { unsub(); clearInterval(id); marketFeed.stop() }
  }, [])

  const handleSubmitCampaign = ({ name, template, uplift }) => {
    queue.enqueue(JOB_TYPES.WEBHOOK_DISPATCH, {
      entityId: `CAMP-${Date.now()}`,
      payload: { name, template, uplift, submittedBy: currentRole },
    })
    setQueueStatus(queue.status())
  }

  const roleConfig = ROLES_CONFIG[currentRole]
  const canCreate = roleConfig.can.includes('create_campaign')

  const active    = CAMPAIGNS.filter(c => c.status === 'active')
  const approved  = CAMPAIGNS.filter(c => c.status === 'approved')
  const pending   = CAMPAIGNS.filter(c => c.status === 'pending_approval')
  const completed = CAMPAIGNS.filter(c => c.status === 'completed')

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaign Manager</h1>
          <p className="text-sm text-slate-500 mt-0.5">Copper Week · Regional incentives · PCB drives · Custom campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={currentRole} onChange={e => setCurrentRole(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none bg-white">
            {Object.entries(ROLES_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {canCreate && (
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
              <Megaphone className="w-4 h-4" /> New Campaign
            </button>
          )}
        </div>
      </div>

      {/* Live platform status */}
      {(queueStatus != null || float != null || Object.keys(liveRates).length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {queueStatus != null && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="w-2 h-2 bg-eco-400 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-slate-700">Queue:</span>
              <span className="text-xs text-amber-600 font-bold">{queueStatus.pending} pending</span>
              <span className="text-xs text-violet-600 font-bold">{queueStatus.processing} processing</span>
            </div>
          )}
          {float != null && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-eco-50 border border-eco-100 rounded-xl">
              <span className="text-xs font-semibold text-slate-700">Float Reserve:</span>
              <span className="text-xs font-bold text-eco-700">${float.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {Object.keys(liveRates).length > 0 && (
            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-900 rounded-xl">
              <div className="w-2 h-2 bg-eco-400 rounded-full animate-pulse" />
              {Object.entries(liveRates).slice(0, 4).map(([k, r]) => {
                const mat = COMMODITIES[k]
                return mat ? (
                  <span key={k} className="text-[10px] text-slate-300 font-semibold">
                    {mat.label} <span className="text-eco-400">${r.spot?.toFixed(2)}</span>
                  </span>
                ) : null
              })}
            </div>
          )}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Active',           count: active.length,    color: 'text-eco-700',   bg: 'bg-eco-50' },
          { label: 'Approved / Sched', count: approved.length,  color: 'text-blue-700',  bg: 'bg-blue-50' },
          { label: 'Pending Approval', count: pending.length,   color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed',        count: completed.length, color: 'text-slate-500', bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {[
        { label: 'Active Now', items: active },
        { label: 'Approved — Scheduled', items: approved },
        { label: 'Pending Approval', items: pending },
        { label: 'Completed', items: completed },
      ].filter(g => g.items.length > 0).map(group => (
        <div key={group.label}>
          <h2 className="text-sm font-bold text-slate-700 mb-3">{group.label}</h2>
          <div className="space-y-4">
            {group.items.map(cam => {
              const ss = STATUS_STYLE[cam.status]
              return (
                <div key={cam.id} className={`bg-white rounded-2xl border shadow-sm ${ss.card}`}>
                  <div className="px-5 py-4 border-b border-slate-50 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        cam.status === 'active' ? 'bg-violet-600' : cam.status === 'approved' ? 'bg-blue-100' : cam.status === 'pending_approval' ? 'bg-amber-100' : 'bg-slate-100'
                      }`}>
                        <Megaphone className={`w-5 h-5 ${cam.status === 'active' ? 'text-white' : cam.status === 'approved' ? 'text-blue-600' : cam.status === 'pending_approval' ? 'text-amber-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{cam.name}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ss.badge}`}>{cam.status.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{cam.id}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{cam.description}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{cam.start_date} → {cam.end_date}</span>
                          <span>Created by {cam.created_by}</span>
                          {cam.approved_by && <span className="text-eco-600 font-semibold">Approved by {cam.approved_by}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-0.5">
                      <p className="text-xs text-slate-500">{cam.estimated_volume_uplift}</p>
                      <p className="text-xs text-amber-600">{cam.estimated_margin_impact}</p>
                      {cam.actual_volume_uplift && <p className="text-xs font-bold text-eco-700">Actual: {cam.actual_volume_uplift}</p>}
                    </div>
                  </div>
                  <div className="px-5 py-3 flex flex-wrap gap-2">
                    {cam.adjustments.map((adj, i) => (
                      <span key={i} className="text-[10px] font-semibold px-2 py-1 bg-slate-50 border border-slate-100 text-slate-700 rounded-lg">
                        {adj.device?.replace('_', ' ')} {adj.change_type === 'uplift_pct' ? `+${adj.value}%` : `${adj.note || adj.change_type}`}
                        {adj.new_offer && <span className="text-slate-400 ml-1">${adj.baseline} → ${adj.new_offer}</span>}
                      </span>
                    ))}
                  </div>
                  {cam.status === 'active' && Object.keys(liveRates).length > 0 && (
                    <div className="px-5 pb-3 flex items-center gap-3 border-t border-slate-50 pt-2">
                      <div className="w-2 h-2 bg-eco-400 rounded-full animate-pulse flex-shrink-0" />
                      <span className="text-[10px] text-slate-400 font-semibold">Live market:</span>
                      {Object.entries(liveRates).slice(0, 4).map(([k, r]) => {
                        const mat = COMMODITIES[k]
                        return mat ? (
                          <span key={k} className="text-[10px] text-slate-600 font-semibold">
                            {mat.label} <span className="text-eco-600 font-bold">${r.spot?.toFixed(2)}</span>
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleSubmitCampaign}
        />
      )}
    </div>
  )
}
