import React, { useState, useMemo } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Gift,
  Search, Download, Filter, X, ChevronDown, Clock,
  Banknote, RefreshCw, Zap, Home, Shield
} from 'lucide-react'

// ─── Transaction data (25 transactions across ~3 months) ─────────────────────

const ALL_TXN = [
  // May 2025
  {
    id: 'TXN-0041', date: '2025-05-27', type: 'credit', category: 'deposit',
    desc: 'Deposit — Surry Hills Hub', amount: 5.40, pts: 54,
    balance: 36.10, note: '12 aluminium cans, 8 PET bottles',
  },
  {
    id: 'TXN-0040', date: '2025-05-24', type: 'debit', category: 'withdrawal',
    desc: 'Bank withdrawal', amount: -20.00, pts: 0,
    balance: 30.70, note: 'Transfer to BSB 062-000 · ****4421',
  },
  {
    id: 'TXN-0039', date: '2025-05-22', type: 'credit', category: 'referral',
    desc: 'Referral bonus — Priya K.', amount: 5.00, pts: 50,
    balance: 50.70, note: 'Friend joined and completed first pickup',
  },
  {
    id: 'TXN-0038', date: '2025-05-19', type: 'credit', category: 'deposit',
    desc: 'Deposit — Redfern Node', amount: 8.80, pts: 88,
    balance: 45.70, note: '3.2 kg aluminium, 1.8 kg PET',
  },
  {
    id: 'TXN-0037', date: '2025-05-15', type: 'debit', category: 'transfer',
    desc: 'Household transfer → James T.', amount: -10.00, pts: 0,
    balance: 36.90, note: 'Split from joint collection',
  },
  {
    id: 'TXN-0036', date: '2025-05-13', type: 'debit', category: 'reward',
    desc: 'Reward redemption — Bamboo Kit', amount: 0, pts: -200,
    balance: 46.90, note: 'Eco store order #ECO-8812',
  },
  {
    id: 'TXN-0035', date: '2025-05-10', type: 'credit', category: 'deposit',
    desc: 'Deposit — Newtown Green Node', amount: 3.20, pts: 32,
    balance: 46.90, note: '6 glass bottles, 4 cardboard kg',
  },
  {
    id: 'TXN-0034', date: '2025-05-05', type: 'debit', category: 'withdrawal',
    desc: 'Bank withdrawal', amount: -15.00, pts: 0,
    balance: 43.70, note: 'Transfer to BSB 062-000 · ****4421',
  },
  {
    id: 'TXN-0033', date: '2025-05-02', type: 'credit', category: 'deposit',
    desc: 'Pickup Booking — Glebe Rd', amount: 6.80, pts: 68,
    balance: 58.70, note: 'Scheduled pickup completed',
  },
  // April 2025
  {
    id: 'TXN-0032', date: '2025-04-29', type: 'credit', category: 'referral',
    desc: 'Referral bonus — James T.', amount: 5.00, pts: 50,
    balance: 51.90, note: 'Friend joined and completed first pickup',
  },
  {
    id: 'TXN-0031', date: '2025-04-25', type: 'credit', category: 'deposit',
    desc: 'Deposit — Surry Hills Hub', amount: 6.20, pts: 62,
    balance: 46.90, note: '2.8 kg aluminium, 1.4 kg steel',
  },
  {
    id: 'TXN-0030', date: '2025-04-21', type: 'debit', category: 'hold',
    desc: 'Payout hold — verification pending', amount: -8.00, pts: 0,
    balance: 40.70, note: 'Standard 48-hour verification hold',
  },
  {
    id: 'TXN-0029', date: '2025-04-18', type: 'credit', category: 'reward',
    desc: 'Eco Reward — Bonus Points Event', amount: 0, pts: 100,
    balance: 48.70, note: 'Earth Month promotion',
  },
  {
    id: 'TXN-0028', date: '2025-04-15', type: 'credit', category: 'deposit',
    desc: 'Deposit — Marrickville Hub', amount: 9.40, pts: 94,
    balance: 48.70, note: '4.1 kg aluminium, 2.2 kg PET, 1 kg glass',
  },
  {
    id: 'TXN-0027', date: '2025-04-10', type: 'debit', category: 'fee',
    desc: 'Pickup booking fee', amount: -1.50, pts: 0,
    balance: 39.30, note: 'Express booking surcharge',
  },
  {
    id: 'TXN-0026', date: '2025-04-07', type: 'credit', category: 'deposit',
    desc: 'Pickup Booking — Chippendale', amount: 7.60, pts: 76,
    balance: 40.80, note: 'Scheduled pickup — 3.4 kg mixed',
  },
  {
    id: 'TXN-0025', date: '2025-04-02', type: 'debit', category: 'withdrawal',
    desc: 'Bank withdrawal', amount: -25.00, pts: 0,
    balance: 33.20, note: 'Transfer to BSB 062-000 · ****4421',
  },
  // March 2025
  {
    id: 'TXN-0024', date: '2025-03-28', type: 'credit', category: 'referral',
    desc: 'Referral bonus — Mia L.', amount: 5.00, pts: 50,
    balance: 58.20, note: 'Friend completed first verified pickup',
  },
  {
    id: 'TXN-0023', date: '2025-03-24', type: 'credit', category: 'deposit',
    desc: 'Deposit — Newtown Green Node', amount: 11.20, pts: 112,
    balance: 53.20, note: '5.8 kg aluminium — monthly high',
  },
  {
    id: 'TXN-0022', date: '2025-03-19', type: 'credit', category: 'reward',
    desc: 'Tier Bonus — Silver milestone', amount: 2.00, pts: 200,
    balance: 42.00, note: 'Reached 1,000 points — Silver unlocked',
  },
  {
    id: 'TXN-0021', date: '2025-03-14', type: 'debit', category: 'transfer',
    desc: 'Household transfer → Sarah T.', amount: -5.00, pts: 0,
    balance: 40.00, note: 'Shared household account split',
  },
  {
    id: 'TXN-0020', date: '2025-03-10', type: 'credit', category: 'deposit',
    desc: 'Deposit — Redfern Node', amount: 8.10, pts: 81,
    balance: 45.00, note: '3.6 kg aluminium, 2.0 kg PET',
  },
  {
    id: 'TXN-0019', date: '2025-03-05', type: 'debit', category: 'withdrawal',
    desc: 'Bank withdrawal', amount: -20.00, pts: 0,
    balance: 36.90, note: 'Transfer to BSB 062-000 · ****4421',
  },
  {
    id: 'TXN-0018', date: '2025-03-01', type: 'credit', category: 'deposit',
    desc: 'Pickup Booking — Broadway', amount: 5.90, pts: 59,
    balance: 56.90, note: 'Scheduled pickup completed, 2.6 kg',
  },
  {
    id: 'TXN-0017', date: '2025-02-25', type: 'debit', category: 'fee',
    desc: 'Pickup booking fee', amount: -1.50, pts: 0,
    balance: 51.00, note: 'Standard booking fee',
  },
]

// ─── Config ───────────────────────────────────────────────────────────────────

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, All: Infinity }

const CATEGORY_META = {
  deposit:    { label: 'Deposit',       icon: ArrowDownLeft,  bg: 'bg-eco-50',     text: 'text-eco-700',    tab: 'Deposits' },
  withdrawal: { label: 'Withdrawal',    icon: ArrowUpRight,   bg: 'bg-red-50',     text: 'text-red-600',    tab: 'Withdrawals' },
  referral:   { label: 'Referral',      icon: Gift,           bg: 'bg-blue-50',    text: 'text-blue-600',   tab: 'Referrals' },
  transfer:   { label: 'Transfer',      icon: ArrowLeftRight, bg: 'bg-amber-50',   text: 'text-amber-600',  tab: 'Transfers' },
  reward:     { label: 'Reward',        icon: Zap,            bg: 'bg-purple-50',  text: 'text-purple-600', tab: 'Rewards' },
  hold:       { label: 'Hold',          icon: Clock,          bg: 'bg-slate-100',  text: 'text-slate-500',  tab: 'Other' },
  fee:        { label: 'Fee',           icon: Banknote,       bg: 'bg-orange-50',  text: 'text-orange-600', tab: 'Other' },
}

const FILTER_TABS = ['All', 'Deposits', 'Withdrawals', 'Referrals', 'Transfers', 'Rewards', 'Other']

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseDate(str) {
  return new Date(str)
}

function groupLabel(dateStr) {
  const now = new Date('2025-05-29')
  const d = parseDate(dateStr)
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff <= 7) return 'This Week'
  if (diff <= 31) return 'This Month'
  return 'Older'
}

function groupOrder(label) {
  return { Today: 0, Yesterday: 1, 'This Week': 2, 'This Month': 3, Older: 4 }[label] ?? 5
}

function fmtDate(str) {
  return new Date(str).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtAmt(amount, category) {
  if (category === 'reward' && amount === 0) return null
  if (amount === 0) return null
  const sign = amount > 0 ? '+' : ''
  return `${sign}$${Math.abs(amount).toFixed(2)}`
}

function amtColor(amount) {
  if (amount > 0) return 'text-eco-700'
  if (amount < 0) return 'text-red-600'
  return 'text-slate-400'
}

// ─── Toast ─────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState(null)
  const show = (msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }
  return { toast, show }
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-semibold flex items-center gap-2
      ${toast.type === 'success' ? 'bg-eco-600 text-white' : 'bg-slate-800 text-white'}`}>
      {toast.type === 'success' ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {toast.msg}
    </div>
  )
}

// ─── Summary stat chip ────────────────────────────────────────────────────────

function StatChip({ label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex-1 min-w-0">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5 truncate">{label}</div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

export default function Transactions() {
  const [periodKey, setPeriodKey]   = useState('90d')
  const [tab, setTab]               = useState('All')
  const [search, setSearch]         = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [page, setPage]             = useState(1)
  const { toast, show }             = useToast()

  const now = new Date('2025-05-29')

  // Filter by period
  const periodFiltered = useMemo(() => {
    const days = PERIOD_DAYS[periodKey]
    return ALL_TXN.filter(t => {
      const diff = Math.floor((now - parseDate(t.date)) / 86400000)
      return diff <= days
    })
  }, [periodKey])

  // Stats for summary bar
  const stats = useMemo(() => {
    let totalIn = 0, totalOut = 0, totalPts = 0
    periodFiltered.forEach(t => {
      if (t.amount > 0) totalIn += t.amount
      else if (t.amount < 0) totalOut += Math.abs(t.amount)
      if (t.pts > 0) totalPts += t.pts
    })
    return { totalIn, totalOut, net: totalIn - totalOut, totalPts }
  }, [periodFiltered])

  // Apply tab + search
  const filtered = useMemo(() => {
    return periodFiltered.filter(t => {
      const meta = CATEGORY_META[t.category]
      const matchTab =
        tab === 'All' ? true :
        (meta?.tab === tab)
      const q = search.toLowerCase()
      const matchSearch = !q ||
        t.desc.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [periodFiltered, tab, search])

  // Group
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(t => {
      const lbl = groupLabel(t.date)
      if (!map[lbl]) map[lbl] = []
      map[lbl].push(t)
    })
    return Object.entries(map).sort((a, b) => groupOrder(a[0]) - groupOrder(b[0]))
  }, [filtered])

  // Pagination
  const visible = useMemo(() => {
    let count = 0
    const out = []
    for (const [lbl, txns] of grouped) {
      const slice = txns.slice(0, Math.max(0, page * PAGE_SIZE - count))
      if (slice.length > 0) out.push([lbl, slice])
      count += txns.length
      if (count >= page * PAGE_SIZE) break
    }
    return out
  }, [grouped, page])

  const totalFiltered = filtered.length
  const shownCount = visible.reduce((s, [, ts]) => s + ts.length, 0)
  const hasMore = shownCount < totalFiltered

  function handleExport() {
    show('Generating export…', 'loading')
    setTimeout(() => show('Downloaded! Check your downloads folder.', 'success'), 1800)
  }

  function clearSearch() {
    setSearch('')
    setTab('All')
    setPeriodKey('90d')
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Full history of your EcoBin wallet activity</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-slate-300 hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Period filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-400 mr-1">Period:</span>
        {Object.keys(PERIOD_DAYS).map(k => (
          <button
            key={k}
            onClick={() => { setPeriodKey(k); setPage(1) }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              periodKey === k
                ? 'bg-eco-600 text-white border-eco-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {/* Summary stats bar */}
      <div className="flex gap-3 flex-wrap sm:flex-nowrap">
        <StatChip label="Total In" value={`+$${stats.totalIn.toFixed(2)}`} color="text-eco-700" />
        <StatChip label="Total Out" value={`-$${stats.totalOut.toFixed(2)}`} color="text-red-600" />
        <StatChip
          label="Net Balance"
          value={`${stats.net >= 0 ? '+' : ''}$${stats.net.toFixed(2)}`}
          color={stats.net >= 0 ? 'text-eco-700' : 'text-red-600'}
        />
        <StatChip label="Points Earned" value={`+${stats.totalPts} pts`} color="text-blue-600" />
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by description or ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-9 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilter(v => !v)}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
            showFilter ? 'border-eco-500 bg-eco-50 text-eco-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Type filter tabs (expandable) */}
      {showFilter && (
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
          {FILTER_TABS.map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1) }}
              className={`flex-1 min-w-max px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Active filters summary */}
      {(tab !== 'All' || search) && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Filters:</span>
          {tab !== 'All' && (
            <span className="flex items-center gap-1 bg-eco-50 text-eco-700 border border-eco-100 rounded-full px-2.5 py-1 font-semibold">
              {tab}
              <button onClick={() => setTab('All')}><X className="w-3 h-3" /></button>
            </span>
          )}
          {search && (
            <span className="flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2.5 py-1 font-semibold">
              "{search}"
              <button onClick={() => setSearch('')}><X className="w-3 h-3" /></button>
            </span>
          )}
          <button onClick={clearSearch} className="text-slate-400 hover:text-slate-600 ml-1">Clear all</button>
        </div>
      )}

      {/* Transaction list */}
      {totalFiltered === 0 ? (
        /* Empty state */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-base font-semibold text-slate-700">No transactions found</div>
          <p className="text-sm text-slate-400 text-center max-w-xs">
            Try adjusting your search or filters. All EcoBin wallet activity will appear here.
          </p>
          <button
            onClick={clearSearch}
            className="mt-2 px-4 py-2 bg-eco-600 text-white text-sm font-semibold rounded-xl hover:bg-eco-700 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(([groupLabel, txns]) => (
            <div key={groupLabel}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{groupLabel}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Transactions */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
                {txns.map(t => {
                  const meta = CATEGORY_META[t.category] || CATEGORY_META.deposit
                  const Icon = meta.icon
                  const displayAmt = fmtAmt(t.amount, t.category)
                  const displayPts = t.pts !== 0
                    ? `${t.pts > 0 ? '+' : ''}${t.pts} pts`
                    : null

                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                    >
                      {/* Icon */}
                      <div className={`w-9 h-9 ${meta.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${meta.text}`} />
                      </div>

                      {/* Description */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{t.desc}</div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <span className="font-mono">{t.id}</span>
                          <span>·</span>
                          <span>{fmtDate(t.date)}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${meta.bg} ${meta.text}`}>
                            {meta.label}
                          </span>
                        </div>
                        {t.note && (
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">{t.note}</div>
                        )}
                      </div>

                      {/* Amount + balance */}
                      <div className="text-right flex-shrink-0">
                        {displayAmt && (
                          <div className={`text-sm font-bold ${amtColor(t.amount)}`}>
                            {displayAmt}
                          </div>
                        )}
                        {displayPts && (
                          <div className={`text-xs font-semibold ${t.pts > 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                            {displayPts}
                          </div>
                        )}
                        {t.balance !== undefined && (
                          <div className="text-[10px] text-slate-300 mt-0.5">
                            bal ${t.balance.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore ? (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full py-3 text-sm font-semibold text-slate-500 border border-slate-200 rounded-2xl hover:border-slate-300 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <ChevronDown className="w-4 h-4" />
              Load more ({totalFiltered - shownCount} remaining)
            </button>
          ) : (
            <p className="text-xs text-slate-400 text-center py-2">
              Showing all {shownCount} of {totalFiltered} transaction{totalFiltered !== 1 ? 's' : ''}
              {tab !== 'All' || search ? ' (filtered)' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
