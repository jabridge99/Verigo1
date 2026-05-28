import React, { useState } from 'react'
import { RISK_ENTITIES, FRAUD_CASES, PAYOUT_HOLDS, SIGNAL_TYPES, RISK_THRESHOLDS, riskLevel, ACTION_META } from '../../data/fraudRisk'
import { UserX, Search, Users, Building2, Store, AlertTriangle, Shield, DollarSign, Clock, ChevronRight } from 'lucide-react'

const GAUGE_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' }

function RiskGauge({ score }) {
  const level = riskLevel(score)
  const r = 38, cx = 50, cy = 55, circ = 2 * Math.PI * r
  const arcLen = circ * 0.75
  const filled = (score / 100) * arcLen
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="9"
        strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round"
        transform="rotate(135 50 55)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={GAUGE_COLORS[level]} strokeWidth="9"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        transform="rotate(135 50 55)" />
      <text x="50" y="52" textAnchor="middle" fill={GAUGE_COLORS[level]} style={{ fontSize: '20px', fontWeight: '800' }}>{score}</text>
      <text x="50" y="64" textAnchor="middle" fill="#94a3b8" style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{RISK_THRESHOLDS[level].label}</text>
    </svg>
  )
}

function RiskBadge({ score }) {
  const t = RISK_THRESHOLDS[riskLevel(score)]
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.bg} ${t.text}`}>{score}</span>
}

const TYPE_BADGE = {
  consumer: 'bg-eco-100 text-eco-700',
  operator: 'bg-amber-100 text-amber-700',
  merchant: 'bg-violet-100 text-violet-700',
}

const STATUS_BADGE = {
  active:    'bg-eco-100 text-eco-700',
  review:    'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-700',
}

const PRIORITY_BADGE = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-slate-100 text-slate-500',
}

const CASE_STATUS_BADGE = {
  open:      'bg-indigo-100 text-indigo-700',
  suspended: 'bg-red-100 text-red-700',
  resolved:  'bg-eco-100 text-eco-700',
}

function signalBarColor(val) {
  if (val === 0) return 'bg-slate-200'
  if (val <= 25) return 'bg-eco-400'
  if (val <= 50) return 'bg-amber-400'
  if (val <= 75) return 'bg-orange-400'
  return 'bg-red-500'
}

function formatDate(str) {
  return new Date(str).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function RiskScorecard() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('risk_score')
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')

  const filtered = RISK_ENTITIES
    .filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!e.name.toLowerCase().includes(q) && !e.ref.toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'risk_score') return b.risk_score - a.risk_score
      if (sortBy === 'held_aud') return b.held_payout_aud - a.held_payout_aud
      if (sortBy === 'flagged') return b.flagged_deposits - a.flagged_deposits
      return 0
    })

  const TYPE_TABS = [
    { key: 'all', label: 'All', Icon: Shield },
    { key: 'consumer', label: 'Consumer', Icon: Users },
    { key: 'operator', label: 'Operator', Icon: Building2 },
    { key: 'merchant', label: 'Merchant', Icon: Store },
  ]

  const selectedEntity = selectedId ? RISK_ENTITIES.find(e => e.id === selectedId) : null
  const entityCases = selectedEntity ? FRAUD_CASES.filter(c => c.entity_id === selectedId) : []
  const entityHolds = selectedEntity ? PAYOUT_HOLDS.filter(h => h.entity_ref === selectedEntity.ref) : []

  return (
    <div className="flex gap-6 h-full">

      {/* ── LEFT PANEL ── */}
      <div className="w-80 flex-shrink-0 border-r border-slate-100 pr-4 flex flex-col">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Risk Scorecard</h1>
          <p className="text-xs text-slate-400 mt-0.5">Entity risk profiles across consumers, operators and merchants</p>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or ref…"
            className="w-full text-sm rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {TYPE_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                typeFilter === key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative mb-4">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="w-full appearance-none text-xs font-semibold bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            <option value="risk_score">Sort by: Risk Score</option>
            <option value="held_aud">Sort by: Held AUD</option>
            <option value="flagged">Sort by: Flagged Deposits</option>
          </select>
          <ChevronRight className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
        </div>

        {/* Entity list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="text-center text-xs text-slate-400 py-10">No entities match filters</div>
          )}
          {filtered.map(entity => {
            const isSelected = entity.id === selectedId
            return (
              <div
                key={entity.id}
                onClick={() => setSelectedId(entity.id)}
                className={`cursor-pointer rounded-xl border p-3 mb-2 transition-colors ${
                  isSelected
                    ? 'bg-violet-50 border-violet-200'
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
              >
                {/* Line 1 */}
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800 truncate flex-1 min-w-0">{entity.name}</span>
                  <RiskBadge score={entity.risk_score} />
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${TYPE_BADGE[entity.type]}`}>
                    {entity.type}
                  </span>
                </div>
                {/* Line 2 */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-slate-400">{entity.ref}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${STATUS_BADGE[entity.status]}`}>
                    {entity.status}
                  </span>
                </div>
                {/* Line 3 */}
                <div className="flex items-center gap-2">
                  {entity.held_payout_aud > 0 ? (
                    <>
                      <span className="text-[11px] font-semibold text-amber-600">
                        ${entity.held_payout_aud.toLocaleString()} held
                      </span>
                      {entity.active_cases > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                          {entity.active_cases} case{entity.active_cases !== 1 ? 's' : ''}
                        </span>
                      )}
                    </>
                  ) : entity.active_cases === 0 ? (
                    <span className="text-[11px] text-slate-400">No active holds</span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                      {entity.active_cases} case{entity.active_cases !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 overflow-y-auto pl-4">
        {!selectedEntity ? (
          <div className="mt-16 text-center">
            <UserX className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Select an entity to view their risk profile</p>
          </div>
        ) : (
          <div className="space-y-4 pb-6">

            {/* ── Section 1: Profile Header ── */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                {/* Gauge */}
                <div className="flex-shrink-0">
                  <RiskGauge score={selectedEntity.risk_score} />
                </div>

                {/* Center meta */}
                <div className="flex-1 min-w-0 pl-4">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-xl font-bold text-slate-900 leading-tight">{selectedEntity.name}</h2>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${TYPE_BADGE[selectedEntity.type]}`}>
                      {selectedEntity.type}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[selectedEntity.status]}`}>
                      {selectedEntity.status}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-slate-400 mb-0.5">{selectedEntity.ref}</p>
                  <p className="text-sm text-slate-500 mb-1">{selectedEntity.location}</p>
                  <p className="text-xs text-slate-400">
                    Joined: {formatDate(selectedEntity.joined)}
                    &nbsp;·&nbsp;
                    Last active: {formatDate(selectedEntity.last_activity)}
                  </p>
                  {selectedEntity.held_payout_aud > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2 text-xs font-semibold text-amber-800">
                      ${selectedEntity.held_payout_aud.toLocaleString()} payout on hold
                    </div>
                  )}
                </div>

                {/* Right stats */}
                <div className="flex-shrink-0 text-right space-y-2">
                  {selectedEntity.type !== 'merchant' && (
                    <div>
                      <p className="text-base font-bold text-slate-900">{selectedEntity.total_deposits.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-400">Total Deposits</p>
                    </div>
                  )}
                  <div>
                    <p className="text-base font-bold text-slate-900">{selectedEntity.flagged_deposits.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400">Flagged Deposits</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">${selectedEntity.total_payout_aud.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400">Total Payout AUD</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 2: Signal Profile ── */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Signal Profile</h3>
              <div className="space-y-3">
                {Object.keys(SIGNAL_TYPES).map(key => {
                  const sig = SIGNAL_TYPES[key]
                  const val = selectedEntity.signals[key] ?? 0
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-700 w-32 flex-shrink-0 truncate">{sig.label}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        {val > 0 && (
                          <div
                            className={`h-full rounded-full ${signalBarColor(val)} transition-all duration-500`}
                            style={{ width: `${val}%` }}
                          />
                        )}
                      </div>
                      <span className="text-xs text-slate-500 text-right w-14 flex-shrink-0">{val}/100</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Section 3: Open Cases ── */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-bold text-slate-900">Open Cases</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {entityCases.length}
                </span>
              </div>
              {entityCases.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No active cases</p>
              ) : (
                <div className="space-y-3">
                  {entityCases.map(c => (
                    <div key={c.id} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs text-slate-500">{c.id}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${PRIORITY_BADGE[c.priority]}`}>
                            {c.priority}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${CASE_STATUS_BADGE[c.status] ?? 'bg-slate-100 text-slate-500'}`}>
                            {c.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {SIGNAL_TYPES[c.primary_signal]?.label ?? c.primary_signal}
                        </span>
                        <RiskBadge score={c.risk_score} />
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mb-1">{c.description}</p>
                      {c.amount_at_risk_aud > 0 && (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <DollarSign className="w-3 h-3" />
                          ${c.amount_at_risk_aud.toLocaleString()} at risk
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Section 4: Payout Holds ── */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-bold text-slate-900">Payout Holds</h3>
                {entityHolds.length > 0 && (
                  <span className="text-xs font-bold text-amber-600">
                    ${entityHolds.reduce((s, h) => s + h.amount_aud, 0).toLocaleString()} AUD
                  </span>
                )}
              </div>
              {entityHolds.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">No payout holds</p>
              ) : (
                <div className="space-y-3">
                  {entityHolds.map(hold => (
                    <div key={hold.id} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] text-slate-400 block mb-0.5">{hold.id}</span>
                          <span className="text-xs font-semibold text-slate-700">
                            {SIGNAL_TYPES[hold.reason]?.label ?? hold.reason}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 flex-shrink-0">
                          ${hold.amount_aud.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="w-3 h-3" />
                          Held since {formatDate(hold.held_since)}
                        </div>
                        <span className="font-mono text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
                          {hold.case_id}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Section 5: Activity Summary ── */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Activity Summary</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{selectedEntity.total_deposits.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400">Total Deposits</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{selectedEntity.flagged_deposits.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400">Flagged Deposits</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">${selectedEntity.total_payout_aud.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400">Total Payout AUD</p>
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold ${selectedEntity.held_payout_aud > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                    ${selectedEntity.held_payout_aud.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400">Held Payout AUD</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
