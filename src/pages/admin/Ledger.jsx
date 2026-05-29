import React, { useState, useMemo } from 'react'
import {
  BookOpen, Download, Filter, ChevronDown, CheckCircle, X,
  AlertTriangle, ArrowRight, Search, Calendar, RefreshCw,
} from 'lucide-react'
import { ledger, ACCOUNT_TYPE } from '../../lib/ledger'

// Map ledger account keys to display metadata
const ACCOUNTS = [
  { id: 'float_reserve',    name: 'Float Reserve',        code: '1500' },
  { id: 'wallet_pool',      name: 'Wallet Pool',          code: '1510' },
  { id: 'platform_fee',     name: 'Platform Fee Income',  code: '4000' },
  { id: 'marketplace_fee',  name: 'Marketplace Fee',      code: '4010' },
  { id: 'operator_payable', name: 'Operator Payable',     code: '2100' },
  { id: 'consumer_payable', name: 'Consumer Payable',     code: '2200' },
  { id: 'fraud_hold',       name: 'Fraud Holds',          code: '2300' },
  { id: 'logistics_cost',   name: 'Logistics Cost',       code: '5100' },
]

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
  const [activeAccount, setActiveAccount] = useState('float_reserve')
  const [filterRecon, setFilterRecon]     = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const [filterMinAmt,   setFilterMinAmt]   = useState('')
  const [showFilters,    setShowFilters]     = useState(false)

  // Live ledger data
  const tb = ledger.trialBalance()
  const totalAssets      = ledger.balance('float_reserve') + ledger.balance('wallet_pool')
  const totalLiabilities = ledger.balance('operator_payable') + ledger.balance('consumer_payable') + ledger.balance('fraud_hold')
  const equity           = Math.round((totalAssets - totalLiabilities) * 100) / 100

  // Get statement entries for the active account (last 100)
  const statementRows = useMemo(() => ledger.statement(activeAccount, 100), [activeAccount])

  // Filter the statement rows
  const filtered = useMemo(() => {
    return statementRows.filter(e => {
      const line = e.lines.find(l => l.account === activeAccount)
      const isNormalSide = ['ASSET', 'EXPENSE'].includes(ACCOUNT_TYPE[activeAccount])
      const debit  = line?.side === 'debit'  ? line.amount : 0
      const credit = line?.side === 'credit' ? line.amount : 0
      const date = e.timestamp.slice(0, 10)

      if (filterDateFrom && date < filterDateFrom) return false
      if (filterDateTo   && date > filterDateTo)   return false
      if (filterMinAmt) {
        const amt = Math.max(debit, credit)
        if (amt < parseFloat(filterMinAmt)) return false
      }
      return true
    })
  }, [statementRows, activeAccount, filterDateFrom, filterDateTo, filterMinAmt])

  // Build account summary from ledger
  const accountBalance = ledger.balance(activeAccount)
  const acctEntries    = ledger.query({ account: activeAccount, limit: 200 })
  const acctDebits     = acctEntries.reduce((s, e) => {
    const l = e.lines.find(l => l.account === activeAccount)
    return s + (l?.side === 'debit' ? l.amount : 0)
  }, 0)
  const acctCredits    = acctEntries.reduce((s, e) => {
    const l = e.lines.find(l => l.account === activeAccount)
    return s + (l?.side === 'credit' ? l.amount : 0)
  }, 0)
  const summary = {
    openingBalance: 0,
    closingBalance: accountBalance,
    totalDebits:    Math.round(acctDebits  * 100) / 100,
    totalCredits:   Math.round(acctCredits * 100) / 100,
  }

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
        <SummaryCard label="Total Assets"      value={fmtBalance(totalAssets)}      color="text-slate-800" />
        <SummaryCard label="Total Liabilities" value={fmtBalance(totalLiabilities)} color="text-red-600"   />
        <SummaryCard label="Equity"            value={fmtBalance(equity)}           color="text-violet-700" />
        <SummaryCard
          label="Trial Balance"
          value={tb.balanced ? 'Balanced' : 'Mismatch'}
          sub={`${ledger.entryCount} journal entries`}
          color={tb.balanced ? 'text-emerald-600' : 'text-red-600'}
          bg={tb.balanced ? 'bg-white' : 'bg-red-50'}
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
              {filtered.map(entry => {
                const line = entry.lines.find(l => l.account === activeAccount)
                const debit  = line?.side === 'debit'  ? line.amount : 0
                const credit = line?.side === 'credit' ? line.amount : 0
                const date   = entry.timestamp.slice(0, 10)
                return (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap font-mono">{date}</td>
                    <td className="px-3 py-3.5">
                      <span className="text-xs font-mono text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md">{entry.id}</span>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-slate-700 max-w-xs">
                      <span className="truncate block">{entry.description}</span>
                    </td>
                    <td className="px-3 py-3.5 text-right text-xs font-semibold text-red-600 tabular-nums">
                      {debit > 0 ? fmt(debit) : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-3 py-3.5 text-right text-xs font-semibold text-violet-600 tabular-nums">
                      {credit > 0 ? fmt(credit) : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-3 py-3.5 text-right text-xs font-bold text-slate-800 tabular-nums">
                      {fmtBalance(entry.balance)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <CheckCircle className="w-4 h-4 text-emerald-500 inline-block" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={3} className="px-5 py-3 text-xs font-bold text-slate-700">Period Totals</td>
                <td className="px-3 py-3 text-right text-xs font-bold text-red-700 tabular-nums">
                  {fmtBalance(filtered.reduce((s, e) => {
                    const l = e.lines.find(l => l.account === activeAccount)
                    return s + (l?.side === 'debit' ? l.amount : 0)
                  }, 0))}
                </td>
                <td className="px-3 py-3 text-right text-xs font-bold text-violet-700 tabular-nums">
                  {fmtBalance(filtered.reduce((s, e) => {
                    const l = e.lines.find(l => l.account === activeAccount)
                    return s + (l?.side === 'credit' ? l.amount : 0)
                  }, 0))}
                </td>
                <td colSpan={2} className="px-5 py-3 text-right text-xs font-bold text-slate-800 tabular-nums">
                  {filtered.length > 0 ? fmtBalance(filtered[filtered.length - 1].balance) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Live ledger status bar */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <p className="text-xs text-slate-600">
            <span className="font-semibold">{ledger.entryCount} total journal entries</span> · trial balance is {tb.balanced ? 'balanced' : 'unbalanced'} · account balance: {fmtBalance(accountBalance)}
          </p>
        </div>
      </div>
    </div>
  )
}
