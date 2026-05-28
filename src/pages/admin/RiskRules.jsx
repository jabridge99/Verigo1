import React, { useState } from 'react'
import { RISK_RULES, SIGNAL_TYPES } from '../../data/fraudRisk'
import {
  SlidersHorizontal, Shield, ToggleLeft, ToggleRight,
  AlertTriangle, Edit2, CheckCircle, X,
} from 'lucide-react'

const CATEGORY_BADGE = {
  deposit:    'bg-indigo-100 text-indigo-700',
  operations: 'bg-amber-100 text-amber-700',
  account:    'bg-violet-100 text-violet-700',
  financial:  'bg-eco-100 text-eco-700',
}

const TABS = ['all', 'deposit', 'operations', 'account', 'financial']

function tpColor(rate) {
  if (rate >= 0.9) return 'text-eco-600 font-bold'
  if (rate >= 0.7) return 'text-amber-600 font-bold'
  return 'text-red-500 font-bold'
}

function RuleCard({ rule, onToggle, onEdit }) {
  return (
    <div className={`bg-white border border-slate-100 rounded-2xl p-5 shadow-sm${rule.enabled ? '' : ' opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-900">{rule.label}</span>
          {!rule.enabled && (
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Disabled</span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${CATEGORY_BADGE[rule.category]}`}>
            {rule.category}
          </span>
          <span className="text-[10px] font-mono text-slate-400">{rule.id}</span>
        </div>
        <button
          onClick={() => onToggle(rule.id)}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none ${rule.enabled ? 'bg-eco-500' : 'bg-slate-200'}`}
          aria-label={rule.enabled ? 'Disable rule' : 'Enable rule'}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${rule.enabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      <p className="text-sm text-slate-500 mt-1">{rule.description}</p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Threshold</p>
          <p className="font-bold text-slate-800 mt-0.5">{rule.threshold} <span className="font-normal text-slate-500 text-sm">{rule.threshold_unit}</span></p>
          <p className="text-[10px] text-slate-400 mt-0.5">Range: {rule.threshold_min}–{rule.threshold_max}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Signal Weight</p>
          <p className="font-bold text-slate-800 mt-0.5">{rule.weight} <span className="font-normal text-slate-500 text-sm">/ 100 pts</span></p>
          <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full">
            <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${rule.weight}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span>Triggered (30d): <span className="text-slate-700 font-medium">{rule.triggered_30d.toLocaleString()}</span></span>
          <span className="text-slate-300">·</span>
          <span>TP Rate: <span className={tpColor(rule.true_positive_rate)}>{Math.round(rule.true_positive_rate * 100)}%</span></span>
        </div>
        <button
          onClick={() => onEdit(rule)}
          className="px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          Edit Rule
        </button>
      </div>
    </div>
  )
}

function EditModal({ rule, threshold, weight, reason, onThreshold, onWeight, onReason, onSave, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-lg text-slate-900">Edit Rule — {rule.label}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${CATEGORY_BADGE[rule.category]}`}>
                {rule.category}
              </span>
              <span className="text-[10px] font-mono text-slate-400">{rule.id}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-5">{rule.description}</p>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-slate-700">Detection Threshold</p>
            <span className="text-sm font-bold text-slate-900">{threshold} <span className="font-normal text-slate-500">{rule.threshold_unit}</span></span>
          </div>
          <input
            type="range"
            min={rule.threshold_min}
            max={rule.threshold_max}
            value={threshold}
            onChange={e => onThreshold(Number(e.target.value))}
            className="w-full accent-slate-900"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
            <span>{rule.threshold_min}</span>
            <span>{rule.threshold_max}</span>
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-slate-700">Signal Weight <span className="font-normal text-slate-400">(contribution to risk score)</span></p>
            <span className="text-sm font-bold text-slate-900">{weight} pts</span>
          </div>
          <input
            type="range"
            min={rule.weight_min}
            max={rule.weight_max}
            value={weight}
            onChange={e => onWeight(Number(e.target.value))}
            className="w-full accent-violet-500"
          />
          <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full">
            <div
              className="bg-violet-500 h-1.5 rounded-full transition-all"
              style={{ width: `${((weight - rule.weight_min) / (rule.weight_max - rule.weight_min)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
            <span>{rule.weight_min}</span>
            <span>{rule.weight_max}</span>
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-slate-700">Reason for change <span className="text-red-400">*</span></p>
            <span className={`text-[10px] ${reason.length < 10 ? 'text-red-400' : 'text-slate-400'}`}>
              {reason.length} / 10 minimum
            </span>
          </div>
          <textarea
            rows={3}
            value={reason}
            onChange={e => onReason(e.target.value)}
            placeholder="Describe why this threshold is being adjusted..."
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={reason.length < 10}
            className="bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RiskRules() {
  const [rules, setRules] = useState(RISK_RULES)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editingRule, setEditingRule] = useState(null)
  const [editThreshold, setEditThreshold] = useState(0)
  const [editWeight, setEditWeight] = useState(0)
  const [editReason, setEditReason] = useState('')

  function toggleRule(id) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  function openEdit(rule) {
    setEditingRule(rule)
    setEditThreshold(rule.threshold)
    setEditWeight(rule.weight)
    setEditReason('')
  }

  function saveEdit() {
    setRules(prev => prev.map(r =>
      r.id === editingRule.id
        ? { ...r, threshold: editThreshold, weight: editWeight }
        : r
    ))
    setEditingRule(null)
  }

  const enabledCount = rules.filter(r => r.enabled).length
  const totalTriggered = rules.reduce((sum, r) => sum + r.triggered_30d, 0)
  const avgTP = Math.round(
    (rules.reduce((sum, r) => sum + r.true_positive_rate, 0) / rules.length) * 100
  )

  const filtered = categoryFilter === 'all' ? rules : rules.filter(r => r.category === categoryFilter)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-slate-700" />
          <h1 className="text-2xl font-bold text-slate-900">Risk Rules</h1>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Configure detection thresholds and signal weights — changes apply to all incoming transactions
        </p>
        <div className="inline-flex items-center gap-6 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <div className="text-sm">
            <span className="font-bold text-slate-900">{enabledCount} rules</span>
            <span className="text-slate-500"> active</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="text-sm">
            <span className="font-bold text-slate-900">{totalTriggered.toLocaleString()}</span>
            <span className="text-slate-500"> triggered (30d)</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="text-sm">
            <span className="text-slate-500">Avg TP rate: </span>
            <span className="font-bold text-slate-900">{avgTP}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setCategoryFilter(tab)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              categoryFilter === tab
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'all' ? 'All' : tab}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(rule => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onToggle={toggleRule}
            onEdit={openEdit}
          />
        ))}
      </div>

      {editingRule && (
        <EditModal
          rule={editingRule}
          threshold={editThreshold}
          weight={editWeight}
          reason={editReason}
          onThreshold={setEditThreshold}
          onWeight={setEditWeight}
          onReason={setEditReason}
          onSave={saveEdit}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  )
}
