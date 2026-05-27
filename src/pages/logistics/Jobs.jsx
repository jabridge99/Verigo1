import React, { useState, useMemo } from 'react'
import {
  Package, Search, Plus, AlertTriangle, CheckCircle, Clock, Truck,
  MapPin, X, User, ChevronRight, Zap, Calendar,
} from 'lucide-react'
import { JOBS, CONTRACTORS } from '../../data/woms'

const STATUS_STYLE = {
  Pending:      { badge: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400',   icon: Clock },
  Assigned:     { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',    icon: User },
  'In Progress':{ badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   icon: Truck },
  Completed:    { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500',  icon: CheckCircle },
  Verified:     { badge: 'bg-eco-100 text-eco-700',       dot: 'bg-eco-500',     icon: CheckCircle },
}

const PRIORITY_STYLE = {
  High:   'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low:    'bg-slate-100 text-slate-500',
}

const RISK_STYLE = {
  Low:    'text-eco-600',
  Medium: 'text-amber-600',
  High:   'text-red-600',
}

const TRIGGER_ICON = {
  'IoT:':      Zap,
  'Schedule:': Calendar,
  'Alert:':    AlertTriangle,
}

const AVAILABLE = CONTRACTORS.filter(c => c.status === 'Available')

function AssignModal({ job, onClose, onAssign }) {
  const [selected, setSelected] = useState(null)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Assign Contractor</h3>
            <p className="text-xs text-slate-400 mt-0.5">{job.job_id} · {job.station_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 mb-3">{AVAILABLE.length} contractors available</p>
          {AVAILABLE.map(c => (
            <button
              key={c.contractor_id}
              onClick={() => setSelected(c)}
              className={`w-full flex items-start gap-3 rounded-xl p-3 border text-left transition-all ${
                selected?.contractor_id === c.contractor_id
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-100 hover:border-slate-200 bg-slate-50'
              }`}
            >
              <div className="w-9 h-9 bg-white rounded-xl border border-slate-200 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-slate-600">{c.driver.split(' ').map(n => n[0]).join('')}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-eco-500" />
                  <span className="text-[11px] text-eco-600 font-semibold">Available</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{c.driver} · {c.vehicle}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-slate-600">★ {c.rating}</span>
                  <span className="text-[11px] text-slate-400">{c.on_time_rate}% on-time</span>
                  <span className="text-[11px] font-semibold text-eco-700">${c.cost_per_job.toFixed(2)}/job</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={() => { onAssign(job, selected); onClose() }}
            className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            {selected ? `Assign ${selected.driver.split(' ')[0]}` : 'Select Contractor'}
          </button>
        </div>
      </div>
    </div>
  )
}

function JobCard({ job, onAssign }) {
  const s = STATUS_STYLE[job.status]
  const Icon = s.icon
  const triggerPrefix = Object.keys(TRIGGER_ICON).find(k => job.trigger.startsWith(k))
  const TriggerIcon = TRIGGER_ICON[triggerPrefix] || Package
  const contractor = CONTRACTORS.find(c => c.contractor_id === job.assigned_contractor)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-amber-100 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            job.status === 'In Progress' ? 'bg-amber-100' :
            job.status === 'Verified' ? 'bg-eco-100' : 'bg-slate-100'
          }`}>
            <Icon className={`w-4 h-4 ${
              job.status === 'In Progress' ? 'text-amber-600' :
              job.status === 'Verified' ? 'text-eco-600' : 'text-slate-500'
            }`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">{job.station_name}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.badge}`}>{job.status}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_STYLE[job.priority]}`}>{job.priority}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{job.address}</p>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400 flex-shrink-0">{job.job_id}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Est. Weight</p>
          <p className="font-semibold text-slate-700">{job.estimated_weight_kg > 0 ? `${job.estimated_weight_kg} kg` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Est. Value</p>
          <p className="font-bold text-eco-700">{job.estimated_value > 0 ? `$${job.estimated_value.toFixed(2)}` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Contamination</p>
          <p className={`font-semibold ${RISK_STYLE[job.contamination_risk]}`}>{job.contamination_risk} Risk</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Pickup Window</p>
          <p className="font-semibold text-slate-700">
            {new Date(job.pickup_window.start).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-lg ${
          triggerPrefix === 'IoT:' ? 'bg-blue-50 text-blue-600' :
          triggerPrefix === 'Alert:' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'
        }`}>
          <TriggerIcon className="w-3 h-3" />
          <span className="font-medium">{job.trigger}</span>
        </div>
        {contractor && (
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Truck className="w-3 h-3" />
            <span>{contractor.driver}</span>
          </div>
        )}
      </div>

      {(job.status === 'Pending' || job.status === 'Assigned') && (
        <div className="mt-4 flex gap-2">
          {job.status === 'Pending' && (
            <button
              onClick={() => onAssign(job)}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" /> Assign Contractor
            </button>
          )}
          <button className="px-4 py-2 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1">
            Details <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function JobEngine() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [assignTarget, setAssignTarget] = useState(null)

  const filtered = useMemo(() => {
    return JOBS.filter(j => {
      const matchStatus = statusFilter === 'all' || j.status === statusFilter
      const matchPriority = priorityFilter === 'all' || j.priority === priorityFilter
      const matchQuery =
        j.station_name.toLowerCase().includes(query.toLowerCase()) ||
        j.job_id.toLowerCase().includes(query.toLowerCase()) ||
        j.address.toLowerCase().includes(query.toLowerCase())
      return matchStatus && matchPriority && matchQuery
    })
  }, [query, statusFilter, priorityFilter])

  const counts = Object.fromEntries(
    ['Pending', 'Assigned', 'In Progress', 'Completed', 'Verified'].map(s => [
      s, JOBS.filter(j => j.status === s).length,
    ])
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Collection Job Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Recovery Logistics Network · {JOBS.length} jobs in system
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <Plus className="w-4 h-4" /> Create Job
        </button>
      </div>

      {/* Pipeline summary */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Object.entries(counts).map(([status, count]) => {
          const s = STATUS_STYLE[status]
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold flex-shrink-0 transition-all ${
                statusFilter === status
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === status ? 'bg-white' : s.dot}`} />
              {status}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusFilter === status ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Search + priority filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search station, job ID or address…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'High', 'Medium', 'Low'].map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border capitalize transition-colors ${
                priorityFilter === p
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
              }`}
            >
              {p === 'all' ? 'All Priority' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No jobs match your filters.</p>
          </div>
        ) : (
          filtered.map(j => (
            <JobCard key={j.job_id} job={j} onAssign={setAssignTarget} />
          ))
        )}
      </div>

      {assignTarget && (
        <AssignModal
          job={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssign={() => {}}
        />
      )}
    </div>
  )
}
