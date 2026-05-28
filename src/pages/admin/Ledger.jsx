import React, { useState } from 'react'
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, X } from 'lucide-react'
import { LEDGER_ACCOUNTS, LEDGER_ENTRIES } from '../../data/finance'

const TYPE_STYLE = {
  Asset:   { badge: 'bg-eco-100 text-eco-700',    dot: 'bg-eco-500' },
  Liability: { badge: 'bg-red-100 text-red-700',  dot: 'bg-red-500' },
  Income:  { badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  Expense: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
}

const STATUS_STYLE = {
  Posted:   'bg-eco-100 text-eco-700',
  Reversed: 'bg-red-100 text-red-700',
  Pending:  'bg-amber-100 text-amber-700',
}

function EntryModal({ entry, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Journal Entry</h3>
            <p className="text-xs text-slate-400 mt-0.5">{entry.id} · {entry.date}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-slate-700 font-medium">{entry.description}</p>
          <div className="bg-slate-50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2 text-[11px] text-slate-400 font-semibold uppercase">Account</th>
                  <th className="text-right px-4 py-2 text-[11px] text-slate-400 font-semibold uppercase">Dr</th>
                  <th className="text-right px-4 py-2 text-[11px] text-slate-400 font-semibold uppercase">Cr</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-700">{LEDGER_ACCOUNTS[entry.debit.account]?.name}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-800 text-right">${entry.debit.amount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-slate-300 text-right">—</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-xs text-slate-500 pl-8">{LEDGER_ACCOUNTS[entry.credit.account]?.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-300 text-right">—</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-800 text-right">${entry.credit.amount.toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-100">
                  <td className="px-4 py-2 text-xs font-bold text-slate-700">Total</td>
                  <td className="px-4 py-2 text-xs font-bold text-slate-800 text-right">${entry.debit.amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-xs font-bold text-slate-800 text-right">${entry.credit.amount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Balance check: {entry.debit.amount === entry.credit.amount ? '✓ Balanced' : '✗ Imbalanced'}</span>
            <span className={`px-1.5 py-0.5 rounded-full font-semibold ${STATUS_STYLE[entry.status]}`}>{entry.status}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const ACCOUNT_GROUPS = [
  { label: 'Assets', types: ['Asset'] },
  { label: 'Liabilities', types: ['Liability'] },
  { label: 'Income & Expense', types: ['Income', 'Expense'] },
]

export default function Ledger() {
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({ Assets: true, Liabilities: true, 'Income & Expense': true })

  const toggleGroup = (label) => setExpandedGroups(g => ({ ...g, [label]: !g[label] }))

  const accounts = Object.values(LEDGER_ACCOUNTS)
  const totalAssets     = accounts.filter(a => a.type === 'Asset').reduce((s, a) => s + a.balance, 0)
  const totalLiabs      = accounts.filter(a => a.type === 'Liability').reduce((s, a) => s + a.balance, 0)
  const totalIncome     = accounts.filter(a => a.type === 'Income').reduce((s, a) => s + a.balance, 0)
  const totalExpense    = accounts.filter(a => a.type === 'Expense').reduce((s, a) => s + a.balance, 0)
  const netPosition     = totalAssets - totalLiabs
  const isBalanced      = Math.abs(totalAssets - totalLiabs - (totalIncome - totalExpense)) < 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Double-Entry Ledger</h1>
        <p className="text-sm text-slate-500 mt-0.5">Chart of accounts · Journal entries · Trial balance</p>
      </div>

      {/* Trial balance summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">Trial Balance</h2>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isBalanced ? 'bg-eco-100 text-eco-700' : 'bg-red-100 text-red-700'}`}>
            {isBalanced ? '✓ Balanced' : '✗ Out of Balance'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Assets',    value: totalAssets,   color: 'text-eco-700' },
            { label: 'Total Liabilities', value: totalLiabs,  color: 'text-red-600' },
            { label: 'Total Income',    value: totalIncome,   color: 'text-violet-600' },
            { label: 'Total Expenses',  value: totalExpense,  color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label}>
              <p className={`text-lg font-bold ${s.color}`}>${s.value.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart of Accounts */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Chart of Accounts</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {ACCOUNT_GROUPS.map(group => {
            const groupAccounts = accounts.filter(a => group.types.includes(a.type))
            const groupTotal = groupAccounts.reduce((s, a) => s + a.balance, 0)
            const isOpen = expandedGroups[group.label]
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    <span className="text-sm font-bold text-slate-700">{group.label}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{groupAccounts.length} accounts</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">${groupTotal.toLocaleString()}</span>
                </button>
                {isOpen && groupAccounts.map(acc => {
                  const s = TYPE_STYLE[acc.type]
                  return (
                    <div key={acc.id} className="flex items-center gap-3 pl-11 pr-5 py-3 bg-slate-50/50">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 font-medium truncate">{acc.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{acc.id}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.badge}`}>{acc.type}</span>
                      <span className="text-sm font-bold text-slate-800 w-28 text-right">${acc.balance.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Journal Entries */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Journal Entries</h2>
          <span className="text-xs text-slate-400">{LEDGER_ENTRIES.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Journal</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Date</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden sm:table-cell">Description</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden md:table-cell">Debit</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase hidden md:table-cell">Credit</th>
                <th className="text-right px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Amount</th>
                <th className="text-center px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {LEDGER_ENTRIES.map(entry => (
                <tr
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-5 py-3 text-xs font-mono text-slate-600">{entry.id}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{entry.date}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 hidden sm:table-cell max-w-xs truncate">{entry.description}</td>
                  <td className="px-3 py-3 text-xs text-slate-500 hidden md:table-cell truncate max-w-[140px]">
                    {LEDGER_ACCOUNTS[entry.debit.account]?.name.split(' ').slice(0, 3).join(' ')}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500 hidden md:table-cell truncate max-w-[140px]">
                    {LEDGER_ACCOUNTS[entry.credit.account]?.name.split(' ').slice(0, 3).join(' ')}
                  </td>
                  <td className="px-5 py-3 text-xs font-bold text-slate-800 text-right">
                    ${entry.debit.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[entry.status]}`}>
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEntry && <EntryModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </div>
  )
}
