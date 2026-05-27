import React, { useState } from 'react'
import {
  Scale, CheckCircle, Clock, AlertTriangle, X, Shield,
  FileText, ChevronDown, ChevronUp,
} from 'lucide-react'
import { WEIGHBRIDGE, JOBS } from '../../data/woms'

const STATUS_STYLE = {
  Verified: 'bg-eco-100 text-eco-700',
  Pending:  'bg-amber-100 text-amber-700',
  Disputed: 'bg-red-100 text-red-700',
}

const MATERIAL_COLOR = {
  'Aluminium':   'bg-slate-400',
  'PET Plastic': 'bg-blue-400',
  'HDPE':        'bg-amber-400',
  'Glass':       'bg-eco-400',
  'Steel':       'bg-rose-400',
  'Cardboard':   'bg-orange-400',
}

function ClassificationBar({ classification }) {
  const total = Object.values(classification).reduce((a, b) => a + b, 0)
  return (
    <div className="space-y-2.5">
      {Object.entries(classification).map(([mat, kg]) => {
        const pct = ((kg / total) * 100).toFixed(0)
        const color = MATERIAL_COLOR[mat] || 'bg-slate-300'
        return (
          <div key={mat} className="flex items-center gap-2">
            <span className="text-xs text-slate-600 w-24 flex-shrink-0">{mat}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-slate-700 w-10 text-right">{kg} kg</span>
            <span className="text-[11px] text-slate-400 w-8 text-right">{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

function VerifyModal({ ticket, job, onClose }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Verify Weighbridge Ticket</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{ticket.ticket_id} · {ticket.station_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-5">
          {/* Weight summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-lg font-bold text-slate-800">{ticket.gross_weight_kg}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase">Gross (kg)</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-lg font-bold text-slate-800">{ticket.tare_weight_kg}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase">Tare (kg)</p>
            </div>
            <div className="bg-eco-50 rounded-xl p-3">
              <p className="text-lg font-bold text-eco-700">{ticket.net_weight_kg}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase">Net (kg)</p>
            </div>
          </div>

          {/* Contamination */}
          <div className={`flex items-center justify-between p-3 rounded-xl ${
            ticket.contamination_pct > 10 ? 'bg-red-50 border border-red-200' :
            ticket.contamination_pct > 5 ? 'bg-amber-50 border border-amber-200' :
            'bg-eco-50 border border-eco-200'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${
                ticket.contamination_pct > 10 ? 'text-red-500' :
                ticket.contamination_pct > 5 ? 'text-amber-500' : 'text-eco-500'
              }`} />
              <span className={`text-sm font-bold ${
                ticket.contamination_pct > 10 ? 'text-red-700' :
                ticket.contamination_pct > 5 ? 'text-amber-700' : 'text-eco-700'
              }`}>{ticket.contamination_pct}% contamination</span>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              ticket.contamination_pct > 10 ? 'bg-red-100 text-red-700' :
              ticket.contamination_pct > 5 ? 'bg-amber-100 text-amber-700' :
              'bg-eco-100 text-eco-700'
            }`}>
              {ticket.contamination_pct > 10 ? 'Above threshold — flag' : ticket.contamination_pct > 5 ? 'Monitor' : 'Acceptable'}
            </span>
          </div>

          {/* Material classification */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-3">Material Classification</p>
            <ClassificationBar classification={ticket.classification} />
            <p className="text-[11px] text-slate-400 mt-2 text-right">
              Total classified: {Object.values(ticket.classification).reduce((a, b) => a + b, 0)} kg
            </p>
          </div>

          {/* EPA */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-eco-50 border border-eco-200">
            <Shield className="w-5 h-5 text-eco-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-eco-700">EPA Compliance</p>
              <p className="text-[11px] text-eco-600">Manifest {ticket.manifest_id} · {ticket.facility}</p>
            </div>
            <span className="ml-auto bg-eco-200 text-eco-800 text-[10px] font-bold px-2 py-0.5 rounded-full">COMPLIANT</span>
          </div>

          {/* Facility */}
          <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Collection Job</span>
              <span className="font-mono font-semibold text-slate-700">{ticket.job_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Facility</span>
              <span className="font-semibold text-slate-700">{ticket.facility}</span>
            </div>
            {job && (
              <div className="flex justify-between">
                <span className="text-slate-400">Operator</span>
                <span className="font-semibold text-slate-700">{job.operator}</span>
              </div>
            )}
          </div>

          {/* Confirm flag */}
          {ticket.contamination_pct > 10 && (
            <div className="flex items-start gap-2">
              <input type="checkbox" id="flag" checked={confirming} onChange={e => setConfirming(e.target.checked)} className="mt-0.5" />
              <label htmlFor="flag" className="text-xs text-slate-600 cursor-pointer">
                I acknowledge high contamination ({ticket.contamination_pct}%) and confirm this ticket for operator notification
              </label>
            </div>
          )}

          <div className="flex gap-3 pb-1">
            <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl text-sm">Cancel</button>
            <button
              disabled={ticket.contamination_pct > 10 && !confirming}
              className="flex-1 bg-eco-700 hover:bg-eco-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
              onClick={onClose}
            >
              Verify Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Weighbridge() {
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [verifyTarget, setVerifyTarget] = useState(null)

  const filtered = WEIGHBRIDGE.filter(t => filter === 'all' || t.status === filter)
  const pending = WEIGHBRIDGE.filter(t => t.status === 'Pending').length
  const totalNet = WEIGHBRIDGE.filter(t => t.status === 'Verified').reduce((a, t) => a + t.net_weight_kg, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Weighbridge</h1>
        <p className="text-sm text-slate-500 mt-0.5">Material weight verification and classification — Alexandria Weighbridge</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Tickets', value: WEIGHBRIDGE.length, color: 'text-slate-800' },
          { label: 'Pending Verification', value: pending, color: pending > 0 ? 'text-amber-600' : 'text-slate-400' },
          { label: 'Net Weight Verified', value: `${totalNet} kg`, color: 'text-eco-700' },
          { label: 'High Contamination', value: WEIGHBRIDGE.filter(t => t.contamination_pct > 10).length, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'Pending', 'Verified'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border capitalize transition-colors ${
              filter === f
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
            }`}
          >
            {f === 'all' ? 'All Tickets' : f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(ticket => {
          const job = JOBS.find(j => j.job_id === ticket.job_id)
          const isExpanded = expanded === ticket.ticket_id
          const highContam = ticket.contamination_pct > 10

          return (
            <div key={ticket.ticket_id} className={`bg-white rounded-2xl border shadow-sm transition-all ${
              highContam ? 'border-red-200' : 'border-slate-100'
            }`}>
              <div
                className="flex items-start gap-4 p-5 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : ticket.ticket_id)}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  ticket.status === 'Verified' ? 'bg-eco-100' : 'bg-amber-100'
                }`}>
                  {ticket.status === 'Verified'
                    ? <CheckCircle className="w-4 h-4 text-eco-600" />
                    : <Scale className="w-4 h-4 text-amber-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{ticket.station_name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[ticket.status]}`}>
                      {ticket.status}
                    </span>
                    {highContam && (
                      <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                        <AlertTriangle className="w-2.5 h-2.5" /> High Contamination
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{ticket.ticket_id} · {ticket.job_id}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-slate-500">Net: <span className="font-bold text-slate-800">{ticket.net_weight_kg} kg</span></span>
                    <span className={ticket.contamination_pct > 10 ? 'text-red-600 font-semibold' : ticket.contamination_pct > 5 ? 'text-amber-600 font-semibold' : 'text-slate-500'}>
                      {ticket.contamination_pct}% contamination
                    </span>
                    <span className="text-slate-400">{ticket.facility}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ticket.status === 'Pending' && (
                    <button
                      onClick={e => { e.stopPropagation(); setVerifyTarget({ ticket, job }) }}
                      className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Verify
                    </button>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-50">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Weight Breakdown</p>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'Gross Weight', value: `${ticket.gross_weight_kg} kg` },
                          { label: 'Tare (Vehicle)', value: `${ticket.tare_weight_kg} kg`, sub: true },
                          { label: 'Net Weight', value: `${ticket.net_weight_kg} kg`, bold: true },
                        ].map(row => (
                          <div key={row.label} className={`flex justify-between ${row.sub ? 'text-slate-400 text-xs' : 'text-slate-700'}`}>
                            <span className={row.sub ? '' : row.bold ? 'font-bold' : ''}>{row.label}</span>
                            <span className={row.bold ? 'font-bold text-eco-700' : ''}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Material Classification</p>
                      <ClassificationBar classification={ticket.classification} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Manifest: {ticket.manifest_id}</span>
                    <Shield className="w-3.5 h-3.5 ml-2" />
                    <span className="text-eco-600 font-semibold">EPA Compliant</span>
                    {ticket.verified_by && (
                      <>
                        <span>·</span>
                        <span>Verified by: {ticket.verified_by}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {verifyTarget && (
        <VerifyModal
          ticket={verifyTarget.ticket}
          job={verifyTarget.job}
          onClose={() => setVerifyTarget(null)}
        />
      )}
    </div>
  )
}
