import React, { useState } from 'react'
import { MapPin, Search, Clock, ChevronRight, CheckCircle } from 'lucide-react'

const BINS = [
  {
    id: 'CZ-001',
    name: 'Surry Hills Collection Zone',
    address: '42 Crown St, Surry Hills NSW 2010',
    distance: '0.3 km',
    status: 'Available',
    capacity: 28,
    nextCollection: 'Thu 29 May, 8am–12pm',
    materials: ['Aluminium', 'PET Plastic', 'Glass', 'Cardboard'],
    hours: 'Mon–Sat 7am–6pm',
  },
  {
    id: 'CZ-002',
    name: 'Redfern Recycling Point',
    address: '155 Redfern St, Redfern NSW 2016',
    distance: '0.9 km',
    status: 'Available',
    capacity: 61,
    nextCollection: 'Wed 28 May, 10am–2pm',
    materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Steel'],
    hours: 'Mon–Sun 6am–8pm',
  },
  {
    id: 'CZ-003',
    name: 'Central Station Drop-off',
    address: 'Elizabeth St entrance, Sydney NSW 2000',
    distance: '1.4 km',
    status: 'Busy',
    capacity: 84,
    nextCollection: 'Fri 30 May, 6am–10am',
    materials: ['Aluminium', 'PET Plastic', 'Glass'],
    hours: 'Mon–Sun 6am–10pm',
  },
  {
    id: 'CZ-004',
    name: 'Darlinghurst Household Hub',
    address: '300 Victoria St, Darlinghurst NSW 2010',
    distance: '1.8 km',
    status: 'Available',
    capacity: 42,
    nextCollection: 'Thu 29 May, 2pm–6pm',
    materials: ['Aluminium', 'PET Plastic', 'HDPE', 'Glass', 'Steel', 'Cardboard'],
    hours: 'Mon–Fri 8am–7pm',
  },
]

const STATUS_STYLE = {
  Available: 'bg-eco-100 text-eco-700',
  Busy:      'bg-amber-100 text-amber-700',
  Offline:   'bg-red-100 text-red-700',
}

function CapacityBar({ pct }) {
  const color = pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-eco-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  )
}

export default function FindBin() {
  const [query, setQuery] = useState('')

  const filtered = BINS.filter(
    b =>
      b.name.toLowerCase().includes(query.toLowerCase()) ||
      b.address.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Find a Collection Zone</h1>
        <p className="text-sm text-slate-500 mt-1">
          Locate your nearest 240L bin drop-off or scheduled pickup zone.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by suburb or postcode…"
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
        />
      </div>

      {/* Map placeholder */}
      <div className="bg-slate-100 rounded-2xl h-56 flex items-center justify-center border border-slate-200 relative overflow-hidden">
        <div className="text-center">
          <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">Interactive map</p>
          <p className="text-xs text-slate-400">4 collection zones near Surry Hills, NSW</p>
        </div>
        {/* Mock zone dots */}
        {[
          { x: '35%', y: '40%' }, { x: '55%', y: '55%' },
          { x: '65%', y: '30%' }, { x: '28%', y: '65%' },
        ].map((dot, i) => (
          <div
            key={i}
            className="absolute w-5 h-5 bg-eco-600 rounded-full border-2 border-white shadow-md flex items-center justify-center"
            style={{ left: dot.x, top: dot.y }}
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        ))}
      </div>

      {/* Zone list */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-500">{filtered.length} zones found</p>
        {filtered.map(bin => (
          <div
            key={bin.id}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-eco-200 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 bg-eco-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-eco-700" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{bin.name}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[bin.status]}`}>
                      {bin.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{bin.address}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-eco-700">{bin.distance}</div>
                <div className="text-[11px] text-slate-400">away</div>
              </div>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Bin Capacity
                  </div>
                  <CapacityBar pct={bin.capacity} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  {bin.hours}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Next Collection
                </div>
                <div className="text-xs font-semibold text-slate-700">{bin.nextCollection}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {bin.materials.slice(0, 3).map(m => (
                    <span key={m} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {m}
                    </span>
                  ))}
                  {bin.materials.length > 3 && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      +{bin.materials.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-eco-700 hover:bg-eco-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                Schedule Pickup Here
              </button>
              <button className="px-4 py-2 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1">
                Details <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
