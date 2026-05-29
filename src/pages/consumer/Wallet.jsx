import React, { useState } from 'react'
import {
  Star, Clock, DollarSign, Shield, Zap, Landmark, CreditCard,
  ArrowRight, X, AlertTriangle, CheckCircle, Lock,
} from 'lucide-react'
import { CONSUMER_WALLET } from '../../data/finance'

const RAIL_META = {
  payid: { label: 'PayID (Instant)',    icon: Zap,       color: 'bg-eco-100 text-eco-700',       fee: 'Free',          time: 'Instant' },
  bank:  { label: 'Bank Transfer',      icon: Landmark,  color: 'bg-slate-100 text-slate-700',   fee: 'Free',          time: '1–2 days' },
  stripe:{ label: 'Debit Card',         icon: CreditCard,color: 'bg-violet-100 text-violet-700', fee: '1.7% + $0.30',  time: 'T+2 days' },
}

function PointsCard({ wallet }) {
  const aud = (wallet.balance_pts * wallet.rate_aud).toFixed(2)
  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Star className="w-4 h-4 text-amber-100" />
            <span className="text-xs font-bold text-amber-100 uppercase tracking-wider">{wallet.label}</span>
          </div>
          <p className="text-3xl font-bold">{wallet.balance_pts.toLocaleString()} pts</p>
          <p className="text-sm text-amber-100 mt-0.5">≈ ${aud} AUD equivalent</p>
        </div>
        <div className="bg-white/20 rounded-xl px-3 py-1.5 text-center">
          <p className="text-[10px] font-bold text-white">${wallet.rate_aud}/pt</p>
        </div>
      </div>
      <div className="bg-white/20 rounded-xl px-3 py-2.5">
        <p className="text-[11px] font-bold text-amber-100 uppercase tracking-wide">{wallet.note}</p>
      </div>
      <p className="text-[11px] text-amber-200 mt-2">Use points in the Rewards store for discounts and perks</p>
    </div>
  )
}

function PendingCard({ wallet }) {
  const nextRelease = wallet.releases[0]
  const daysToRelease = Math.max(0, Math.ceil((new Date(nextRelease.release_at) - new Date()) / 86400000))
  return (
    <div className="rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 p-5 text-white shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Clock className="w-4 h-4 text-orange-100" />
            <span className="text-xs font-bold text-orange-100 uppercase tracking-wider">{wallet.label}</span>
          </div>
          <p className="text-3xl font-bold">${wallet.balance_aud.toFixed(2)}</p>
          <p className="text-sm text-orange-100 mt-0.5">{wallet.note}</p>
        </div>
        <div className="bg-white/20 rounded-xl px-3 py-1.5 text-center">
          <p className="text-[10px] font-bold text-white uppercase">HELD</p>
        </div>
      </div>
      <div className="bg-white/20 rounded-xl p-3 space-y-2">
        <p className="text-[11px] font-bold text-orange-100 uppercase tracking-wide mb-2">Upcoming Releases</p>
        {wallet.releases.map(r => (
          <div key={r.source} className="flex items-center justify-between text-xs">
            <span className="text-orange-100 truncate flex-1 mr-2">{r.source}</span>
            <span className="font-bold text-white">${r.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-orange-200 mt-2">
        Next release in {daysToRelease} day{daysToRelease !== 1 ? 's' : ''} — 7-day anti-fraud hold
      </p>
    </div>
  )
}

function AvailableCard({ wallet, onWithdraw }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-eco-500 to-eco-600 p-5 text-white shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <DollarSign className="w-4 h-4 text-eco-100" />
            <span className="text-xs font-bold text-eco-100 uppercase tracking-wider">{wallet.label}</span>
          </div>
          <p className="text-3xl font-bold">${wallet.balance_aud.toFixed(2)}</p>
          <p className="text-sm text-eco-100 mt-0.5">{wallet.note}</p>
        </div>
        <div className="bg-white/20 rounded-xl px-3 py-1.5 text-center">
          <p className="text-[10px] font-bold text-white uppercase">CASH</p>
        </div>
      </div>
      <button
        onClick={onWithdraw}
        className="w-full bg-white text-eco-700 font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-eco-50 transition-colors"
      >
        Withdraw <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

function ReserveCard({ wallet }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 p-5 text-white shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Lock className="w-4 h-4 text-slate-300" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{wallet.label}</span>
          </div>
          <p className="text-3xl font-bold">${wallet.balance_aud.toFixed(2)}</p>
          <p className="text-sm text-slate-300 mt-0.5">{wallet.note}</p>
        </div>
        <div className="bg-red-500/80 rounded-xl px-3 py-1.5">
          <p className="text-[10px] font-bold text-white uppercase">{wallet.status}</p>
        </div>
      </div>
      <div className="bg-white/10 rounded-xl p-3 space-y-1">
        <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1">Hold Details</p>
        <p className="text-xs text-slate-200">{wallet.reason}</p>
        <p className="text-[11px] text-slate-400">
          Held since {new Date(wallet.held_since).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} ·
          Expected release {new Date(wallet.release_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Contact support to appeal this hold</p>
    </div>
  )
}

function WithdrawModal({ wallet, onClose }) {
  const [selectedRail, setSelectedRail] = useState(CONSUMER_WALLET.wallets.available.preferred_rail)
  const [amount, setAmount] = useState(wallet.balance_aud.toFixed(2))
  const [step, setStep] = useState(1)

  const rail = RAIL_META[selectedRail]
  const parsedAmount = parseFloat(amount) || 0
  const feeAmount = selectedRail === 'stripe' ? (parsedAmount * 0.017 + 0.30).toFixed(2) : '0.00'
  const netAmount = selectedRail === 'stripe' ? (parsedAmount - parseFloat(feeAmount)).toFixed(2) : parsedAmount.toFixed(2)
  const isValid = parsedAmount > 0 && parsedAmount <= wallet.balance_aud

  const configuredRails = Object.entries(CONSUMER_WALLET.payment_rails).filter(([, r]) => r.configured)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Withdraw Cash</h3>
            <p className="text-xs text-slate-400 mt-0.5">Available: ${wallet.balance_aud.toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 1 && (
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Amount (AUD)</label>
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-eco-300">
                <span className="text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="flex-1 text-xl font-bold text-slate-800 focus:outline-none"
                  min="1"
                  max={wallet.balance_aud}
                  step="0.01"
                />
                <button
                  onClick={() => setAmount(wallet.balance_aud.toFixed(2))}
                  className="text-xs text-eco-600 font-semibold hover:underline"
                >Max</button>
              </div>
              {!isValid && parsedAmount > 0 && (
                <p className="text-xs text-red-500 mt-1">Exceeds available balance</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Payment Method</label>
              <div className="space-y-2">
                {configuredRails.map(([key, railConfig]) => {
                  const meta = RAIL_META[key]
                  if (!meta) return null
                  const Icon = meta.icon
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedRail(key)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        selectedRail === key ? 'border-eco-400 bg-eco-50' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{meta.label}</p>
                        <p className="text-[11px] text-slate-400">
                          {key === 'payid' ? railConfig.identifier :
                           key === 'bank' ? `BSB ${railConfig.bsb} · ${railConfig.account}` : 'Card on file'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-slate-700">{meta.fee}</p>
                        <p className="text-[10px] text-slate-400">{meta.time}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Withdrawal Amount</span>
                <span className="font-semibold text-slate-800">${parsedAmount.toFixed(2)}</span>
              </div>
              {parseFloat(feeAmount) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">— Processing Fee</span>
                  <span className="text-slate-500">-${feeAmount}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                <span className="text-slate-800">You Receive</span>
                <span className="text-eco-700">${netAmount}</span>
              </div>
            </div>

            <button
              disabled={!isValid}
              onClick={() => setStep(2)}
              className="w-full bg-eco-700 hover:bg-eco-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center gap-3 bg-eco-50 rounded-xl p-4">
              <CheckCircle className="w-8 h-8 text-eco-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-eco-800">Confirm Withdrawal</p>
                <p className="text-sm text-eco-700">${netAmount} → {rail.label}</p>
                <p className="text-xs text-eco-600">{rail.time}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
              <strong>Important:</strong> This transfers real cash from your EcoBin wallet to your bank/PayID. This action cannot be undone once submitted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl text-sm">Back</button>
              <button onClick={onClose} className="flex-1 bg-eco-700 hover:bg-eco-800 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                Confirm Withdrawal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Wallet() {
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const { wallets, withdrawal_history } = CONSUMER_WALLET

  const totalCash = wallets.available.balance_aud + wallets.pending.balance_aud + wallets.reserve.balance_aud
  const pointsAud = (wallets.points.balance_pts * wallets.points.rate_aud).toFixed(2)

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Wallet</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your earnings, eco points, and payout methods</p>
      </div>

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-700">
          <span className="font-bold">Eco Points are not cash.</span> Points cannot be withdrawn or converted to AUD. Only your Available Cash balance can be withdrawn.
        </div>
      </div>

      <div className="space-y-4">
        <PointsCard wallet={wallets.points} />
        <PendingCard wallet={wallets.pending} />
        <AvailableCard wallet={wallets.available} onWithdraw={() => setWithdrawOpen(true)} />
        <ReserveCard wallet={wallets.reserve} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-3">Balance Summary</h2>
        <div className="space-y-2">
          {[
            { label: 'Eco Points',     value: `${wallets.points.balance_pts.toLocaleString()} pts (≈$${pointsAud})`, color: 'text-amber-600', note: 'Not cash' },
            { label: 'Pending Cash',   value: `$${wallets.pending.balance_aud.toFixed(2)}`,    color: 'text-orange-500', note: 'Being released' },
            { label: 'Available Cash', value: `$${wallets.available.balance_aud.toFixed(2)}`, color: 'text-eco-700',   note: 'Withdraw now' },
            { label: 'Reserve Hold',   value: `$${wallets.reserve.balance_aud.toFixed(2)}`,   color: 'text-slate-500', note: 'Locked' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="text-slate-500">{item.label}</span>
              <div className="text-right">
                <span className={`font-bold ${item.color}`}>{item.value}</span>
                <span className="text-[10px] text-slate-400 ml-2">{item.note}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-bold">
            <span className="text-slate-700">Total Cash Wallets</span>
            <span className="text-slate-900">${totalCash.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Withdrawal History</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {withdrawal_history.map(wh => (
            <div key={wh.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-8 h-8 bg-eco-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-eco-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{wh.id}</p>
                <p className="text-[11px] text-slate-400">{wh.rail.toUpperCase()} · {wh.date}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-slate-800">-${wh.amount.toFixed(2)}</p>
                <span className="text-[10px] font-semibold text-eco-600">{wh.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {withdrawOpen && (
        <WithdrawModal wallet={wallets.available} onClose={() => setWithdrawOpen(false)} />
      )}
    </div>
  )
}
