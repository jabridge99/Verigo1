import React, { useState, useMemo } from 'react'
import {
  MapPin, Search, AlertTriangle, CheckCircle, WifiOff, Wifi,
  Building2, Activity, Cpu, TrendingUp, Users, Filter, X,
  Battery, Radio, Shield, Zap, Camera, RefreshCw,
} from 'lucide-react'
import { STATIONS, OPERATORS } from '../../data/stations'

const STATUS_STYLE = {
  Active:      'bg-eco-100 text-eco-700',
  Maintenance: 'bg-amber-100 text-amber-700',
  Offline:     'bg-red-100 text-red-700',
}

const RISK_STYLE = {
  Low:    'bg-eco-100 text-eco-700',
  Medium: 'bg-amber-100 text-amber-700',
  High:   'bg-red-100 text-red-700',
}

function ioAlerts(iot) {
  return [
    iot.fill_sensor !== 'online' ? 'Fill sensor fault' : null,
    iot.connectivity === 'offline' ? 'Connectivity offline' : null,
    iot.tamper_sensor === 'triggered' ? 'Tamper triggered' : null,
    iot.tamper_sensor === 'fault' ? 'Tamper sensor fault' : null,
    iot.battery < 20 ? `Low battery (${iot.battery}%)` : null,
  ].filter(Boolean)
}

function CapacityBar({ pct }) {
  const c = pct === 0 ? 'bg-slate-200' : pct > 80 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-eco-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${c} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500">{pct}%</span>
    </div>
  )
}

function AlertPanel({ station, onClose }) {
  const alerts = ioAlerts(station.iot)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-100">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">{station.name}</h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{station.station_id} · {station.operator}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[station.status]}`}>
              {station.status}
            </span>
            <span className="text-xs text-slate-400">{station.address}</span>
          </div>

          {/* IoT alert list */}
          {alerts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Active Alerts ({alerts.length})</p>
              {alerts.map(a => (
                <div key={a} className="flex items-center gap-2.5 bg-red-50 rounded-xl p-3 text-xs text-red-700">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">{a}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-eco-50 rounded-xl p-3 text-xs text-eco-700">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="font-medium">All sensors healthy</span>
            </div>
          )}

          {/* Key IoT stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl p-2.5">
              <p className="text-sm font-bold text-slate-800">{station.iot.signal_strength}%</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Signal</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5">
              <p className="text-sm font-bold text-slate-800">{station.iot.battery}%</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Battery</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5">
              <p className="text-sm font-bold text-slate-800">{station.fill_level}%</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Fill</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors">
              Escalate to Operator
            </button>
            <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-xl transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminStations() {
  const [query, setQuery] = useState('')
  const [operatorFilter, setOperatorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [alertsOnly, setAlertsOnly] = useState(false)
  const [alertStation, setAlertStation] = useState(null)

  const filtered = useMemo(() => {
    return STATIONS.filter(s => {
      const matchOp = operatorFilter === 'all' || s.operator_id === operatorFilter
      const matchStatus = statusFilter === 'all' || s.status.toLowerCase() === statusFilter
      const matchQuery =
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.station_id.toLowerCase().includes(query.toLowerCase()) ||
        s.suburb.toLowerCase().includes(query.toLowerCase()) ||
        s.operator.toLowerCase().includes(query.toLowerCase())
      const matchAlerts = !alertsOnly || ioAlerts(s.iot).length > 0
      return matchOp && matchStatus && matchQuery && matchAlerts
    })
  }, [query, operatorFilter, statusFilter, alertsOnly])

  // Network-wide stats
  const totalActive = STATIONS.filter(s => s.status === 'Active').length
  const totalOffline = STATIONS.filter(s => s.status === 'Offline').length
  const totalAlerts = STATIONS.filter(s => ioAlerts(s.iot).length > 0).length
  const avgFill = Math.round(STATIONS.reduce((a, s) => a + s.fill_level, 0) / STATIONS.length)
  const totalValue = STATIONS.reduce((a, s) => a + s.estimated_value, 0)
  const totalMonthlyDeposits = STATIONS.reduce((a, s) => a + s.stats.monthly_deposits, 0)

  // Per-operator breakdown
  const operatorStats = OPERATORS.map(op => {
    const sts = STATIONS.filter(s => s.operator_id === op.id)
    return {
      ...op,
      total: sts.length,
      active: sts.filter(s => s.status === 'Active').length,
      alerts: sts.filter(s => ioAlerts(s.iot).length > 0).length,
      avgFill: sts.length ? Math.round(sts.reduce((a, s) => a + s.fill_level, 0) / sts.length) : 0,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Station Network</h1>
        <p className="text-sm text-slate-500 mt-1">
          240L wheelie bin station management across all operator partners.
        </p>
      </div>

      {/* Network stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Stations', value: STATIONS.length, color: 'text-slate-800' },
          { label: 'Active',         value: totalActive,     color: 'text-eco-700' },
          { label: 'Offline',        value: totalOffline,    color: totalOffline > 0 ? 'text-red-600' : 'text-slate-400' },
          { label: 'IoT Alerts',     value: totalAlerts,     color: totalAlerts > 0 ? 'text-amber-600' : 'text-slate-400' },
          { label: 'Avg Fill',       value: `${avgFill}%`,   color: avgFill > 70 ? 'text-red-600' : 'text-slate-800' },
          { label: 'Network Value',  value: `$${totalValue.toFixed(0)}`, color: 'text-eco-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Operator breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" /> Operator Partner Summary
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {operatorStats.map(op => (
            <div key={op.id} className="border border-slate-100 rounded-xl p-4">
              <p className="text-sm font-bold text-slate-800">{op.name}</p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{op.id}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-base font-bold text-slate-800">{op.total}</p>
                  <p className="text-[10px] text-slate-400">Stations</p>
                </div>
                <div className="bg-eco-50 rounded-lg p-2">
                  <p className="text-base font-bold text-eco-700">{op.active}</p>
                  <p className="text-[10px] text-slate-400">Active</p>
                </div>
                <div className={`rounded-lg p-2 ${op.alerts > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                  <p className={`text-base font-bold ${op.alerts > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                    {op.alerts}
                  </p>
                  <p className="text-[10px] text-slate-400">Alerts</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-base font-bold text-slate-800">{op.avgFill}%</p>
                  <p className="text-[10px] text-slate-400">Avg Fill</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search station, suburb, operator…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={operatorFilter}
            onChange={e => setOperatorFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Operators</option>
            {OPERATORS.map(op => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="offline">Offline</option>
          </select>
          <button
            onClick={() => setAlertsOnly(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
              alertsOnly
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Alerts Only
          </button>
        </div>
      </div>

      {/* IoT Fleet Health summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-slate-400" /> IoT Fleet Health
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            {
              icon: Activity,
              label: 'Fill Sensors',
              ok: STATIONS.filter(s => s.iot.fill_sensor === 'online').length,
              fault: STATIONS.filter(s => s.iot.fill_sensor !== 'online').length,
            },
            {
              icon: Radio,
              label: 'Connectivity',
              ok: STATIONS.filter(s => s.iot.connectivity !== 'offline').length,
              fault: STATIONS.filter(s => s.iot.connectivity === 'offline').length,
            },
            {
              icon: Zap,
              label: 'RFID',
              ok: STATIONS.filter(s => s.iot.rfid === 'enabled').length,
              fault: STATIONS.filter(s => s.iot.rfid !== 'enabled').length,
            },
            {
              icon: Shield,
              label: 'Tamper',
              ok: STATIONS.filter(s => s.iot.tamper_sensor === 'ok').length,
              fault: STATIONS.filter(s => s.iot.tamper_sensor !== 'ok').length,
            },
            {
              icon: Camera,
              label: 'Cameras',
              ok: STATIONS.filter(s => s.iot.camera).length,
              fault: STATIONS.filter(s => !s.iot.camera).length,
            },
            {
              icon: Battery,
              label: 'Battery',
              ok: STATIONS.filter(s => s.iot.battery >= 20).length,
              fault: STATIONS.filter(s => s.iot.battery < 20).length,
            },
          ].map(({ icon: Icon, label, ok, fault }) => (
            <div key={label} className={`rounded-xl p-3 border ${fault > 0 ? 'border-amber-100 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className={`w-3.5 h-3.5 ${fault > 0 ? 'text-amber-500' : 'text-eco-500'}`} />
                <span className="text-[10px] font-semibold text-slate-600">{label}</span>
              </div>
              <div className="flex items-end gap-1">
                <span className={`text-lg font-bold ${fault > 0 ? 'text-amber-600' : 'text-eco-600'}`}>{ok}</span>
                <span className="text-[10px] text-slate-400 mb-0.5">/ {ok + fault}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">{fault > 0 ? `${fault} issue${fault > 1 ? 's' : ''}` : 'All healthy'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Station table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-600">{filtered.length} station{filtered.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-slate-400">{totalMonthlyDeposits.toLocaleString()} deposits this month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Station', 'Operator', 'Status', 'Fill', 'Est. Value', 'IoT', 'Risk', 'Activity', 'Last Collection', 'Alerts'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(st => {
                const alerts = ioAlerts(st.iot)
                return (
                  <tr
                    key={st.station_id}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setAlertStation(st)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 whitespace-nowrap">{st.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{st.station_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">{st.operator}</td>
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
                      <div className="flex items-center gap-1.5">
                        {st.iot.connectivity !== 'offline'
                          ? <Wifi className="w-3.5 h-3.5 text-eco-500" />
                          : <WifiOff className="w-3.5 h-3.5 text-red-400" />
                        }
                        <span className="text-xs text-slate-500">{st.iot.connectivity}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${RISK_STYLE[st.contamination_risk]}`}>
                        {st.contamination_risk}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        st.activity_level === 'High' ? 'bg-eco-100 text-eco-700' :
                        st.activity_level === 'Medium' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {st.activity_level}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {st.last_collection}
                    </td>
                    <td className="px-5 py-4">
                      {alerts.length > 0 ? (
                        <button
                          onClick={e => { e.stopPropagation(); setAlertStation(st) }}
                          className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {alerts.length}
                        </button>
                      ) : (
                        <CheckCircle className="w-4 h-4 text-eco-400" />
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-slate-400 text-sm">
                    No stations match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {alertStation && (
        <AlertPanel station={alertStation} onClose={() => setAlertStation(null)} />
      )}
    </div>
  )
}
