import React from 'react'
import { Link } from 'react-router-dom'
import { Truck, MapPin, Package, Clock, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react'

const TODAY_JOBS = [
  { id: 'J-4201', address: '42 Crown St, Surry Hills',      type: '240L Mixed',     window: '8–10am',   status: 'Completed', weight: '12.0 kg' },
  { id: 'J-4202', address: '155 Redfern St, Redfern',       type: '240L Mixed',     window: '10–12pm',  status: 'Completed', weight: '9.8 kg' },
  { id: 'J-4203', address: '300 Victoria St, Darlinghurst', type: '240L Cardboard', window: '12–2pm',   status: 'In Progress', weight: '—' },
  { id: 'J-4204', address: '88 Enmore Rd, Newtown',         type: '240L Mixed',     window: '2–4pm',    status: 'Pending', weight: '—' },
  { id: 'J-4205', address: '60 King St, Newtown',           type: '240L Glass',     window: '2–4pm',    status: 'Pending', weight: '—' },
]

const STATUS_STYLE = {
  Completed:    'bg-eco-100 text-eco-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Pending:      'bg-slate-100 text-slate-600',
}

const STATUS_ICON = {
  Completed:    CheckCircle,
  'In Progress': Truck,
  Pending:      Clock,
}

export default function LogisticsDashboard() {
  const completed   = TODAY_JOBS.filter(j => j.status === 'Completed').length
  const inProgress  = TODAY_JOBS.filter(j => j.status === 'In Progress').length
  const pending     = TODAY_JOBS.filter(j => j.status === 'Pending').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Good morning, Mike</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Thursday 29 May · Eastern Suburbs Loop · {TODAY_JOBS.length} jobs today
        </p>
      </div>

      {/* Route summary banner */}
      <div className="bg-amber-600 rounded-2xl px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs font-semibold text-amber-200 uppercase tracking-wider mb-0.5">Active Route</div>
            <div className="font-bold text-lg">Eastern Suburbs Loop — Run CL-2847</div>
            <div className="text-sm text-amber-200 mt-0.5">Operator: GreenStation Ops · Est. 4.2 tonnes</div>
          </div>
        </div>
        <Link
          to="/logistics/routes"
          className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          View Route →
        </Link>
      </div>

      {/* Job stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Completed', value: completed, color: 'text-eco-700 bg-eco-50',    icon: CheckCircle },
          { label: 'In Progress', value: inProgress, color: 'text-amber-700 bg-amber-50', icon: Truck },
          { label: 'Pending',    value: pending,    color: 'text-slate-700 bg-slate-100', icon: Clock },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
            <div className={`w-9 h-9 ${s.color.split(' ')[1]} rounded-xl flex items-center justify-center mx-auto mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color.split(' ')[0]}`} />
            </div>
            <div className={`text-3xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Today's jobs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900">Today's Jobs</h2>
          <Link to="/logistics/jobs" className="text-xs text-amber-600 font-semibold hover:underline">
            All jobs →
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {TODAY_JOBS.map(job => {
            const Icon = STATUS_ICON[job.status]
            return (
              <div key={job.id} className="flex items-center gap-4 px-6 py-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  STATUS_STYLE[job.status].split(' ')[1]
                }`}>
                  <Icon className={`w-4 h-4 ${STATUS_STYLE[job.status].split(' ')[0]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-900 truncate">{job.address}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {job.id} · {job.type} · {job.window}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[job.status]}`}>
                    {job.status}
                  </span>
                  {job.weight !== '—' && (
                    <div className="text-xs text-slate-400 mt-0.5">{job.weight}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
