import React, { useState, useEffect, useRef } from 'react'
import {
  Truck, Clock, MapPin, CheckCircle, AlertCircle, Calendar,
  Plus, X, ChevronDown, Zap, Navigation, Package, Wifi, WifiOff,
  Battery, AlertTriangle,
} from 'lucide-react'
import { iotStream, STATION_REGISTRY } from '../../lib/iotStream'
import { optimizeRoute, buildTimeline, SYDNEY_DEPOT } from '../../lib/routeOptimizer'

// ── Static job seed data ──────────────────────────────────────────────────────

const DRIVERS = ['Alex W.', 'Jamie L.', 'Sam R.', 'Maria K.', 'Tom H.']

function makeSeedJobs() {
  return [
    {
      id: 'CL-2847', date: 'Thu 29 May', window: '08:00', driver: 'Alex W.',
      stationIds: ['ST-001', 'ST-002', 'ST-004'], status: 'scheduled', estKg: 4200,
    },
    {
      id: 'CL-2846', date: 'Wed 28 May', window: '10:00', driver: 'Jamie L.',
      stationIds: ['ST-006'], status: 'en-route', estKg: 2400,
    },
    {
      id: 'CL-2845', date: 'Tue 27 May', window: '07:00', driver: 'Alex W.',
      stationIds: ['ST-001', 'ST-002'], status: 'completed', estKg: 3800,
    },
    {
      id: 'CL-2844', date: 'Mon 26 May', window: '08:00', driver: 'Sam R.',
      stationIds: ['ST-004', 'ST-005'], status: 'completed', estKg: 4000,
    },
    {
      id: 'CL-2843', date: 'Fri 23 May', window: '09:00', driver: 'Maria K.',
      stationIds: ['ST-007', 'ST-008'], status: 'completed', estKg: 2100,
    },
  ]
}

const STATUS_META = {
  scheduled: { label: 'Scheduled',   icon: Clock,        style: 'bg-blue-100 text-blue-700' },
  'en-route': { label: 'En Route',   icon: Truck,        style: 'bg-amber-100 text-amber-700' },
  completed:  { label: 'Completed',  icon: CheckCircle,  style: 'bg-eco-100 text-eco-700' },
}

let jobSeq = 2848

// ── Component ────────────────────────────────────────────────────────────────

export default function OperatorLogistics() {
  const [jobs, setJobs]               = useState(makeSeedJobs)
  const [tab, setTab]                 = useState('active')
  const [stationLive, setStationLive] = useState({})
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState({
    selectedIds: [], driver: '', window: '08:00', date: '',
  })
  const [previewRoute, setPreviewRoute] = useState(null)

  // Subscribe to IoT stream
  useEffect(() => {
    iotStream.connect()
    const unsub = iotStream.subscribe(null, st => {
      setStationLive(prev => ({ ...prev, [st.stationId]: st }))
    })
    return unsub
  }, [])

  // Recompute route preview whenever selected stations change
  useEffect(() => {
    if (form.selectedIds.length < 2) { setPreviewRoute(null); return }
    const stops = form.selectedIds.map(id => {
      const reg = STATION_REGISTRY[id]
      const live = stationLive[id]
      return { id, name: reg.name, suburb: reg.suburb, lat: reg.lat, lng: reg.lng,
               fillPct: live?.fill_pct ?? 0, estimatedKg: live?.weight_today_kg ?? 0 }
    })
    const result   = optimizeRoute(SYDNEY_DEPOT, stops)
    const startMs  = new Date()
    startMs.setHours(...(form.window.split(':').map(Number)), 0, 0)
    const timeline = buildTimeline(startMs, result.stops)
    setPreviewRoute({ ...result, timeline })
  }, [form.selectedIds, form.window, stationLive])

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const activeJobs    = jobs.filter(j => j.status !== 'completed')
  const shown         = tab === 'active' ? activeJobs : completedJobs

  const todayKg       = completedJobs.reduce((s, j) => s + j.estKg, 0)
  const todayComplete = completedJobs.length
  const needsUrgent   = Object.values(stationLive).filter(s => (s.fill_pct ?? 0) >= 75 || s.status === 'offline')

  function toggleStation(id) {
    setForm(f => ({
      ...f,
      selectedIds: f.selectedIds.includes(id)
        ? f.selectedIds.filter(x => x !== id)
        : [...f.selectedIds, id],
    }))
  }

  function dispatchJob() {
    if (!form.selectedIds.length || !form.driver) return
    const id = `CL-${jobSeq++}`
    const today = new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
    setJobs(prev => [{
      id, date: form.date || today, window: form.window, driver: form.driver,
      stationIds: [...form.selectedIds], status: 'scheduled',
      estKg: form.selectedIds.reduce((s, sid) => s + (stationLive[sid]?.weight_today_kg ?? 0), 0),
    }, ...prev])
    setForm({ selectedIds: [], driver: '', window: '08:00', date: '' })
    setPreviewRoute(null)
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Logistics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Dispatch and track 240L bin collection runs</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Dispatch Run
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Jobs',    value: activeJobs.length, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Completed Today', value: todayComplete,    color: 'text-eco-700',  bg: 'bg-eco-50' },
          { label: 'kg Collected',   value: `${(todayKg / 1000).toFixed(1)}t`, color: 'text-indigo-700', bg: 'bg-indigo-50' },
          { label: 'Stations Urgent', value: needsUrgent.length, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border border-slate-100 shadow-sm px-5 py-4 text-center ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Dispatch form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">New Collection Run</h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Station selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Select Stations
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(STATION_REGISTRY).map(([id, cfg]) => {
                const live    = stationLive[id]
                const fill    = live?.fill_pct ?? '—'
                const offline = live?.status === 'offline'
                const urgent  = typeof fill === 'number' && fill >= 75
                const sel     = form.selectedIds.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => toggleStation(id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      sel
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                        : 'border-slate-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-slate-400">{id}</span>
                      {offline
                        ? <WifiOff className="w-3 h-3 text-red-400" />
                        : urgent
                          ? <AlertTriangle className="w-3 h-3 text-amber-500" />
                          : <Wifi className="w-3 h-3 text-eco-500" />
                      }
                    </div>
                    <div className="text-xs font-semibold text-slate-800 leading-tight">{cfg.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {typeof fill === 'number' ? `${fill}% full` : 'offline'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Driver + time */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Driver</label>
              <select
                value={form.driver}
                onChange={e => setForm(f => ({ ...f, driver: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">Select driver…</option>
                {DRIVERS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Start Time</label>
              <input
                type="time"
                value={form.window}
                onChange={e => setForm(f => ({ ...f, window: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Date (optional)</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Route preview */}
          {previewRoute && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Navigation className="w-4 h-4 text-indigo-600" />
                Optimised Route — {previewRoute.totalKm} km total
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin className="w-3 h-3 text-indigo-500" />
                  <span className="font-semibold">Depot</span>
                  <span>→ START</span>
                </div>
                {previewRoute.timeline.map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <MapPin className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    <span className="font-medium">{stop.name}</span>
                    <span className="text-slate-400">ETA {stop.etaFormatted}</span>
                    <span className="text-slate-400">+{stop.distFromPrevKm} km</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <MapPin className="w-3 h-3 text-indigo-500" />
                  <span className="font-semibold">Depot</span>
                  <span>← RETURN ({previewRoute.returnKm} km)</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={dispatchJob}
              disabled={!form.selectedIds.length || !form.driver}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
            >
              Dispatch Job ({form.selectedIds.length} station{form.selectedIds.length !== 1 ? 's' : ''})
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-lg text-sm hover:border-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Job list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {['active', 'completed'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                  tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t} ({t === 'active' ? activeJobs.length : completedJobs.length})
              </button>
            ))}
          </div>

          {shown.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400 text-sm">
              No {tab} jobs
            </div>
          )}

          {shown.map(job => {
            const meta = STATUS_META[job.status]
            const Icon = meta.icon
            return (
              <div key={job.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 font-mono text-sm">{job.id}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.style}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        {job.date} · {job.window} · <span className="font-medium text-slate-700">{job.driver}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-900">{(job.estKg / 1000).toFixed(1)}t</div>
                    <div className="text-[11px] text-slate-400">est. kg</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {job.stationIds.map(sid => {
                    const live = stationLive[sid]
                    const fill = live?.fill_pct ?? null
                    return (
                      <span key={sid} className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                        <MapPin className="w-3 h-3" />
                        {STATION_REGISTRY[sid]?.name ?? sid}
                        {fill !== null && <span className="text-slate-400">· {fill}%</span>}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Live station status sidebar */}
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm uppercase tracking-wide px-1">Live Station Status</h2>
          {Object.entries(STATION_REGISTRY).map(([id, cfg]) => {
            const live    = stationLive[id]
            const fill    = live?.fill_pct ?? null
            const battery = live?.battery_pct ?? null
            const offline = live?.status === 'offline'
            const urgent  = !offline && fill !== null && fill >= 75
            const critical = !offline && fill !== null && fill >= 90

            return (
              <div
                key={id}
                className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${
                  critical ? 'border-red-200 bg-red-50/30'
                  : urgent  ? 'border-amber-200 bg-amber-50/20'
                  : offline ? 'border-slate-200 opacity-60'
                  : 'border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{cfg.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{id}</div>
                  </div>
                  {offline
                    ? <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0" />
                    : <Wifi className="w-4 h-4 text-eco-500 flex-shrink-0" />
                  }
                </div>

                {!offline && fill !== null && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Fill</span>
                      <span className={`font-bold ${critical ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-slate-700'}`}>
                        {fill}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          critical ? 'bg-red-500' : urgent ? 'bg-amber-400' : 'bg-eco-500'
                        }`}
                        style={{ width: `${fill}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Battery className="w-3 h-3" />
                      <span>{battery !== null ? `${battery}%` : '—'}</span>
                      {battery !== null && battery <= 15 && (
                        <span className="text-amber-600 font-semibold">Low</span>
                      )}
                    </div>
                  </div>
                )}

                {offline && (
                  <div className="mt-1.5 text-[11px] font-semibold text-red-500">Offline</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
