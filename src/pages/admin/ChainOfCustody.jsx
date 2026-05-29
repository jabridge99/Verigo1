import React, { useState } from 'react'
import {
  Shield, CheckCircle, Clock, FileText, Package,
  Scale, Warehouse, DollarSign, Search, X,
} from 'lucide-react'
import { CUSTODY, JOBS } from '../../data/woms'

const ALL_STAGES = ['Collected', 'Weighed', 'Classified', 'Warehouse Intake', 'Settlement']

const STAGE_ICON = {
  Collected:        { icon: Package,     color: 'text-blue-600',   bg: 'bg-blue-100',   line: 'bg-blue-300' },
  Weighed:          { icon: Scale,       color: 'text-amber-600',  bg: 'bg-amber-100',  line: 'bg-amber-300' },
  Classified:       { icon: FileText,    color: 'text-violet-600', bg: 'bg-violet-100', line: 'bg-violet-300' },
  'Warehouse Intake':{ icon: Warehouse,  color: 'text-eco-600',    bg: 'bg-eco-100',    line: 'bg-eco-300' },
  Settlement:       { icon: DollarSign,  color: 'text-slate-600',  bg: 'bg-slate-100',  line: 'bg-slate-300' },
}

function CustodyTimeline({ record }) {
  const completedStages = record.events.map(e => e.stage)
  return (
    <div className="space-y-0">
      {ALL_STAGES.map((stage, i) => {
        const event = record.events.find(e => e.stage === stage)
        const completed = !!event
        const isLast = i === ALL_STAGES.length - 1
        const s = STAGE_ICON[stage]
        const Icon = s.icon
        return (
          <div key={stage} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                completed ? `${s.bg} border-transparent` : 'bg-slate-50 border-slate-200'
              }`}>
                <Icon className={`w-3.5 h-3.5 ${completed ? s.color : 'text-slate-300'}`} />
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[24px] ${completed ? s.line : 'bg-slate-100'}`} />
              )}
            </div>
            <div className={`pb-5 ${isLast ? '' : ''} flex-1 min-w-0`}>
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${completed ? 'text-slate-900' : 'text-slate-300'}`}>{stage}</span>
                {completed && <span className="bg-eco-100 text-eco-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Done</span>}
                {!completed && <span className="bg-slate-100 text-slate-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">Pending</span>}
              </div>
              {event ? (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs text-slate-500">{event.actor}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(event.timestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {new Date(event.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                    {event.location ? ` · ${event.location}` : ''}
                  </p>
                  {event.notes && (
                    <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 rounded-lg px-2 py-1">{event.notes}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-300 mt-0.5 italic">Not yet completed</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecordModal({ record, job, onClose }) {
  const completedCount = record.events.length
  const isFullChain = completedCount === ALL_STAGES.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Chain of Custody</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{record.custody_id} · {record.manifest_id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">{record.station_name}</p>
              <p className="text-xs text-slate-400">{record.job_id}</p>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${record.epa_compliant ? 'text-eco-700' : 'text-red-600'}`}>
                <Shield className="w-3.5 h-3.5" />
                {record.epa_compliant ? 'EPA Compliant' : 'Non-Compliant'}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{completedCount}/{ALL_STAGES.length} stages complete</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-eco-500 rounded-full transition-all"
              style={{ width: `${(completedCount / ALL_STAGES.length) * 100}%` }}
            />
          </div>

          {/* Timeline */}
          <CustodyTimeline record={record} />

          {/* Footer */}
          <div className="border-t border-slate-50 pt-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs font-semibold text-slate-700">{record.manifest_id}</p>
              <p className="text-[11px] text-slate-400">Digital manifest · {isFullChain ? 'Complete chain' : 'Partial — in progress'}</p>
            </div>
            {isFullChain && (
              <button className="ml-auto bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                Download
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChainOfCustody() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const records = CUSTODY.filter(r =>
    r.station_name.toLowerCase().includes(query.toLowerCase()) ||
    r.job_id.toLowerCase().includes(query.toLowerCase()) ||
    r.custody_id.toLowerCase().includes(query.toLowerCase())
  ).map(r => ({
    record: r,
    job: JOBS.find(j => j.job_id === r.job_id),
    completedStages: r.events.length,
    isComplete: r.events.length === ALL_STAGES.length,
  }))

  const completeCount = records.filter(r => r.isComplete).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Chain of Custody</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          EPA-compliant material tracking from station to warehouse to recycler
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: CUSTODY.length, color: 'text-slate-800' },
          { label: 'Full Chain Complete', value: completeCount, color: 'text-eco-700' },
          { label: 'In Progress', value: CUSTODY.length - completeCount, color: 'text-amber-600' },
          { label: 'EPA Compliant', value: CUSTODY.filter(r => r.epa_compliant).length, color: 'text-eco-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline stage legend */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Custody Stages</p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {ALL_STAGES.map((stage, i) => {
            const s = STAGE_ICON[stage]
            const Icon = s.icon
            return (
              <React.Fragment key={stage}>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`w-6 h-6 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <Icon className={`w-3 h-3 ${s.color}`} />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600">{stage}</span>
                </div>
                {i < ALL_STAGES.length - 1 && <span className="text-slate-300 flex-shrink-0">→</span>}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by station, job ID or custody record…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Records */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Record', 'Station', 'Manifest', 'Progress', 'EPA', 'Last Stage', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {records.map(({ record, job, completedStages, isComplete }) => {
              const lastEvent = record.events[record.events.length - 1]
              const s = STAGE_ICON[lastEvent?.stage] || STAGE_ICON['Collected']
              const LastIcon = s.icon
              return (
                <tr
                  key={record.custody_id}
                  className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => setSelected({ record, job })}
                >
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{record.custody_id}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900 whitespace-nowrap">{record.station_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{record.job_id}</p>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{record.manifest_id}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-eco-500 rounded-full"
                          style={{ width: `${(completedStages / ALL_STAGES.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{completedStages}/{ALL_STAGES.length}</span>
                    </div>
                    <span className={`text-[10px] font-semibold mt-1 block ${isComplete ? 'text-eco-600' : 'text-amber-600'}`}>
                      {isComplete ? 'Full chain' : 'In progress'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {record.epa_compliant
                      ? <span className="flex items-center gap-1 text-eco-600 text-[11px] font-semibold"><Shield className="w-3 h-3" /> Compliant</span>
                      : <span className="text-red-600 text-[11px] font-semibold">Non-compliant</span>
                    }
                  </td>
                  <td className="px-5 py-4">
                    {lastEvent && (
                      <div className="flex items-center gap-1.5">
                        <div className={`w-5 h-5 rounded-lg ${s.bg} flex items-center justify-center`}>
                          <LastIcon className={`w-3 h-3 ${s.color}`} />
                        </div>
                        <span className="text-xs text-slate-600">{lastEvent.stage}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <button className="text-xs text-violet-600 font-semibold hover:underline">View</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <RecordModal record={selected.record} job={selected.job} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
