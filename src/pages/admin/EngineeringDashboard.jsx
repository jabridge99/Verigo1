import React, { useState, useEffect } from 'react'
import {
  Shield, RefreshCw, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Database, Lock, Zap, GitBranch,
  Activity, Terminal, Cpu, Code2, Package,
} from 'lucide-react'
import { runSelfAudit, CHECK_CATEGORIES } from '../../audit/selfAudit.js'
import { SCHEMA, IMMUTABLE_TABLES, SOFT_DELETE_TABLES } from '../../schema/schema.js'
import { ROLES, PERMISSIONS } from '../../lib/rbac.js'
import { VALID_EVENTS } from '../../lib/eventBus.js'
import { JOB_TYPES } from '../../lib/queue.js'
import { AUDIT_ACTIONS } from '../../lib/audit.js'

const CATEGORY_COLORS = {
  schema:    { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  rbac:      { bg: 'bg-violet-100', text: 'text-violet-700' },
  data:      { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  events:    { bg: 'bg-eco-100',    text: 'text-eco-700'    },
  integrity: { bg: 'bg-slate-100',  text: 'text-slate-600'  },
}

const TEST_SUITES = [
  { name: 'Fraud Tests',       cases: 15, category: 'detection',      areas: 'signal detection · risk scoring · thresholds',    file: 'fraud.test.js'       },
  { name: 'Payout Tests',      cases: 12, category: 'financial',      areas: 'idempotency · auto-hold rules · RBAC',             file: 'payout.test.js'      },
  { name: 'Pricing Tests',     cases: 14, category: 'pricing',        areas: 'offer computation · shadow mode · overrides',      file: 'pricing.test.js'     },
  { name: 'Logistics Tests',   cases: 12, category: 'operations',     areas: 'GPS distance · weight anomaly · route efficiency', file: 'logistics.test.js'   },
  { name: 'Integration Tests', cases: 18, category: 'infrastructure', areas: 'EventBus · RBAC matrix · crypto · audit chain',    file: 'integration.test.js' },
  { name: 'Rollback Tests',    cases: 12, category: 'resilience',     areas: 'health gates · pricing freeze · tamper detection', file: 'rollback.test.js'    },
]

const SUITE_CAT_COLORS = {
  detection:      'bg-red-100 text-red-700',
  financial:      'bg-eco-100 text-eco-700',
  pricing:        'bg-violet-100 text-violet-700',
  operations:     'bg-amber-100 text-amber-700',
  infrastructure: 'bg-indigo-100 text-indigo-700',
  resilience:     'bg-slate-100 text-slate-600',
}

const PRINCIPLES_LEFT = [
  'API-first design', 'Event-driven architecture', 'Microservice-ready',
  'Audit-friendly', 'Mobile-ready', 'Modular & scalable',
]
const PRINCIPLES_RIGHT = [
  'RBAC enforced', 'KYC required', 'Webhook HMAC-SHA256 signing',
  'Idempotent processing', 'Soft deletes only', 'Immutable ledgers',
]

function StatusIcon({ status }) {
  if (status === 'pass') return <CheckCircle className="w-5 h-5 text-eco-500 flex-shrink-0" />
  if (status === 'warn') return <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
  return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
}

export default function EngineeringDashboard() {
  const [auditResult, setAuditResult]   = useState(null)
  const [auditRunning, setAuditRunning] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [schemaOpen, setSchemaOpen]     = useState(false)

  async function runAudit() {
    setAuditRunning(true)
    try {
      const result = await runSelfAudit({ actor: 'admin@ecobin.au' })
      setAuditResult(result)
    } finally {
      setAuditRunning(false)
    }
  }

  useEffect(() => { runAudit() }, [])

  const filteredChecks = auditResult
    ? (categoryFilter === 'all' ? auditResult.checks : auditResult.checks.filter(c => c.category === categoryFilter))
    : []

  const totalTestCases = TEST_SUITES.reduce((s, t) => s + t.cases, 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Engineering Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Architecture audit · Schema health · Platform integrity</p>
        </div>
        <button onClick={runAudit} disabled={auditRunning}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 disabled:opacity-60 transition-colors">
          <RefreshCw className={`w-4 h-4 ${auditRunning ? 'animate-spin' : ''}`} />
          {auditRunning ? 'Running…' : 'Run Audit'}
        </button>
      </div>

      {/* Architecture Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Database, label: 'Schema Tables',   value: Object.keys(SCHEMA).length,         sub: `${IMMUTABLE_TABLES.length} immutable · ${SOFT_DELETE_TABLES.length} soft-delete`, color: 'text-indigo-600' },
          { icon: Shield,   label: 'RBAC',            value: Object.keys(ROLES).length + ' roles', sub: `${Object.keys(PERMISSIONS).length} permissions`,                                  color: 'text-violet-600' },
          { icon: Zap,      label: 'Event Types',     value: VALID_EVENTS.size,                   sub: 'pub/sub architecture',                                                               color: 'text-eco-600'    },
          { icon: Package,  label: 'Job Types',       value: Object.keys(JOB_TYPES).length,       sub: 'queue-based processing',                                                             color: 'text-amber-600'  },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Self-Audit Panel */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-500" />
            <h2 className="font-bold text-slate-900">Self-Audit Results</h2>
            {auditResult && (
              <span className="text-[10px] text-slate-400 font-medium">
                · ran in {auditResult.duration_ms}ms · {auditResult.ran_at.slice(0, 19).replace('T', ' ')} UTC
              </span>
            )}
          </div>
          {auditResult && (
            <div className="flex items-center gap-3 text-sm">
              <span className="font-bold text-eco-600">{auditResult.summary.passed} passed</span>
              {auditResult.summary.warned > 0 && <span className="font-bold text-amber-600">{auditResult.summary.warned} warned</span>}
              {auditResult.summary.failed > 0 && <span className="font-bold text-red-600">{auditResult.summary.failed} failed</span>}
            </div>
          )}
        </div>

        <div className="p-5">
          {/* Empty state */}
          {!auditResult && !auditRunning && (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="font-semibold text-slate-500">No audit run yet</p>
              <p className="text-sm text-slate-400 mt-1">Click 'Run Audit' to check platform integrity</p>
              <button onClick={runAudit} className="mt-4 px-4 py-2 border border-violet-300 text-violet-600 text-sm font-bold rounded-xl hover:bg-violet-50">
                Run First Audit
              </button>
            </div>
          )}

          {/* Loading state */}
          {auditRunning && (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-violet-400 mx-auto animate-spin mb-3" />
              <p className="font-semibold text-slate-600">Running integrity checks</p>
              <p className="text-sm text-slate-400 mt-1">Scanning schema · RBAC · data · events · integrity</p>
            </div>
          )}

          {/* Results */}
          {auditResult && !auditRunning && (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Passed',     value: auditResult.summary.passed,     color: 'text-eco-600',    bg: 'bg-eco-50'    },
                  { label: 'Warned',     value: auditResult.summary.warned,     color: 'text-amber-600',  bg: 'bg-amber-50'  },
                  { label: 'Failed',     value: auditResult.summary.failed,     color: 'text-red-600',    bg: 'bg-red-50'    },
                  { label: 'Auto-Fixed', value: auditResult.summary.auto_fixed, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Category filter tabs */}
              <div className="flex flex-wrap gap-1 mb-4">
                {['all', ...CHECK_CATEGORIES].map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg capitalize transition-colors ${
                      categoryFilter === cat ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}>
                    {cat}
                    {cat !== 'all' && (
                      <span className="ml-1.5 opacity-60">
                        {auditResult.checks.filter(c => c.category === cat).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Check list */}
              <div className="space-y-2">
                {filteredChecks.map(check => {
                  const cc = CATEGORY_COLORS[check.category] ?? { bg: 'bg-slate-100', text: 'text-slate-600' }
                  return (
                    <div key={check.id} className="flex items-start gap-3 border border-slate-100 rounded-xl p-4">
                      <StatusIcon status={check.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-400">{check.id}</span>
                          {check.autoFixed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">Auto-Fixed</span>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-slate-800 mt-0.5">{check.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{check.detail}</p>
                        {check.count > 0 && (
                          <span className="text-[10px] font-bold text-slate-400 mt-1 inline-block">({check.count} affected)</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${cc.bg} ${cc.text}`}>
                        {check.category}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Schema Explorer */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <button onClick={() => setSchemaOpen(o => !o)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-500" />
            <h2 className="font-bold text-slate-900">Schema Explorer</h2>
            <span className="text-[10px] font-bold text-slate-400 ml-1">{Object.keys(SCHEMA).length} tables</span>
          </div>
          {schemaOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {schemaOpen && (
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(SCHEMA).map(([name, table]) => (
              <div key={name} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="flex items-start gap-1.5 flex-wrap mb-1">
                  <span className="font-mono font-bold text-xs text-slate-800">{name}</span>
                  {table.immutable   && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">Immutable</span>}
                  {table.soft_delete && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-eco-100 text-eco-700 rounded-full">Soft Delete</span>}
                  {table.audit_all   && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">Audit All</span>}
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">{table.description}</p>
                <div className="flex gap-3 mt-2 text-[9px] text-slate-400 font-semibold">
                  <span>{Object.keys(table.fields ?? {}).length} fields</span>
                  <span>{table.indices?.length ?? 0} indices</span>
                  <span>{table.constraints?.length ?? 0} constraints</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Engineering Principles */}
      <div className="bg-slate-950 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="w-4 h-4 text-eco-400" />
          <h2 className="font-bold text-white">Engineering Principles</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-3">Architecture</p>
            <div className="space-y-2">
              {PRINCIPLES_LEFT.map(p => (
                <div key={p} className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-eco-400 flex-shrink-0" />
                  <span className="text-sm text-slate-200">{p}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-3">Security</p>
            <div className="space-y-2">
              {PRINCIPLES_RIGHT.map(p => (
                <div key={p} className="flex items-center gap-2">
                  <Lock className="w-3 h-3 text-eco-400 flex-shrink-0" />
                  <span className="text-sm text-slate-200">{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Test Suite Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-slate-500" />
          <h2 className="font-bold text-slate-900">Test Suite</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{totalTestCases} tests across {TEST_SUITES.length} suites</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEST_SUITES.map(suite => (
            <div key={suite.file} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-slate-800">{suite.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SUITE_CAT_COLORS[suite.category]}`}>
                  {suite.category}
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900">{suite.cases}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">test cases</p>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{suite.areas}</p>
              <div className="mt-3 pt-3 border-t border-slate-50">
                <span className="text-[10px] font-mono text-slate-400">{suite.file}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-slate-950 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <Terminal className="w-4 h-4 text-eco-400 flex-shrink-0" />
          <code className="text-eco-300 text-sm font-mono">npm test</code>
          <span className="text-slate-500 text-xs">·</span>
          <code className="text-eco-300 text-sm font-mono">npm run test:ui</code>
          <span className="text-slate-500 text-xs">interactive</span>
          <span className="text-slate-500 text-xs">·</span>
          <code className="text-eco-300 text-sm font-mono">npm run test:coverage</code>
        </div>
      </div>

    </div>
  )
}
