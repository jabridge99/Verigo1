import React, { useState } from 'react'
import {
  CheckCircle, AlertTriangle, Camera, MapPin, FileText,
  Navigation, X, Clock, Image, Shield,
} from 'lucide-react'
import { PROOFS, JOBS, CONTRACTORS } from '../../data/woms'

const STATUS_STYLE = {
  Complete:    { badge: 'bg-eco-100 text-eco-700',   icon: CheckCircle, color: 'text-eco-600' },
  'In Progress': { badge: 'bg-amber-100 text-amber-700', icon: Clock, color: 'text-amber-600' },
}

function ImageGrid({ uploaded, required }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: required }).map((_, i) => (
        <div
          key={i}
          className={`aspect-square rounded-xl flex flex-col items-center justify-center border-2 border-dashed ${
            i < uploaded
              ? 'bg-eco-50 border-eco-300'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          {i < uploaded ? (
            <>
              <Image className="w-5 h-5 text-eco-500" />
              <span className="text-[9px] text-eco-600 font-semibold mt-1">Photo {i + 1}</span>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5 text-slate-300" />
              <span className="text-[9px] text-slate-400 mt-1">Required</span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function ManifestModal({ proof, job, contractor, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Digital Manifest</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">MAN-{proof.job_id.split('-')[1]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-5">
          {/* Manifest header */}
          <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Collection Job</span>
              <span className="font-mono font-semibold text-slate-700">{proof.job_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Station</span>
              <span className="font-semibold text-slate-700">{proof.station_name}</span>
            </div>
            {job && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Address</span>
                  <span className="font-semibold text-slate-700 text-right max-w-[200px]">{job.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Operator</span>
                  <span className="font-semibold text-slate-700">{job.operator}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Contractor</span>
              <span className="font-semibold text-slate-700">{contractor?.name || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Driver</span>
              <span className="font-semibold text-slate-700">{contractor?.driver || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vehicle</span>
              <span className="font-semibold text-slate-700">{contractor?.vehicle || '—'}</span>
            </div>
          </div>

          {/* GPS */}
          <div className="border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Navigation className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">GPS Validation</span>
              {proof.gps_validated
                ? <span className="ml-auto bg-eco-100 text-eco-700 text-[10px] font-bold px-2 py-0.5 rounded-full">VERIFIED</span>
                : <span className="ml-auto bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">FAILED</span>
              }
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-400 mb-0.5">Deviation</p>
                <p className={`font-bold ${proof.gps_deviation_m <= 20 ? 'text-eco-700' : 'text-red-600'}`}>
                  {proof.gps_deviation_m}m from station
                </p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5">Threshold</p>
                <p className="font-semibold text-slate-700">≤ 50m accepted</p>
              </div>
            </div>
          </div>

          {/* Photo proof */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">
                Photo Evidence ({proof.images_uploaded}/{proof.images_required})
              </span>
            </div>
            <ImageGrid uploaded={proof.images_uploaded} required={proof.images_required} />
          </div>

          {/* Bin condition */}
          <div className="border border-slate-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Bin Condition</p>
            <p className="text-sm text-slate-700 font-medium">{proof.bin_condition}</p>
            {proof.notes && (
              <div className="mt-2 flex items-start gap-2 bg-amber-50 rounded-lg p-2 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{proof.notes}</span>
              </div>
            )}
          </div>

          {/* Materials */}
          {job && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Materials Collected</p>
              <div className="flex flex-wrap gap-1.5">
                {job.materials_expected.map(m => (
                  <span key={m} className="bg-eco-50 text-eco-700 text-xs font-medium px-2.5 py-1 rounded-lg border border-eco-100">{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-50 pt-3">
            <div>
              <p className="text-slate-400 mb-0.5">Collection started</p>
              <p className="font-semibold text-slate-700">{new Date(proof.started_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <div>
              <p className="text-slate-400 mb-0.5">Completed</p>
              <p className="font-semibold text-slate-700">{proof.completed_at ? new Date(proof.completed_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : 'In progress'}</p>
            </div>
          </div>

          {/* Manifest signature */}
          <div className={`flex items-center gap-3 p-3 rounded-xl ${proof.manifest_signed ? 'bg-eco-50 border border-eco-200' : 'bg-amber-50 border border-amber-200'}`}>
            <Shield className={`w-5 h-5 flex-shrink-0 ${proof.manifest_signed ? 'text-eco-600' : 'text-amber-600'}`} />
            <div>
              <p className={`text-xs font-bold ${proof.manifest_signed ? 'text-eco-700' : 'text-amber-700'}`}>
                {proof.manifest_signed ? 'Manifest Digitally Signed' : 'Awaiting Digital Signature'}
              </p>
              <p className={`text-[11px] ${proof.manifest_signed ? 'text-eco-600' : 'text-amber-600'}`}>
                {proof.manifest_signed ? 'EPA-compliant digital manifest confirmed' : 'Contractor must sign before verification'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PickupProof() {
  const [selected, setSelected] = useState(null)

  const withJob = PROOFS.map(p => ({
    proof: p,
    job: JOBS.find(j => j.job_id === p.job_id),
    contractor: CONTRACTORS.find(c => c.contractor_id === p.contractor_id),
  }))

  const complete = withJob.filter(x => x.proof.status === 'Complete').length
  const incomplete = withJob.filter(x => x.proof.status === 'In Progress').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pickup Proof</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Recovery Logistics Network · GPS validation, photo evidence and digital manifests
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Proofs', value: PROOFS.length, color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Complete',     value: complete,       color: 'text-eco-700',   bg: 'bg-eco-50' },
          { label: 'In Progress',  value: incomplete,     color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 p-5 text-center`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Proof list */}
      <div className="space-y-4">
        {withJob.map(({ proof, job, contractor }) => {
          const s = STATUS_STYLE[proof.status]
          const Icon = s.icon
          const allComplete = proof.images_uploaded === proof.images_required && proof.manifest_signed && proof.gps_validated
          return (
            <div key={proof.proof_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    proof.status === 'Complete' ? 'bg-eco-100' : 'bg-amber-100'
                  }`}>
                    <Icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{proof.station_name}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.badge}`}>
                        {proof.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{proof.proof_id} · {proof.job_id} · {contractor?.driver}</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0">
                  {new Date(proof.started_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Proof checklist */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'GPS', icon: Navigation,
                    ok: proof.gps_validated,
                    detail: proof.gps_validated ? `±${proof.gps_deviation_m}m` : 'Not verified',
                  },
                  {
                    label: 'Photos', icon: Camera,
                    ok: proof.images_uploaded === proof.images_required,
                    detail: `${proof.images_uploaded}/${proof.images_required}`,
                  },
                  {
                    label: 'Manifest', icon: FileText,
                    ok: proof.manifest_signed,
                    detail: proof.manifest_signed ? 'Signed' : 'Pending',
                  },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl p-3 text-center ${item.ok ? 'bg-eco-50' : 'bg-slate-50'}`}>
                    <item.icon className={`w-4 h-4 mx-auto mb-1 ${item.ok ? 'text-eco-600' : 'text-slate-400'}`} />
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${item.ok ? 'text-eco-700' : 'text-slate-500'}`}>{item.label}</p>
                    <p className={`text-[11px] font-medium mt-0.5 ${item.ok ? 'text-eco-600' : 'text-slate-400'}`}>{item.detail}</p>
                  </div>
                ))}
              </div>

              {proof.notes && (
                <div className="mt-3 flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span className="font-medium">{proof.notes}</span>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setSelected({ proof, job, contractor })}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" /> View Manifest
                </button>
                {proof.status === 'In Progress' && !allComplete && (
                  <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 rounded-lg transition-colors">
                    Contact Driver
                  </button>
                )}
                {proof.status === 'Complete' && allComplete && (
                  <div className="flex-1 bg-eco-50 rounded-lg flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-eco-700">
                    <CheckCircle className="w-3.5 h-3.5" /> Proof Complete
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <ManifestModal
          proof={selected.proof}
          job={selected.job}
          contractor={selected.contractor}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
