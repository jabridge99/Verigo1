import React, { useState } from 'react'
import {
  CheckCircle, AlertTriangle, Camera, MapPin, FileText,
  Navigation, X, Clock, Shield, ChevronDown, ChevronUp,
  Image, User, AlertCircle,
} from 'lucide-react'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PROOFS = [
  {
    proof_id: 'PRF-054', job_id: 'JOB-054', station: 'Pyrmont Point',
    date_time: '2026-05-29T11:12', contractor: 'Lisa Chen', company: 'RecycleTruck Pro',
    weight_kg: 113, materials: ['Aluminium', 'PET Plastic', 'HDPE'],
    gps_match: true, gps_coords: '-33.8726, 151.1942', gps_deviation_m: 8,
    status: 'Verified', verifier: 'J. Anderson', verified_at: '2026-05-29T12:05',
    signed_receipt: 'RCP-29054', photo_count: 3,
    dispute_reason: null, dispute_notes: null,
  },
  {
    proof_id: 'PRF-052', job_id: 'JOB-052', station: 'Marrickville Loop',
    date_time: '2026-05-29T09:08', contractor: 'Wei Zhang', company: 'EcoMover NSW',
    weight_kg: 89, materials: ['Aluminium', 'PET Plastic', 'Glass'],
    gps_match: true, gps_coords: '-33.9111, 151.1552', gps_deviation_m: 12,
    status: 'Pending', verifier: null, verified_at: null,
    signed_receipt: 'RCP-29052', photo_count: 3,
    dispute_reason: null, dispute_notes: null,
  },
  {
    proof_id: 'PRF-053', job_id: 'JOB-053', station: 'Surry Hills Hub',
    date_time: '2026-05-29T08:14', contractor: 'Sarah Park', company: 'GreenRoute Transport',
    weight_kg: 65, materials: ['Aluminium', 'PET Plastic', 'Glass', 'Cardboard'],
    gps_match: true, gps_coords: '-33.8845, 151.2094', gps_deviation_m: 5,
    status: 'Pending', verifier: null, verified_at: null,
    signed_receipt: 'RCP-29053', photo_count: 3,
    dispute_reason: null, dispute_notes: null,
  },
  {
    proof_id: 'PRF-050', job_id: 'JOB-050', station: 'Glebe Eco Depot',
    date_time: '2026-05-29T13:47', contractor: 'Marcus Chen', company: 'FastPickup Logistics',
    weight_kg: 128, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Cardboard'],
    gps_match: false, gps_coords: '-33.8801, 151.1861', gps_deviation_m: 94,
    status: 'Disputed', verifier: null, verified_at: null,
    signed_receipt: 'RCP-29050', photo_count: 2,
    dispute_reason: 'GPS mismatch', dispute_notes: 'Recorded coordinates do not match station location. Possible device error or incorrect station attended.',
  },
  {
    proof_id: 'PRF-044', job_id: 'JOB-044', station: 'Darlinghurst Point',
    date_time: '2026-05-28T09:22', contractor: 'Lisa Chen', company: 'RecycleTruck Pro',
    weight_kg: 224, materials: ['Aluminium', 'PET Plastic', 'Glass'],
    gps_match: true, gps_coords: '-33.8776, 151.2167', gps_deviation_m: 5,
    status: 'Verified', verifier: 'P. Henderson', verified_at: '2026-05-28T15:30',
    signed_receipt: 'RCP-28044', photo_count: 3,
    dispute_reason: null, dispute_notes: null,
  },
  {
    proof_id: 'PRF-045', job_id: 'JOB-045', station: 'Waterloo Green Point',
    date_time: '2026-05-28T10:48', contractor: 'Lisa Chen', company: 'RecycleTruck Pro',
    weight_kg: 178, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Glass', 'Steel'],
    gps_match: true, gps_coords: '-33.8960, 151.2010', gps_deviation_m: 3,
    status: 'Verified', verifier: 'P. Henderson', verified_at: '2026-05-28T16:00',
    signed_receipt: 'RCP-28045', photo_count: 3,
    dispute_reason: null, dispute_notes: null,
  },
  {
    proof_id: 'PRF-046', job_id: 'JOB-046', station: 'Redfern Node',
    date_time: '2026-05-28T13:20', contractor: 'Sarah Park', company: 'GreenRoute Transport',
    weight_kg: 159, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Steel'],
    gps_match: true, gps_coords: '-33.8930, 151.2065', gps_deviation_m: 7,
    status: 'Pending', verifier: null, verified_at: null,
    signed_receipt: 'RCP-28046', photo_count: 3,
    dispute_reason: null, dispute_notes: null,
  },
  {
    proof_id: 'PRF-041', job_id: 'JOB-041', station: 'Surry Hills Hub',
    date_time: '2026-05-27T11:08', contractor: 'Sarah Park', company: 'GreenRoute Transport',
    weight_kg: 171, materials: ['Aluminium', 'PET Plastic', 'Glass', 'Cardboard'],
    gps_match: true, gps_coords: '-33.8845, 151.2094', gps_deviation_m: 4,
    status: 'Verified', verifier: 'J. Anderson', verified_at: '2026-05-27T15:30',
    signed_receipt: 'RCP-27041', photo_count: 3,
    dispute_reason: null, dispute_notes: null,
  },
  {
    proof_id: 'PRF-042', job_id: 'JOB-042', station: 'Newtown Station',
    date_time: '2026-05-27T13:45', contractor: 'James Murphy', company: 'ClearBin Solutions',
    weight_kg: 188, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Steel'],
    gps_match: true, gps_coords: '-33.8976, 151.1786', gps_deviation_m: 6,
    status: 'Verified', verifier: 'J. Anderson', verified_at: '2026-05-27T16:00',
    signed_receipt: 'RCP-27042', photo_count: 3,
    dispute_reason: null, dispute_notes: null,
  },
]

const DISPUTE_REASONS = [
  'GPS mismatch',
  'Weight discrepancy',
  'Incorrect materials recorded',
  'Photo evidence insufficient',
  'Station not attended',
  'Incorrect station attended',
  'Other',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  Verified: { badge: 'bg-green-100 text-green-700',   icon: CheckCircle, iconColor: 'text-green-600',  bg: 'bg-green-50' },
  Pending:  { badge: 'bg-amber-100 text-amber-700',   icon: Clock,       iconColor: 'text-amber-600',  bg: 'bg-amber-50' },
  Disputed: { badge: 'bg-red-100 text-red-700',       icon: AlertTriangle, iconColor: 'text-red-600',  bg: 'bg-red-50'  },
}

// ─── Dispute Modal ────────────────────────────────────────────────────────────

function DisputeModal({ proof, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-red-100 flex items-center justify-between bg-red-50 rounded-t-2xl">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Raise Dispute
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{proof.proof_id} · {proof.station}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Dispute Reason</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <option value="">Select reason…</option>
              {DISPUTE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Describe the issue in detail…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>
          <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2.5 text-xs text-amber-700">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Raising a dispute will notify the contractor and flag this collection for manual review.</span>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button
            disabled={!reason || !notes.trim()}
            onClick={() => { onSubmit(proof, reason, notes); onClose() }}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            {reason ? 'Submit Dispute' : 'Select Reason'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Proof Card ───────────────────────────────────────────────────────────────

function ProofCard({ proof, onDispute }) {
  const [expanded, setExpanded] = useState(false)
  const sm = STATUS_META[proof.status]
  const Icon = sm.icon

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${
      proof.status === 'Disputed' ? 'border-red-100 hover:border-red-200' :
      proof.status === 'Verified' ? 'border-green-100 hover:border-green-200' :
      'border-slate-100 hover:border-amber-100'
    }`}>
      {/* Disputed banner */}
      {proof.status === 'Disputed' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-t-2xl border-b border-red-100">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-[11px] font-bold text-red-600 uppercase tracking-wide">
            Disputed — {proof.dispute_reason}
          </span>
        </div>
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sm.bg}`}>
              <Icon className={`w-4 h-4 ${sm.iconColor}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">{proof.station}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sm.badge}`}>
                  {proof.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {proof.proof_id} · {proof.job_id} · {proof.contractor} ({proof.company})
              </p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-semibold text-slate-600">
              {new Date(proof.date_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-[11px] text-slate-400">
              {new Date(proof.date_time).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>

        {/* Photo placeholder */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`aspect-video rounded-xl flex flex-col items-center justify-center border-2 border-dashed ${
                i < proof.photo_count
                  ? 'bg-slate-100 border-slate-200'
                  : 'bg-slate-50 border-slate-100'
              }`}
            >
              {i < proof.photo_count ? (
                <>
                  <Camera className="w-4 h-4 text-slate-400" />
                  <span className="text-[9px] text-slate-400 font-semibold mt-1">Photo captured</span>
                </>
              ) : (
                <>
                  <Image className="w-4 h-4 text-slate-200" />
                  <span className="text-[9px] text-slate-300 mt-1">No photo</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Key metrics */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="text-sm font-bold text-slate-800">{proof.weight_kg} kg</p>
            <p className="text-[10px] text-slate-400 font-medium">Weight</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="text-sm font-bold text-slate-800">{proof.materials.length}</p>
            <p className="text-[10px] text-slate-400 font-medium">Materials</p>
          </div>
          <div className={`rounded-xl p-2.5 text-center ${proof.gps_match ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center justify-center gap-1">
              {proof.gps_match
                ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              }
              <p className={`text-xs font-bold ${proof.gps_match ? 'text-green-700' : 'text-red-700'}`}>
                {proof.gps_match ? 'GPS Match' : 'GPS Mismatch'}
              </p>
            </div>
            <p className={`text-[10px] font-medium mt-0.5 ${proof.gps_match ? 'text-green-500' : 'text-red-500'}`}>
              {proof.gps_match ? `±${proof.gps_deviation_m}m` : `${proof.gps_deviation_m}m off`}
            </p>
          </div>
        </div>

        {/* Material tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {proof.materials.map(m => (
            <span key={m} className="bg-amber-50 text-amber-700 text-[10px] font-medium px-2 py-0.5 rounded-md border border-amber-100">
              {m}
            </span>
          ))}
        </div>

        {/* Verified badge */}
        {proof.status === 'Verified' && (
          <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2 text-xs">
            <Shield className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <div>
              <span className="font-bold text-green-700">Verified</span>
              <span className="text-green-600"> by {proof.verifier} at {new Date(proof.verified_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-600 py-1.5 rounded-xl hover:bg-amber-50 transition-colors"
        >
          {expanded
            ? <><ChevronUp className="w-3.5 h-3.5" /> Hide details</>
            : <><ChevronDown className="w-3.5 h-3.5" /> Full details & GPS</>
          }
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-slate-50 pt-4 mt-2 space-y-3">
            {/* GPS coordinates */}
            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <Navigation className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-600">GPS Details</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recorded coordinates</span>
                <span className="font-mono font-semibold text-slate-700">{proof.gps_coords}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Deviation from station</span>
                <span className={`font-bold ${proof.gps_deviation_m <= 50 ? 'text-green-600' : 'text-red-600'}`}>
                  {proof.gps_deviation_m}m {proof.gps_deviation_m <= 50 ? '(within threshold)' : '(exceeds threshold)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Accepted threshold</span>
                <span className="font-semibold text-slate-700">≤ 50m</span>
              </div>
            </div>

            {/* Signed receipt */}
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-600">Signed Receipt</span>
              </div>
              <span className="font-mono font-semibold text-amber-700">{proof.signed_receipt}</span>
            </div>

            {/* Timestamp */}
            <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-600">Collection Timestamp</span>
              </div>
              <span className="font-semibold text-slate-700">
                {new Date(proof.date_time).toLocaleString('en-AU', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>

            {/* Dispute notes if existing */}
            {proof.dispute_notes && (
              <div className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2.5 text-xs text-red-700">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold mb-0.5">Dispute Notes</p>
                  <p>{proof.dispute_notes}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          {proof.status === 'Pending' && (
            <>
              <button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Verify
              </button>
              <button
                onClick={() => onDispute(proof)}
                className="flex-1 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Dispute
              </button>
            </>
          )}
          {proof.status === 'Verified' && (
            <div className="flex-1 bg-green-50 border border-green-100 rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-green-700">
              <CheckCircle className="w-3.5 h-3.5" /> Verified · {proof.signed_receipt}
            </div>
          )}
          {proof.status === 'Disputed' && (
            <div className="flex-1 bg-red-50 border border-red-100 rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" /> Under Review
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PickupProof() {
  const [proofs, setProofs] = useState(PROOFS)
  const [disputeTarget, setDisputeTarget] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')

  const counts = {
    verifiedToday: proofs.filter(p => p.status === 'Verified' && p.date_time.startsWith('2026-05-29')).length,
    pendingReview: proofs.filter(p => p.status === 'Pending').length,
    disputed: proofs.filter(p => p.status === 'Disputed').length,
  }

  const filtered = proofs.filter(p => statusFilter === 'All' || p.status === statusFilter)

  function handleDispute(proof, reason, notes) {
    setProofs(prev => prev.map(p =>
      p.proof_id === proof.proof_id
        ? { ...p, status: 'Disputed', dispute_reason: reason, dispute_notes: notes }
        : p
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proof of Collection</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            GPS verification, photo evidence and signed receipts
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <FileText className="w-4 h-4" /> Export Report
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Verified Today',  value: counts.verifiedToday,  icon: CheckCircle, color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-100' },
          { label: 'Pending Review',  value: counts.pendingReview,  icon: Clock,       color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100' },
          { label: 'Disputed',        value: counts.disputed,       icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-50',    border: 'border-red-100'   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border ${s.border} p-5`}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-slate-500 font-medium">{s.label}</span>
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Verified', 'Pending', 'Disputed'].map(f => {
          const sm = STATUS_META[f] || {}
          const count = f === 'All' ? proofs.length : proofs.filter(p => p.status === f).length
          return (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === f
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
              }`}
            >
              {f === 'All' ? 'All Proofs' : f}
              <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                statusFilter === f ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Proof cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map(proof => (
          <ProofCard
            key={proof.proof_id}
            proof={proof}
            onDispute={setDisputeTarget}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-400">
            <Camera className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No proofs match this filter.</p>
          </div>
        )}
      </div>

      {disputeTarget && (
        <DisputeModal
          proof={disputeTarget}
          onClose={() => setDisputeTarget(null)}
          onSubmit={(proof, reason, notes) => {
            handleDispute(proof, reason, notes)
            setDisputeTarget(null)
          }}
        />
      )}
    </div>
  )
}
