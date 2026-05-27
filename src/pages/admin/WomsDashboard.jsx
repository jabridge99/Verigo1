import React, { useState } from 'react'
import {
  Truck, Scale, Warehouse, DollarSign, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Activity, Users, Package, Clock,
  ArrowRight, Zap,
} from 'lucide-react'
import { JOBS, OPS_KPIS, ACTIVITY_LOG, WEIGHBRIDGE } from '../../data/woms'

const PIPELINE = [
  { key: 'Pending',     label: 'Pickup Queued',   color: 'bg-slate-400',   text: 'text-slate-600' },
  { key: 'Assigned',    label: 'Contractor Assigned', color: 'bg-blue-400', text: 'text-blue-600' },
  { key: 'In Progress', label: 'En Route',        color: 'bg-amber-400',   text: 'text-amber-600' },
  { key: 'Completed',   label: 'Awaiting WB',     color: 'bg-orange-400',  text: 'text-orange-600' },
  { key: 'Verified',    label: 'In Warehouse',    color: 'bg-eco-500',     text: 'text-eco-600' },
]

const ACTIVITY_ICON_STYLE = {
  alert:  { icon: AlertTriangle, bg: 'bg-amber-50', color: 'text-amber-500' },
  info:   { icon: Package,       bg: 'bg-blue-50',  color: 'text-blue-500' },
  truck:  { icon: Truck,         bg: 'bg-slate-50', color: 'text-slate-500' },
  check:  { icon: CheckCircle,   bg: 'bg-eco-50',   color: 'text-eco-600' },
  warn:   { icon: AlertTriangle, bg: 'bg-red-50',   color: 'text-red-500' },
  dollar: { icon: DollarSign,    bg: 'bg-violet-50',color: 'text-violet-600' },
}

function BarChart({ revenue, cost, days }) {
  const max = Math.max(...revenue)
  return (
    <div className="flex items-end gap-1.5 h-28">
      {revenue.map((r, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '96px' }}>
            <div
              className="w-full bg-violet-200 rounded-t-sm"
              style={{ height: `${(cost[i] / max) * 96}px` }}
            />
            <div
              className="w-full bg-violet-600 rounded-t-sm"
              style={{ height: `${((r - cost[i]) / max) * 96}px` }}
            />
          </div>
          <span className="text-[9px] text-slate-400 font-medium">{days[i]}</span>
        </div>
      ))}
    </div>
  )
}

function KpiCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${trend >= 0 ? 'text-eco-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function WomsDashboard() {
  const [selectedStage, setSelectedStage] = useState(null)
  const k = OPS_KPIS

  const stageJobs = selectedStage
    ? JOBS.filter(j => j.status === selectedStage)
    : []

  const pendingWb = WEIGHBRIDGE.filter(w => w.status === 'Pending').length
  const highContam = WEIGHBRIDGE.filter(w => w.contamination_pct > 10).length
  const margin = ((k.logistics_revenue_mtd - k.logistics_cost_mtd) / k.logistics_revenue_mtd * 100).toFixed(1)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 bg-violet-600 rounded flex items-center justify-center">
            <Activity className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Recovery Logistics Network</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Operations Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">27 May 2026 · Live operational view — WOMS</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Jobs Today" value={k.jobs_today} sub={`${k.jobs_completed_today} completed`} icon={Package} color="bg-amber-500" trend={12} />
        <KpiCard label="Tonnes MTD" value={`${k.tonnes_mtd}t`} sub={`of ${k.tonnes_target_mtd}t target`} icon={Scale} color="bg-blue-500" trend={8} />
        <KpiCard label="Logistics Revenue MTD" value={`$${(k.logistics_revenue_mtd / 1000).toFixed(1)}K`} sub="Recovery Logistics Network" icon={TrendingUp} color="bg-eco-600" trend={14} />
        <KpiCard label="Gross Margin" value={`${margin}%`} sub={`Cost $${(k.logistics_cost_mtd / 1000).toFixed(1)}K MTD`} icon={DollarSign} color="bg-violet-600" trend={3} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="On-Time Rate" value={`${k.on_time_rate_pct}%`} sub="Last 30 days" icon={Clock} color="bg-eco-500" />
        <KpiCard label="Avg Contamination" value={`${k.avg_contamination_pct}%`} sub="Target < 10%" icon={AlertTriangle} color={k.avg_contamination_pct > 10 ? 'bg-red-500' : 'bg-amber-500'} />
        <KpiCard label="Active Contractors" value={`${k.active_contractors}/${k.total_contractors}`} sub={`${k.fleet_utilization_pct}% fleet utilised`} icon={Users} color="bg-slate-500" />
        <KpiCard label="Settlements Pending" value={`$${k.settlements_pending_value.toLocaleString()}`} sub="2 awaiting approval" icon={Warehouse} color="bg-indigo-500" />
      </div>

      {/* Pipeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" /> Operational Pipeline
        </h2>
        <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
          {PIPELINE.map((stage, i) => {
            const count = JOBS.filter(j => j.status === stage.key).length
            const isSelected = selectedStage === stage.key
            return (
              <React.Fragment key={stage.key}>
                <button
                  onClick={() => setSelectedStage(isSelected ? null : stage.key)}
                  className={`flex-1 min-w-[100px] rounded-xl p-3 text-center border-2 transition-all ${
                    isSelected ? 'border-violet-400 bg-violet-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className={`text-2xl font-bold ${stage.text}`}>{count}</div>
                  <div className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-tight">{stage.label}</div>
                  <div className={`h-1 rounded-full mt-2 mx-auto ${stage.color}`} style={{ width: `${Math.max(count * 20, 12)}%` }} />
                </button>
                {i < PIPELINE.length - 1 && (
                  <div className="flex items-center text-slate-300">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </React.Fragment>
            )
          })}
          <div className="flex items-center text-slate-300">
            <ArrowRight className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-[100px] bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-violet-600">{pendingWb}</div>
            <div className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-tight">Weighbridge</div>
            <div className="h-1 bg-violet-400 rounded-full mt-2 mx-auto" style={{ width: `${Math.max(pendingWb * 20, 12)}%` }} />
          </div>
        </div>

        {/* Expanded stage jobs */}
        {selectedStage && stageJobs.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500">{stageJobs.length} job{stageJobs.length > 1 ? 's' : ''} · {selectedStage}</p>
            {stageJobs.map(j => (
              <div key={j.job_id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 text-xs">
                <span className="font-mono font-semibold text-slate-500">{j.job_id}</span>
                <span className="font-semibold text-slate-800 flex-1 truncate">{j.station_name}</span>
                <span className={`font-semibold px-1.5 py-0.5 rounded-full ${
                  j.priority === 'High' ? 'bg-red-100 text-red-700' :
                  j.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-500'}`}
                >{j.priority}</span>
                <span className="text-slate-400">{j.estimated_weight_kg > 0 ? `~${j.estimated_weight_kg} kg` : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue vs Cost chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-700">Revenue vs Cost — Last 7 Days</h2>
            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-violet-600" /><span className="text-slate-500">Margin</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-violet-200" /><span className="text-slate-500">Cost</span></div>
            </div>
          </div>
          <BarChart revenue={k.revenue_7d} cost={k.cost_7d} days={k.days_7d} />
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-slate-50">
            {[
              { label: '7d Revenue', value: `$${k.revenue_7d.reduce((a, b) => a + b, 0).toLocaleString()}` },
              { label: '7d Cost',    value: `$${k.cost_7d.reduce((a, b) => a + b, 0).toLocaleString()}` },
              { label: '7d Margin',  value: `${(((k.revenue_7d.reduce((a,b)=>a+b,0)-k.cost_7d.reduce((a,b)=>a+b,0))/k.revenue_7d.reduce((a,b)=>a+b,0))*100).toFixed(1)}%` },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-lg font-bold text-slate-900">{s.value}</p>
                <p className="text-[11px] text-slate-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts + Activity */}
        <div className="space-y-4">
          {/* Active alerts */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h2 className="text-sm font-bold text-slate-700 mb-3">Active Alerts</h2>
            <div className="space-y-2">
              {highContam > 0 && (
                <div className="flex items-start gap-2.5 bg-red-50 rounded-xl p-3 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-red-700 font-medium">{highContam} weighbridge ticket{highContam > 1 ? 's' : ''} with contamination &gt;10%</span>
                </div>
              )}
              <div className="flex items-start gap-2.5 bg-amber-50 rounded-xl p-3 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-amber-700 font-medium">3 pending weighbridge verifications</span>
              </div>
              <div className="flex items-start gap-2.5 bg-amber-50 rounded-xl p-3 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-amber-700 font-medium">JOB-049: Alexandria Node offline — recovery dispatch needed</span>
              </div>
              <div className="flex items-start gap-2.5 bg-blue-50 rounded-xl p-3 text-xs">
                <Package className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-blue-700 font-medium">RTE-014 optimized and ready — assign contractor</span>
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h2 className="text-sm font-bold text-slate-700 mb-3">Activity Feed</h2>
            <div className="space-y-3">
              {ACTIVITY_LOG.slice(0, 6).map(a => {
                const s = ACTIVITY_ICON_STYLE[a.type]
                const Icon = s.icon
                return (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <div className={`w-6 h-6 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-3 h-3 ${s.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-700 leading-snug">{a.message}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
