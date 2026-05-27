import React, { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Gift, Search, Download } from 'lucide-react'

const ALL_TXN = [
  { id: 'TXN-0041', date: '27 May 2025', type: 'credit',   category: 'deposit',   desc: 'Deposit — Surry Hills Hub',   amount: '+$5.40',   pts: '+54 pts',  color: 'text-eco-700' },
  { id: 'TXN-0040', date: '24 May 2025', type: 'debit',    category: 'withdraw',  desc: 'Bank withdrawal',             amount: '-$20.00',  pts: '',         color: 'text-red-600' },
  { id: 'TXN-0039', date: '22 May 2025', type: 'credit',   category: 'referral',  desc: 'Referral bonus — Priya K.',   amount: '+$5.00',   pts: '',         color: 'text-eco-700' },
  { id: 'TXN-0038', date: '19 May 2025', type: 'credit',   category: 'deposit',   desc: 'Deposit — Redfern Node',      amount: '+$8.80',   pts: '+88 pts',  color: 'text-eco-700' },
  { id: 'TXN-0037', date: '15 May 2025', type: 'transfer', category: 'transfer',  desc: 'Transfer to James T.',        amount: '-$10.00',  pts: '',         color: 'text-amber-600' },
  { id: 'TXN-0036', date: '13 May 2025', type: 'credit',   category: 'reward',    desc: 'Eco Reward — Bamboo Kit',     amount: '',         pts: '-200 pts', color: 'text-blue-600' },
  { id: 'TXN-0035', date: '10 May 2025', type: 'credit',   category: 'deposit',   desc: 'Deposit — Newtown Green',     amount: '+$3.20',   pts: '+32 pts',  color: 'text-eco-700' },
  { id: 'TXN-0034', date: '05 May 2025', type: 'debit',    category: 'withdraw',  desc: 'Bank withdrawal',             amount: '-$15.00',  pts: '',         color: 'text-red-600' },
  { id: 'TXN-0033', date: '29 Apr 2025', type: 'credit',   category: 'referral',  desc: 'Referral bonus — James T.',   amount: '+$5.00',   pts: '',         color: 'text-eco-700' },
  { id: 'TXN-0032', date: '21 Apr 2025', type: 'credit',   category: 'deposit',   desc: 'Deposit — Surry Hills Hub',   amount: '+$6.20',   pts: '+62 pts',  color: 'text-eco-700' },
]

const TABS = ['All', 'Credits', 'Debits', 'Transfers', 'Referrals']

const ICON_MAP = {
  credit:   { icon: ArrowDownLeft,  bg: 'bg-eco-50',    text: 'text-eco-700' },
  debit:    { icon: ArrowUpRight,   bg: 'bg-red-50',    text: 'text-red-600' },
  transfer: { icon: ArrowLeftRight, bg: 'bg-amber-50',  text: 'text-amber-600' },
  referral: { icon: Gift,           bg: 'bg-blue-50',   text: 'text-blue-600' },
}

export default function Transactions() {
  const [tab,    setTab]    = useState('All')
  const [search, setSearch] = useState('')

  const filtered = ALL_TXN.filter(t => {
    const matchTab =
      tab === 'All'       ? true :
      tab === 'Credits'   ? t.type === 'credit' && t.category !== 'referral' :
      tab === 'Debits'    ? t.type === 'debit' :
      tab === 'Transfers' ? t.type === 'transfer' :
      tab === 'Referrals' ? t.category === 'referral' : true
    const matchSearch = t.desc.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Full history of your wallet activity.</p>
        </div>
        <button className="flex items-center gap-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-slate-300 transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search transactions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 min-w-max px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
        {filtered.length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-slate-400">No transactions found.</div>
        )}
        {filtered.map(t => {
          const kind = t.category === 'referral' ? 'referral' : t.type
          const { icon: Icon, bg, text } = ICON_MAP[kind] || ICON_MAP.credit
          return (
            <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{t.desc}</div>
                <div className="text-xs text-slate-400">{t.id} · {t.date}</div>
              </div>
              <div className="text-right flex-shrink-0">
                {t.amount && (
                  <div className={`text-sm font-bold ${t.color}`}>{t.amount}</div>
                )}
                {t.pts && (
                  <div className="text-xs text-slate-500">{t.pts}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-400 text-center">Showing {filtered.length} of {ALL_TXN.length} transactions</p>
    </div>
  )
}
