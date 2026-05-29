import React, { useState } from 'react'
import {
  Map, Clock, CheckCircle, Truck, Package, ChevronDown, ChevronUp,
  Navigation, X, User, Plus, Zap, Calendar, AlertTriangle, Weight,
} from 'lucide-react'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ROUTES = [
  {
    route_id: 'RTE-014',
    name: 'Waterloo–Glebe Morning',
    contractor: 'Wei Zhang · EcoMover NSW',
    start_time: '08:00',
    status: 'Active',
    distance_km: 18.4,
    est_weight_kg: 841,
    stops: [
      { order: 1, station: 'Waterloo Green Point',   address: '50 Cope St, Waterloo',          arrival: '08:15', fill_level: 87, expected_kg: 196 },
      { order: 2, station: 'Redfern Node',            address: '155 Redfern St, Redfern',        arrival: '08:45', fill_level: 61, expected_kg: 148 },
      { order: 3, station: 'Surry Hills Hub',         address: '42 Crown St, Surry Hills',       arrival: '09:10', fill_level: 28, expected_kg: 68  },
      { order: 4, station: 'Darlinghurst Point',      address: '300 Victoria St, Darlinghurst',  arrival: '09:35', fill_level: 74, expected_kg: 178 },
      { order: 5, station: 'Glebe Eco Depot',         address: '12 Glebe Point Rd, Glebe',       arrival: '10:05', fill_level: 55, expected_kg: 132 },
      { order: 6, station: 'Alexandria Depot Drop',   address: '88 Botany Rd, Alexandria',       arrival: '10:40', fill_level: null, expected_kg: null, is_depot: true },
    ],
  },
  {
    route_id: 'RTE-015',
    name: 'Inner West Circuit',
    contractor: 'Marcus Chen · FastPickup Logistics',
    start_time: '09:00',
    status: 'Active',
    distance_km: 22.1,
    est_weight_kg: 723,
    stops: [
      { order: 1, station: 'Newtown Station',         address: '2 King St, Newtown',             arrival: '09:20', fill_level: 44, expected_kg: 108 },
      { order: 2, station: 'Marrickville Loop',       address: '315 Marrickville Rd, Marrickville', arrival: '09:55', fill_level: 37, expected_kg: 92 },
      { order: 3, station: 'Tempe Recycling Hub',     address: '5 Princes Hwy, Tempe',           arrival: '10:25', fill_level: 69, expected_kg: 168 },
      { order: 4, station: 'St Peters Green Point',   address: '22 Hutchinson St, St Peters',    arrival: '10:55', fill_level: 52, expected_kg: 127 },
      { order: 5, station: 'Erskineville Node',       address: '78 Erskineville Rd, Erskineville',arrival: '11:20', fill_level: 93, expected_kg: 228 },
      { order: 6, station: 'Alexandria Depot Drop',   address: '88 Botany Rd, Alexandria',       arrival: '11:55', fill_level: null, expected_kg: null, is_depot: true },
    ],
  },
  {
    route_id: 'RTE-016',
    name: 'City–East Express',
    contractor: 'Lisa Chen · RecycleTruck Pro',
    start_time: '10:30',
    status: 'Planning',
    distance_km: 14.7,
    est_weight_kg: 548,
    stops: [
      { order: 1, station: 'Pyrmont Point',           address: '1 Pirrama Rd, Pyrmont',          arrival: '10:45', fill_level: 72, expected_kg: 115 },
      { order: 2, station: 'CBD Green Hub',            address: '88 George St, Sydney CBD',       arrival: '11:10', fill_level: 48, expected_kg: 114 },
      { order: 3, station: 'Woolloomooloo Bin',        address: '2 Cowper Wharf Rd, Woolloomooloo', arrival: '11:35', fill_level: 81, expected_kg: 196 },
      { order: 4, station: 'Kings Cross Node',         address: '1 Darlinghurst Rd, Kings Cross', arrival: '12:00', fill_level: 50, expected_kg: 123 },
      { order: 5, station: 'Alexandria Depot Drop',    address: '88 Botany Rd, Alexandria',       arrival: '12:40', fill_level: null, expected_kg: null, is_depot: true },
    ],
  },
  {
    route_id: 'RTE-013',
    name: 'South Inner Loop',
    contractor: 'Sarah Park · GreenRoute Transport',
    start_time: '07:30',
    status: 'Completed',
    distance_km: 19.2,
    est_weight_kg: 892,
    stops: [
      { order: 1, station: 'Waterloo Green Point',    address: '50 Cope St, Waterloo',           arrival: '07:48', fill_level: 78, expected_kg: 186 },
      { order: 2, station: 'Alexandria Node',          address: '88 Botany Rd, Alexandria',       arrival: '08:15', fill_level: 65, expected_kg: 158 },
      { order: 3, station: 'Zetland Recycling Point',  address: '40 Epsom Rd, Zetland',           arrival: '08:40', fill_level: 83, expected_kg: 204 },
      { order: 4, station: 'Rosebery Collection Hub',  address: '1 Mentmore Ave, Rosebery',       arrival: '09:10', fill_level: 57, expected_kg: 141 },
      { order: 5, station: 'Mascot Node',              address: '15 Church Ave, Mascot',          arrival: '09:35', fill_level: 41, expected_kg: 100 },
      { order: 6, station: 'Botany Drop Zone',         address: '2 Botany Rd, Botany',            arrival: '09:58', fill_level: 42, expected_kg: 103 },
      { order: 7, station: 'Alexandria Depot Drop',    address: '88 Botany Rd, Alexandria',       arrival: '10:25', fill_level: null, expected_kg: null, is_depot: true },
    ],
  },
]

const ALL_STATIONS = [
  'Waterloo Green Point', 'Redfern Node', 'Surry Hills Hub', 'Darlinghurst Point',
  'Glebe Eco Depot', 'Newtown Station', 'Marrickville Loop', 'Pyrmont Point',
  'CBD Green Hub', 'Woolloomooloo Bin', 'Kings Cross Node', 'Tempe Recycling Hub',
  'St Peters Green Point', 'Erskineville Node', 'Alexandria Node', 'Zetland Recycling Point',
]

const ALL_CONTRACTORS = [
  'Wei Zhang · EcoMover NSW',
  'Marcus Chen · FastPickup Logistics',
  'Lisa Chen · RecycleTruck Pro',
  'Sarah Park · GreenRoute Transport',
  'James Murphy · ClearBin Solutions',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  Active:    { badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   header: 'bg-amber-600' },
  Planning:  { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',    header: 'bg-blue-600'  },
  Completed: { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',   header: 'bg-green-600' },
  Cancelled: { badge: 'bg-slate-100 text-slate-500',   dot: 'bg-slate-400',   header: 'bg-slate-500' },
}

function FillPip({ level }) {
  if (level === null) return null
  const color = level >= 85 ? 'bg-red-400' : level >= 60 ? 'bg-amber-400' : 'bg-green-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${level}%` }} />
      </div>
      <span className={`text-[10px] font-bold ${level >= 85 ? 'text-red-600' : level >= 60 ? 'text-amber-600' : 'text-green-600'}`}>
        {level}%
      </span>
    </div>
  )
}

// ─── Create Route Modal ───────────────────────────────────────────────────────

function CreateRouteModal({ onClose, onConfirm }) {
  const [contractor, setContractor] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [selected, setSelected] = useState([])
  const [preview, setPreview] = useState(false)

  function toggleStation(s) {
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const estDistance = (selected.length * 3.8).toFixed(1)
  const estWeight = selected.length * 142

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Create New Route</h3>
            <p className="text-xs text-slate-400 mt-0.5">Select contractor and stations to build route</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Contractor */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Contractor</label>
            <select
              value={contractor}
              onChange={e => setContractor(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select a contractor…</option>
              {ALL_CONTRACTORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Start time */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Station multi-select */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Stations ({selected.length} selected)
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1">
              {ALL_STATIONS.map(s => (
                <label
                  key={s}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-medium transition-all ${
                    selected.includes(s)
                      ? 'bg-amber-50 border-amber-400 text-amber-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s)}
                    onChange={() => toggleStation(s)}
                    className="accent-amber-600"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          {selected.length > 0 && (
            <div
              className="bg-amber-50 border border-amber-200 rounded-xl p-4 cursor-pointer"
              onClick={() => setPreview(p => !p)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Route Preview (Auto-optimized)</span>
                </div>
                {preview ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-bold text-amber-800">{selected.length} + 1</p>
                  <p className="text-amber-600">Stops</p>
                </div>
                <div>
                  <p className="font-bold text-amber-800">~{estDistance} km</p>
                  <p className="text-amber-600">Distance</p>
                </div>
                <div>
                  <p className="font-bold text-amber-800">~{estWeight} kg</p>
                  <p className="text-amber-600">Est. Weight</p>
                </div>
              </div>
              {preview && (
                <ol className="mt-3 space-y-1">
                  {selected.map((s, i) => (
                    <li key={s} className="flex items-center gap-2 text-xs text-amber-700">
                      <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                  <li className="flex items-center gap-2 text-xs text-amber-700 opacity-60">
                    <span className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0">D</span>
                    Alexandria Depot Drop
                  </li>
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button
            disabled={!contractor || selected.length === 0}
            onClick={() => { onConfirm({ contractor, startTime, stations: selected }); onClose() }}
            className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            {contractor && selected.length > 0 ? 'Confirm Route' : 'Fill all fields'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Route Card ───────────────────────────────────────────────────────────────

function RouteCard({ route }) {
  const [expanded, setExpanded] = useState(false)
  const sm = STATUS_META[route.status]

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
      {/* Coloured header */}
      <div className={`${sm.header} px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-white opacity-80" />
          <span className="text-white font-bold text-sm">{route.name}</span>
          <span className="bg-white/20 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
            {route.status}
          </span>
          {route.status !== 'Completed' && route.status !== 'Cancelled' && (
            <span className="bg-white/15 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Auto-optimized
            </span>
          )}
        </div>
        <span className="text-white/70 text-[11px] font-mono">{route.route_id}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Contractor + start time */}
        <div className="flex items-center gap-3 text-xs">
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{route.contractor}</p>
            <p className="text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" /> Start {route.start_time}
            </p>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Stops',    value: route.stops.length },
            { label: 'Distance', value: `${route.distance_km} km` },
            { label: 'Est. Wt', value: `${route.est_weight_kg} kg` },
            { label: 'Status',   value: route.status, colored: true },
          ].map(m => (
            <div key={m.label} className="bg-slate-50 rounded-xl p-2.5 text-center">
              <p className={`text-sm font-bold ${m.colored ? (sm.header.replace('bg-', 'text-')) : 'text-slate-800'}`}>
                {m.value}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-amber-600 py-1.5 rounded-xl hover:bg-amber-50 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Hide stops</> : <><ChevronDown className="w-3.5 h-3.5" /> Show {route.stops.length} stops</>}
        </button>

        {/* Stop list */}
        {expanded && (
          <div className="space-y-2 border-t border-slate-50 pt-3">
            {route.stops.map(stop => (
              <div
                key={stop.order}
                className={`flex items-start gap-3 p-3 rounded-xl ${stop.is_depot ? 'bg-slate-50 opacity-60' : 'bg-white border border-slate-100'}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  stop.is_depot ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-700'
                }`}>
                  {stop.is_depot ? 'D' : stop.order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800 truncate">{stop.station}</p>
                    <span className="text-[11px] text-slate-400 flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{stop.arrival}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{stop.address}</p>
                  {!stop.is_depot && (
                    <div className="mt-1.5 flex items-center gap-3">
                      <FillPip level={stop.fill_level} />
                      <span className="text-[10px] text-slate-400">~{stop.expected_kg} kg</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {route.status === 'Planning' && (
            <button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Assign & Start
            </button>
          )}
          {route.status === 'Active' && (
            <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
              <Navigation className="w-3.5 h-3.5" /> Track Live
            </button>
          )}
          {route.status === 'Completed' && (
            <div className="flex-1 bg-green-50 border border-green-100 rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold text-green-700">
              <CheckCircle className="w-3.5 h-3.5" /> Route Complete · {route.est_weight_kg} kg collected
            </div>
          )}
          <button className="px-3.5 py-2.5 border border-slate-200 hover:border-slate-300 text-slate-500 text-xs font-semibold rounded-xl transition-colors">
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Routes() {
  const [routes, setRoutes] = useState(ROUTES)
  const [statusFilter, setStatusFilter] = useState('All')
  const [showCreate, setShowCreate] = useState(false)

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const filtered = routes.filter(r => statusFilter === 'All' || r.status === statusFilter)

  const activeRoutes = routes.filter(r => r.status === 'Active').length
  const totalStops = routes.filter(r => r.status === 'Active').reduce((a, r) => a + r.stops.length, 0)
  const totalKm = routes.filter(r => r.status === 'Active').reduce((a, r) => a + r.distance_km, 0)

  function handleCreateRoute(data) {
    const newRoute = {
      route_id: `RTE-${100 + routes.length}`,
      name: `${data.contractor.split(' ')[0]} Route`,
      contractor: data.contractor,
      start_time: data.startTime,
      status: 'Planning',
      distance_km: parseFloat((data.stations.length * 3.8).toFixed(1)),
      est_weight_kg: data.stations.length * 142,
      stops: [
        ...data.stations.map((s, i) => ({
          order: i + 1, station: s, address: 'Sydney NSW',
          arrival: null, fill_level: 55, expected_kg: 142,
        })),
        { order: data.stations.length + 1, station: 'Alexandria Depot Drop', address: '88 Botany Rd, Alexandria', arrival: null, fill_level: null, expected_kg: null, is_depot: true },
      ],
    }
    setRoutes(prev => [newRoute, ...prev])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Route Planner</h1>
          <p className="text-sm text-slate-500 mt-0.5">{today}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-slate-500">
              <span className="font-bold text-amber-700">{activeRoutes}</span> active routes
            </span>
            <span className="text-xs text-slate-500">
              <span className="font-bold text-amber-700">{totalStops}</span> stops in progress
            </span>
            <span className="text-xs text-slate-500">
              <span className="font-bold text-amber-700">{totalKm.toFixed(1)} km</span> in field
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-xs font-semibold text-amber-700">
            <Zap className="w-3.5 h-3.5" /> Auto-optimized for min. distance
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Route
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Routes',  value: routes.length,                                              color: 'text-slate-800' },
          { label: 'Active',        value: routes.filter(r => r.status === 'Active').length,          color: 'text-amber-600' },
          { label: 'Planning',      value: routes.filter(r => r.status === 'Planning').length,        color: 'text-blue-600'  },
          { label: 'Completed',     value: routes.filter(r => r.status === 'Completed').length,       color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Active', 'Planning', 'Completed', 'Cancelled'].map(f => {
          const sm = STATUS_META[f] || {}
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
              {f !== 'All' && sm.dot && (
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === f ? 'bg-white' : sm.dot}`} />
              )}
              {f === 'All' ? 'All Routes' : f}
              <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                statusFilter === f ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
              }`}>
                {f === 'All' ? routes.length : routes.filter(r => r.status === f).length}
              </span>
            </button>
          )
        })}
      </div>

      {/* Route cards */}
      <div className="grid sm:grid-cols-2 gap-5">
        {filtered.map(r => (
          <RouteCard key={r.route_id} route={r} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-400">
            <Map className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No routes match this filter.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRouteModal
          onClose={() => setShowCreate(false)}
          onConfirm={handleCreateRoute}
        />
      )}
    </div>
  )
}
