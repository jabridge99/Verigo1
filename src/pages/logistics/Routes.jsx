import React, { useState } from 'react'
import {
  Map, Clock, CheckCircle, Truck, Zap, Package, ChevronRight,
  ArrowRight, TrendingDown, Navigation, X, User,
} from 'lucide-react'
import { ROUTES, CONTRACTORS } from '../../data/woms'

const STATUS_STYLE = {
  Completed:    { badge: 'bg-eco-100 text-eco-700',   header: 'bg-eco-600' },
  'In Progress':{ badge: 'bg-amber-100 text-amber-700', header: 'bg-amber-500' },
  Optimized:    { badge: 'bg-blue-100 text-blue-700',  header: 'bg-blue-500' },
  Draft:        { badge: 'bg-slate-100 text-slate-600', header: 'bg-slate-400' },
}

const STOP_STYLE = {
  Completed:    'bg-eco-700 text-white',
  'In Progress':'bg-amber-500 text-white',
  Pending:      'bg-slate-200 text-slate-500',
}

function AssignModal({ route, onClose }) {
  const [selected, setSelected] = useState(null)
  const available = CONTRACTORS.filter(c => c.status === 'Available')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Assign to Route</h3>
            <p className="text-xs text-slate-400 mt-0.5">{route.route_id} · {route.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          {available.map(c => (
            <button
              key={c.contractor_id}
              onClick={() => setSelected(c)}
              className={`w-full flex items-center gap-3 rounded-xl p-3 border text-left transition-all ${
                selected?.contractor_id === c.contractor_id
                  ? 'border-amber-400 bg-amber-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
              }`}
            >
              <div className="w-8 h-8 bg-white rounded-xl border border-slate-200 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-600">{c.driver.split(' ').map(n => n[0]).join('')}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{c.driver}</p>
                <p className="text-[11px] text-slate-400">{c.name} · ${c.cost_per_job}/job · ★{c.rating}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
          <button
            disabled={!selected}
            className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            {selected ? 'Assign & Start' : 'Select Driver'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MockMap({ route }) {
  const positions = [
    { x: '20%', y: '55%' }, { x: '40%', y: '30%' }, { x: '60%', y: '60%' }, { x: '78%', y: '40%' },
  ]
  return (
    <div
      className="relative rounded-xl overflow-hidden h-36 border border-slate-200"
      style={{
        background: '#eef2f7',
        backgroundImage: 'linear-gradient(to right, #d4dce688 1px, transparent 1px), linear-gradient(to bottom, #d4dce688 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Route line */}
      <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
        {route.stops.slice(0, -1).map((_, i) => {
          const from = positions[i]
          const to = positions[i + 1]
          if (!from || !to) return null
          return (
            <line
              key={i}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={i === 0 && route.status === 'In Progress' ? '#f59e0b' : '#94a3b8'}
              strokeWidth="1.5" strokeDasharray={route.status === 'Optimized' ? '4 3' : 'none'}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      {/* Stop pins */}
      {route.stops.map((stop, i) => {
        const pos = positions[i]
        if (!pos) return null
        return (
          <div
            key={stop.order}
            className={`absolute w-7 h-7 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold -translate-x-1/2 -translate-y-1/2 ${STOP_STYLE[stop.status]}`}
            style={{ left: pos.x, top: pos.y }}
          >
            {stop.order}
          </div>
        )
      })}
    </div>
  )
}

function RouteCard({ route, onAssign }) {
  const s = STATUS_STYLE[route.status]
  const completedStops = route.stops.filter(s => s.status === 'Completed').length
  const savingsEstimate = Math.round(route.route_cost * (route.savings_pct / 100))

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
      <div className={`${s.header} px-5 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">{route.name}</span>
          <span className="bg-white/20 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{route.status}</span>
        </div>
        <span className="text-white/80 text-[11px] font-mono">{route.route_id}</span>
      </div>

      <div className="p-5 space-y-4">
        <MockMap route={route} />

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-sm font-bold text-slate-800">{route.stops.length}</p>
            <p className="text-[10px] text-slate-400 font-medium">Stops</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-sm font-bold text-slate-800">{route.total_distance_km} km</p>
            <p className="text-[10px] text-slate-400 font-medium">Distance</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-sm font-bold text-slate-800">{route.estimated_duration}</p>
            <p className="text-[10px] text-slate-400 font-medium">Est. Time</p>
          </div>
          <div className="bg-eco-50 rounded-xl p-2.5">
            <div className="flex items-center justify-center gap-0.5">
              <TrendingDown className="w-3 h-3 text-eco-600" />
              <p className="text-sm font-bold text-eco-700">{route.savings_pct}%</p>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Optimized</p>
          </div>
        </div>

        {/* Contractor */}
        {route.contractor_name ? (
          <div className="flex items-center gap-2 text-xs">
            <Truck className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-600 font-medium">{route.contractor_name}</span>
            {route.status === 'In Progress' && (
              <span className="ml-auto bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {completedStops}/{route.stops.length} stops done
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <User className="w-3.5 h-3.5" />
            <span>No contractor assigned</span>
          </div>
        )}

        {/* Stop list */}
        <div className="space-y-1.5">
          {route.stops.map(stop => (
            <div key={stop.order} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${STOP_STYLE[stop.status]}`}>
                {stop.status === 'Completed' ? '✓' : stop.order}
              </div>
              <span className="text-xs text-slate-700 flex-1 font-medium truncate">{stop.station}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {stop.eta && <span className="text-[11px] text-slate-400">{stop.eta}</span>}
                {stop.actual && <span className="text-[11px] text-eco-600 font-semibold">→ {stop.actual}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Cost */}
        <div className="flex items-center justify-between text-xs border-t border-slate-50 pt-3">
          <span className="text-slate-500">Route cost</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 line-through">${(route.route_cost / (1 - route.savings_pct / 100)).toFixed(2)}</span>
            <span className="font-bold text-slate-900">${route.route_cost.toFixed(2)}</span>
            <span className="text-eco-600 text-[10px] font-semibold">-${savingsEstimate} saved</span>
          </div>
        </div>

        {/* Actions */}
        {route.status === 'Optimized' && (
          <button
            onClick={() => onAssign(route)}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            <User className="w-3.5 h-3.5" /> Assign Contractor & Start
          </button>
        )}
        {route.status === 'In Progress' && (
          <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors">
            <Navigation className="w-3.5 h-3.5" /> Track Live
          </button>
        )}
        {route.status === 'Completed' && (
          <div className="flex gap-2">
            <div className="flex-1 bg-eco-50 rounded-xl py-2 text-center text-xs font-semibold text-eco-700">
              ✓ {route.actual_duration} · {route.total_weight_kg} kg
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RouteOptimizer() {
  const [assignTarget, setAssignTarget] = useState(null)
  const [filter, setFilter] = useState('all')

  const filtered = ROUTES.filter(r => filter === 'all' || r.status === filter)

  const totalSavings = ROUTES.reduce((acc, r) => acc + r.route_cost * (r.savings_pct / 100), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Route Optimizer</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Recovery Logistics Network · {ROUTES.length} routes · ${totalSavings.toFixed(0)} saved through optimisation
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <Zap className="w-4 h-4" /> Optimise Routes
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Routes', value: ROUTES.length, color: 'text-slate-800' },
          { label: 'In Progress',  value: ROUTES.filter(r => r.status === 'In Progress').length,  color: 'text-amber-600' },
          { label: 'Optimized',    value: ROUTES.filter(r => r.status === 'Optimized').length,    color: 'text-blue-600' },
          { label: 'Completed',    value: ROUTES.filter(r => r.status === 'Completed').length,    color: 'text-eco-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'In Progress', 'Optimized', 'Completed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border capitalize transition-colors ${
              filter === f
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
            }`}
          >
            {f === 'all' ? 'All Routes' : f}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {filtered.map(r => (
          <RouteCard key={r.route_id} route={r} onAssign={setAssignTarget} />
        ))}
      </div>

      {assignTarget && (
        <AssignModal route={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
    </div>
  )
}
