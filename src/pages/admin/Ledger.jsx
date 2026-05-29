import React, { useState, useMemo } from 'react'
import {
  BookOpen, Download, Filter, ChevronDown, CheckCircle, X,
  AlertTriangle, ArrowRight, Search, Calendar, RefreshCw,
} from 'lucide-react'

// ── Static data ──────────────────────────────────────────────────────────────

const ACCOUNTS = [
  { id: 'PLR', name: 'Platform Revenue',      code: '4000', normal: 'credit' },
  { id: 'OPP', name: 'Operator Payables',     code: '2100', normal: 'debit'  },
  { id: 'CWP', name: 'Consumer Wallet Pool',  code: '2200', normal: 'debit'  },
  { id: 'FLR', name: 'Float Reserve',         code: '1500', normal: 'debit'  },
  { id: 'FEE', name: 'Fee Income',            code: '4100', normal: 'credit' },
  { id: 'FRH', name: 'Fraud Holds',           code: '2300', normal: 'debit'  },
]

const ALL_ENTRIES = [
  { id: 'JE-00421', date: '2026-05-29', description: 'Consumer deposit — batch #D4821', account: 'CWP', debit: 18450.00,  credit: 0,        balance: 284910.50, reconciled: true  },
  { id: 'JE-00420', date: '2026-05-29', description: 'Platform fee collection — May W4', account: 'FEE', debit: 0,         credit: 3240.00,  balance: 48320.00,  reconciled: true  },
  { id: 'JE-00419', date: '2026-05-28', description: 'Operator settlement — GreenLoop Pty', account: 'OPP', debit: 12800.00, credit: 0,        balance: 96210.00,  reconciled: true  },
  { id: 'JE-00418', date: '2026-05-28', description: 'Float reserve top-up — auto', account: 'FLR', debit: 5000.00,  credit: 0,        balance: 142840.00, reconciled: true  },
  { id: 'JE-00417', date: '2026-05-28', description: 'Fraud hold — suspicious TXN TXN-9182', account: 'FRH', debit: 840.00,   credit: 0,        balance: 6720.00,   reconciled: false },
  { id: 'JE-00416', date: '2026-05-27', description: 'Consumer withdrawal — wallet payout', account: 'CWP', debit: 0,         credit: 2100.00,  balance: 266460.50, reconciled: true  },
  { id: 'JE-00415', date: '2026-05-27', description: 'Platform revenue — transaction fees', account: 'PLR', debit: 0,         credit: 9840.00,  balance: 318400.00, reconciled: true  },
  { id: 'JE-00414', date: '2026-05-27', description: 'Operator payable — EcoPartner QLD', account: 'OPP', debit: 8420.00,  credit: 0,        balance: 83410.00,  reconciled: true  },
  { id: 'JE-00413', date: '2026-05-26', description: 'Fraud hold release — TXN-8874 cleared', account: 'FRH', debit: 0,         credit: 420.00,   balance: 5880.00,   reconciled: false },
  { id: 'JE-00412', date: '2026-05-26', description: 'Consumer deposit — batch #D4810', account: 'CWP', debit: 22100.00, credit: 0,        balance: 268560.50, reconciled: true  },
  { id: 'JE-00411', date: '2026-05-26', description: 'Fee income — operator onboarding', account: 'FEE', debit: 0,         credit: 500.00,   balance: 45080.00,  reconciled: true  },
  { id: 'JE-00410', date: '2026-05-25', description: 'Float reserve drawdown — settlement shortfall', account: 'FLR', debit: 0,         credit: 2000.00,  balance: 137840.00, reconciled: false },
  { id: 'JE-00409', date: '2026-05-25', description: 'Operator settlement — WasteWorks NSW', account: 'OPP', debit: 15600.00, credit: 0,        balance: 74990.00,  reconciled: true  },
  { id: 'JE-00408', date: '2026-05-25', description: 'Platform revenue — monthly subscription', account: 'PLR', debit: 0,         credit: 4200.00,  balance: 308560.00, reconciled: true  },
  { id: 'JE-00407', date: '2026-05-24', description: 'Consumer wallet pool deposit — CRN bulk', account: 'CWP', debit: 31800.00, credit: 0,        balance: 246460.50, reconciled: true  },
  { id: 'JE-00406', date: '2026-05-24', description: 'Fraud hold — chargebank alert TXN-9041', account: 'FRH', debit: 1200.00,  credit: 0,        balance: 6300.00,   reconciled: false },
  { id: 'JE-00405', date: '2026-05-24', description: 'Fee income — recycler listing upgrade', account: 'FEE', debit: 0,         credit: 1800.00,  balance: 44580.00,  reconciled: true  },
  { id: 'JE-00404', date: '2026-05-23', description: 'Operator payable — NorthBin Co', account: 'OPP', debit: 9100.00,  credit: 0,        balance: 59390.00,  reconciled: true  },
  { id: 'JE-00403', date: '2026-05-23', description: 'Float reserve — regulatory top-up', account: 'FLR', debit: 10000.00, credit: 0,        balance: 139840.00, reconciled: true  },
  { id: 'JE-00402', date: '2026-05-22', description: 'Consumer withdrawal — mass payout W22', account: 'CWP', debit: 0,         credit: 8400.00,  balance: 214660.50, reconciled: true  },
  { id: 'JE-00401', date: '2026-05-22', description: 'Platform revenue — recycler commissions', account: 'PLR', debit: 0,         credit: 14200.00, balance: 304360.00, reconciled: true  },
  { id: 'JE-00400', date: '2026-05-21', description: 'Fraud hold escalation — TXN-8801 frozen', account: 'FRH', debit: 3200.00,  credit: 0,        balance: 5100.00,   reconciled: false },
  { id: 'JE-00399', date: '2026-05-21', description: 'Operator payable — CleanEarth VIC', account: 'OPP', debit: 7280.00,  credit: 0,        balance: 50290.00,  reconciled: true  },
  { id: 'JE-00398', date: '2026-05-20', description: 'Fee income — API integration fee', account: 'FEE', debit: 0,         credit: 2400.00,  balance: 42780.00,  reconciled: true  },
]

const ACCOUNT_SUMMARIES = {
  PLR: { openingBalance: 290120.00, closingBalance: 318400.00, totalDebits: 0,         totalCredits: 28280.00 },
  OPP: { openingBalance: 43010.00,  closingBalance: 96210.00,  totalDebits: 53200.00,  totalCredits: 0        },
  CWP: { openingBalance: 214660.50, closingBalance: 284910.50, totalDebits: 72350.00,  totalCredits: 10500.00 },
  FLR: { openingBalance: 129840.00, closingBalance: 142840.00, totalDebits: 15000.00,  totalCredits: 2000.00  },
  FEE: { openingBalance: 38180.00,  closingBalance: 48320.00,  totalDebits: 0,         totalCredits: 10140.00 },
  FRH: { openingBalance: 1900.00,   closingBalance: 6720.00,   totalDebits: 5240.00,   totalCredits: 420.00   },
}

const fmt = (n) => n === 0 ? '—' : '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBalance = (n) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color = 'text-slate-800', bg = 'bg-white' }) {
  return (
    <div className={`${bg} rounded-2xl border border-slate-100 shadow-sm p-5`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      <p className="text-xs font-semibold text-slate-500 mt-2">{label}</p>
    </div>
  )
}

function BalanceStrip({ summary }) {
  const closing = summary.openingBalance + summary.totalDebits - summary.totalCredits
  const steps = [
    { label: 'Opening Balance', value: summary.openingBalance, color: 'text-slate-700' },
    { label: '+ Debits',        value: summary.totalDebits,    color: 'text-red-600'   },
    { label: '− Credits',       value: summary.totalCredits,   color: 'text-violet-600' },
    { label: 'Closing Balance', value: closing,                color: 'text-slate-900'  },
  ]
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-wrap items-center gap-3">
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          <div className="text-center">
            <p className={`text-sm font-bold ${s.color}`}>{fmtBalance(s.value)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Ledger() {
  const [activeAccount, setActiveAccount] = useState('CWP')
  const [filterRecon, setFilterRecon]     = useState('all')   // all | reconciled | unreconciled
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const [filterMinAmt,   setFilterMinAmt]   = useState('')
  const [showFilters,    setShowFilters]     = useState(false)

  // Summary totals (all accounts)
  const totalAssets      = 142840.00 + 284910.50   // Float + CWP
  const totalLiabilities = 96210.00 + 6720.00      // OPP + FRH
  const equity           = totalAssets - totalLiabilities
  const unreconciledCount = ALL_ENTRIES.filter(e => !e.reconciled).length

  const filtered = useMemo(() => {
    return ALL_ENTRIES.filter(e => {
      if (e.account !== activeAccount) return false
      if (filterRecon === 'reconciled'   && !e.reconciled) return false
      if (filterRecon === 'unreconciled' &&  e.reconciled) return false
      if (filterDateFrom && e.date < filterDateFrom) return false
      if (filterDateTo   && e.date > filterDateTo)   return false
      if (filterMinAmt) {
        const amt = Math.max(e.debit, e.credit)
        if (amt < parseFloat(filterMinAmt)) return false
      }
      return true
    })
  }, [activeAccount, filterRecon, filterDateFrom, filterDateTo, filterMinAmt])

  const summary = ACCOUNT_SUMMARIES[activeAccount]
  const activeAccountName = ACCOUNTS.find(a => a.id === activeAccount)?.name

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">General Ledger</h1>
          <p className="text-sm text-slate-500 mt-0.5">Double-entry accounting · AUD · As at 29 May 2026</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors self-start">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Assets"       value={fmtBalance(totalAssets)}      color="text-slate-800" />
        <SummaryCard label="Total Liabilities"  value={fmtBalance(totalLiabilities)} color="text-red-600"   />
        <SummaryCard label="Equity"             value={fmtBalance(equity)}           color="text-violet-700" />
        <SummaryCard
          label="Unreconciled Items"
          value={unreconciledCount}
          color={unreconciledCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
          bg={unreconciledCount > 0 ? 'bg-amber-50' : 'bg-white'}
        />
      </div>

      {/* ── Account selector ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-2 flex-wrap">
          <BookOpen className="w-4 h-4 text-violet-600" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-2">Account</span>
          {ACCOUNTS.map(acc => (
            <button
              key={acc.id}
              onClick={() => setActiveAccount(acc.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeAccount === acc.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {acc.code} · {acc.name}
            </button>
          ))}
        </div>

        {/* Balance strip */}
        <div className="px-5 py-4">
          <BalanceStrip summary={summary} />
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Reconciliation filter */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
              {[
                { id: 'all',            label: 'All' },
                { id: 'reconciled',     label: 'Reconciled' },
                { id: 'unreconciled',   label: 'Unreconciled' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFilterRecon(opt.id)}
                  className={`px-3 py-1.5 transition-colors ${
                    filterRecon === opt.id ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >{opt.label}</button>
              ))}
            </div>

            <button
              onClick={() => setShowFilters(f => !f)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                showFilters ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" /> More Filters
              <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">{filtered.length} entries</span>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-50 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">Date From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">Date To</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">Min Amount (AUD)</label>
              <input
                type="number"
                placeholder="e.g. 1000"
                value={filterMinAmt}
                onChange={e => setFilterMinAmt(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-32 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <button
              onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterMinAmt('') }}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ── Ledger table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">{activeAccountName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Account {ACCOUNTS.find(a => a.id === activeAccount)?.code} · Double-entry view</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Date</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">TXN ID</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Description</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Debit (AUD)</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Credit (AUD)</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Running Balance</th>
                <th className="text-center px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Recon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No entries match the current filters.</td>
                </tr>
              )}
              {filtered.map(entry => (
                <tr
                  key={entry.id}
                  className={`transition-colors ${
                    !entry.reconciled
                      ? 'bg-amber-50/60 hover:bg-amber-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap font-mono">{entry.date}</td>
                  <td className="px-3 py-3.5">
                    <span className="text-xs font-mono text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md">{entry.id}</span>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-slate-700 max-w-xs">
                    <div className="flex items-center gap-1.5">
                      {!entry.reconciled && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                      <span className="truncate">{entry.description}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs font-semibold text-red-600 tabular-nums">
                    {entry.debit > 0 ? fmt(entry.debit) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs font-semibold text-violet-600 tabular-nums">
                    {entry.credit > 0 ? fmt(entry.credit) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="px-3 py-3.5 text-right text-xs font-bold text-slate-800 tabular-nums">
                    {fmtBalance(entry.balance)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {entry.reconciled
                      ? <CheckCircle className="w-4 h-4 text-emerald-500 inline-block" />
                      : <span className="text-amber-500 font-bold text-sm">✗</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={3} className="px-5 py-3 text-xs font-bold text-slate-700">Period Totals</td>
                <td className="px-3 py-3 text-right text-xs font-bold text-red-700 tabular-nums">
                  {fmtBalance(filtered.reduce((s, e) => s + e.debit, 0))}
                </td>
                <td className="px-3 py-3 text-right text-xs font-bold text-violet-700 tabular-nums">
                  {fmtBalance(filtered.reduce((s, e) => s + e.credit, 0))}
                </td>
                <td colSpan={2} className="px-5 py-3 text-right text-xs font-bold text-slate-800 tabular-nums">
                  {filtered.length > 0 ? fmtBalance(filtered[0].balance) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Unreconciled legend */}
        {filtered.some(e => !e.reconciled) && (
          <div className="px-5 py-3 border-t border-amber-100 bg-amber-50/50 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs text-amber-700">
              <span className="font-semibold">{filtered.filter(e => !e.reconciled).length} unreconciled entries</span> highlighted in amber — review and confirm before period close.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
