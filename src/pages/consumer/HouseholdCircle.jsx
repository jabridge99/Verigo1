import React, { useState } from 'react'
import {
  Users, Plus, Crown, TrendingUp, CheckCircle, Leaf, X,
  Mail, AlertCircle, Target, Award, Clock,
} from 'lucide-react'

// ── Types & initial state ─────────────────────────────────────────────────────

const INITIAL_MEMBERS = [
  { id: 1, name: 'Sarah M.',  role: 'leader', initials: 'SM', items: 42, kg: 12.0, earnedAud: 5.40,  streakDays: 8,  color: 'bg-eco-600',    joinedAt: '2025-01-10' },
  { id: 2, name: 'James M.',  role: 'member', initials: 'JM', items: 38, kg: 9.8,  earnedAud: 3.80,  streakDays: 5,  color: 'bg-blue-600',   joinedAt: '2025-01-12' },
  { id: 3, name: 'Ella M.',   role: 'member', initials: 'EM', items: 29, kg: 6.6,  earnedAud: 2.90,  streakDays: 12, color: 'bg-purple-600', joinedAt: '2025-02-03' },
]

const INITIAL_INVITES = [
  { id: 10, email: 'gran@family.au', name: 'Gran Mitchell', sentAt: '2025-05-20', status: 'pending' },
]

const INITIAL_ACTIVITY = [
  { memberId: 3, action: 'Booked pickup — 3.2 kg',          when: '2 hours ago',     icon: CheckCircle, color: 'text-eco-700 bg-eco-50' },
  { memberId: 2, action: 'Completed collection — $3.80',    when: '13 May',          icon: TrendingUp,  color: 'text-blue-700 bg-blue-50' },
  { memberId: 1, action: 'Invited Ella to the circle',      when: '10 May',          icon: Users,       color: 'text-purple-700 bg-purple-50' },
  { memberId: 1, action: 'Hit 8-day recycling streak',      when: '8 May',           icon: Award,       color: 'text-amber-700 bg-amber-50' },
  { memberId: 2, action: 'Completed collection — $3.80',    when: '27 Apr',          icon: TrendingUp,  color: 'text-blue-700 bg-blue-50' },
]

const CIRCLE_GOAL = { label: 'May Challenge', targetKg: 40, rewardAud: 5.00 }

// ── Helper ────────────────────────────────────────────────────────────────────

function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose, onSend }) {
  const [email, setEmail] = useState('')
  const [name,  setName]  = useState('')
  const [sent,  setSent]  = useState(false)
  const [err,   setErr]   = useState('')

  function handleSend(e) {
    e.preventDefault()
    if (!validateEmail(email)) { setErr('Enter a valid email address.'); return }
    if (name.trim().length < 2) { setErr('Enter the person\'s name.'); return }
    setErr('')
    setSent(true)
    onSend({ email: email.trim().toLowerCase(), name: name.trim() })
    setTimeout(() => { setSent(false); onClose() }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Invite to Circle</h3>
            <p className="text-sm text-slate-500 mt-0.5">They'll get an email with a join link.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <CheckCircle className="w-10 h-10 text-eco-700 mx-auto mb-2" />
            <p className="font-semibold text-slate-900">Invite sent to {email}!</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5 uppercase tracking-wide">Their Name</label>
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setErr('') }}
                placeholder="e.g. Gran Mitchell"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5 uppercase tracking-wide">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErr('') }}
                placeholder="gran@family.com"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
              />
            </div>
            {err && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
              </div>
            )}
            <button type="submit"
              className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors mt-1">
              Send Invite
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Remove member confirm ────────────────────────────────────────────────────

function RemoveConfirm({ member, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900">Remove {member.name}?</h3>
        <p className="text-sm text-slate-500 mt-1 mb-4">They'll lose access to this circle's shared rewards.</p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:border-slate-300">
            Cancel
          </button>
          <button onClick={() => { onConfirm(member.id); onClose() }}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm">
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function HouseholdCircle() {
  const [members,  setMembers]  = useState(INITIAL_MEMBERS)
  const [invites,  setInvites]  = useState(INITIAL_INVITES)
  const [activity, setActivity] = useState(INITIAL_ACTIVITY)
  const [showInvite,  setShowInvite]  = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [tab, setTab] = useState('members')

  const leader    = members.find(m => m.role === 'leader')
  const totalKg   = members.reduce((s, m) => s + m.kg, 0)
  const totalAud  = members.reduce((s, m) => s + m.earnedAud, 0)
  const totalItems = members.reduce((s, m) => s + m.items, 0)
  const goalPct   = Math.min(100, Math.round((totalKg / CIRCLE_GOAL.targetKg) * 100))
  const sorted    = [...members].sort((a, b) => b.earnedAud - a.earnedAud)

  function handleSendInvite({ email, name }) {
    setInvites(prev => [...prev, {
      id: Date.now(), email, name,
      sentAt: new Date().toISOString().slice(0, 10),
      status: 'pending',
    }])
    setActivity(prev => [{ memberId: 1, action: `Invited ${name} to the circle`, when: 'just now', icon: Users, color: 'text-purple-700 bg-purple-50' }, ...prev])
  }

  function cancelInvite(id) {
    setInvites(prev => prev.filter(i => i.id !== id))
  }

  function removeMember(id) {
    setMembers(prev => prev.filter(m => m.id !== id))
    setActivity(prev => [{ memberId: 1, action: 'Removed a member from the circle', when: 'just now', icon: Users, color: 'text-red-700 bg-red-50' }, ...prev])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Household Recycling Circle</h1>
          <p className="text-sm text-slate-500 mt-1">
            The Mitchell Family · {members.length} members
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {/* Circle summary */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
          May 2026 — Circle Summary
        </div>
        <div className="grid grid-cols-3 gap-4 text-center mb-5">
          <div>
            <div className="text-3xl font-bold text-eco-400">${totalAud.toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-1">Value Recovered</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{totalKg.toFixed(1)} kg</div>
            <div className="text-xs text-slate-400 mt-1">Materials Collected</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{totalItems}</div>
            <div className="text-xs text-slate-400 mt-1">Items Deposited</div>
          </div>
        </div>

        {/* Circle goal progress */}
        <div className="bg-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-eco-400" />
              <span className="font-semibold text-white">{CIRCLE_GOAL.label}</span>
            </div>
            <span className="text-slate-300 text-xs">
              {totalKg.toFixed(1)} / {CIRCLE_GOAL.targetKg} kg
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 mb-2">
            <div
              className="h-2 rounded-full bg-eco-400 transition-all"
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{goalPct}% complete</span>
            <span>Reward: ${CIRCLE_GOAL.rewardAud.toFixed(2)} AUD for each member</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {['members', 'invites', 'activity'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t}{t === 'invites' && invites.length > 0 && ` (${invites.length})`}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">May Leaderboard</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {sorted.map((m, i) => (
              <div key={m.id} className="flex items-center gap-4 px-6 py-4">
                <div className="text-lg font-bold text-slate-300 w-5 text-center">{i + 1}</div>
                <div className={`w-9 h-9 ${m.color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {m.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{m.name}</span>
                    {m.role === 'leader' && <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {m.items} items · {m.kg} kg · 🔥 {m.streakDays}-day streak
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-eco-700">${m.earnedAud.toFixed(2)}</div>
                  <div className="text-[11px] text-slate-400">this month</div>
                </div>
                {m.role !== 'leader' && (
                  <button
                    onClick={() => setRemoveTarget(m)}
                    className="ml-1 p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50"
                    title="Remove member"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invites tab */}
      {tab === 'invites' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Pending Invitations</h2>
            <button onClick={() => setShowInvite(true)}
              className="text-xs text-eco-700 font-semibold hover:underline">+ New invite</button>
          </div>
          {invites.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">
              No pending invites. <button onClick={() => setShowInvite(true)} className="text-eco-700 font-semibold hover:underline">Invite someone</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {invites.map(inv => (
                <div key={inv.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{inv.name}</div>
                    <div className="text-xs text-slate-400">{inv.email} · Sent {inv.sentAt}</div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 flex-shrink-0">
                    <Clock className="w-3 h-3 inline mr-1" />Pending
                  </span>
                  <button onClick={() => cancelInvite(inv.id)}
                    className="p-1.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity tab */}
      {tab === 'activity' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {activity.map((a, i) => {
              const m = members.find(m => m.id === a.memberId)
              return (
                <div key={i} className="flex items-start gap-4 px-6 py-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${a.color}`}>
                    <a.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{m?.name ?? 'Circle'}</span>
                      {' '}{a.action}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{a.when}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSend={handleSendInvite}
        />
      )}

      {removeTarget && (
        <RemoveConfirm
          member={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onConfirm={removeMember}
        />
      )}
    </div>
  )
}
