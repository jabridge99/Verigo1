import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, Coins, ArrowUpRight, ArrowDownLeft, ArrowRight,
  RefreshCcw, Lock, CheckCircle, X, TrendingUp, Star,
  Award, Zap, Users, Leaf,
} from 'lucide-react'

// ─── REWARD TIERS ────────────────────────────────────────────────────────────

const TIERS = [
  { name: 'Bronze',   min: 0,     max: 999,   color: 'text-amber-700 bg-amber-100',   bar: 'bg-amber-400' },
  { name: 'Silver',   min: 1000,  max: 4999,  color: 'text-slate-600 bg-slate-200',   bar: 'bg-slate-400' },
  { name: 'Gold',     min: 5000,  max: 14999, color: 'text-yellow-700 bg-yellow-100', bar: 'bg-yellow-400' },
  { name: 'Platinum', min: 15000, max: Infinity, color: 'text-violet-700 bg-violet-100', bar: 'bg-violet-500' },
]

const TIER_BENEFITS = {
  Bronze:   ['Base commodity rates', 'Standard scheduling', 'Eco Rewards Marketplace'],
  Silver:   ['+5% bonus eco points', 'Early access to new offers', 'Priority email support'],
  Gold:     ['+10% bonus eco points', 'Priority collection scheduling', 'Exclusive Gold rewards', 'Phone support'],
  Platinum: ['+15% bonus eco points', 'White-glove collection service', 'Custom impact reports', 'Dedicated account manager'],
}

function TierBadge({ tier, size = 'sm' }) {
  const t = TIERS.find(t => t.name === tier)
  if (!t) return null
  return (
    <span className={`font-bold rounded-full px-2 py-0.5 ${size === 'sm' ? 'text-xs' : 'text-sm px-3 py-1'} ${t.color}`}>
      {tier}
    </span>
  )
}

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: 'first',    label: 'First Loop',         icon: Leaf,    pts: 10,  done: true,  pct: 100 },
  { id: 'ten',      label: '10 Club',             icon: Star,    pts: 50,  done: true,  pct: 100 },
  { id: 'circle',   label: 'Circle Leader',       icon: Users,   pts: 100, done: true,  pct: 100 },
  { id: 'century',  label: 'Century (100 runs)',  icon: Award,   pts: 200, done: false, pct: 29 },
  { id: 'warrior',  label: 'Eco Warrior (1t CO₂)',icon: Leaf,    pts: 500, done: false, pct: 4 },
  { id: 'earner',   label: 'Big Earner ($100/mo)', icon: Coins,  pts: 300, done: false, pct: 14 },
  { id: 'loyalty',  label: 'Loyal Looper (30d)',  icon: Zap,     pts: 250, done: false, pct: 60 },
]

// ─── TRANSFER MODAL ───────────────────────────────────────────────────────────

const FEE_RATE = 0.03

function TransferModal({ onClose }) {
  const [from,   setFrom]   = useState('cash')
  const [to,     setTo]     = useState('member')
  const [amount, setAmount] = useState('')
  const [member, setMember] = useState('')
  const [done,   setDone]   = useState(false)

  const numAmt = parseFloat(amount) || 0
  const fee    = from === 'cash' && to === 'member' ? numAmt * FEE_RATE : 0
  const net    = numAmt - fee

  if (done) {
    return (
      <ModalShell onClose={onClose}>
        <div className="text-center py-4 space-y-3">
          <div className="w-14 h-14 bg-eco-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-eco-700" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Transfer Complete</h3>
          <p className="text-slate-500 text-sm">
            ${net.toFixed(2)} sent{to === 'member' ? ` to ${member || 'recipient'}` : ''}.
            {fee > 0 && ` (${(FEE_RATE * 100).toFixed(0)}% fee: $${fee.toFixed(2)})`}
          </p>
          <button onClick={onClose} className="mt-4 bg-eco-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm w-full">
            Done
          </button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell onClose={onClose} title="Internal Transfer">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">From</label>
            <select
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
            >
              <option value="cash">Cash Wallet ($14.20)</option>
              <option value="points">Eco Points (1,420)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">To</label>
            <select
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
            >
              <option value="member">Household Member</option>
              <option value="points">Eco Points Wallet</option>
              <option value="cash">Cash Wallet</option>
            </select>
          </div>
        </div>

        {to === 'member' && (
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Recipient (CirclLoop username or email)</label>
            <input
              type="text"
              value={member}
              onChange={e => setMember(e.target.value)}
              placeholder="e.g. james.m@email.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Amount ($)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
          />
        </div>

        {numAmt > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Transfer amount</span>
              <span className="font-semibold">${numAmt.toFixed(2)}</span>
            </div>
            {fee > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Platform fee (3%)</span>
                <span className="font-semibold">− ${fee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-amber-200 pt-1.5 font-bold">
              <span className="text-slate-700">Recipient receives</span>
              <span className="text-eco-700">${net.toFixed(2)}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => numAmt > 0 && setDone(true)}
          disabled={numAmt <= 0}
          className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          Confirm Transfer
        </button>
      </div>
    </ModalShell>
  )
}

function ModalShell({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm">
        {title && (
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ─── WITHDRAW MODAL ───────────────────────────────────────────────────────────

function WithdrawModal({ onClose }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <ModalShell onClose={onClose}>
        <div className="text-center py-4 space-y-3">
          <div className="w-14 h-14 bg-eco-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-7 h-7 text-eco-700" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Withdrawal Requested</h3>
          <p className="text-slate-500 text-sm">
            ${parseFloat(amount || 0).toFixed(2)} will arrive within 1–2 business days.
          </p>
          <button onClick={onClose} className="mt-4 bg-eco-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm w-full">
            Done
          </button>
        </div>
      </ModalShell>
    )
  }

  const num = parseFloat(amount) || 0
  const fee = num < 10 ? 0.50 : 0

  return (
    <ModalShell onClose={onClose} title="Withdraw Funds">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Amount ($) — Balance: $14.20</label>
          <input
            type="number" min="5" step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Min $5.00"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Payment Method</label>
          <div className="space-y-2">
            {[
              { id: 'bank',  label: 'Bank Transfer (BSB 062-000 · ••4821)', sub: '1–2 business days' },
              { id: 'payid', label: 'PayID (sarah@email.com)',              sub: 'Instant' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all ${
                  method === m.id ? 'border-eco-500 bg-eco-50' : 'border-slate-200 hover:border-eco-200'
                }`}
              >
                <span className="font-medium text-slate-800">{m.label}</span>
                <span className="text-xs text-slate-400">{m.sub}</span>
              </button>
            ))}
          </div>
        </div>
        {num > 0 && (
          <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-semibold">${num.toFixed(2)}</span></div>
            {fee > 0 && <div className="flex justify-between text-amber-700"><span>Processing fee</span><span>− ${fee.toFixed(2)}</span></div>}
            <div className="flex justify-between border-t border-slate-200 pt-1 font-bold"><span>You receive</span><span className="text-eco-700">${(num - fee).toFixed(2)}</span></div>
          </div>
        )}
        {num < 10 && num > 0 && (
          <p className="text-xs text-amber-600">Withdrawals under $10 incur a $0.50 processing fee.</p>
        )}
        <button
          onClick={() => num >= 5 && setDone(true)}
          disabled={num < 5}
          className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          Confirm Withdrawal
        </button>
      </div>
    </ModalShell>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

const CURRENT_PTS  = 1420
const CURRENT_TIER = 'Silver'
const NEXT_TIER    = 'Gold'
const NEXT_TIER_PTS = 5000

const RECENT_TXN = [
  { label: '240L Mixed — 27 May',       type: 'credit',   amount: '+$5.40',   pts: '+54 pts' },
  { label: 'Eco Rewards — Coffee',      type: 'debit',    amount: '−$2.50',   pts: '−250 pts' },
  { label: 'Referral bonus — James M.', type: 'bonus',    amount: '+$2.00',   pts: '+20 pts' },
  { label: '240L Mixed — 13 May',       type: 'credit',   amount: '+$8.80',   pts: '+88 pts' },
  { label: 'Transfer to James M.',      type: 'transfer', amount: '−$5.00',   pts: null },
]

const TXN_STYLE = {
  credit:   'text-eco-700 bg-eco-50',
  debit:    'text-red-600 bg-red-50',
  bonus:    'text-purple-700 bg-purple-50',
  transfer: 'text-blue-700 bg-blue-50',
}

export default function WalletPage() {
  const [showTransfer,  setShowTransfer]  = useState(false)
  const [showWithdraw,  setShowWithdraw]  = useState(false)
  const tierIndex  = TIERS.findIndex(t => t.name === CURRENT_TIER)
  const nextTier   = TIERS[tierIndex + 1]
  const tierPct    = Math.round(((CURRENT_PTS - TIERS[tierIndex].min) / (NEXT_TIER_PTS - TIERS[tierIndex].min)) * 100)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Wallet</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your cash, eco points, and rewards</p>
      </div>

      {/* Wallet cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Cash */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Cash Wallet</div>
          <div className="text-3xl font-bold">$14.20</div>
          <div className="text-xs text-slate-400 mt-1">Available balance · AUD</div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setShowWithdraw(true)} className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
            </button>
            <button onClick={() => setShowTransfer(true)} className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <RefreshCcw className="w-3.5 h-3.5" /> Transfer
            </button>
          </div>
        </div>

        {/* Eco Points */}
        <div className="bg-eco-700 rounded-2xl p-6 text-white">
          <div className="text-[10px] font-semibold text-eco-300 uppercase tracking-widest mb-4">Eco Points</div>
          <div className="text-3xl font-bold">1,420 pts</div>
          <div className="text-xs text-eco-200 mt-1">≈ $14.20 marketplace value</div>
          <div className="flex gap-2 mt-5">
            <Link to="/consumer/rewards" className="flex-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5" /> Redeem
            </Link>
            <button onClick={() => setShowTransfer(true)} className="flex-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </div>

        {/* Crypto — coming soon */}
        <div className="bg-slate-100 rounded-2xl p-6 border-2 border-dashed border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">CirclCoin</div>
            <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Coming Soon</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-slate-400" />
            <div className="text-xl font-bold text-slate-300">— CLC</div>
          </div>
          <div className="text-xs text-slate-400 mt-1">Crypto integration is disabled</div>
          <div className="mt-5 bg-white rounded-xl px-4 py-3 text-xs text-slate-500">
            Earn CirclCoin when enabled. Will be linked to your eco points at conversion.
          </div>
        </div>
      </div>

      {/* Tier & achievements */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Tier progress */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Reward Tier</h2>
            <TierBadge tier={CURRENT_TIER} />
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-500">{CURRENT_PTS.toLocaleString()} pts</span>
            <span className="text-slate-400">{NEXT_TIER_PTS.toLocaleString()} pts to {NEXT_TIER}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-slate-400 rounded-full" style={{ width: `${tierPct}%` }} />
          </div>
          <div className="space-y-2">
            {TIER_BENEFITS[CURRENT_TIER].map(b => (
              <div key={b} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-eco-600 flex-shrink-0" />
                <span className="text-slate-700">{b}</span>
              </div>
            ))}
          </div>
          {nextTier && (
            <div className="mt-4 bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Unlock at {nextTier.name}:</p>
              <p className="text-xs text-slate-600">{TIER_BENEFITS[nextTier.name][0]}</p>
            </div>
          )}
        </div>

        {/* Achievements */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Achievements</h2>
            <span className="text-xs text-slate-400">3/7 unlocked</span>
          </div>
          <div className="space-y-3">
            {ACHIEVEMENTS.map(a => (
              <div key={a.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  a.done ? 'bg-eco-100' : 'bg-slate-100'
                }`}>
                  <a.icon className={`w-4 h-4 ${a.done ? 'text-eco-700' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${a.done ? 'text-slate-900' : 'text-slate-500'}`}>
                    {a.label}
                  </div>
                  {!a.done && a.pct > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-eco-400 rounded-full" style={{ width: `${a.pct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400">{a.pct}%</span>
                    </div>
                  )}
                </div>
                <div className="text-xs font-semibold text-eco-700 flex-shrink-0">
                  {a.done ? '✓' : `+${a.pts} pts`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Recent Transactions</h2>
          <Link to="/consumer/transactions" className="text-xs text-eco-700 font-semibold hover:underline">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {RECENT_TXN.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-3.5">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${TXN_STYLE[t.type]}`}>
                  {t.type === 'credit' ? '+' : t.type === 'bonus' ? '★' : '→'}
                </div>
                <span className="text-sm text-slate-700">{t.label}</span>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${t.type === 'credit' || t.type === 'bonus' ? 'text-eco-700' : 'text-slate-700'}`}>
                  {t.amount}
                </div>
                {t.pts && <div className="text-[11px] text-slate-400">{t.pts}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showTransfer && <TransferModal onClose={() => setShowTransfer(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
    </div>
  )
}
