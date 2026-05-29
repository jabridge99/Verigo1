import React, { useState } from 'react'
import { Users, Clock, TrendingUp, CheckCircle, ArrowRight, X, Leaf } from 'lucide-react'
import { GROUP_REWARDS, TRANSFER_HISTORY, ptsToAUD } from '../../data/marketplace'

const CURRENT_USER = { name: 'Sarah M.', tier: 'silver', points: 1_420, initials: 'SM' }

function countdown(deadline) {
  const d = new Date(deadline)
  const now = new Date()
  const diff = d - now
  if (diff <= 0) return 'Ended'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  return days > 0 ? `${days}d left` : 'Ends today'
}

function ContributeModal({ pool, onClose }) {
  const [amount, setAmount] = useState(100)
  const [done, setDone] = useState(false)
  const max = Math.min(CURRENT_USER.points, pool.target_points - pool.current_points)
  const canSubmit = amount > 0 && amount <= CURRENT_USER.points && amount <= max

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
          <div className="w-14 h-14 bg-eco-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-eco-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Contribution Added!</h2>
          <p className="text-sm text-slate-500 mb-4">
            You added <strong>{amount.toLocaleString()} pts</strong> to <strong>{pool.name}</strong>.
          </p>
          <div className="bg-eco-50 rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2">
            <Leaf className="w-4 h-4 text-eco-600 flex-shrink-0" />
            <p className="text-xs text-eco-700">Every point brings the group closer to the goal. Share this pool to rally more contributors!</p>
          </div>
          <button onClick={onClose} className="w-full py-3 bg-eco-600 text-white font-bold rounded-xl hover:bg-eco-700 transition-colors">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Contribute to Pool</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-eco-50 rounded-xl px-4 py-3">
            <p className="text-sm font-bold text-eco-900">{pool.name}</p>
            <p className="text-xs text-eco-700 mt-0.5">{pool.reward}</p>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-2">
              <span className="text-slate-600">Points to contribute</span>
              <span className="text-eco-700">{amount.toLocaleString()} pts = ${ptsToAUD(amount)} AUD</span>
            </div>
            <input type="range" min="50" max={Math.min(CURRENT_USER.points, max)} step="50"
              value={amount} onChange={e => setAmount(parseInt(e.target.value))}
              className="w-full accent-eco-600" />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>50 pts min</span>
              <span>{Math.min(CURRENT_USER.points, max).toLocaleString()} pts max</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Pool progress after</span>
              <span className="font-bold text-eco-700">
                {(pool.current_points + amount).toLocaleString()} / {pool.target_points.toLocaleString()} pts
                ({Math.min(100, Math.round(((pool.current_points + amount) / pool.target_points) * 100))}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Your balance after</span>
              <span className="font-bold text-slate-700">{(CURRENT_USER.points - amount).toLocaleString()} pts</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl">Cancel</button>
            <button disabled={!canSubmit} onClick={() => setDone(true)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                canSubmit ? 'bg-eco-600 text-white hover:bg-eco-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}>
              Contribute {amount.toLocaleString()} pts
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TransferModal({ onClose }) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const valid = recipient.trim() && parseInt(amount) > 0 && parseInt(amount) <= CURRENT_USER.points

  if (done) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
          <div className="w-14 h-14 bg-eco-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-eco-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Points Transferred!</h2>
          <p className="text-sm text-slate-500 mb-4">
            <strong>{parseInt(amount).toLocaleString()} pts</strong> sent to <strong>{recipient}</strong>.
          </p>
          <button onClick={onClose} className="w-full py-3 bg-eco-600 text-white font-bold rounded-xl hover:bg-eco-700 transition-colors">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white">Transfer Points</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm">
            <span className="text-slate-500">Your balance: </span>
            <span className="font-bold text-eco-700">{CURRENT_USER.points.toLocaleString()} pts</span>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Recipient (name or email) *</label>
            <input value={recipient} onChange={e => setRecipient(e.target.value)}
              placeholder="James M. or james@example.com"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Points to transfer *</label>
            <input type="number" min="50" max={CURRENT_USER.points} value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="500"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
            {amount && <p className="text-[11px] text-slate-400 mt-1">≈ ${ptsToAUD(parseInt(amount) || 0)} AUD value</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Message (optional)</label>
            <input value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Birthday gift! 🎉"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-xl">Cancel</button>
            <button disabled={!valid} onClick={() => setDone(true)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                valid ? 'bg-eco-600 text-white hover:bg-eco-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}>
              Send Points
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GroupRewards() {
  const [selected, setSelected] = useState(null)
  const [showTransfer, setShowTransfer] = useState(false)

  const active = GROUP_REWARDS.filter(g => g.status === 'active')
  const completed = GROUP_REWARDS.filter(g => g.status === 'completed')

  return (
    <div className="space-y-6">
      {selected && <ContributeModal pool={selected} onClose={() => setSelected(null)} />}
      {showTransfer && <TransferModal onClose={() => setShowTransfer(false)} />}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Group Rewards</h1>
          <p className="text-sm text-slate-500 mt-0.5">Pool points with your community to unlock bigger rewards</p>
        </div>
        <button onClick={() => setShowTransfer(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">
          <ArrowRight className="w-4 h-4 rotate-[-90deg]" />
          Transfer Points
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Pools',     value: active.length, color: 'text-eco-700', bg: 'bg-eco-50' },
          { label: 'Your Contributions', value: GROUP_REWARDS.reduce((s, g) => s + g.my_contribution, 0).toLocaleString() + ' pts', color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Pools Completed',  value: completed.length, color: 'text-slate-700', bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Active pools */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-700">Active Pools</h2>
        {active.map(pool => {
          const pct = Math.min(100, Math.round((pool.current_points / pool.target_points) * 100))
          const ptsLeft = pool.target_points - pool.current_points
          const isContributing = pool.my_contribution > 0
          const almostFull = pct >= 85

          return (
            <div key={pool.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${almostFull ? 'border-eco-200' : 'border-slate-100'}`}>
              {almostFull && (
                <div className="bg-eco-600 px-5 py-2 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                  <p className="text-xs font-bold text-white">Almost there! Only {ptsLeft.toLocaleString()} pts needed to unlock</p>
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">{pool.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{pool.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {pool.participants} contributors</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {countdown(pool.deadline)}</span>
                      <span className="text-eco-600 font-semibold">{pool.merchant_name}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-eco-700">{pct}%</p>
                    <p className="text-[10px] text-slate-400">of goal</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-eco-500' : almostFull ? 'bg-eco-400' : 'bg-violet-400'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-3">
                  <span>{pool.current_points.toLocaleString()} pts raised</span>
                  <span>{pool.target_points.toLocaleString()} pts goal</span>
                </div>

                {/* Reward */}
                <div className="bg-slate-50 rounded-xl px-4 py-2.5 mb-3 flex items-start gap-2">
                  <Leaf className="w-3.5 h-3.5 text-eco-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Reward: {pool.reward}</p>
                  </div>
                </div>

                {/* Top contributors */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex -space-x-2">
                    {pool.top_contributors.slice(0, 5).map((c, i) => (
                      <div key={i} className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white ${c.is_me ? 'bg-eco-600' : 'bg-slate-500'}`}>
                        {c.initials}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">{pool.participants} people contributing</p>
                  {isContributing && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-eco-100 text-eco-700 rounded-full ml-auto">You: {pool.my_contribution.toLocaleString()} pts</span>
                  )}
                </div>

                <button onClick={() => setSelected(pool)}
                  className="w-full py-2.5 bg-eco-600 text-white text-sm font-bold rounded-xl hover:bg-eco-700 transition-colors">
                  {isContributing ? 'Add More Points' : 'Join This Pool'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Completed pools */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-3">Completed Pools</h2>
          <div className="space-y-3">
            {completed.map(pool => (
              <div key={pool.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-eco-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-eco-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{pool.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{pool.participants} contributors · {pool.target_points.toLocaleString()} pts raised · {pool.merchant_name}</p>
                </div>
                {pool.my_contribution > 0 && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-eco-700">{pool.my_contribution.toLocaleString()} pts</p>
                    <p className="text-[10px] text-slate-400">your share</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfer history */}
      {TRANSFER_HISTORY.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900">Points Transfer History</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {TRANSFER_HISTORY.map(t => (
              <div key={t.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.direction === 'sent' ? 'bg-amber-100 text-amber-700' : 'bg-eco-100 text-eco-700'}`}>
                      {t.direction === 'sent' ? 'Sent' : 'Received'}
                    </span>
                    <p className="text-sm font-semibold text-slate-800">{t.counterparty}</p>
                  </div>
                  {t.message && <p className="text-xs text-slate-400 mt-0.5 italic">"{t.message}"</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${t.direction === 'sent' ? 'text-amber-600' : 'text-eco-700'}`}>
                    {t.direction === 'sent' ? '−' : '+'}{t.points.toLocaleString()} pts
                  </p>
                  <p className="text-[10px] text-slate-400">{new Date(t.ts).toLocaleDateString('en-AU')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
