import React from 'react'
import { Link } from 'react-router-dom'
import {
  Truck, Package, CheckCircle, Clock, Users, TrendingUp,
  AlertTriangle, Navigation, Zap,
} from 'lucide-react'
import { JOBS, CONTRACTORS, ROUTES, OPS_KPIS } from '../../data/woms'

const STATUS_STYLE = {
  Completed:    { badge: 'bg-eco-100 text-eco-700',   bg: 'bg-eco-50' },
  'In Progress':{ badge: 'bg-amber-100 text-amber-700', bg: 'bg-amber-50' },
  Assigned:     { badge: 'bg-blue-100 text-blue-700',  bg: 'bg-blue-50' },
  Pending:      { badge: 'bg-slate-100 text-slate-600', bg: 'bg-slate-50' },
  Verified:     { badge: 'bg-eco-100 text-eco-700',   bg: 'bg-eco-50' },
}

function LiveContractorDot({ status }) {
  return (
    <span className={`w-2 h-2 rounded-full inline-block ${
      status === 'Available' ? 'bg-eco-500' :
      status === 'On Route' ? 'bg-amber-500' : 'bg-slate-300'
    }`} />
  )
}

export default function LogisticsDashboard() {
  const activeRoutes = ROUTES.filter(r => r.status === 'In Progress')
  const todayJobs = JOBS.filter(j => ['In Progress', 'Assigned', 'Pending'].includes(j.status))
  const completedToday = JOBS.filter(j => j.status === 'Completed' || j.status === 'Verified').length
  const availableContractors = CONTRACTORS.filter(c => c.status === 'Available').length
  const onRouteContractors = CONTRACTORS.filter(c => c.status === 'On Route').length
  const k = OPS_KPIS

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 bg-amber-500 rounded flex items-center justify-center">
            <Truck className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Recovery Logistics Network</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Operations</h1>
        <p className="text-sm text-slate-500 mt-0.5">Wednesday 27 May 2026 · Live network view</p>
      </div>

      {/* Active route banner */}
      {activeRoutes.length > 0 && (
        <div className="bg-amber-600 rounded-2xl px-6 py-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Navigation className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-amber-200 uppercase tracking-wider mb-0.5">{activeRoutes.length} Routes Active</div>
                <div className="font-bold">
                  {activeRoutes.map(r => r.name).join(' · ')}
                </div>
                <div className="text-sm text-amber-200 mt-0.5">
                  {onRouteContractors} contractors on route · {todayJobs.length} jobs outstanding
                </div>
              </div>
            </div>
            <Link
              to="/logistics/routes"
              className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              Track Routes →
            </Link>
          </div>
        </div>
      )}

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Jobs Today',          value: k.jobs_today,             icon: Package,    color: 'text-slate-800',  bg: 'bg-slate-50' },
          { label: 'Completed',           value: completedToday,           icon: CheckCircle,color: 'text-eco-700',    bg: 'bg-eco-50' },
          { label: 'Contractors Active',  value: `${onRouteContractors}/${CONTRACTORS.length}`, icon: Users, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'On-Time Rate',        value: `${k.on_time_rate_pct}%`, icon: TrendingUp, color: 'text-eco-700',    bg: 'bg-eco-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3`}>
            <s.icon className={`w-5 h-5 flex-shrink-0 ${s.color}`} />
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-400 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {JOBS.filter(j => j.priority === 'High' && j.status === 'Pending').length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-red-700">
              {JOBS.filter(j => j.priority === 'High' && j.status === 'Pending').length} high-priority job{JOBS.filter(j => j.priority === 'High' && j.status === 'Pending').length > 1 ? 's' : ''} unassigned
            </span>
            <span className="text-red-600 ml-2">— assign contractor immediately</span>
          </div>
          <Link to="/logistics/jobs" className="ml-auto text-red-700 text-xs font-semibold flex-shrink-0 hover:underline">
            View jobs →
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Job pipeline */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900">Job Pipeline</h2>
            <Link to="/logistics/jobs" className="text-xs text-amber-600 font-semibold hover:underline">All jobs →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {JOBS.slice(0, 7).map(job => {
              const s = STATUS_STYLE[job.status]
              return (
                <div key={job.job_id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    job.status === 'In Progress' ? 'bg-amber-500' :
                    job.status === 'Assigned' ? 'bg-blue-500' :
                    job.status === 'Pending' ? 'bg-slate-300' : 'bg-eco-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{job.station_name}</p>
                    <p className="text-[11px] text-slate-400">{job.job_id} · {job.operator}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      job.priority === 'High' ? 'bg-red-100 text-red-700' :
                      job.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
                    }`}>{job.priority}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.badge}`}>{job.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Contractor roster */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900">Contractor Roster</h2>
            <Link to="/logistics/contractors" className="text-xs text-amber-600 font-semibold hover:underline">Marketplace →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {CONTRACTORS.map(c => {
              const currentJob = c.current_job ? JOBS.find(j => j.job_id === c.current_job) : null
              return (
                <div key={c.contractor_id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={`w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-600`}>
                    {c.driver.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <LiveContractorDot status={c.status} />
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.driver}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {currentJob ? currentJob.station_name : c.coverage_area}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-xs font-semibold ${
                      c.status === 'Available' ? 'text-eco-600' :
                      c.status === 'On Route' ? 'text-amber-600' : 'text-slate-400'
                    }`}>{c.status}</p>
                    <p className="text-[11px] text-slate-400">★{c.rating} · {c.on_time_rate}%</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/logistics/jobs',        label: 'Job Engine',     icon: Package,    color: 'bg-amber-600' },
          { to: '/logistics/contractors', label: 'Contractors',    icon: Users,      color: 'bg-blue-600' },
          { to: '/logistics/routes',      label: 'Route Optimizer', icon: Navigation, color: 'bg-slate-700' },
          { to: '/logistics/proof',       label: 'Pickup Proof',   icon: CheckCircle,color: 'bg-eco-600' },
        ].map(l => (
          <Link
            key={l.to}
            to={l.to}
            className="flex items-center gap-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5 hover:border-amber-200 hover:shadow-md transition-all group"
          >
            <div className={`w-8 h-8 ${l.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <l.icon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
