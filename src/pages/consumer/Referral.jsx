import React, { useState } from 'react'
import { GitBranch, Copy, CheckCheck, Users, DollarSign, Gift, Share2, Mail, MessageSquare } from 'lucide-react'

const REFERRALS = [
  { name: 'James T.',    date: 'May 2025',   status: 'Active',   earned: '$5.00' },
  { name: 'Priya K.',   date: 'Apr 2025',   status: 'Active',   earned: '$5.00' },
  { name: 'Marcus W.',  date: 'Mar 2025',   status: 'Pending',  earned: '$0.00' },
  { name: 'Anna L.',    date: 'Feb 2025',   status: 'Active',   earned: '$5.00' },
]

const CODE = 'SARAHM-42XQ'

export default function Referral() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(CODE).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeCount  = REFERRALS.filter(r => r.status === 'Active').length
  const pendingCount = REFERRALS.filter(r => r.status === 'Pending').length
  const totalEarned  = REFERRALS.reduce((s, r) => s + parseFloat(r.earned.replace('$', '')), 0)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Referral Program</h1>
        <p className="text-sm text-slate-500 mt-0.5">Invite friends and earn $5.00 AUD for each active referral.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Referrals', value: activeCount,             icon: Users,     color: 'text-eco-700 bg-eco-50' },
          { label: 'Pending',          value: pendingCount,            icon: GitBranch, color: 'text-amber-700 bg-amber-50' },
          { label: 'Total Earned',     value: `$${totalEarned.toFixed(2)}`, icon: DollarSign, color: 'text-blue-700 bg-blue-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className={`w-9 h-9 ${s.color.split(' ')[1]} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color.split(' ')[0]}`} />
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Referral code card */}
      <div className="bg-eco-700 text-white rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-4 h-4 text-eco-300" />
          <span className="text-sm font-semibold text-eco-200">Your Referral Code</span>
        </div>
        <div className="text-3xl font-bold tracking-widest mb-4">{CODE}</div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-4 py-2.5 rounded-xl text-sm font-semibold"
          >
            {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <button className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Share2 className="w-4 h-4" /> Share Link
          </button>
          <button className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-4 py-2.5 rounded-xl text-sm font-semibold">
            <Mail className="w-4 h-4" /> Email Invite
          </button>
          <button className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-4 py-2.5 rounded-xl text-sm font-semibold">
            <MessageSquare className="w-4 h-4" /> SMS Invite
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Share your code',    desc: 'Send your unique referral code or link to a friend.' },
            { step: '2', title: 'They sign up',       desc: 'Your friend joins CirclLoop and completes their first deposit.' },
            { step: '3', title: 'Both of you earn',   desc: 'You get $5.00 AUD, and they get 200 bonus Eco Points.' },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <div className="w-7 h-7 bg-eco-100 rounded-full flex items-center justify-center text-xs font-bold text-eco-700 flex-shrink-0 mt-0.5">
                {s.step}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{s.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Your Referrals</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {REFERRALS.map(r => (
            <div key={r.name} className="flex items-center gap-4 px-6 py-3.5">
              <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                {r.name[0]}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-400">Joined {r.date}</div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                r.status === 'Active' ? 'bg-eco-50 text-eco-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {r.status}
              </span>
              <div className="text-sm font-bold text-slate-900 w-14 text-right">{r.earned}</div>
            </div>
          ))}
        </div>
        {REFERRALS.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No referrals yet. Share your code to get started!
          </div>
        )}
      </div>
    </div>
  )
}
