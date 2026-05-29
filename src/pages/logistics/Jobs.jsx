import React, { useState, useMemo } from 'react'
import {
  Package, Search, Plus, AlertTriangle, CheckCircle, Clock, Truck,
  MapPin, X, User, ChevronDown, ChevronUp, Zap, Calendar, Filter,
  Weight, Navigation, Star, AlertCircle,
} from 'lucide-react'

// ─── Mock Data ───────────────────────────────────────────────────────────────

const JOBS = [
  {
    job_id: 'JOB-047', station_name: 'Waterloo Green Point', address: '50 Cope St, Waterloo NSW 2017',
    suburb: 'Waterloo', status: 'Pending', priority: 'urgent',
    assigned_contractor: null, pickup_window: '08:00 – 12:00, 29 May',
    estimated_weight_kg: 196, distance_from_depot_km: 4.2,
    fill_level: 87, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Glass', 'Steel'],
    special_instructions: 'Station near school — no vehicle reversing before 8:30am.',
    trigger: 'IoT: fill sensor 87%',
  },
  {
    job_id: 'JOB-048', station_name: 'Redfern Node', address: '155 Redfern St, Redfern NSW 2016',
    suburb: 'Redfern', status: 'Pending', priority: 'standard',
    assigned_contractor: null, pickup_window: '10:00 – 14:00, 29 May',
    estimated_weight_kg: 148, distance_from_depot_km: 3.6,
    fill_level: 61, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Steel'],
    special_instructions: '',
    trigger: 'Schedule: bi-weekly pickup',
  },
  {
    job_id: 'JOB-049', station_name: 'Alexandria Node', address: '88 Botany Rd, Alexandria NSW 2015',
    suburb: 'Alexandria', status: 'Pending', priority: 'urgent',
    assigned_contractor: null, pickup_window: '07:00 – 10:00, 29 May',
    estimated_weight_kg: 0, distance_from_depot_km: 1.8,
    fill_level: 0, materials: ['Aluminium', 'PET Plastic'],
    special_instructions: 'Station offline recovery — verify equipment on arrival.',
    trigger: 'Alert: station offline recovery',
  },
  {
    job_id: 'JOB-050', station_name: 'Glebe Eco Depot', address: '12 Glebe Point Rd, Glebe NSW 2037',
    suburb: 'Glebe', status: 'Assigned', priority: 'standard',
    assigned_contractor: 'CTR-001', pickup_window: '13:00 – 17:00, 29 May',
    estimated_weight_kg: 132, distance_from_depot_km: 6.1,
    fill_level: 55, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Cardboard'],
    special_instructions: 'Loading dock requires booking — call site manager on arrival.',
    trigger: 'Schedule: bi-weekly pickup',
  },
  {
    job_id: 'JOB-051', station_name: 'Newtown Station', address: '2 King St, Newtown NSW 2042',
    suburb: 'Newtown', status: 'Assigned', priority: 'standard',
    assigned_contractor: 'CTR-003', pickup_window: '14:00 – 18:00, 29 May',
    estimated_weight_kg: 108, distance_from_depot_km: 7.4,
    fill_level: 44, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Steel'],
    special_instructions: '',
    trigger: 'Schedule: bi-weekly pickup',
  },
  {
    job_id: 'JOB-052', station_name: 'Marrickville Loop', address: '315 Marrickville Rd, Marrickville NSW 2204',
    suburb: 'Marrickville', status: 'In Progress', priority: 'standard',
    assigned_contractor: 'CTR-004', pickup_window: '09:00 – 13:00, 29 May',
    estimated_weight_kg: 92, distance_from_depot_km: 9.2,
    fill_level: 37, materials: ['Aluminium', 'PET Plastic', 'Glass'],
    special_instructions: '',
    trigger: 'Schedule: weekly pickup',
  },
  {
    job_id: 'JOB-053', station_name: 'Surry Hills Hub', address: '42 Crown St, Surry Hills NSW 2010',
    suburb: 'Surry Hills', status: 'In Progress', priority: 'low',
    assigned_contractor: 'CTR-002', pickup_window: '08:00 – 12:00, 29 May',
    estimated_weight_kg: 68, distance_from_depot_km: 2.9,
    fill_level: 28, materials: ['Aluminium', 'PET Plastic', 'Glass', 'Cardboard'],
    special_instructions: 'Access via rear laneway only — front gate code: 4821.',
    trigger: 'Schedule: bi-weekly pickup',
  },
  {
    job_id: 'JOB-054', station_name: 'Pyrmont Point', address: '1 Pirrama Rd, Pyrmont NSW 2009',
    suburb: 'Pyrmont', status: 'In Progress', priority: 'standard',
    assigned_contractor: 'CTR-005', pickup_window: '11:00 – 15:00, 29 May',
    estimated_weight_kg: 115, distance_from_depot_km: 5.0,
    fill_level: 72, materials: ['Aluminium', 'PET Plastic', 'HDPE'],
    special_instructions: '',
    trigger: 'IoT: fill sensor 72%',
  },
  {
    job_id: 'JOB-044', station_name: 'Darlinghurst Point', address: '300 Victoria St, Darlinghurst NSW 2010',
    suburb: 'Darlinghurst', status: 'Completed', priority: 'standard',
    assigned_contractor: 'CTR-005', pickup_window: '09:00 – 13:00, 28 May',
    estimated_weight_kg: 238, distance_from_depot_km: 3.3,
    fill_level: 100, materials: ['Aluminium', 'PET Plastic', 'Glass'],
    special_instructions: '',
    trigger: 'Schedule: bi-weekly pickup',
  },
  {
    job_id: 'JOB-045', station_name: 'Waterloo Green Point', address: '50 Cope St, Waterloo NSW 2017',
    suburb: 'Waterloo', status: 'Completed', priority: 'urgent',
    assigned_contractor: 'CTR-005', pickup_window: '07:00 – 11:00, 28 May',
    estimated_weight_kg: 186, distance_from_depot_km: 4.2,
    fill_level: 78, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Glass', 'Steel'],
    special_instructions: '',
    trigger: 'IoT: fill sensor 78%',
  },
  {
    job_id: 'JOB-041', station_name: 'Surry Hills Hub', address: '42 Crown St, Surry Hills NSW 2010',
    suburb: 'Surry Hills', status: 'Verified', priority: 'standard',
    assigned_contractor: 'CTR-002', pickup_window: '09:00 – 13:00, 27 May',
    estimated_weight_kg: 178, distance_from_depot_km: 2.9,
    fill_level: 74, materials: ['Aluminium', 'PET Plastic', 'Glass', 'Cardboard'],
    special_instructions: '',
    trigger: 'Schedule: bi-weekly pickup',
  },
  {
    job_id: 'JOB-042', station_name: 'Newtown Station', address: '2 King St, Newtown NSW 2042',
    suburb: 'Newtown', status: 'Verified', priority: 'standard',
    assigned_contractor: 'CTR-003', pickup_window: '11:00 – 15:00, 27 May',
    estimated_weight_kg: 194, distance_from_depot_km: 7.4,
    fill_level: 81, materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Steel'],
    special_instructions: '',
    trigger: 'Schedule: bi-weekly pickup',
  },
]

const CONTRACTORS = [
  { id: 'CTR-001', name: 'Marcus Chen', company: 'FastPickup Logistics', vehicle: 'Toyota HiAce (Van)', rating: 4.8, jobs_today: 1, status: 'Available' },
  { id: 'CTR-002', name: 'Sarah Park',  company: 'GreenRoute Transport',  vehicle: 'Isuzu NPR (Light Truck)', rating: 4.9, jobs_today: 2, status: 'On Route' },
  { id: 'CTR-003', name: 'James Murphy', company: 'ClearBin Solutions',   vehicle: 'Toyota HiAce (Van)', rating: 4.6, jobs_today: 1, status: 'Available' },
  { id: 'CTR-004', name: 'Wei Zhang',   company: 'EcoMover NSW',          vehicle: 'Isuzu NPR (Light Truck)', rating: 4.7, jobs_today: 2, status: 'On Route' },
  { id: 'CTR-005', name: 'Lisa Chen',   company: 'RecycleTruck Pro',       vehicle: 'Mitsubishi Canter', rating: 4.5, jobs_today: 1, status: 'Available' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  Pending:      { badge: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400',   label: 'Pending' },
  Assigned:     { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',    label: 'Assigned' },
  'In Progress':{ badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   label: 'In Progress' },
  Completed:    { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500',  label: 'Completed' },
  Verified:     { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',   label: 'Verified' },
}

const PRIORITY_META = {
  urgent:   { badge: 'bg-red-100 text-red-700 border border-red-200',    label: 'Urgent', icon: AlertTriangle },
  standard: { badge: 'bg-amber-50 text-amber-700 border border-amber-100', label: 'Standard', icon: null },
  low:      { badge: 'bg-slate-100 text-slate-500 border border-slate-200', label: 'Low', icon: null },
}

const STATUS_FLOW = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Verified']

function FillBar({ level }) {
  const color = level >= 85 ? 'bg-red-500' : level >= 60 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${level}%` }} />
      </div>
      <span className={`text-[11px] font-bold ${level >= 85 ? 'text-red-600' : level >= 60 ? 'text-amber-600' : 'text-green-600'}`}>
        {level}%
      </span>
    </div>
  )
}

// ─── Assign Panel ─────────────────────────────────────────────────────────────

function AssignPanel({ job, onClose, onAssign }) {
  const [selected, setSelected] = useState(null)
  const available = CONTRACTORS.filter(c => c.status === 'Available')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Assign Contractor</h3>
            <p className="text-xs text-slate-400 mt-0.5">{job.job_id} · {job.station_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
            {available.length} contractors available now
          </p>
          {available.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full flex items-start gap-3 rounded-xl p-3 border text-left transition-all ${
                selected?.id === c.id
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-100 hover:border-slate-200 bg-slate-50'
              }`}
            >
              <div className="w-9 h-9 bg-white rounded-xl border border-slate-200 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-slate-600">
                  {c.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{c.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[11px] text-green-600 font-semibold">Available</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{c.company} · {c.vehicle}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-amber-500 font-semibold">★ {c.rating}</span>
                  <span className="text-[11px] text-slate-400">{c.jobs_today} job{c.jobs_today !== 1 ? 's' : ''} today</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={() => { onAssign(job, selected); onClose() }}
            className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            {selected ? `Confirm · ${selected.name.split(' ')[0]}` : 'Select Contractor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onAssign, onAdvanceStatus, onUnassign }) {
  const [expanded, setExpanded] = useState(false)
  const sm = STATUS_META[job.status] || STATUS_META['Pending']
  const pm = PRIORITY_META[job.priority]
  const PriorityIcon = pm.icon
  const contractor = CONTRACTORS.find(c => c.id === job.assigned_contractor)
  const currentStep = STATUS_FLOW.indexOf(job.status)
  const canAdvance = job.status !== 'Verified'

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${
      job.priority === 'urgent' ? 'border-red-100 hover:border-red-200' : 'border-slate-100 hover:border-amber-100'
    } hover:shadow-md`}>
      {/* Priority banner for urgent */}
      {job.priority === 'urgent' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-t-2xl border-b border-red-100">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-[11px] font-bold text-red-600 uppercase tracking-wide">
            Urgent — Station {job.fill_level}% full
          </span>
        </div>
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              job.status === 'In Progress' ? 'bg-amber-100' :
              job.status === 'Verified' ? 'bg-green-100' :
              job.status === 'Completed' ? 'bg-orange-100' : 'bg-slate-100'
            }`}>
              <Package className={`w-4 h-4 ${
                job.status === 'In Progress' ? 'text-amber-600' :
                job.status === 'Verified' ? 'text-green-600' :
                job.status === 'Completed' ? 'text-orange-600' : 'text-slate-500'
              }`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-sm">{job.station_name}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sm.badge}`}>
                  {sm.label}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pm.badge}`}>
                  {PriorityIcon && <PriorityIcon className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />}
                  {pm.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {job.address}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-400 flex-shrink-0 pt-0.5">{job.job_id}</span>
        </div>

        {/* Key metrics row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Pickup Window</p>
            <p className="text-xs font-semibold text-slate-700">{job.pickup_window}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Est. Weight</p>
            <p className="text-xs font-semibold text-slate-700">
              {job.estimated_weight_kg > 0 ? `${job.estimated_weight_kg} kg` : 'Unknown'}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">From Depot</p>
            <p className="text-xs font-semibold text-slate-700">{job.distance_from_depot_km} km</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-0.5">Contractor</p>
            <p className="text-xs font-semibold text-slate-700 truncate">
              {contractor ? contractor.name : <span className="text-slate-400">Unassigned</span>}
            </p>
          </div>
        </div>

        {/* Status flow tracker */}
        <div className="mt-4 flex items-center gap-1">
          {STATUS_FLOW.map((step, i) => (
            <React.Fragment key={step}>
              <div className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg ${
                i < currentStep ? 'bg-green-100 text-green-600' :
                i === currentStep ? 'bg-amber-100 text-amber-700' :
                'bg-slate-50 text-slate-300'
              }`}>
                {i < currentStep && <CheckCircle className="w-2.5 h-2.5" />}
                {step}
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <div className={`h-px flex-1 ${i < currentStep ? 'bg-green-300' : 'bg-slate-100'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Trigger chip */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg font-medium ${
            job.trigger.startsWith('IoT') ? 'bg-blue-50 text-blue-600' :
            job.trigger.startsWith('Alert') ? 'bg-red-50 text-red-600' :
            'bg-slate-50 text-slate-500'
          }`}>
            {job.trigger.startsWith('IoT') ? <Zap className="w-3 h-3" /> :
             job.trigger.startsWith('Alert') ? <AlertCircle className="w-3 h-3" /> :
             <Calendar className="w-3 h-3" />}
            {job.trigger}
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-600 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors font-medium"
          >
            {expanded ? <><ChevronUp className="w-3 h-3" /> Hide details</> : <><ChevronDown className="w-3 h-3" /> Show details</>}
          </button>
        </div>

        {/* Expanded detail panel */}
        {expanded && (
          <div className="mt-4 border-t border-slate-50 pt-4 space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Station Fill Level</p>
              <FillBar level={job.fill_level} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Material Types</p>
              <div className="flex flex-wrap gap-1.5">
                {job.materials.map(m => (
                  <span key={m} className="bg-amber-50 text-amber-700 text-[10px] font-medium px-2 py-0.5 rounded-md border border-amber-100">
                    {m}
                  </span>
                ))}
              </div>
            </div>
            {job.special_instructions && (
              <div className="flex items-start gap-2 bg-amber-50 rounded-xl px-3 py-2.5 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span className="font-medium">{job.special_instructions}</span>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          {job.status === 'Pending' && (
            <button
              onClick={() => onAssign(job)}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" /> Assign Contractor
            </button>
          )}
          {job.status === 'Assigned' && contractor && (
            <>
              <button
                onClick={() => onUnassign(job)}
                className="px-3 py-2.5 border border-slate-200 hover:border-red-300 text-slate-500 hover:text-red-600 text-xs font-semibold rounded-xl transition-colors"
              >
                Unassign
              </button>
              <button
                onClick={() => onAssign(job)}
                className="px-3 py-2.5 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold rounded-xl transition-colors"
              >
                Reassign
              </button>
            </>
          )}
          {canAdvance && job.status !== 'Pending' && (
            <button
              onClick={() => onAdvanceStatus(job)}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Advance to {STATUS_FLOW[Math.min(currentStep + 1, STATUS_FLOW.length - 1)]}
            </button>
          )}
          {job.status === 'Verified' && (
            <div className="flex-1 bg-green-50 rounded-xl py-2.5 text-center text-xs font-semibold text-green-700 flex items-center justify-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Verified Complete
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Jobs() {
  const [jobs, setJobs] = useState(JOBS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('')
  const [suburbFilter, setSuburbFilter] = useState('All')
  const [assignTarget, setAssignTarget] = useState(null)

  const suburbs = ['All', ...Array.from(new Set(JOBS.map(j => j.suburb))).sort()]

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      const matchStatus = statusFilter === 'All' || j.status === statusFilter
      const matchSuburb = suburbFilter === 'All' || j.suburb === suburbFilter
      const matchSearch =
        j.station_name.toLowerCase().includes(search.toLowerCase()) ||
        j.job_id.toLowerCase().includes(search.toLowerCase()) ||
        j.address.toLowerCase().includes(search.toLowerCase())
      const matchDate = !dateFilter || j.pickup_window.includes(dateFilter)
      return matchStatus && matchSuburb && matchSearch && matchDate
    })
  }, [jobs, statusFilter, suburbFilter, search, dateFilter])

  const counts = {
    today: jobs.filter(j => j.pickup_window.includes('29 May')).length,
    unassigned: jobs.filter(j => j.status === 'Pending').length,
    inProgress: jobs.filter(j => j.status === 'In Progress').length,
    completed: jobs.filter(j => ['Completed', 'Verified'].includes(j.status)).length,
  }

  function handleAssign(job, contractor) {
    setJobs(prev => prev.map(j =>
      j.job_id === job.job_id
        ? { ...j, assigned_contractor: contractor.id, status: 'Assigned' }
        : j
    ))
  }

  function handleUnassign(job) {
    setJobs(prev => prev.map(j =>
      j.job_id === job.job_id
        ? { ...j, assigned_contractor: null, status: 'Pending' }
        : j
    ))
  }

  function handleAdvanceStatus(job) {
    const current = STATUS_FLOW.indexOf(job.status)
    if (current < STATUS_FLOW.length - 1) {
      setJobs(prev => prev.map(j =>
        j.job_id === job.job_id ? { ...j, status: STATUS_FLOW[current + 1] } : j
      ))
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Board</h1>
          <p className="text-sm text-slate-500 mt-0.5">Recovery Logistics Network · {jobs.length} jobs in system</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <Plus className="w-4 h-4" /> Create Job
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Today's Jobs", value: counts.today, icon: Calendar, color: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'Unassigned',  value: counts.unassigned, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'In Progress', value: counts.inProgress, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Completed',   value: counts.completed,  icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-slate-500 font-medium">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-600">Filters</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search job ID, station or address…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {['All', 'Pending', 'Assigned', 'In Progress', 'Completed', 'Verified'].map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {/* Suburb */}
          <select
            value={suburbFilter}
            onChange={e => setSuburbFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {suburbs.map(s => <option key={s}>{s}</option>)}
          </select>
          {/* Date */}
          <input
            type="text"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            placeholder="Filter by date…"
            className="bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 w-36"
          />
        </div>
        {/* Quick status tabs */}
        <div className="flex gap-2 flex-wrap">
          {['All', 'Pending', 'Assigned', 'In Progress', 'Completed', 'Verified'].map(s => {
            const count = s === 'All' ? jobs.length : jobs.filter(j => j.status === s).length
            const m = STATUS_META[s] || {}
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  statusFilter === s
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                }`}
              >
                {s !== 'All' && m.dot && (
                  <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === s ? 'bg-white' : m.dot}`} />
                )}
                {s}
                <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                  statusFilter === s ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Job list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No jobs match your filters.</p>
          </div>
        ) : (
          filtered.map(job => (
            <JobCard
              key={job.job_id}
              job={job}
              onAssign={setAssignTarget}
              onAdvanceStatus={handleAdvanceStatus}
              onUnassign={handleUnassign}
            />
          ))
        )}
      </div>

      {assignTarget && (
        <AssignPanel
          job={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssign={(job, contractor) => {
            handleAssign(job, contractor)
            setAssignTarget(null)
          }}
        />
      )}
    </div>
  )
}
