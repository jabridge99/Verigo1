import React, { useState } from 'react'
import { Users, Plus, Crown, TrendingUp, CheckCircle, ArrowRight, Leaf, X } from 'lucide-react'

const MEMBERS = [
  { id: 1, name: 'Sarah M.',  role: 'Circle Leader', initials: 'SM', items: 42, kg: 12.0, earned: '$5.40',  streak: 8,  avatar: 'bg-eco-600' },
  { id: 2, name: 'James M.',  role: 'Member',         initials: 'JM', items: 38, kg: 9.8,  earned: '$3.80',  streak: 5,  avatar: 'bg-blue-600' },
  { id: 3, name: 'Ella M.',   role: 'Member',         initials: 'EM', items: 29, kg: 6.6,  earned: '$2.90',  streak: 12, avatar: 'bg-purple-600' },
]

const ACTIVITY = [
  { member: 'Ella M.',  action: 'Booked pickup',          time: '2 hours ago', icon: CheckCircle, color: 'text-eco-700 bg-eco-50' },
  { member: 'James M.', action: 'Completed collection — $3.80 recovered', time: '13 May', icon: TrendingUp, color: 'text-blue-700 bg-blue-50' },
  { member: 'Sarah M.', action: 'Invited Ella to the circle', time: '10 May', icon: Users, color: 'text-purple-700 bg-purple-50' },
  { member: 'Sarah M.', action: 'Completed collection — $5.40 recovered', time: '27 Apr', icon: TrendingUp, color: 'text-eco-700 bg-eco-50' },
]

export default function HouseholdCircle() {
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const handleInvite = e => {
    e.preventDefault()
    setSent(true)
    setTimeout(() => { setSent(false); setEmail(''); setShowInvite(false) }, 2000)
  }

  const totalEarned = '$10.90'
  const totalKg     = '28.4 kg'
  const totalItems  = 109

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Household Recycling Circle</h1>
          <p className="text-sm text-slate-500 mt-1">The Mitchell Family · 3 members</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {/* Circle totals */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">
          May 2025 — Circle Summary
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-eco-400">{totalEarned}</div>
            <div className="text-xs text-slate-400 mt-1">Value Recovered</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{totalKg}</div>
            <div className="text-xs text-slate-400 mt-1">Materials Collected</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{totalItems}</div>
            <div className="text-xs text-slate-400 mt-1">Items Deposited</div>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Circle Members — May Leaderboard</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {MEMBERS.map((m, i) => (
            <div key={m.id} className="flex items-center gap-4 px-6 py-4">
              <div className="text-lg font-bold text-slate-300 w-5 text-center">{i + 1}</div>
              <div className={`w-9 h-9 ${m.avatar} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {m.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{m.name}</span>
                  {i === 0 && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                  <span className="text-[10px] text-slate-400">{m.role}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {m.items} items · {m.kg} kg · 🔥 {m.streak}-day streak
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-eco-700">{m.earned}</div>
                <div className="text-[11px] text-slate-400">this month</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {ACTIVITY.map((a, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${a.color}`}>
                <a.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{a.member}</span> {a.action}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Invite to Your Circle</h3>
                <p className="text-sm text-slate-500 mt-1">Send an email invite to a household member.</p>
              </div>
              <button onClick={() => setShowInvite(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {sent ? (
              <div className="text-center py-6">
                <CheckCircle className="w-10 h-10 text-eco-700 mx-auto mb-3" />
                <p className="font-semibold text-slate-900">Invite sent!</p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
                />
                <button
                  type="submit"
                  className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Send Invite
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
