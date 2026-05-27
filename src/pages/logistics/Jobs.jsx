import React, { useState } from 'react'
import { Package, MapPin, Clock, CheckCircle, AlertCircle, Phone, Search } from 'lucide-react'

const JOBS = [
  { id: 'J-4201', address: '42 Crown St, Surry Hills NSW',      type: '240L Mixed Recyclables',  window: '8:00–10:00am',  status: 'Completed',   weight: '12.0 kg', value: '$5.40', notes: '' },
  { id: 'J-4202', address: '155 Redfern St, Redfern NSW',       type: '240L Mixed Recyclables',  window: '10:00am–12pm',  status: 'Completed',   weight: '9.8 kg',  value: '$3.80', notes: '' },
  { id: 'J-4203', address: '300 Victoria St, Darlinghurst NSW', type: '240L Cardboard & Paper',  window: '12:00–2:00pm',  status: 'In Progress', weight: '—',       value: '—',     notes: 'Access via side gate' },
  { id: 'J-4204', address: '88 Enmore Rd, Newtown NSW',         type: '240L Mixed Recyclables',  window: '2:00–4:00pm',   status: 'Pending',     weight: '—',       value: '—',     notes: '' },
  { id: 'J-4205', address: '60 King St, Newtown NSW',           type: '240L Glass Containers',   window: '2:00–4:00pm',   status: 'Pending',     weight: '—',       value: '—',     notes: 'Ring bell — unit 4' },
]

const STATUS_STYLE  = {
  Completed:    'bg-eco-100 text-eco-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Pending:      'bg-slate-100 text-slate-600',
}

export default function LogisticsJobs() {
  const [query, setQuery]     = useState('')
  const [filter, setFilter]   = useState('all')

  const filtered = JOBS.filter(
    j =>
      (filter === 'all' || j.status.toLowerCase().replace(' ', '') === filter.replace(' ', '')) &&
      j.address.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
        <p className="text-sm text-slate-500 mt-0.5">All jobs for today's route</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search address…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'completed', 'in progress', 'pending'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border capitalize transition-colors whitespace-nowrap ${
                filter === f
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map(job => (
          <div key={job.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${STATUS_STYLE[job.status].split(' ')[1]}`}>
                  <Package className={`w-4 h-4 ${STATUS_STYLE[job.status].split(' ')[0]}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 leading-tight">{job.address}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{job.type}</div>
                </div>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[job.status]}`}>
                {job.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-slate-400 mb-0.5">Job ID</div>
                <div className="font-mono font-semibold text-slate-700">{job.id}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Window</div>
                <div className="font-semibold text-slate-700">{job.window}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Weight</div>
                <div className="font-semibold text-slate-700">{job.weight}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-0.5">Est. Value</div>
                <div className={`font-bold ${job.value !== '—' ? 'text-eco-700' : 'text-slate-400'}`}>{job.value}</div>
              </div>
            </div>

            {job.notes && (
              <div className="mt-3 flex items-start gap-2 text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {job.notes}
              </div>
            )}

            {job.status === 'In Progress' && (
              <div className="mt-4 flex gap-2">
                <button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                  Mark Collected
                </button>
                <button className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:border-slate-300 transition-colors flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Contact
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
