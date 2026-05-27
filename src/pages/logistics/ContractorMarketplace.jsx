import React, { useState } from 'react'
import {
  Star, Truck, CheckCircle, Clock, WifiOff, Search,
  MapPin, Award, Package, X, Zap,
} from 'lucide-react'
import { CONTRACTORS, JOBS } from '../../data/woms'

const STATUS_STYLE = {
  Available: { badge: 'bg-eco-100 text-eco-700',   dot: 'bg-eco-500',   ring: 'ring-eco-200' },
  'On Route': { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', ring: 'ring-amber-200' },
  Offline:   { badge: 'bg-red-100 text-red-700',    dot: 'bg-red-400',   ring: 'ring-red-200' },
}

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star
          key={n}
          className={`w-3 h-3 ${n <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`}
        />
      ))}
      <span className="text-xs font-semibold text-slate-600 ml-1">{rating}</span>
    </div>
  )
}

function DispatchModal({ contractor, onClose }) {
  const [selectedJob, setSelectedJob] = useState(null)
  const pendingJobs = JOBS.filter(j => j.status === 'Pending')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Dispatch Job</h3>
            <p className="text-xs text-slate-400 mt-0.5">{contractor.name} · {contractor.driver}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 mb-3">{pendingJobs.length} pending jobs available</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pendingJobs.map(j => (
              <button
                key={j.job_id}
                onClick={() => setSelectedJob(j)}
                className={`w-full text-left rounded-xl p-3 border transition-all ${
                  selectedJob?.job_id === j.job_id
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{j.station_name}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    j.priority === 'High' ? 'bg-red-100 text-red-700' :
                    j.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`}>{j.priority}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{j.job_id} · {j.address}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">~{j.estimated_weight_kg} kg · Est. ${j.estimated_value.toFixed(2)}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
          <button
            disabled={!selectedJob}
            className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            {selectedJob ? `Dispatch ${selectedJob.job_id}` : 'Select Job'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ContractorCard({ contractor, onDispatch }) {
  const s = STATUS_STYLE[contractor.status]
  const currentJob = contractor.current_job
    ? JOBS.find(j => j.job_id === contractor.current_job)
    : null

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all ${
      contractor.status === 'Available' ? 'border-eco-100 hover:border-eco-200' : 'border-slate-100'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`relative w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 ring-2 ${s.ring}`}>
          <span className="text-lg font-bold text-slate-600">
            {contractor.driver.split(' ').map(n => n[0]).join('')}
          </span>
          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${s.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900">{contractor.name}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.badge}`}>
              {contractor.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{contractor.driver} · {contractor.vehicle_type}</p>
          <Stars rating={contractor.rating} />
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-amber-700">${contractor.cost_per_job.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400">per job</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-50 rounded-xl p-2.5">
          <p className="text-sm font-bold text-slate-800">{contractor.completed_jobs}</p>
          <p className="text-[10px] text-slate-400 font-medium">Jobs Done</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-2.5">
          <p className={`text-sm font-bold ${contractor.on_time_rate >= 95 ? 'text-eco-600' : contractor.on_time_rate >= 90 ? 'text-amber-600' : 'text-red-600'}`}>
            {contractor.on_time_rate}%
          </p>
          <p className="text-[10px] text-slate-400 font-medium">On-Time</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-2.5">
          <p className="text-sm font-bold text-slate-800">{contractor.certifications.length}</p>
          <p className="text-[10px] text-slate-400 font-medium">Certs</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span>{contractor.coverage_area}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {contractor.certifications.map(c => (
            <span key={c} className="flex items-center gap-1 bg-eco-50 text-eco-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full">
              <Award className="w-2.5 h-2.5" />{c}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {contractor.specializations.map(s => (
            <span key={s} className="bg-slate-100 text-slate-500 text-[10px] font-medium px-1.5 py-0.5 rounded">
              {s}
            </span>
          ))}
        </div>
      </div>

      {currentJob && (
        <div className="mt-3 flex items-center gap-2 bg-amber-50 rounded-xl px-3 py-2 text-[11px] text-amber-700">
          <Truck className="w-3 h-3 flex-shrink-0" />
          <span className="font-medium">On route: {currentJob.station_name} ({currentJob.job_id})</span>
        </div>
      )}

      {contractor.status === 'Available' && (
        <button
          onClick={() => onDispatch(contractor)}
          className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" /> Dispatch Job
        </button>
      )}
    </div>
  )
}

export default function ContractorMarketplace() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('rating')
  const [query, setQuery] = useState('')
  const [dispatchTarget, setDispatchTarget] = useState(null)

  const filtered = [...CONTRACTORS]
    .filter(c => {
      const matchStatus = statusFilter === 'all' || c.status === statusFilter
      const matchQuery = c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.driver.toLowerCase().includes(query.toLowerCase()) ||
        c.coverage_area.toLowerCase().includes(query.toLowerCase())
      return matchStatus && matchQuery
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'cost') return a.cost_per_job - b.cost_per_job
      if (sortBy === 'on_time') return b.on_time_rate - a.on_time_rate
      return b.completed_jobs - a.completed_jobs
    })

  const available = CONTRACTORS.filter(c => c.status === 'Available').length
  const onRoute = CONTRACTORS.filter(c => c.status === 'On Route').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contractor Marketplace</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Recovery Logistics Network · {CONTRACTORS.length} contractors
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-eco-50 border border-eco-200 px-3 py-2 rounded-xl text-xs font-semibold text-eco-700">
            <span className="w-2 h-2 rounded-full bg-eco-500" /> {available} Available
          </div>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-xs font-semibold text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> {onRoute} On Route
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search contractor, driver, or coverage area…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'Available', 'On Route', 'Offline'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                statusFilter === f
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="rating">Sort: Rating</option>
            <option value="cost">Sort: Cost ↑</option>
            <option value="on_time">Sort: On-Time</option>
            <option value="jobs">Sort: Experience</option>
          </select>
        </div>
      </div>

      {/* Leaderboard bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Performance Leaderboard</p>
        <div className="space-y-2">
          {[...CONTRACTORS]
            .filter(c => c.status !== 'Offline')
            .sort((a, b) => b.rating - a.rating)
            .map((c, i) => (
              <div key={c.contractor_id} className="flex items-center gap-3">
                <span className={`w-5 text-xs font-bold text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-orange-400'}`}>
                  {i + 1}
                </span>
                <span className="text-xs font-semibold text-slate-700 flex-1">{c.name}</span>
                <Stars rating={c.rating} />
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${c.on_time_rate}%` }} />
                </div>
                <span className="text-[11px] text-slate-400 w-10 text-right">{c.on_time_rate}%</span>
              </div>
            ))}
        </div>
      </div>

      {/* Contractor grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => (
          <ContractorCard key={c.contractor_id} contractor={c} onDispatch={setDispatchTarget} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400">
            <Truck className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No contractors match your search.</p>
          </div>
        )}
      </div>

      {dispatchTarget && (
        <DispatchModal contractor={dispatchTarget} onClose={() => setDispatchTarget(null)} />
      )}
    </div>
  )
}
