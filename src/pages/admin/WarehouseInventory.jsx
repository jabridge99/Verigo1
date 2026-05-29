import React, { useState, useEffect } from 'react'
import {
  Warehouse, Package, TrendingUp, CheckCircle, Clock,
  ArrowUpRight, Filter,
} from 'lucide-react'
import { WAREHOUSE } from '../../data/woms'
import { iotStream } from '../../lib/iotStream'

const RECYCLER_COLOR = {
  'Visy Industries': 'bg-blue-100 text-blue-700',
  'Cleanaway':       'bg-eco-100 text-eco-700',
}

function MaterialGauge({ quantity_t, capacity_t = 10, color }) {
  const pct = Math.min((quantity_t / capacity_t) * 100, 100)
  return (
    <div className="relative h-24 w-8 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
      <div
        className={`absolute bottom-0 w-full rounded-b-lg transition-all ${color}`}
        style={{ height: `${pct}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-bold text-slate-600 rotate-90 whitespace-nowrap">{quantity_t}t</span>
      </div>
    </div>
  )
}

export default function WarehouseInventory() {
  const [filter, setFilter] = useState('all')
  const [stations, setStations] = useState([])
  const w = WAREHOUSE

  useEffect(() => {
    iotStream.connect()
    setStations(iotStream.getAllStations())
    const unsub = iotStream.subscribe(null, () => {
      setStations(iotStream.getAllStations())
    })
    return () => { unsub(); iotStream.disconnect() }
  }, [])

  const totalTonnes = w.materials.reduce((a, m) => a + m.quantity_t, 0)
  const totalValue = w.materials.reduce((a, m) => a + m.total_value, 0)
  const readyTonnes = w.materials.filter(m => m.ready).reduce((a, m) => a + m.quantity_t, 0)
  const capacityPct = ((totalTonnes / w.capacity_tonnes) * 100).toFixed(0)

  const filtered = w.materials.filter(m => {
    if (filter === 'all') return true
    if (filter === 'ready') return m.ready
    if (filter === 'pending') return !m.ready
    return m.recycler.toLowerCase().includes(filter.toLowerCase())
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Warehouse Inventory</h1>
        <p className="text-sm text-slate-500 mt-0.5">{w.name} · {w.address}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Stock', value: `${totalTonnes.toFixed(1)}t`, sub: `of ${w.capacity_tonnes}t capacity`, color: 'text-slate-800' },
          { label: 'Capacity Used', value: `${capacityPct}%`, sub: 'Alexandria Processing Centre', color: parseInt(capacityPct) > 80 ? 'text-red-600' : 'text-slate-800' },
          { label: 'Total Value', value: `$${totalValue.toLocaleString()}`, sub: '6 material streams', color: 'text-eco-700' },
          { label: 'Ready for Dispatch', value: `${readyTonnes.toFixed(1)}t`, sub: 'Awaiting settlement approval', color: 'text-blue-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Capacity bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700">Warehouse Capacity</h2>
          <span className="text-xs text-slate-400">{totalTonnes.toFixed(1)}t / {w.capacity_tonnes}t</span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
          {w.materials.map(m => (
            <div
              key={m.material}
              className={`h-full ${m.color} first:rounded-l-full`}
              style={{ width: `${(m.quantity_t / w.capacity_tonnes) * 100}%` }}
              title={`${m.material}: ${m.quantity_t}t`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {w.materials.map(m => (
            <div key={m.material} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${m.color}`} />
              <span className="text-[11px] text-slate-500">{m.material}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live EcoBin Station Network */}
      {stations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-eco-500 rounded-full animate-pulse" />
            <h2 className="text-sm font-bold text-slate-700">Live Station Fill Levels</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stations.map(s => (
              <div key={s.stationId} className={`rounded-xl border p-3 ${s.fill_pct >= 75 ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                <p className="text-[11px] font-semibold text-slate-600 truncate">{s.name}</p>
                <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.fill_pct >= 90 ? 'bg-red-500' : s.fill_pct >= 75 ? 'bg-amber-400' : 'bg-eco-500'}`} style={{ width: `${s.fill_pct}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-400">{s.fill_pct}% full</span>
                  <span className="text-[10px] font-semibold text-slate-600">{s.weight_today_kg.toFixed(1)}kg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'ready', 'pending', 'Visy Industries', 'Cleanaway'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border capitalize transition-colors ${
              filter === f
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
            }`}
          >
            {f === 'all' ? 'All Materials' : f === 'ready' ? 'Ready for Dispatch' : f === 'pending' ? 'Pending' : f}
          </button>
        ))}
      </div>

      {/* Material inventory grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(m => (
          <div key={m.material} className={`bg-white rounded-2xl border shadow-sm p-5 ${m.ready ? 'border-blue-100' : 'border-slate-100'}`}>
            <div className="flex items-start gap-4">
              <MaterialGauge quantity_t={m.quantity_t} color={m.color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-bold text-slate-900">{m.material}</span>
                  {m.ready
                    ? <span className="flex items-center gap-1 bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full"><CheckCircle className="w-2.5 h-2.5" /> Ready</span>
                    : <span className="flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"><Clock className="w-2.5 h-2.5" /> Pending</span>
                  }
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Quantity</span>
                    <span className="font-bold text-slate-800">{m.quantity_t}t</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Unit Price</span>
                    <span className="font-semibold text-slate-700">${m.value_per_t.toLocaleString()}/t</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-50 pt-1.5">
                    <span className="text-slate-500 font-medium">Total Value</span>
                    <span className="font-bold text-eco-700">${m.total_value.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RECYCLER_COLOR[m.recycler] || 'bg-slate-100 text-slate-500'}`}>
                    → {m.recycler}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent intake */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-slate-400" /> Recent Intake
          </h2>
        </div>
        <div className="divide-y divide-slate-50">
          {w.recent_intake.map(intake => (
            <div key={intake.job_id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-semibold text-slate-900">{intake.station}</span>
                  <span className="text-xs text-slate-400 ml-2 font-mono">{intake.job_id}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-800">{intake.weight_kg} kg</span>
                  <span className="text-xs text-slate-400 ml-2">{intake.date}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(intake.materials).map(([mat, t]) => (
                  <span key={mat} className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded">
                    {mat}: {(t * 1000).toFixed(0)} kg
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
