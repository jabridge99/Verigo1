import React, { useState } from 'react'
import {
  Star, Truck, MapPin, Clock, Search, Filter,
  CheckCircle, X, Upload, ChevronDown, MessageSquare,
  Award, Zap, Users,
} from 'lucide-react'

const CONTRACTORS = [
  {
    id: 'C001',
    name: 'FastHaul Logistics',
    initials: 'FH',
    location: 'Sydney, NSW',
    vehicle: 'Box Truck (3.5t)',
    rating: 4.9,
    jobsDone: 312,
    ratePerRun: 145,
    avgResponseMin: 12,
    specialties: ['Hazardous', 'Bulk Metals', 'Same-day'],
    availability: 'Available',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'C002',
    name: 'GreenMove Co.',
    initials: 'GM',
    location: 'Melbourne, VIC',
    vehicle: 'Flatbed (5t)',
    rating: 4.7,
    jobsDone: 245,
    ratePerRun: 130,
    avgResponseMin: 18,
    specialties: ['Electronics', 'White Goods'],
    availability: 'Available',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'C003',
    name: 'EcoTransport QLD',
    initials: 'ET',
    location: 'Brisbane, QLD',
    vehicle: 'Curtainsider (8t)',
    rating: 4.8,
    jobsDone: 198,
    ratePerRun: 175,
    avgResponseMin: 22,
    specialties: ['Bulk Plastics', 'Long Haul'],
    availability: 'On Job',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'C004',
    name: 'RapidRecycle SA',
    initials: 'RR',
    location: 'Adelaide, SA',
    vehicle: 'Ute + Trailer (2t)',
    rating: 4.5,
    jobsDone: 87,
    ratePerRun: 95,
    avgResponseMin: 9,
    specialties: ['Residential', 'Glass'],
    availability: 'Available',
    color: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'C005',
    name: 'MetalMover WA',
    initials: 'MM',
    location: 'Perth, WA',
    vehicle: 'Tipper (6t)',
    rating: 4.6,
    jobsDone: 153,
    ratePerRun: 160,
    avgResponseMin: 30,
    specialties: ['Scrap Metal', 'Demolition'],
    availability: 'Available',
    color: 'bg-rose-100 text-rose-700',
  },
  {
    id: 'C006',
    name: 'SortRight NSW',
    initials: 'SR',
    location: 'Parramatta, NSW',
    vehicle: 'Box Truck (3.5t)',
    rating: 4.4,
    jobsDone: 74,
    ratePerRun: 120,
    avgResponseMin: 15,
    specialties: ['Cardboard', 'Paper', 'Sorting'],
    availability: 'Offline',
    color: 'bg-slate-100 text-slate-600',
  },
  {
    id: 'C007',
    name: 'ClearBin VIC',
    initials: 'CB',
    location: 'Geelong, VIC',
    vehicle: 'Flatbed (4t)',
    rating: 4.8,
    jobsDone: 211,
    ratePerRun: 140,
    avgResponseMin: 20,
    specialties: ['Bulk Plastics', 'HDPE', 'PET'],
    availability: 'Available',
    color: 'bg-teal-100 text-teal-700',
  },
  {
    id: 'C008',
    name: 'NorthHaul QLD',
    initials: 'NH',
    location: 'Townsville, QLD',
    vehicle: 'Curtainsider (10t)',
    rating: 4.3,
    jobsDone: 56,
    ratePerRun: 195,
    avgResponseMin: 45,
    specialties: ['Long Haul', 'Refrigerated'],
    availability: 'On Job',
    color: 'bg-indigo-100 text-indigo-700',
  },
]

const AVAILABILITY_STYLE = {
  Available: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  'On Job':  { badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500'   },
  Offline:   { badge: 'bg-slate-100 text-slate-500',     dot: 'bg-slate-400'   },
}

const VEHICLE_TYPES = ['All Vehicles', 'Box Truck', 'Flatbed', 'Curtainsider', 'Tipper', 'Ute + Trailer']

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

function ContractorCard({ contractor }) {
  const avail = AVAILABILITY_STYLE[contractor.availability] || AVAILABILITY_STYLE.Offline

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all ${
      contractor.availability === 'Available' ? 'border-amber-100 hover:border-amber-200' : 'border-slate-100'
    }`}>
      {/* Avatar + name row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="relative flex-shrink-0">
          <div className={`w-11 h-11 rounded-2xl ${contractor.color} flex items-center justify-center font-bold text-sm`}>
            {contractor.initials}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${avail.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div>
              <p className="font-bold text-slate-900 text-sm leading-tight">{contractor.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="text-[11px] text-slate-500">{contractor.location}</span>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${avail.badge}`}>
              {contractor.availability}
            </span>
          </div>
        </div>
      </div>

      {/* Vehicle + rating */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Truck className="w-3.5 h-3.5 text-slate-400" />
          {contractor.vehicle}
        </div>
        <Stars rating={contractor.rating} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-50 rounded-xl p-2.5 text-center">
          <p className="text-sm font-bold text-slate-800">{contractor.jobsDone}</p>
          <p className="text-[10px] text-slate-400 font-medium">Jobs Done</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-2.5 text-center">
          <p className="text-sm font-bold text-amber-700">${contractor.ratePerRun}</p>
          <p className="text-[10px] text-slate-400 font-medium">Per Run</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-2.5 text-center">
          <div className="flex items-center justify-center gap-0.5">
            <Clock className="w-3 h-3 text-slate-400" />
            <p className="text-sm font-bold text-slate-700">{contractor.avgResponseMin}m</p>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Avg Resp.</p>
        </div>
      </div>

      {/* Specialty chips */}
      <div className="flex flex-wrap gap-1 mb-4">
        {contractor.specialties.map(s => (
          <span key={s} className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
            {s}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          disabled={contractor.availability === 'Offline'}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" /> Hire
        </button>
        <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" /> Message
        </button>
      </div>
    </div>
  )
}

function ApplicationModal({ onClose }) {
  const [suburbs, setSuburbs] = useState([''])
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', vehicle: '', abn: '' })

  function addSuburb() {
    setSuburbs(s => [...s, ''])
  }
  function updateSuburb(i, val) {
    setSuburbs(s => s.map((x, idx) => idx === i ? val : x))
  }
  function removeSuburb(i) {
    setSuburbs(s => s.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-bold text-slate-900">Contractor Application</h3>
            <p className="text-xs text-slate-400 mt-0.5">Join the EcoBin recovery network</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-10 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Application Received!</h3>
            <p className="text-sm text-slate-500 mb-1">Thanks, <span className="font-semibold text-slate-700">{form.name || 'applicant'}</span>.</p>
            <p className="text-sm text-slate-500">Our team will review your application and be in touch within 2 business days.</p>
            <button onClick={onClose} className="mt-6 bg-amber-600 text-white font-semibold py-2.5 px-6 rounded-xl text-sm hover:bg-amber-700 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Vehicle Type</label>
              <select
                required
                value={form.vehicle}
                onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">Select vehicle type…</option>
                {VEHICLE_TYPES.slice(1).map(v => <option key={v}>{v}</option>)}
                <option>Other (specify in notes)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">ABN</label>
              <input
                required
                type="text"
                value={form.abn}
                onChange={e => setForm(f => ({ ...f, abn: e.target.value }))}
                placeholder="12 345 678 901"
                maxLength={14}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">Coverage Suburbs</label>
                <button type="button" onClick={addSuburb} className="text-[10px] font-semibold text-amber-600 hover:text-amber-700">
                  + Add suburb
                </button>
              </div>
              <div className="space-y-2">
                {suburbs.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={s}
                      onChange={e => updateSuburb(i, e.target.value)}
                      placeholder={`Suburb ${i + 1}`}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    {suburbs.length > 1 && (
                      <button type="button" onClick={() => removeSuburb(i)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Driver's Licence (upload)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-amber-300 transition-colors cursor-pointer">
                <Upload className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs text-slate-400">Click to upload or drag & drop</p>
                <p className="text-[10px] text-slate-300 mt-0.5">PDF, JPG, PNG — max 5 MB</p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl text-sm hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                Submit Application
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ContractorMarketplace() {
  const [query, setQuery] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('All Vehicles')
  const [availFilter, setAvailFilter] = useState('All')
  const [minRating, setMinRating] = useState(0)
  const [showApplication, setShowApplication] = useState(false)

  const available  = CONTRACTORS.filter(c => c.availability === 'Available').length
  const onJob      = CONTRACTORS.filter(c => c.availability === 'On Job').length
  const avgRating  = (CONTRACTORS.reduce((s, c) => s + c.rating, 0) / CONTRACTORS.length).toFixed(1)
  const jobsMTD    = CONTRACTORS.reduce((s, c) => s + Math.floor(c.jobsDone * 0.08), 0)
  const areasCovered = new Set(CONTRACTORS.map(c => c.location.split(', ')[1])).size

  const filtered = CONTRACTORS.filter(c => {
    const matchQuery = !query ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.location.toLowerCase().includes(query.toLowerCase()) ||
      c.specialties.some(s => s.toLowerCase().includes(query.toLowerCase()))
    const matchVehicle = vehicleFilter === 'All Vehicles' || c.vehicle.toLowerCase().includes(vehicleFilter.toLowerCase())
    const matchAvail   = availFilter === 'All' || c.availability === availFilter
    const matchRating  = c.rating >= minRating
    return matchQuery && matchVehicle && matchAvail && matchRating
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contractor Network</h1>
          <p className="text-sm text-slate-500 mt-0.5">EcoBin Recovery Logistics — vetted contractors</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Now',     value: available,         color: 'text-emerald-700', bg: 'bg-emerald-50',  icon: <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" /> },
          { label: 'Avg Rating',     value: `${avgRating} ★`, color: 'text-amber-700',   bg: 'bg-amber-50',    icon: <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" /> },
          { label: 'Jobs MTD',       value: jobsMTD,           color: 'text-slate-800',   bg: 'bg-slate-50',    icon: <Truck className="w-3.5 h-3.5 text-slate-400" /> },
          { label: 'Areas Covered',  value: `${areasCovered} states`, color: 'text-violet-700', bg: 'bg-violet-50', icon: <MapPin className="w-3.5 h-3.5 text-violet-500" /> },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3`}>
            <div className="mt-1">{s.icon}</div>
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, suburb, or specialty…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={vehicleFilter}
            onChange={e => setVehicleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {VEHICLE_TYPES.map(v => <option key={v}>{v}</option>)}
          </select>
          <select
            value={availFilter}
            onChange={e => setAvailFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="All">All Availability</option>
            <option value="Available">Available</option>
            <option value="On Job">On Job</option>
            <option value="Offline">Offline</option>
          </select>
          <select
            value={minRating}
            onChange={e => setMinRating(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value={0}>Any Rating</option>
            <option value={4}>4.0+</option>
            <option value={4.5}>4.5+</option>
            <option value={4.8}>4.8+</option>
          </select>
        </div>
        {(query || vehicleFilter !== 'All Vehicles' || availFilter !== 'All' || minRating > 0) && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
            <p className="text-xs text-slate-500">{filtered.length} contractor{filtered.length !== 1 ? 's' : ''} match filters</p>
            <button
              onClick={() => { setQuery(''); setVehicleFilter('All Vehicles'); setAvailFilter('All'); setMinRating(0) }}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Contractor grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(c => <ContractorCard key={c.id} contractor={c} />)}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-400">
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">No contractors match your filters.</p>
            <p className="text-xs mt-1">Try adjusting the search or filter criteria.</p>
          </div>
        )}
      </div>

      {/* Onboarding CTA panel */}
      <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-amber-200" />
              <h2 className="text-lg font-bold">Become a Contractor</h2>
            </div>
            <p className="text-amber-100 text-sm mb-4">
              Join Australia's fastest-growing resource recovery network. Set your own rates, work your own hours.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                'Active ABN registered in Australia',
                'Vehicle payload greater than 1 tonne',
                'Public liability insurance (min $5M)',
                'Valid driver\'s licence (HC or above)',
              ].map(req => (
                <div key={req} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                  <span className="text-amber-100 text-xs">{req}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={() => setShowApplication(true)}
              className="bg-white text-amber-700 hover:bg-amber-50 font-bold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm w-full sm:w-auto"
            >
              Apply Now
            </button>
            <p className="text-amber-200 text-[11px] text-center mt-2">Takes about 3 minutes</p>
          </div>
        </div>
      </div>

      {showApplication && <ApplicationModal onClose={() => setShowApplication(false)} />}
    </div>
  )
}
