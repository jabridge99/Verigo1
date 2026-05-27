import React, { useState } from 'react'
import { Building2, MapPin, Plus, Search, MoreHorizontal } from 'lucide-react'

const STATIONS = [
  { id: 'ST-001', name: 'Surry Hills Hub',    suburb: 'Surry Hills',    status: 'Active',      capacity: 28, lastCollection: '27 May', materials: ['Alum', 'PET', 'Glass', 'Steel'], weeklyVol: '1.8t' },
  { id: 'ST-002', name: 'Redfern Node',       suburb: 'Redfern',        status: 'Active',      capacity: 61, lastCollection: '26 May', materials: ['Alum', 'PET', 'HDPE'],           weeklyVol: '2.1t' },
  { id: 'ST-003', name: 'Darlinghurst Point', suburb: 'Darlinghurst',   status: 'Maintenance', capacity: 0,  lastCollection: '20 May', materials: ['Alum', 'PET', 'Glass'],           weeklyVol: '0t' },
  { id: 'ST-004', name: 'Newtown Station',    suburb: 'Newtown',        status: 'Active',      capacity: 44, lastCollection: '27 May', materials: ['Alum', 'PET', 'HDPE', 'Steel'],   weeklyVol: '2.4t' },
  { id: 'ST-005', name: 'Marrickville Loop',  suburb: 'Marrickville',   status: 'Active',      capacity: 37, lastCollection: '25 May', materials: ['Alum', 'PET', 'Glass'],           weeklyVol: '1.6t' },
  { id: 'ST-006', name: 'Alexandria Node',    suburb: 'Alexandria',     status: 'Offline',     capacity: 0,  lastCollection: '15 May', materials: ['Alum', 'PET'],                    weeklyVol: '0t' },
]

const STATUS_STYLE = {
  Active:      'bg-eco-100 text-eco-700',
  Maintenance: 'bg-amber-100 text-amber-700',
  Offline:     'bg-red-100 text-red-700',
}

function CapacityBar({ pct }) {
  const color = pct === 0 ? 'bg-slate-200' : pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-eco-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500">{pct}%</span>
    </div>
  )
}

export default function OperatorStations() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = STATIONS.filter(
    s =>
      (filter === 'all' || s.status.toLowerCase() === filter) &&
      (s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.suburb.toLowerCase().includes(query.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stations</h1>
          <p className="text-sm text-slate-500 mt-0.5">{STATIONS.length} stations in your network</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Station
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search stations…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'maintenance', 'offline'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border capitalize transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Station table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Station', 'Status', 'Capacity', 'Last Collection', 'Weekly Vol', 'Materials', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(st => (
                <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{st.name}</div>
                        <div className="text-xs text-slate-400">{st.id} · {st.suburb}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[st.status]}`}>
                      {st.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <CapacityBar pct={st.capacity} />
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs">{st.lastCollection}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900">{st.weeklyVol}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {st.materials.map(m => (
                        <span key={m} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
