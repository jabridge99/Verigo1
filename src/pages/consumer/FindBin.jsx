import React, { useState, useMemo } from 'react'
import {
  MapPin, Search, Navigation, QrCode, Wifi, WifiOff, Battery,
  AlertTriangle, CheckCircle, Clock, ChevronRight, X, Map, List,
  Zap, Activity, Shield, Cpu, Radio, Camera, TrendingUp,
} from 'lucide-react'
import { STATIONS, latLngToPercent } from '../../data/stations'

const STATUS_COLOR = {
  Active:      { pin: 'bg-eco-600', ring: 'ring-eco-300', badge: 'bg-eco-100 text-eco-700' },
  Maintenance: { pin: 'bg-amber-500', ring: 'ring-amber-300', badge: 'bg-amber-100 text-amber-700' },
  Offline:     { pin: 'bg-red-500',   ring: 'ring-red-300',   badge: 'bg-red-100 text-red-700' },
}

const FILL_COLOR = pct =>
  pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-400' : pct > 30 ? 'bg-eco-500' : 'bg-eco-400'

const ACTIVITY_STYLE = {
  High:   'bg-eco-100 text-eco-700',
  Medium: 'bg-blue-100 text-blue-700',
  Low:    'bg-slate-100 text-slate-500',
}

const RISK_STYLE = {
  Low:    'bg-eco-100 text-eco-700',
  Medium: 'bg-amber-100 text-amber-700',
  High:   'bg-red-100 text-red-700',
}

const IOT_STATUS_STYLE = {
  online:    { color: 'text-eco-600',  bg: 'bg-eco-50',   dot: 'bg-eco-500' },
  offline:   { color: 'text-red-600',  bg: 'bg-red-50',   dot: 'bg-red-500' },
  fault:     { color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  ok:        { color: 'text-eco-600',  bg: 'bg-eco-50',   dot: 'bg-eco-500' },
  triggered: { color: 'text-red-600',  bg: 'bg-red-50',   dot: 'bg-red-500' },
  enabled:   { color: 'text-eco-600',  bg: 'bg-eco-50',   dot: 'bg-eco-500' },
  disabled:  { color: 'text-slate-500', bg: 'bg-slate-50', dot: 'bg-slate-400' },
}

function FillGauge({ pct }) {
  const color = FILL_COLOR(pct)
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15" fill="none"
          stroke={pct > 80 ? '#f87171' : pct > 60 ? '#fbbf24' : '#22c55e'}
          strokeWidth="3"
          strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold text-slate-700">{pct}%</span>
      </div>
    </div>
  )
}

function IoTDot({ status }) {
  const s = IOT_STATUS_STYLE[status] || IOT_STATUS_STYLE.offline
  return <span className={`inline-block w-2 h-2 rounded-full ${s.dot}`} />
}

function formatDate(isoString) {
  if (!isoString) return 'N/A'
  const d = new Date(isoString)
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function StationDetail({ station, onClose }) {
  const { iot, collection_schedule } = station
  const statusStyle = STATUS_COLOR[station.status]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900">{station.name}</h2>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusStyle.badge}`}>
                {station.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{station.station_id} · {station.bin_type}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-eco-50 rounded-xl p-3 text-center">
              <FillGauge pct={station.fill_level} />
              <p className="text-[10px] font-semibold text-slate-500 mt-1.5 uppercase tracking-wide">Fill Level</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center flex flex-col items-center justify-center">
              <p className="text-xl font-bold text-eco-700">${station.estimated_value.toFixed(2)}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-1 uppercase tracking-wide">Est. Value</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center flex flex-col items-center justify-center">
              <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${ACTIVITY_STYLE[station.activity_level]}`}>
                {station.activity_level}
              </span>
              <p className="text-[10px] font-semibold text-slate-500 mt-1 uppercase tracking-wide">Activity</p>
            </div>
          </div>

          {/* QR & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <QrCode className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">QR Code</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 flex items-center justify-center h-20">
                <div className="grid grid-cols-5 grid-rows-5 gap-0.5">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-sm ${Math.random() > 0.4 ? 'bg-slate-800' : 'bg-white'}`} />
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center font-mono">{station.qr_code}</p>
            </div>
            <div className="border border-slate-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Location</span>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-snug">{station.address}</p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                {station.gps.lat.toFixed(5)}, {station.gps.lng.toFixed(5)}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs font-bold text-eco-700">{station.distance}</span>
                <span className="text-xs text-slate-400">from you · {station.operator}</span>
              </div>
            </div>
          </div>

          {/* Collection schedule */}
          <div className="border border-slate-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Collection Schedule</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Frequency</p>
                <p className="font-semibold text-slate-700">{collection_schedule.frequency}</p>
                <div className="flex gap-1 mt-1">
                  {collection_schedule.days.map(d => (
                    <span key={d} className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-medium">{d.slice(0, 3)}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Next Pickup</p>
                <p className="font-semibold text-slate-700">
                  {collection_schedule.next_collection ? formatDate(collection_schedule.next_collection) : 'TBD'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Hours: {station.hours}</p>
              </div>
            </div>
          </div>

          {/* IoT sensor status */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">IoT Sensor Status</span>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono ml-auto">
                FW {iot.firmware}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Fill Sensor', icon: Activity, value: iot.fill_sensor, detail: 'Ultrasonic' },
                { label: 'Connectivity', icon: Radio, value: iot.connectivity === 'offline' ? 'offline' : 'online', detail: iot.connectivity },
                { label: 'RFID Reader', icon: Zap, value: iot.rfid, detail: iot.rfid_last_scan },
                { label: 'Tamper Sensor', icon: Shield, value: iot.tamper_sensor, detail: iot.tamper_sensor === 'triggered' ? 'ALERT' : 'Secure' },
                { label: 'Camera', icon: Camera, value: iot.camera ? 'online' : 'disabled', detail: iot.camera ? iot.camera_last_capture : 'Not installed' },
                { label: 'Signal', icon: Wifi, value: iot.signal_strength > 50 ? 'online' : iot.signal_strength > 0 ? 'fault' : 'offline', detail: `${iot.signal_strength}% · ${iot.last_ping}` },
              ].map(({ label, icon: Icon, value, detail }) => {
                const s = IOT_STATUS_STYLE[value] || IOT_STATUS_STYLE.offline
                return (
                  <div key={label} className={`${s.bg} rounded-xl p-3 flex items-start gap-2.5`}>
                    <div className={`w-7 h-7 rounded-lg bg-white/70 flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${s.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <IoTDot status={value} />
                        <span className="text-[11px] font-semibold text-slate-700">{label}</span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${s.color} font-medium truncate`}>{detail}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex items-center gap-3 px-1">
              <Battery className="w-3.5 h-3.5 text-slate-400" />
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${iot.battery > 50 ? 'bg-eco-500' : iot.battery > 20 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${iot.battery}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500 font-medium">{iot.battery}% battery</span>
            </div>
          </div>

          {/* Contamination + Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-100 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Contamination Risk</p>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${RISK_STYLE[station.contamination_risk]}`}>
                {station.contamination_risk} Risk
              </span>
            </div>
            <div className="border border-slate-100 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Monthly Stats</p>
              <p className="text-sm font-bold text-slate-800">{station.stats.monthly_deposits}</p>
              <p className="text-[11px] text-slate-400">deposits · {station.stats.weekly_volume}/wk</p>
            </div>
          </div>

          {/* Materials */}
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Accepted Materials</p>
            <div className="flex flex-wrap gap-1.5">
              {station.materials.map(m => (
                <span key={m} className="bg-eco-50 text-eco-700 text-xs font-medium px-2.5 py-1 rounded-lg border border-eco-100">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-1">
            <button className="flex-1 bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              <Navigation className="w-4 h-4" /> Get Directions
            </button>
            <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
              <QrCode className="w-4 h-4" /> Scan at Station
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MapView({ stations, selected, onSelect }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-slate-200 h-80"
      style={{
        background: '#eef2f7',
        backgroundImage:
          'linear-gradient(to right, #d4dce688 1px, transparent 1px), linear-gradient(to bottom, #d4dce688 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      {/* Suburb labels */}
      {[
        { name: 'Surry Hills', x: '42%', y: '28%' },
        { name: 'Redfern',     x: '38%', y: '48%' },
        { name: 'Darlinghurst', x: '67%', y: '13%' },
        { name: 'Newtown',     x: '16%', y: '55%' },
        { name: 'Marrickville', x: '6%',  y: '72%' },
        { name: 'Alexandria',  x: '31%', y: '68%' },
        { name: 'Waterloo',    x: '50%', y: '58%' },
        { name: 'Glebe',       x: '24%', y: '18%' },
      ].map(l => (
        <span
          key={l.name}
          className="absolute text-[9px] font-bold text-slate-400/80 uppercase tracking-wider select-none pointer-events-none"
          style={{ left: l.x, top: l.y, transform: 'translate(-50%, -50%)' }}
        >
          {l.name}
        </span>
      ))}

      {/* "You are here" dot */}
      <div
        className="absolute w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md ring-4 ring-blue-200/60 z-10"
        style={{ left: '44%', top: '32%', transform: 'translate(-50%, -50%)' }}
      />

      {/* Station pins */}
      {stations.map(s => {
        const pos = latLngToPercent(s.gps.lat, s.gps.lng)
        const c = STATUS_COLOR[s.status]
        const isSelected = selected?.station_id === s.station_id
        const fill = FILL_COLOR(s.fill_level).replace('bg-', '')
        return (
          <button
            key={s.station_id}
            onClick={() => onSelect(s)}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-all group`}
            title={s.name}
          >
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg
              ${c.pin} ${isSelected ? `ring-2 ${c.ring} scale-125` : 'hover:scale-110'}
              transition-transform
            `}>
              <MapPin className="w-3.5 h-3.5 text-white" />
            </div>
            {isSelected && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-white text-slate-800 text-[10px] font-semibold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap border border-slate-100">
                {s.name}
              </div>
            )}
            {/* Fill indicator under pin */}
            <div className={`
              absolute top-full left-1/2 -translate-x-1/2 mt-0.5 h-1 rounded-full
              ${s.fill_level > 80 ? 'bg-red-400' : s.fill_level > 60 ? 'bg-amber-400' : 'bg-eco-500'}
            `} style={{ width: `${(s.fill_level / 100) * 24}px`, minWidth: '3px' }} />
          </button>
        )
      })}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm border border-slate-100">
        <div className="space-y-1">
          {[
            { color: 'bg-eco-600', label: 'Active' },
            { color: 'bg-amber-500', label: 'Maintenance' },
            { color: 'bg-red-500', label: 'Offline' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
              <span className="text-[10px] text-slate-600 font-medium">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* You marker label */}
      <div
        className="absolute bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow"
        style={{ left: '44%', top: '32%', transform: 'translate(10px, -150%)' }}
      >
        You
      </div>
    </div>
  )
}

function StationCard({ station, onSelect }) {
  const c = STATUS_COLOR[station.status]
  const iotOnline = station.iot.connectivity !== 'offline'

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-eco-200 hover:shadow-md transition-all cursor-pointer"
      onClick={() => onSelect(station)}
    >
      <div className="flex items-start gap-3">
        <FillGauge pct={station.fill_level} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 text-sm">{station.name}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.badge}`}>
              {station.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{station.address}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm font-bold text-eco-700">${station.estimated_value.toFixed(2)}</span>
            <span className="text-[11px] text-slate-400">est. reward</span>
            <span className="text-eco-600 font-bold text-xs">{station.distance}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ACTIVITY_STYLE[station.activity_level]}`}>
            {station.activity_level}
          </span>
          <div className="flex items-center gap-1">
            {iotOnline
              ? <Wifi className="w-3 h-3 text-eco-500" />
              : <WifiOff className="w-3 h-3 text-red-400" />
            }
            {station.iot.tamper_sensor === 'triggered' && (
              <AlertTriangle className="w-3 h-3 text-amber-500" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>
            Next: {station.collection_schedule.next_collection
              ? new Date(station.collection_schedule.next_collection).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
              : 'TBD'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-eco-600">
          <span className="font-semibold">View details</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  )
}

export default function FindBin() {
  const [view, setView] = useState('map')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('distance')
  const [selected, setSelected] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)

  function openDetail(station) {
    setSelected(station)
    setDetailOpen(true)
  }

  function closeDetail() {
    setDetailOpen(false)
  }

  const stations = useMemo(() => {
    let list = STATIONS.filter(s => {
      const matchQuery =
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.address.toLowerCase().includes(query.toLowerCase()) ||
        s.suburb.toLowerCase().includes(query.toLowerCase())
      const matchFilter =
        filter === 'all' ||
        (filter === 'active' && s.status === 'Active') ||
        (filter === 'busy' && s.fill_level > 70 && s.status === 'Active') ||
        (filter === 'offline' && s.status !== 'Active')
      return matchQuery && matchFilter
    })

    if (sort === 'distance') list = [...list].sort((a, b) => a.distance_m - b.distance_m)
    else if (sort === 'fill') list = [...list].sort((a, b) => b.fill_level - a.fill_level)
    else if (sort === 'value') list = [...list].sort((a, b) => b.estimated_value - a.estimated_value)

    return list
  }, [query, filter, sort])

  const activeCount = STATIONS.filter(s => s.status === 'Active').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Station Locator</h1>
        <p className="text-sm text-slate-500 mt-1">
          {activeCount} active 240L wheelie bin stations near you.
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search suburb, address or station name…"
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
          />
        </div>
        <button className="flex items-center gap-1.5 bg-eco-700 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-eco-800 transition-colors flex-shrink-0">
          <Navigation className="w-4 h-4" />
          <span className="hidden sm:inline">Near Me</span>
        </button>
      </div>

      {/* View toggle + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-slate-100 rounded-xl p-0.5">
          <button
            onClick={() => setView('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              view === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Map className="w-3.5 h-3.5" /> Map
          </button>
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Available' },
            { key: 'busy', label: 'Nearly Full' },
            { key: 'offline', label: 'Unavailable' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filter === f.key
                  ? 'bg-eco-700 text-white border-eco-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-eco-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-eco-500"
          >
            <option value="distance">Sort: Distance</option>
            <option value="fill">Sort: Fill Level</option>
            <option value="value">Sort: Reward Value</option>
          </select>
        </div>
      </div>

      {/* Map view */}
      {view === 'map' && (
        <>
          <MapView stations={stations} selected={selected} onSelect={setSelected} />
          {selected && (
            <div className="bg-white rounded-2xl border border-eco-200 shadow-sm p-4 flex items-start gap-3">
              <FillGauge pct={selected.fill_level} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{selected.name}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[selected.status].badge}`}>
                    {selected.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selected.address}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm font-bold text-eco-700">${selected.estimated_value.toFixed(2)}</span>
                  <span className="text-[11px] text-slate-400">est. reward</span>
                </div>
              </div>
              <button
                onClick={() => openDetail(selected)}
                className="flex-shrink-0 bg-eco-700 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-eco-800 transition-colors"
              >
                Details
              </button>
            </div>
          )}
        </>
      )}

      {/* List view */}
      <div className={view === 'list' ? 'space-y-3' : 'hidden'}>
        <p className="text-sm font-semibold text-slate-400">{stations.length} station{stations.length !== 1 ? 's' : ''} found</p>
        {stations.map(s => (
          <StationCard key={s.station_id} station={s} onSelect={openDetail} />
        ))}
        {stations.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No stations match your search.</p>
          </div>
        )}
      </div>

      {/* In map view, show compact list below map */}
      {view === 'map' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-400">{stations.length} nearest stations</p>
          {stations.slice(0, 4).map(s => (
            <div
              key={s.station_id}
              onClick={() => setSelected(s)}
              className={`flex items-center gap-3 bg-white rounded-xl border px-4 py-3 cursor-pointer hover:border-eco-200 transition-all ${
                selected?.station_id === s.station_id ? 'border-eco-300 shadow-sm' : 'border-slate-100'
              }`}
            >
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_COLOR[s.status].pin}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-slate-800">{s.name}</span>
                <span className="text-xs text-slate-400 ml-2">{s.distance}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-sm font-bold text-eco-700">${s.estimated_value.toFixed(2)}</span>
                <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full ${FILL_COLOR(s.fill_level)}`}
                    style={{ width: `${s.fill_level}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Station detail modal */}
      {detailOpen && selected && (
        <StationDetail station={selected} onClose={closeDetail} />
      )}
    </div>
  )
}
