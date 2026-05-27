import React, { useState, useMemo } from 'react'
import {
  Building2, Search, Plus, MoreHorizontal, X, Cpu, Wifi, WifiOff,
  AlertTriangle, CheckCircle, Activity, Radio, Camera, Zap, Shield,
  Battery, Clock, TrendingUp, Calendar, MapPin, QrCode, RefreshCw,
} from 'lucide-react'
import { STATIONS } from '../../data/stations'

const MY_STATIONS = STATIONS.filter(s => s.operator_id === 'OP-001')

const STATUS_STYLE = {
  Active:      'bg-eco-100 text-eco-700',
  Maintenance: 'bg-amber-100 text-amber-700',
  Offline:     'bg-red-100 text-red-700',
}

const ACTIVITY_STYLE = {
  High:   'bg-eco-100 text-eco-700',
  Medium: 'bg-blue-100 text-blue-700',
  Low:    'bg-slate-100 text-slate-500',
}

const RISK_STYLE = {
  Low:    { badge: 'bg-eco-100 text-eco-700',    bar: 'bg-eco-500',   pct: 8 },
  Medium: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400', pct: 18 },
  High:   { badge: 'bg-red-100 text-red-700',     bar: 'bg-red-400',   pct: 35 },
}

const IOT_S = {
  online:    { dot: 'bg-eco-500',   text: 'text-eco-600' },
  offline:   { dot: 'bg-red-500',   text: 'text-red-600' },
  fault:     { dot: 'bg-amber-500', text: 'text-amber-600' },
  ok:        { dot: 'bg-eco-500',   text: 'text-eco-600' },
  triggered: { dot: 'bg-red-500',   text: 'text-red-600' },
  enabled:   { dot: 'bg-eco-500',   text: 'text-eco-600' },
  disabled:  { dot: 'bg-slate-400', text: 'text-slate-500' },
}

function ioHealth(iot) {
  const issues = [
    iot.fill_sensor !== 'online',
    iot.connectivity === 'offline',
    iot.tamper_sensor === 'triggered' || iot.tamper_sensor === 'fault',
    iot.battery < 20,
  ].filter(Boolean).length
  if (issues === 0) return { label: 'Healthy', style: 'bg-eco-100 text-eco-700' }
  if (issues === 1) return { label: '1 Alert', style: 'bg-amber-100 text-amber-700' }
  return { label: `${issues} Alerts`, style: 'bg-red-100 text-red-700' }
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

function IotCell({ iot }) {
  const h = ioHealth(iot)
  const conn = iot.connectivity !== 'offline'
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${h.style}`}>{h.label}</span>
      {conn
        ? <Wifi className="w-3.5 h-3.5 text-eco-500" />
        : <WifiOff className="w-3.5 h-3.5 text-red-400" />
      }
      {iot.tamper_sensor === 'triggered' && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
    </div>
  )
}

function FillBar({ pct }) {
  const c = pct > 80 ? '#f87171' : pct > 60 ? '#fbbf24' : '#22c55e'
  return (
    <div className="relative h-20 w-8 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
      <div
        className="absolute bottom-0 w-full rounded-lg transition-all"
        style={{ height: `${pct}%`, backgroundColor: c }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-bold text-slate-700 rotate-90 whitespace-nowrap">{pct}%</span>
      </div>
    </div>
  )
}

function SensorRow({ icon: Icon, label, value, detail, bg, textColor, dotColor }) {
  return (
    <div className={`${bg} rounded-xl p-3 flex items-start gap-2.5`}>
      <div className="w-7 h-7 bg-white/60 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className={`w-3.5 h-3.5 ${textColor}`} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="text-[11px] font-semibold text-slate-700">{label}</span>
        </div>
        <p className={`text-[10px] mt-0.5 ${textColor} font-medium`}>{detail}</p>
      </div>
    </div>
  )
}

function StationPanel({ station, onClose }) {
  const { iot, collection_schedule, stats } = station
  const riskStyle = RISK_STYLE[station.contamination_risk]

  function sensorStyle(val) {
    const s = IOT_S[val] || IOT_S.offline
    return { bg: 'bg-slate-50', textColor: s.text, dotColor: s.dot }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm h-full overflow-y-auto shadow-2xl border-l border-slate-100">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900">{station.name}</h2>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[station.status]}`}>
                {station.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{station.station_id} · {station.bin_type}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Fill + value + activity */}
          <div className="flex items-stretch gap-3">
            <FillBar pct={station.fill_level} />
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="bg-eco-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-eco-700">${station.estimated_value.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase tracking-wide">Est. Value</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center flex flex-col items-center justify-center gap-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ACTIVITY_STYLE[station.activity_level]}`}>
                  {station.activity_level}
                </span>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Activity</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-slate-800">{stats.monthly_deposits}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase tracking-wide">Monthly</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-slate-800">{stats.weekly_volume}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase tracking-wide">Weekly Vol</p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="border border-slate-100 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Location</span>
              <span className="ml-auto text-[10px] font-mono text-slate-400">
                {station.gps.lat.toFixed(5)}, {station.gps.lng.toFixed(5)}
              </span>
            </div>
            <p className="text-xs text-slate-700">{station.address}</p>
            <div className="mt-2 flex items-center gap-2">
              <QrCode className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-mono text-slate-500">{station.qr_code}</span>
            </div>
          </div>

          {/* Collection schedule */}
          <div className="border border-slate-100 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Collection Schedule</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-500">Frequency</span>
              <span className="text-[11px] font-semibold text-slate-700">{collection_schedule.frequency}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-500">Days</span>
              <div className="flex gap-1">
                {collection_schedule.days.map(d => (
                  <span key={d} className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    {d.slice(0, 3)}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Next pickup</span>
              <span className="text-[11px] font-semibold text-slate-700">
                {collection_schedule.next_collection
                  ? new Date(collection_schedule.next_collection).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
                  : 'TBD'}
              </span>
            </div>
          </div>

          {/* Contamination risk */}
          <div className="border border-slate-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">Contamination Risk</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${riskStyle.badge}`}>
                {station.contamination_risk}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${riskStyle.bar} rounded-full`} style={{ width: `${riskStyle.pct}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{riskStyle.pct}% non-recyclable material detected</p>
          </div>

          {/* IoT sensors */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">IoT Sensors</span>
              <span className="ml-auto text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                FW {iot.firmware}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SensorRow
                icon={Activity} label="Fill Sensor" value={iot.fill_sensor}
                detail={`Ultrasonic · ${iot.fill_sensor}`}
                {...sensorStyle(iot.fill_sensor)}
              />
              <SensorRow
                icon={Radio} label="Connectivity" value={iot.connectivity === 'offline' ? 'offline' : 'online'}
                detail={`${iot.connectivity} · ${iot.signal_strength}%`}
                {...sensorStyle(iot.connectivity === 'offline' ? 'offline' : 'online')}
              />
              <SensorRow
                icon={Zap} label="RFID" value={iot.rfid}
                detail={`${iot.rfid} · ${iot.rfid_last_scan}`}
                {...sensorStyle(iot.rfid)}
              />
              <SensorRow
                icon={Shield} label="Tamper" value={iot.tamper_sensor}
                detail={iot.tamper_sensor === 'triggered' ? '⚠ Alert triggered' : 'Secure'}
                {...sensorStyle(iot.tamper_sensor)}
              />
              <SensorRow
                icon={Camera} label="Camera" value={iot.camera ? 'online' : 'disabled'}
                detail={iot.camera ? `Last: ${iot.camera_last_capture}` : 'Not installed'}
                {...sensorStyle(iot.camera ? 'online' : 'disabled')}
              />
              <SensorRow
                icon={RefreshCw} label="Last Ping" value="online"
                detail={iot.last_ping}
                {...sensorStyle('online')}
              />
            </div>

            {/* Battery */}
            <div className="mt-3 flex items-center gap-3 px-1">
              <Battery className={`w-4 h-4 ${iot.battery > 50 ? 'text-eco-500' : iot.battery > 20 ? 'text-amber-500' : 'text-red-500'}`} />
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${iot.battery > 50 ? 'bg-eco-500' : iot.battery > 20 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${iot.battery}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-500">{iot.battery}% battery</span>
            </div>
          </div>

          {/* Materials */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Accepted Materials</p>
            <div className="flex flex-wrap gap-1.5">
              {station.materials.map(m => (
                <span key={m} className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pb-2">
            <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Trigger Collection
            </button>
            <button className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors">
              Edit Station
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OperatorStations() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedStation, setSelectedStation] = useState(null)

  const filtered = useMemo(() => {
    return MY_STATIONS.filter(s =>
      (filter === 'all' || s.status.toLowerCase() === filter) &&
      (s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.suburb.toLowerCase().includes(query.toLowerCase()) ||
        s.station_id.toLowerCase().includes(query.toLowerCase()))
    )
  }, [query, filter])

  const activeCount = MY_STATIONS.filter(s => s.status === 'Active').length
  const alertCount = MY_STATIONS.filter(s => ioHealth(s.iot).label !== 'Healthy').length
  const avgFill = Math.round(MY_STATIONS.reduce((a, s) => a + s.fill_level, 0) / MY_STATIONS.length)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stations</h1>
          <p className="text-sm text-slate-500 mt-0.5">{MY_STATIONS.length} 240L wheelie bin stations in your network</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Station
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Stations', value: MY_STATIONS.length, color: 'text-slate-800' },
          { label: 'Active', value: activeCount, color: 'text-eco-700' },
          { label: 'IoT Alerts', value: alertCount, color: alertCount > 0 ? 'text-amber-600' : 'text-slate-400' },
          { label: 'Avg Fill', value: `${avgFill}%`, color: avgFill > 70 ? 'text-red-600' : 'text-slate-800' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, suburb or ID…"
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
                {['Station', 'Status', 'Fill Level', 'Est. Value', 'IoT Health', 'Activity', 'Risk', 'Next Collection', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(st => (
                <tr
                  key={st.station_id}
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedStation(st)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 whitespace-nowrap">{st.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{st.station_id} · {st.suburb}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[st.status]}`}>
                      {st.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <CapacityBar pct={st.fill_level} />
                  </td>
                  <td className="px-5 py-4 font-bold text-eco-700 whitespace-nowrap">
                    ${st.estimated_value.toFixed(2)}
                  </td>
                  <td className="px-5 py-4">
                    <IotCell iot={st.iot} />
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ACTIVITY_STYLE[st.activity_level]}`}>
                      {st.activity_level}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${RISK_STYLE[st.contamination_risk].badge}`}>
                      {st.contamination_risk}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {st.collection_schedule.next_collection
                      ? new Date(st.collection_schedule.next_collection).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
                      : 'TBD'}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedStation(st) }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400 text-sm">
                    No stations match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStation && (
        <StationPanel station={selectedStation} onClose={() => setSelectedStation(null)} />
      )}
    </div>
  )
}
