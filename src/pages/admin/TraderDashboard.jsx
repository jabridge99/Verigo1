import React, { useState, useEffect, useRef } from 'react'
import {
  TrendingUp, TrendingDown, AlertTriangle, Zap, RefreshCw,
  Shield, DollarSign, Activity, CheckCircle, XCircle, Clock,
  ChevronDown,
} from 'lucide-react'
import { marketFeed, COMMODITIES } from '../../lib/marketFeed'
import { overrideQueue } from '../../lib/overrideQueue'
import { pricingEngine } from '../../lib/pricingEngine'

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtSpot = (n) => n == null ? '—' : `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const fmtRate = (n) => n == null ? '—' : `$${Number(n).toFixed(4)}`
const fmtPct  = (n) => n == null ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`

function StatusBadge({ status }) {
  if (status === 'pending')  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock className="w-2.5 h-2.5" />Pending</span>
  if (status === 'approved') return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle className="w-2.5 h-2.5" />Approved</span>
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle className="w-2.5 h-2.5" />Rejected</span>
  return <span className="text-[10px] text-slate-400">{status}</span>
}

// ── Live Market Prices Panel ──────────────────────────────────────────────────

function MarketPricesPanel() {
  const [prices, setPrices] = useState({})

  useEffect(() => {
    const unsub = marketFeed.subscribe(null, record => {
      setPrices(prev => ({ ...prev, [record.material]: record }))
    })
    return unsub
  }, [])

  const materials = Object.keys(COMMODITIES)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 bg-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-white text-sm">Live Market Prices</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-slate-400 font-semibold">Auto-refreshes every 8s with market tick</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-50">
        {materials.slice(0, 4).map(mat => {
          const p = prices[mat]
          const chgPct = p?.change_pct ?? 0
          return (
            <div key={mat} className="px-4 py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{COMMODITIES[mat]?.label ?? mat}</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{p ? fmtSpot(p.spot) : '—'}<span className="text-xs font-normal text-slate-400">/t</span></p>
                </div>
                {chgPct >= 0
                  ? <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                }
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-slate-500">Consumer: <span className="font-mono font-semibold text-slate-700">{p ? fmtRate(p.consumer_rate) : '—'}/kg</span></span>
                <span className={`font-bold ${chgPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtPct(chgPct)} 24h</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-50 border-t border-slate-50">
        {materials.slice(4).map(mat => {
          const p = prices[mat]
          const chgPct = p?.change_pct ?? 0
          return (
            <div key={mat} className="px-4 py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{COMMODITIES[mat]?.label ?? mat}</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{p ? fmtSpot(p.spot) : '—'}<span className="text-xs font-normal text-slate-400">/t</span></p>
                </div>
                {chgPct >= 0
                  ? <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                }
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-slate-500">Consumer: <span className="font-mono font-semibold text-slate-700">{p ? fmtRate(p.consumer_rate) : '—'}/kg</span></span>
                <span className={`font-bold ${chgPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtPct(chgPct)} 24h</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Override Request Form ─────────────────────────────────────────────────────

function OverrideRequestForm({ onSubmitted }) {
  const [material, setMaterial]   = useState('')
  const [rate, setRate]           = useState('')
  const [rationale, setRationale] = useState('')
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [currentRate, setCurrentRate] = useState(null)

  const materials = Object.keys(COMMODITIES)

  useEffect(() => {
    if (!material) { setCurrentRate(null); return }
    const p = marketFeed.getPrice(material)
    setCurrentRate(p?.consumer_rate ?? null)
  }, [material])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const rateNum = parseFloat(rate)
    if (!material) { setError('Please select a material.'); return }
    if (!rate || isNaN(rateNum) || rateNum <= 0) { setError('Proposed rate must be a positive number.'); return }
    if (currentRate != null && Math.abs(rateNum - currentRate) < 0.0001) {
      setError('Proposed rate must differ from the current consumer rate.')
      return
    }
    if (!rationale.trim()) { setError('Please provide a rationale.'); return }
    const id = overrideQueue.submit(material, rateNum, rationale.trim(), 'trader')
    setSuccess(`Override request ${id} submitted and awaiting approval.`)
    setMaterial('')
    setRate('')
    setRationale('')
    setCurrentRate(null)
    if (onSubmitted) onSubmitted()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
        <Zap className="w-4 h-4 text-violet-600" />
        <h2 className="font-bold text-slate-900 text-sm">Submit Override Request</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {success}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Material</label>
            <div className="relative">
              <select
                value={material}
                onChange={e => { setMaterial(e.target.value); setSuccess(''); setError('') }}
                className="w-full appearance-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 pr-8"
              >
                <option value="">Select material…</option>
                {materials.map(m => {
                  const p = marketFeed.getPrice(m)
                  return (
                    <option key={m} value={m}>
                      {COMMODITIES[m].label} {p ? `(current: $${p.consumer_rate.toFixed(4)}/kg)` : ''}
                    </option>
                  )
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {currentRate != null && (
              <p className="text-[11px] text-slate-400 mt-1">
                Current rate: <span className="font-mono font-semibold text-violet-600">${currentRate.toFixed(4)}/kg</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Proposed Rate ($/kg)</label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              value={rate}
              onChange={e => { setRate(e.target.value); setSuccess(''); setError('') }}
              placeholder="e.g. 1.8500"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Rationale</label>
          <textarea
            value={rationale}
            onChange={e => { setRationale(e.target.value); setSuccess(''); setError('') }}
            placeholder="Explain why this override is needed (e.g. market dislocation, hedging need, client negotiation)…"
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 resize-none"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">Override requests require admin approval before taking effect.</p>
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
          >
            <Zap className="w-3.5 h-3.5" />
            Submit Request
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Pending Approvals Table ───────────────────────────────────────────────────

function PendingApprovalsTable({ queue, onAction }) {
  const [rejectReasons, setRejectReasons] = useState({})
  const [showReject, setShowReject] = useState({})

  const handleApprove = (id) => {
    try {
      overrideQueue.approve(id, 'admin')
      if (onAction) onAction()
    } catch (e) {
      console.error(e)
    }
  }

  const handleReject = (id) => {
    try {
      overrideQueue.reject(id, 'admin', rejectReasons[id] || '')
      setShowReject(prev => ({ ...prev, [id]: false }))
      setRejectReasons(prev => { const n = { ...prev }; delete n[id]; return n })
      if (onAction) onAction()
    } catch (e) {
      console.error(e)
    }
  }

  if (queue.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <h2 className="font-bold text-slate-900 text-sm">Pending Approvals</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full ml-auto">0</span>
        </div>
        <div className="px-5 py-10 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-semibold">No pending requests</p>
          <p className="text-xs text-slate-300 mt-1">All override requests have been resolved</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2 bg-amber-50">
        <Clock className="w-4 h-4 text-amber-600" />
        <h2 className="font-bold text-amber-900 text-sm">Pending Approvals</h2>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full ml-auto">{queue.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50">
              <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">ID</th>
              <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Material</th>
              <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Current</th>
              <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Proposed</th>
              <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden lg:table-cell">Rationale</th>
              <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden md:table-cell">Trader</th>
              <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {queue.map(req => {
              const diff = req.proposedRate - req.currentRate
              const diffPct = req.currentRate > 0 ? (diff / req.currentRate) * 100 : 0
              return (
                <React.Fragment key={req.id}>
                  <tr className="hover:bg-amber-50/30">
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] font-mono font-bold text-violet-700">{req.id}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="text-xs font-semibold text-slate-800">{COMMODITIES[req.material]?.label ?? req.material}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{req.material}</p>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono text-xs text-slate-600">
                      {fmtRate(req.currentRate)}/kg
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <p className={`font-mono text-xs font-bold ${diff >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                        {fmtRate(req.proposedRate)}/kg
                      </p>
                      <p className={`text-[10px] ${diff >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                        {diff >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
                      </p>
                    </td>
                    <td className="px-3 py-3.5 hidden lg:table-cell">
                      <p className="text-xs text-slate-600 max-w-xs truncate" title={req.rationale}>{req.rationale || '—'}</p>
                    </td>
                    <td className="px-3 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-slate-600">{req.trader}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg transition-colors border border-emerald-200"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          onClick={() => setShowReject(prev => ({ ...prev, [req.id]: !prev[req.id] }))}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-lg transition-colors border border-red-200"
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                  {showReject[req.id] && (
                    <tr className="bg-red-50/50">
                      <td colSpan={7} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            placeholder="Rejection reason (optional)…"
                            value={rejectReasons[req.id] || ''}
                            onChange={e => setRejectReasons(prev => ({ ...prev, [req.id]: e.target.value }))}
                            className="flex-1 border border-red-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                          />
                          <button
                            onClick={() => handleReject(req.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            Confirm Reject
                          </button>
                          <button
                            onClick={() => setShowReject(prev => ({ ...prev, [req.id]: false }))}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Override History Table ────────────────────────────────────────────────────

function OverrideHistoryTable({ history }) {
  if (history.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" />
          <h2 className="font-bold text-slate-900 text-sm">Override History</h2>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-slate-400">No resolved requests yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-600" />
          <h2 className="font-bold text-slate-900 text-sm">Override History</h2>
          <span className="text-[10px] text-slate-400 font-semibold">Last {history.length} resolved</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50">
              <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">ID</th>
              <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Material</th>
              <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Current</th>
              <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Proposed</th>
              <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden md:table-cell">Trader</th>
              <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden lg:table-cell">Approver</th>
              <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden lg:table-cell">Reason</th>
              <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {history.map(req => (
              <tr key={req.id} className={req.status === 'approved' ? 'bg-emerald-50/20' : 'bg-red-50/20'}>
                <td className="px-5 py-3">
                  <span className="text-[11px] font-mono font-bold text-violet-700">{req.id}</span>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                    {req.resolvedAt ? new Date(req.resolvedAt).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p className="text-xs font-semibold text-slate-800">{COMMODITIES[req.material]?.label ?? req.material}</p>
                </td>
                <td className="px-3 py-3 text-right font-mono text-xs text-slate-500">
                  {fmtRate(req.currentRate)}/kg
                </td>
                <td className="px-3 py-3 text-right font-mono text-xs font-bold text-slate-800">
                  {fmtRate(req.proposedRate)}/kg
                </td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <span className="text-xs text-slate-600">{req.trader}</span>
                </td>
                <td className="px-3 py-3 hidden lg:table-cell">
                  <span className="text-xs text-slate-600">{req.approver ?? '—'}</span>
                </td>
                <td className="px-3 py-3 hidden lg:table-cell">
                  <span className="text-xs text-slate-500 truncate max-w-xs block" title={req.rejectReason}>
                    {req.rejectReason || '—'}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  <StatusBadge status={req.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TraderDashboard() {
  const [allQueue, setAllQueue] = useState([])
  const [isLive, setIsLive]     = useState(true)

  const refreshQueue = () => {
    setAllQueue(overrideQueue.getQueue())
  }

  useEffect(() => {
    refreshQueue()
    // Poll every 2s (overrideQueue doesn't emit React state changes)
    const id = setInterval(refreshQueue, 2000)
    return () => clearInterval(id)
  }, [])

  // Track market feed liveness
  useEffect(() => {
    const unsub = marketFeed.subscribe(null, () => setIsLive(true))
    return unsub
  }, [])

  const pending  = allQueue.filter(r => r.status === 'pending')
  const resolved = allQueue.filter(r => r.status !== 'pending').slice(-20).reverse()

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 bg-violet-600 rounded flex items-center justify-center">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Commodity Desk</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Trader Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live market prices · Override requests · Approval queue</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
            isLive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {isLive ? 'Market Live' : 'Connecting…'}
          </div>
          {pending.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-amber-50 border-amber-200 text-xs font-semibold text-amber-700">
              <Clock className="w-3.5 h-3.5" />
              {pending.length} pending
            </div>
          )}
        </div>
      </div>

      {/* ── Live Market Prices ── */}
      <MarketPricesPanel />

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Overrides',
            value: pricingEngine.overrideCount,
            icon: Shield,
            color: pricingEngine.overrideCount > 0 ? 'text-violet-700' : 'text-slate-500',
            bg: pricingEngine.overrideCount > 0 ? 'bg-violet-50' : 'bg-slate-50',
          },
          {
            label: 'Pending Requests',
            value: pending.length,
            icon: Clock,
            color: pending.length > 0 ? 'text-amber-700' : 'text-slate-500',
            bg: pending.length > 0 ? 'bg-amber-50' : 'bg-slate-50',
          },
          {
            label: 'Approved (All Time)',
            value: allQueue.filter(r => r.status === 'approved').length,
            icon: CheckCircle,
            color: 'text-emerald-700',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Rejected (All Time)',
            value: allQueue.filter(r => r.status === 'rejected').length,
            icon: XCircle,
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <div className="flex items-center justify-between">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Override Request Form ── */}
      <OverrideRequestForm onSubmitted={refreshQueue} />

      {/* ── Pending Approvals ── */}
      <PendingApprovalsTable queue={pending} onAction={refreshQueue} />

      {/* ── Override History ── */}
      <OverrideHistoryTable history={resolved} />

      {/* ── Footer note ── */}
      <div className="flex items-center justify-center gap-2 py-2">
        <RefreshCw className="w-3 h-3 text-slate-300" />
        <p className="text-[11px] text-slate-400">Auto-refreshes every 8s with market tick · Queue polling every 2s</p>
      </div>
    </div>
  )
}
