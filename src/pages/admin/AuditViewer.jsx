import React, { useState, useMemo, useEffect } from 'react'
import { Shield, ChevronDown, ChevronRight, Download, Lock, Hash, Filter, X } from 'lucide-react'
import { AUDIT_LOG, ROLES_CONFIG } from '../../data/override'
import { auditLog } from '../../lib/audit'

function normalizeLiveEntry(e) {
  return {
    id:          String(e.id),
    ts:          e.ts,
    actor:       e.actor ?? 'system',
    role:        'system',
    action:      e.action,
    entity_type: e.entityType ?? 'pricing',
    entity_id:   e.entityId ?? null,
    summary:     e.after?.rationale ?? e.after?.reason ?? e.action,
    ip:          '—',
    hash:        e.hash ?? '',
    before:      e.before ?? null,
    after:       e.after ?? null,
    note:        null,
    flag:        null,
    _live:       true,
  }
}

const ACTION_COLORS = {
  propose_override:    'bg-violet-100 text-violet-700',
  approve_override:    'bg-eco-100 text-eco-700',
  reject_override:     'bg-red-100 text-red-700',
  rollback_override:   'bg-amber-100 text-amber-700',
  activate_override:   'bg-eco-100 text-eco-700',
  create_campaign:     'bg-indigo-100 text-indigo-700',
  approve_campaign:    'bg-eco-100 text-eco-700',
  emergency_freeze:    'bg-red-200 text-red-800',
  lift_freeze:         'bg-eco-100 text-eco-700',
  view_simulation:     'bg-slate-100 text-slate-600',
  update_override:     'bg-violet-100 text-violet-700',
  export_audit:        'bg-slate-100 text-slate-600',
}

const ROLE_COLORS = {
  analyst:             'bg-sky-100 text-sky-700',
  pricing_manager:     'bg-violet-100 text-violet-700',
  commercial_director: 'bg-amber-100 text-amber-700',
  audit_viewer:        'bg-slate-100 text-slate-600',
}

function formatTs(ts) {
  const d = new Date(ts)
  return d.toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function DiffBlock({ before, after }) {
  if (!before && !after) return <p className="text-xs text-slate-400 italic">No state change recorded</p>
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]))
  return (
    <div className="grid grid-cols-2 gap-3 mt-2">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Before</p>
        <div className="bg-slate-900 rounded-lg p-3 space-y-1">
          {before ? keys.map(k => (
            <div key={k} className="flex justify-between gap-2 text-xs">
              <span className="text-slate-400 font-mono">{k}</span>
              <span className={`font-mono font-semibold ${after && after[k] !== before[k] ? 'text-red-400' : 'text-slate-300'}`}>
                {String(before[k])}
              </span>
            </div>
          )) : <p className="text-xs text-slate-500 italic">—</p>}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">After</p>
        <div className="bg-slate-900 rounded-lg p-3 space-y-1">
          {after ? keys.map(k => (
            <div key={k} className="flex justify-between gap-2 text-xs">
              <span className="text-slate-400 font-mono">{k}</span>
              <span className={`font-mono font-semibold ${before && after[k] !== before[k] ? 'text-eco-400' : 'text-slate-300'}`}>
                {String(after[k])}
              </span>
            </div>
          )) : <p className="text-xs text-slate-500 italic">—</p>}
        </div>
      </div>
    </div>
  )
}

function AuditRow({ entry }) {
  const [expanded, setExpanded] = useState(false)
  const actionColor = ACTION_COLORS[entry.action] || 'bg-slate-100 text-slate-600'
  const roleColor   = ROLE_COLORS[entry.role]    || 'bg-slate-100 text-slate-500'

  return (
    <>
      <tr
        className={`border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer transition-colors ${expanded ? 'bg-slate-50' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3 w-4">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
        </td>
        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">{formatTs(entry.ts)}</td>
        <td className="px-3 py-3">
          <p className="text-sm font-semibold text-slate-800">{entry.actor}</p>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${roleColor}`}>{entry.role.replace('_', ' ')}</span>
        </td>
        <td className="px-3 py-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${actionColor}`}>
            {entry.action.replace(/_/g, ' ')}
          </span>
        </td>
        <td className="px-3 py-3 text-xs font-mono text-violet-700">{entry.entity_id || '—'}</td>
        <td className="px-3 py-3 text-sm text-slate-600 max-w-xs">
          <p className="truncate">{entry.summary}</p>
          {entry.flag && <p className="text-[10px] font-bold text-red-600 mt-0.5">⚑ {entry.flag.replace(/_/g, ' ')}</p>}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-300 flex-shrink-0" />
            <span className="text-[9px] font-mono text-slate-300 truncate max-w-[80px]" title={entry.hash}>
              {entry.hash.slice(0, 10)}…
            </span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-100">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Audit ID</p>
                  <p className="font-mono text-violet-700 font-bold">{entry.id}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">IP Address</p>
                  <p className="font-mono text-slate-600">{entry.ip}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Entity Type</p>
                  <p className="font-semibold text-slate-700 capitalize">{entry.entity_type?.replace(/_/g, ' ') || '—'}</p>
                </div>
                {entry.note && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold mb-0.5">Note</p>
                    <p className="text-slate-600 italic">{entry.note}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1.5">
                  <Hash className="w-3 h-3" /> SHA-256 Hash (integrity proof)
                </p>
                <p className="font-mono text-[11px] text-slate-500 bg-slate-100 rounded px-3 py-1.5 break-all">{entry.hash}</p>
              </div>

              <DiffBlock before={entry.before} after={entry.after} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function exportCSV(entries) {
  const cols = ['id', 'ts', 'actor', 'role', 'action', 'entity_type', 'entity_id', 'summary', 'ip', 'hash']
  const header = cols.join(',')
  const rows = entries.map(e =>
    cols.map(c => `"${String(e[c] ?? '').replace(/"/g, '""')}"`).join(',')
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-export-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportJSON(entries) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-export-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AuditViewer() {
  const [role, setRole]           = useState('commercial_director')
  const [filterActor, setFA]      = useState('')
  const [filterRole, setFR]       = useState('')
  const [filterAction, setFAct]   = useState('')
  const [filterEntity, setFE]     = useState('')
  const [showFilters, setFilters] = useState(false)
  const [liveEntries, setLive]    = useState([])

  useEffect(() => {
    function refresh() {
      const raw = auditLog.query({ limit: 200 })
      setLive(raw.map(normalizeLiveEntry))
    }
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [])

  const merged = useMemo(() => {
    const combined = [...liveEntries, ...AUDIT_LOG]
    combined.sort((a, b) => (b.ts > a.ts ? 1 : -1))
    return combined
  }, [liveEntries])

  const roleConfig = ROLES_CONFIG[role]
  const canExport  = roleConfig?.can.includes('export_audit')
  const totalCount = auditLog.length + AUDIT_LOG.length

  const uniqueActors  = useMemo(() => [...new Set(merged.map(e => e.actor))], [merged])
  const uniqueRoles   = useMemo(() => [...new Set(merged.map(e => e.role))],  [merged])
  const uniqueActions = useMemo(() => [...new Set(merged.map(e => e.action))],[merged])

  const filtered = useMemo(() => {
    return merged.filter(e => {
      if (filterActor  && e.actor  !== filterActor)  return false
      if (filterRole   && e.role   !== filterRole)   return false
      if (filterAction && e.action !== filterAction) return false
      if (filterEntity && !e.entity_id?.toLowerCase().includes(filterEntity.toLowerCase())) return false
      return true
    })
  }, [merged, filterActor, filterRole, filterAction, filterEntity])

  const hasFilters = filterActor || filterRole || filterAction || filterEntity
  const setFilterActor  = setFA
  const setFilterRole   = setFR
  const setFilterAction = setFAct
  const setFilterEntity = setFE
  const setShowFilters  = setFilters

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
          <p className="text-sm text-slate-500 mt-0.5">Immutable, append-only record of all pricing decisions</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={role} onChange={e => setRole(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-400"
          >
            {Object.keys(ROLES_CONFIG).map(r => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Immutability notice */}
      <div className="flex items-start gap-3 bg-slate-900 text-white rounded-2xl px-5 py-4">
        <Shield className="w-5 h-5 text-eco-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-white">Append-Only Ledger — Tamper-Evident</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Every entry is hashed with SHA-256 and cannot be modified or deleted. Any change to historical data
            would invalidate the hash chain. This log is admissible as audit evidence.
          </p>
        </div>
        <div className="ml-auto text-right flex-shrink-0">
          <p className="text-xl font-bold text-eco-400">{totalCount}</p>
          <p className="text-[10px] text-slate-400">Total entries</p>
          {auditLog.length > 0 && (
            <p className="text-[9px] text-eco-400 mt-0.5">{auditLog.length} live</p>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Overrides Proposed',  value: merged.filter(e => e.action === 'propose_override' || e.action === 'pricing.override.applied').length,  color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Overrides Approved',  value: merged.filter(e => e.action === 'approve_override' || e.action === 'pricing.override.applied').length,  color: 'text-eco-700',    bg: 'bg-eco-50' },
          { label: 'Overrides Rejected',  value: merged.filter(e => e.action === 'reject_override'  || e.action === 'pricing.override.cleared').length,  color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'Emergency Freezes',   value: merged.filter(e => e.action === 'emergency_freeze').length,                                              color: 'text-red-700',    bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-violet-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasFilters && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">active</span>
            )}
          </button>
          <div className="flex items-center gap-2 ml-auto">
            {hasFilters && (
              <button
                onClick={() => { setFilterActor(''); setFilterRole(''); setFilterAction(''); setFilterEntity('') }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
            {canExport ? (
              <div className="flex gap-2">
                <button
                  onClick={() => exportCSV(filtered)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={() => exportJSON(filtered)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> JSON
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Lock className="w-3.5 h-3.5" /> Export requires audit_viewer or director role
              </div>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-50 pt-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Actor</label>
              <select
                value={filterActor} onChange={e => setFilterActor(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="">All actors</option>
                {uniqueActors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Role</label>
              <select
                value={filterRole} onChange={e => setFilterRole(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="">All roles</option>
                {uniqueRoles.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Action</label>
              <select
                value={filterAction} onChange={e => setFilterAction(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                <option value="">All actions</option>
                {uniqueActions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Entity ID</label>
              <input
                type="text"
                value={filterEntity}
                onChange={e => setFilterEntity(e.target.value)}
                placeholder="e.g. OVR-0041"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Audit table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 bg-slate-900 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">Audit Log</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {filtered.length} of {totalCount} entries — sorted newest first
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-eco-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-slate-400 font-semibold">LIVE</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-400">No audit entries match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="w-4 px-4 py-3" />
                  <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase whitespace-nowrap">Timestamp</th>
                  <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Actor / Role</th>
                  <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Action</th>
                  <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Entity</th>
                  <th className="text-left px-3 py-3 text-[10px] text-slate-400 font-semibold uppercase">Summary</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-400 font-semibold uppercase hidden lg:table-cell">Hash</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 border-t border-slate-50 bg-slate-50">
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            This log is read-only and append-only. Entries cannot be edited, deleted, or reordered.
            SHA-256 hashes ensure integrity. Exported for compliance reporting.
          </p>
        </div>
      </div>
    </div>
  )
}
