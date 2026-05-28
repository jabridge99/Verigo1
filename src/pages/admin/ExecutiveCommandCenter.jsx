import React, { useState } from 'react'
import {
  Activity, DollarSign, TrendingUp, Shield, Users, MapPin, Zap,
  ShieldAlert, AlertTriangle, Package, BarChart2, Building2,
  CheckCircle, Clock, ArrowUpRight, Layers
} from 'lucide-react'
import {
  PLATFORM_HEALTH, OPS_METRICS, FINANCIAL_METRICS, PRICING_METRICS,
  RISK_SUMMARY, GROWTH_METRICS, FORECASTS, REVENUE_HISTORY_30D,
  DEPOSITS_HISTORY_30D, ALERTS_HISTORY_7D, EXEC_SUMMARY_ALERTS,
} from '../../data/executive'

function Sparkline({ data, color = '#22c55e', width = 64, height = 24 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - 2 - ((v - min) / range) * (height - 4)}`
  ).join(' ')
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Delta({ value, suffix = '%', inverse = false }) {
  const positive = inverse ? value <= 0 : value >= 0
  const color = positive ? 'text-eco-500' : 'text-red-500'
  const arrow = value >= 0 ? '↑' : '↓'
  return <span className={`text-xs font-bold ${color}`}>{arrow} {Math.abs(value)}{suffix}</span>
}

function ServiceDot({ status }) {
  const cfg = { operational: 'bg-eco-500', degraded: 'bg-amber-500 animate-pulse', incident: 'bg-red-500 animate-pulse' }
  return <span className={`inline-block w-2 h-2 rounded-full ${cfg[status]}`} />
}

function SectionLabel({ icon: Icon, label, accent = 'text-slate-400' }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-3.5 h-3.5 ${accent}`} />
      <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">{label}</span>
    </div>
  )
}

function RiskScore({ score }) {
  const color = score >= 76 ? 'text-red-500' : score >= 51 ? 'text-orange-500' : score >= 26 ? 'text-amber-500' : 'text-eco-500'
  const label = score >= 76 ? 'Critical' : score >= 51 ? 'High' : score >= 26 ? 'Medium' : 'Low'
  return (
    <div className="text-center">
      <p className={`text-3xl font-black ${color}`}>{score}</p>
      <p className={`text-[10px] font-bold uppercase ${color}`}>{label}</p>
    </div>
  )
}

function ProgressBar({ value, max = 100, color = 'bg-eco-500', height = 'h-1.5' }) {
  return (
    <div className={`w-full bg-slate-100 rounded-full ${height} overflow-hidden`}>
      <div className={`${height} ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

export default function ExecutiveCommandCenter() {
  const [forecastPeriod, setForecastPeriod] = useState('7d')
  const [alertsExpanded, setAlertsExpanded] = useState(false)

  const f = FORECASTS[forecastPeriod]
  const confidence = f.confidence

  const overallBadge = () => {
    if (PLATFORM_HEALTH.overall === 'healthy') {
      return (
        <span className="ml-3 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-eco-500/20 text-eco-400 border border-eco-500/30">
          ● All Systems Operational
        </span>
      )
    }
    if (PLATFORM_HEALTH.overall === 'degraded') {
      return (
        <span className="ml-3 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
          ⚠ Degraded — 1 Service Impacted
        </span>
      )
    }
    return (
      <span className="ml-3 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
        ✕ Incident Active
      </span>
    )
  }

  const alertChipClass = (severity) => {
    if (severity === 'critical') return 'bg-red-500/20 text-red-300 border border-red-500/30'
    if (severity === 'high') return 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
    if (severity === 'medium') return 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
    return 'bg-slate-700 text-slate-400'
  }

  const routeEffColor = OPS_METRICS.route_efficiency.on_time_pct >= 95
    ? 'text-eco-600' : OPS_METRICS.route_efficiency.on_time_pct >= 85
    ? 'text-amber-600' : 'text-red-600'

  const confBarColor = confidence >= 80 ? 'bg-eco-500' : confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="p-6 space-y-5 bg-slate-50 min-h-screen">

      {/* 1. Command Header */}
      <div className="bg-slate-950 rounded-2xl px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center flex-wrap gap-1">
              <h1 className="text-white text-2xl font-black tracking-tight">Executive Command Center</h1>
              {overallBadge()}
            </div>
            <div className="flex items-center mt-1">
              <span className="text-slate-400 text-sm">EcoBin Platform Intelligence · Live</span>
              <span className="text-slate-500 text-xs ml-3">Updated 08:41 AEST, 28 May 2026</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {PLATFORM_HEALTH.services.map(s => (
              <div key={s.name} className="flex items-center gap-1.5">
                <ServiceDot status={s.status} />
                <span className="text-[11px] text-slate-400">{s.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {EXEC_SUMMARY_ALERTS.map(alert => (
              <div
                key={alert.id}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap ${alertChipClass(alert.severity)}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  alert.severity === 'critical' ? 'bg-red-400' :
                  alert.severity === 'high' ? 'bg-amber-400' :
                  alert.severity === 'medium' ? 'bg-indigo-400' : 'bg-slate-500'
                }`} />
                <span className="text-[9px] font-bold px-1.5 bg-white/10 rounded">{alert.module}</span>
                {alert.msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Hero KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1: Revenue */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Revenue — 30 Days</p>
          <p className="text-3xl font-black text-slate-900">${FINANCIAL_METRICS.revenue_30d_aud.toLocaleString()}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Delta value={+8.4} />
            <span className="text-slate-400 text-xs">vs prior 30d</span>
          </div>
          <div className="mt-3">
            <Sparkline data={REVENUE_HISTORY_30D} color="#22c55e" width={120} height={28} />
          </div>
        </div>

        {/* Card 2: Active Users */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Active Users</p>
          <p className="text-3xl font-black text-slate-900">{GROWTH_METRICS.active_users.count.toLocaleString()}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Delta value={GROWTH_METRICS.active_users.wow_pct} />
            <span className="text-slate-400 text-xs">week-on-week</span>
          </div>
          <p className="text-xs text-eco-600 font-semibold mt-0.5">+{GROWTH_METRICS.active_users.new_today} today</p>
        </div>

        {/* Card 3: Payout Liability */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Payout Liability</p>
          <p className="text-3xl font-black text-slate-900">${FINANCIAL_METRICS.payout_liability.total_aud.toLocaleString()}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Delta value={+4.8} inverse={true} />
            <span className="text-slate-400 text-xs">7d change</span>
          </div>
          <div className="mt-3 h-1.5 flex rounded-full overflow-hidden">
            <div className="bg-eco-500 h-1.5" style={{ width: `${(84200 / 142840) * 100}%` }} />
            <div className="bg-violet-500 h-1.5" style={{ width: `${(48400 / 142840) * 100}%` }} />
            <div className="bg-amber-500 h-1.5 flex-1" />
          </div>
          <div className="flex gap-3 mt-1">
            <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-eco-500 inline-block" /> Consumer</span>
            <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" /> Operator</span>
            <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Merchant</span>
          </div>
        </div>

        {/* Card 4: Platform Risk */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Platform Risk Score</p>
          <div className="flex items-center justify-between">
            <RiskScore score={RISK_SUMMARY.platform_risk_score} />
            <div className="text-right">
              <p className="text-xs text-slate-400">{RISK_SUMMARY.fraud_alerts.total_open} open cases</p>
              <p className="text-xs text-slate-400">{RISK_SUMMARY.payout_holds.count} holds</p>
            </div>
          </div>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">1 Critical</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-bold">3 High</span>
          </div>
        </div>
      </div>

      {/* 3. Operations + Financial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Operations card */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <SectionLabel icon={Activity} label="Operations" accent="text-amber-500" />

          <div className="space-y-4">
            {/* Active Stations */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-semibold text-slate-800">Active Stations</span>
                <span className="text-sm font-bold text-slate-900">{OPS_METRICS.active_stations.current} / {OPS_METRICS.active_stations.total}</span>
              </div>
              <ProgressBar value={OPS_METRICS.active_stations.pct} color="bg-amber-500" />
              <p className="text-[10px] text-slate-400 mt-0.5">82.7% online · {OPS_METRICS.active_stations.added_7d} added this week</p>
            </div>

            {/* Pickup Queue */}
            <div>
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="text-sm font-semibold text-slate-800">Pickup Queue</span>
                <span className="text-sm font-bold text-slate-900">{OPS_METRICS.pickup_queue.pending} pending</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={OPS_METRICS.pickup_queue.overdue > 0 ? 'text-red-500 font-bold text-xs' : 'text-slate-400 text-xs'}>
                  {OPS_METRICS.pickup_queue.overdue} overdue
                </span>
                <span className="text-[10px] text-slate-400">· Avg wait {OPS_METRICS.pickup_queue.avg_wait_hrs}h</span>
              </div>
            </div>

            {/* Route Efficiency */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-semibold text-slate-800">Route Efficiency</span>
                <span className={`text-sm font-bold ${routeEffColor}`}>{OPS_METRICS.route_efficiency.on_time_pct}%</span>
              </div>
              <ProgressBar value={OPS_METRICS.route_efficiency.on_time_pct} max={100} color="bg-amber-400" />
              <p className="text-[10px] text-slate-400 mt-0.5">Target 95% · {OPS_METRICS.route_efficiency.routes_active} routes active</p>
            </div>

            {/* Contractor Utilization */}
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-semibold text-slate-800">Contractor Utilization</span>
                <span className="text-sm font-bold text-amber-600">{OPS_METRICS.contractor_util.active_pct}%</span>
              </div>
              <ProgressBar value={OPS_METRICS.contractor_util.active_pct} color="bg-slate-400" />
              <p className="text-[10px] text-slate-400 mt-0.5">{OPS_METRICS.contractor_util.total} contractors · avg {OPS_METRICS.contractor_util.avg_jobs_day} jobs/day</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-50">
            Today: {OPS_METRICS.deposits_today.count.toLocaleString()} deposits · {OPS_METRICS.deposits_today.weight_kg.toLocaleString()}kg · {OPS_METRICS.deposits_today.flagged} flagged
          </p>
        </div>

        {/* Financial card */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <SectionLabel icon={DollarSign} label="Financial" accent="text-eco-500" />

          {/* Payout Liability breakdown */}
          <div className="bg-slate-50 rounded-xl p-3 mb-3">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-semibold text-slate-700">Payout Liability</span>
              <span className="text-sm font-bold text-slate-900">${FINANCIAL_METRICS.payout_liability.total_aud.toLocaleString()}</span>
            </div>
            <div className="space-y-1.5 mb-2">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-eco-500 inline-block" /> Consumer</span>
                <span className="font-semibold text-slate-700">${FINANCIAL_METRICS.payout_liability.consumer_aud.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" /> Operator</span>
                <span className="font-semibold text-slate-700">${FINANCIAL_METRICS.payout_liability.operator_aud.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Merchant</span>
                <span className="font-semibold text-slate-700">${FINANCIAL_METRICS.payout_liability.merchant_aud.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-1.5 flex rounded-full overflow-hidden">
              <div className="bg-eco-500 h-1.5" style={{ width: `${(84200 / 142840) * 100}%` }} />
              <div className="bg-violet-500 h-1.5" style={{ width: `${(48400 / 142840) * 100}%` }} />
              <div className="bg-amber-500 h-1.5 flex-1" />
            </div>
          </div>

          {/* Treasury */}
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">Treasury</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">${FINANCIAL_METRICS.treasury.balance_aud.toLocaleString()}</span>
                <Delta value={+6.9} />
                <span className="text-[10px] text-slate-400">30d change</span>
              </div>
            </div>
            <span className="text-xs text-eco-600 font-semibold">{FINANCIAL_METRICS.treasury.runway_days} days runway</span>
          </div>

          {/* Logistics Margin */}
          <div className="mb-3">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-semibold text-slate-800">Logistics Margin</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-orange-500">{FINANCIAL_METRICS.logistics_margin.pct}%</span>
                <Delta value={FINANCIAL_METRICS.logistics_margin.change_7d} />
              </div>
            </div>
            <ProgressBar value={FINANCIAL_METRICS.logistics_margin.pct} max={25} color="bg-orange-400" />
            <p className="text-[10px] text-slate-400 mt-0.5">Target {FINANCIAL_METRICS.logistics_margin.target_pct}% · ${(FINANCIAL_METRICS.logistics_margin.gross_aud / 1000).toFixed(0)}K gross</p>
          </div>

          {/* Operator Payable */}
          <div>
            <div className="flex justify-between items-baseline mb-0.5">
              <span className="text-sm font-semibold text-slate-800">Operator Payable</span>
              <span className="text-sm font-bold text-slate-900">${FINANCIAL_METRICS.operator_payable.total_aud.toLocaleString()}</span>
            </div>
            {FINANCIAL_METRICS.operator_payable.overdue_aud > 0 && (
              <p className="text-xs text-amber-600 font-semibold">${FINANCIAL_METRICS.operator_payable.overdue_aud.toLocaleString()} overdue</p>
            )}
            <p className="text-[10px] text-slate-400">{FINANCIAL_METRICS.operator_payable.pending_count} settlements · avg {FINANCIAL_METRICS.operator_payable.avg_days}d</p>
          </div>
        </div>
      </div>

      {/* 4. Pricing + Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pricing card */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <SectionLabel icon={TrendingUp} label="Pricing Intelligence" accent="text-violet-500" />

          {/* Commodities */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {PRICING_METRICS.commodities.map(c => (
              <div key={c.symbol} className="bg-slate-50 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-slate-700">{c.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 ml-1">{c.symbol}</span>
                  </div>
                  <Sparkline data={c.sparkline} color={c.change_pct >= 0 ? '#22c55e' : '#ef4444'} width={48} height={20} />
                </div>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-sm font-bold text-slate-800">
                    {c.unit.includes('/g') ? `$${c.price.toLocaleString()}` : `$${c.price}`}
                    <span className="text-[10px] text-slate-400 font-normal ml-0.5">{c.unit.replace('AUD', '')}</span>
                  </span>
                  <Delta value={c.change_pct} />
                </div>
              </div>
            ))}
          </div>

          {/* Realised Margin */}
          <div className="bg-slate-50 rounded-xl p-3 mb-3">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-sm font-semibold text-slate-700">Realised Margin</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-violet-700">{PRICING_METRICS.realised_margin.pct}%</span>
                <Delta value={PRICING_METRICS.realised_margin.change_7d} inverse />
                <span className="text-[10px] text-slate-400">Target {PRICING_METRICS.realised_margin.target_pct}%</span>
              </div>
            </div>
            <ProgressBar value={PRICING_METRICS.realised_margin.pct} max={30} color="bg-violet-500" />
          </div>

          {/* Pricing Exposure */}
          <div className="flex justify-between items-center text-sm mb-3">
            <span className="text-sm font-semibold text-slate-700">Pricing Exposure</span>
            <div className="text-right">
              <p className="text-xs text-slate-600">${PRICING_METRICS.pricing_exposure.total_aud.toLocaleString()} total · ${PRICING_METRICS.pricing_exposure.at_risk_aud.toLocaleString()} at risk</p>
              <p className="text-xs text-eco-600 font-semibold">{PRICING_METRICS.pricing_exposure.hedged_pct}% hedged</p>
            </div>
          </div>

          {/* Active Model */}
          <div className="bg-violet-50 rounded-lg px-3 py-2 text-xs text-violet-700">
            Shadow Lab: {PRICING_METRICS.active_model.id} {PRICING_METRICS.active_model.name} · +{PRICING_METRICS.active_model.shadow_delta_pct}% projected vs production
          </div>
        </div>

        {/* Risk card */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
          <SectionLabel icon={ShieldAlert} label="Fraud & Risk" accent="text-red-500" />

          {/* Platform Risk Score */}
          <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-3 mb-3">
            <div className="text-center flex-shrink-0">
              <p className="text-3xl font-black text-amber-500 leading-none">42</p>
              <p className="text-[10px] text-slate-400 mt-0.5">/ 100</p>
              <p className="text-[10px] font-bold uppercase text-amber-500">Medium</p>
            </div>
            <div className="flex-1">
              <ProgressBar value={RISK_SUMMARY.platform_risk_score} color="bg-amber-500" height="h-2" />
              <p className="text-[10px] text-slate-400 mt-1">Composite risk index across fraud, ops, and finance</p>
            </div>
          </div>

          {/* Fraud Alerts */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-semibold text-slate-800">Fraud Alerts</span>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{RISK_SUMMARY.fraud_alerts.total_open} total open</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">1 Critical</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">3 High</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">1 Medium</span>
            </div>
            <p className="text-[10px] text-eco-600 font-semibold mt-1">{RISK_SUMMARY.auto_blocks_today} auto-blocked today</p>
          </div>

          {/* Payout Holds */}
          <div className="mb-3">
            <div className="flex justify-between items-baseline mb-0.5">
              <span className="text-sm font-semibold text-slate-800">Payout Holds</span>
              <span className="text-sm font-bold text-amber-700">${RISK_SUMMARY.payout_holds.total_aud.toLocaleString()} AUD</span>
            </div>
            <p className="text-[10px] text-slate-400">{RISK_SUMMARY.payout_holds.count} active · oldest {RISK_SUMMARY.payout_holds.oldest_days} days</p>
          </div>

          {/* Contamination Hotspots */}
          <div className="space-y-1 mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-1.5">Contamination Hotspots</p>
            {RISK_SUMMARY.contamination_hotspots.map(h => (
              <div key={h.zone_id} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${h.severity === 'high' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className="text-xs text-slate-700 flex-1">{h.zone}</span>
                <span className="text-[9px] font-semibold bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{h.type.replace(/_/g, ' ')}</span>
                <span className="text-[9px] font-mono text-slate-400">{h.zone_id}</span>
              </div>
            ))}
          </div>

          {/* Alert volume sparkline */}
          <div className="border-t border-slate-50 pt-2 mt-3 flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Alert volume — 7d:</span>
            <Sparkline data={ALERTS_HISTORY_7D} color="#f97316" width={80} height={18} />
          </div>
        </div>
      </div>

      {/* 5. Growth Row */}
      <div>
        <SectionLabel icon={TrendingUp} label="Growth" accent="text-eco-500" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Active Users */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-2xl font-black text-slate-900">{GROWTH_METRICS.active_users.count.toLocaleString()}</span>
              <Delta value={+8.2} />
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Active Users</p>
            <p className="text-xs text-eco-600 font-semibold">+{GROWTH_METRICS.active_users.new_today} today</p>
            <div className="mt-2">
              <Sparkline data={[18200, 19400, 20800, 21600, 22400, 23800, 24841]} color="#22c55e" width={80} height={20} />
            </div>
          </div>

          {/* Operator Partners */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-2xl font-black text-slate-900">{GROWTH_METRICS.operator_partners.count}</span>
              <span className="text-xs text-eco-600 font-semibold">+{GROWTH_METRICS.operator_partners.added_30d} this month</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Operator Partners</p>
            <p className="text-xs text-amber-600 font-semibold">{GROWTH_METRICS.operator_partners.pending} pending approval</p>
          </div>

          {/* Station Network */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-2xl font-black text-slate-900">{GROWTH_METRICS.station_count.total.toLocaleString()}</span>
              <span className="text-xs text-eco-600 font-semibold">+{GROWTH_METRICS.station_count.added_30d} this month</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Stations</p>
            <p className="text-xs text-slate-400">{GROWTH_METRICS.station_count.in_deployment} deploying · {GROWTH_METRICS.station_count.offline} offline</p>
            <div className="mt-2">
              <ProgressBar value={847} max={1024} color="bg-eco-400" />
              <p className="text-[10px] text-slate-400 mt-0.5">82.7% online</p>
            </div>
          </div>

          {/* Marketplace Activity */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-2xl font-black text-slate-900">{GROWTH_METRICS.marketplace.redemptions_30d.toLocaleString()}</span>
              <span className="text-xs text-slate-400">redemptions (30d)</span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Marketplace</p>
            <p className="text-xs text-slate-500">{(GROWTH_METRICS.marketplace.points_redeemed_30d / 1000).toFixed(0)}k pts · ${GROWTH_METRICS.marketplace.gmv_aud.toLocaleString()} GMV</p>
            <p className="text-xs text-slate-400">{GROWTH_METRICS.marketplace.active_merchants} active merchants</p>
          </div>
        </div>
      </div>

      {/* 6. Forecast Panel */}
      <div className="bg-slate-950 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-black text-lg">Platform Forecast</h2>
              <span className="bg-eco-500/20 text-eco-400 text-[11px] font-bold px-2 py-0.5 rounded-full border border-eco-500/30">
                {confidence}% confidence
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">{f.label} — projections based on current trajectory</p>
          </div>
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            {['7d', '30d', '90d'].map(p => (
              <button
                key={p}
                onClick={() => setForecastPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  forecastPeriod === p
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Forecast metric tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
            <p className="text-xl font-black text-eco-400">${(f.revenue_aud / 1000).toFixed(0)}K AUD</p>
            <p className="text-[10px] text-slate-400 mt-1">Projected Revenue</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
            <p className="text-xl font-black text-violet-400">{f.users.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Active Users</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
            <p className="text-xl font-black text-amber-400">{f.stations.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Station Network</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
            <p className="text-xl font-black text-indigo-400">{f.deposits.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Deposits</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
            <p className={`text-xl font-black ${f.margin_pct >= 25 ? 'text-eco-400' : 'text-amber-400'}`}>{f.margin_pct}%</p>
            <p className="text-[10px] text-slate-400 mt-1">Realised Margin</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
            <p className={`text-xl font-black ${f.fraud_rate_pct <= 1.5 ? 'text-eco-400' : f.fraud_rate_pct <= 2.5 ? 'text-amber-400' : 'text-red-400'}`}>{f.fraud_rate_pct}%</p>
            <p className="text-[10px] text-slate-400 mt-1">Fraud Rate</p>
          </div>
        </div>

        {/* Confidence meter */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-slate-400 text-xs flex-shrink-0">Model confidence:</span>
          <div className="flex-1 max-w-[200px]">
            <ProgressBar value={confidence} color={confBarColor} height="h-2" />
          </div>
          <span className="text-xs font-bold text-slate-300">{confidence}%</span>
          <span className="text-[10px] text-slate-500 ml-auto">Projections are indicative — based on 90-day rolling model</span>
        </div>

        {/* Revenue history full-width sparkline */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">Revenue History — 30 Days</p>
          {(() => {
            const data = REVENUE_HISTORY_30D
            const W = 640, H = 48, pad = 2
            const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
            const pts = data.map((v, i) =>
              `${(i / (data.length - 1)) * W},${H - pad - ((v - min) / range) * (H - pad * 2)}`
            ).join(' ')
            return (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: '48px' }}>
                <polyline points={pts} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            )
          })()}
          <div className="flex justify-between text-[9px] text-slate-600 mt-1">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </div>

      {/* 7. Platform Health Bar */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4">
        <SectionLabel icon={Activity} label="Platform Health" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {PLATFORM_HEALTH.services.map(s => (
            <div key={s.name} className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <ServiceDot status={s.status} />
              <div>
                <p className="text-xs font-semibold text-slate-700">{s.name}</p>
                <p className={`text-[10px] ${
                  s.status === 'operational' ? 'text-slate-400' :
                  s.status === 'degraded' ? 'text-amber-500 font-bold' :
                  'text-red-500 font-bold'
                }`}>
                  {s.status === 'operational' ? `${s.latency_ms}ms` : s.note || s.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
