import React, { useState } from 'react'
import { Truck, Clock, MapPin, CheckCircle, AlertCircle, Calendar, Package } from 'lucide-react'

const RUNS = [
  {
    id: 'CL-2847', date: 'Thu 29 May', window: '8am–12pm', driver: 'Alex W.',
    stations: ['ST-001 Surry Hills', 'ST-002 Redfern', 'ST-005 Marrickville'],
    status: 'Scheduled', estVol: '4.2t',
  },
  {
    id: 'CL-2846', date: 'Wed 28 May', window: '10am–2pm', driver: 'Jamie L.',
    stations: ['ST-004 Newtown'],
    status: 'In Progress', estVol: '2.4t',
  },
  {
    id: 'CL-2845', date: 'Tue 27 May', window: '7am–11am', driver: 'Alex W.',
    stations: ['ST-001 Surry Hills', 'ST-002 Redfern'],
    status: 'Completed', estVol: '3.8t',
  },
  {
    id: 'CL-2844', date: 'Mon 26 May', window: '8am–12pm', driver: 'Sam R.',
    stations: ['ST-004 Newtown', 'ST-005 Marrickville'],
    status: 'Completed', estVol: '4.0t',
  },
]

const STATUS_STYLE = {
  Scheduled:   'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed:   'bg-eco-100 text-eco-700',
}

const STATUS_ICON = {
  Scheduled:   Clock,
  'In Progress': Truck,
  Completed:   CheckCircle,
}

export default function OperatorLogistics() {
  const [tab, setTab] = useState('upcoming')

  const upcoming  = RUNS.filter(r => r.status !== 'Completed')
  const completed = RUNS.filter(r => r.status === 'Completed')
  const shown = tab === 'upcoming' ? upcoming : completed

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Logistics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Schedule and track 240L bin collection runs</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          <Calendar className="w-4 h-4" /> Schedule Run
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Scheduled',    value: '1', color: 'text-blue-700 bg-blue-50' },
          { label: 'In Progress',  value: '1', color: 'text-amber-700 bg-amber-50' },
          { label: 'Completed (May)', value: '12', color: 'text-eco-700 bg-eco-50' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 text-center">
            <div className={`text-2xl font-bold ${s.color.split(' ')[0]}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {['upcoming', 'completed'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Run cards */}
      <div className="space-y-4">
        {shown.map(run => {
          const Icon = STATUS_ICON[run.status]
          return (
            <div key={run.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{run.id}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[run.status]}`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {run.date} · {run.window} · Driver: <span className="font-medium text-slate-700">{run.driver}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-slate-900">{run.estVol}</div>
                  <div className="text-xs text-slate-400">est. volume</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {run.stations.map(s => (
                  <span key={s} className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                    <MapPin className="w-3 h-3" /> {s}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
