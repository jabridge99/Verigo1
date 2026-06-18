'use client'

import { useEffect, useState } from 'react'
import { Lock, ShieldCheck, Download, TrendingUp, QrCode, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  listMyOrganisations,
  listAmlProgramVersions,
  getAmlProgramVersion,
  exportAmlProgram,
  getAmlProgramHealth,
  type AmlProgramVersion,
  type AmlProgramVersionDetail,
  type ProgramHealth,
} from '@/lib/signup'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
const WEB = process.env.NEXT_PUBLIC_WEB_URL ?? ''

export default function AmlProgramPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [versions, setVersions] = useState<AmlProgramVersion[]>([])
  const [fullHistoryAvailable, setFullHistoryAvailable] = useState(true)
  const [health, setHealth] = useState<ProgramHealth | null>(null)
  const [detail, setDetail] = useState<AmlProgramVersionDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportReason, setExportReason] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportDone, setExportDone] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const orgs = await listMyOrganisations()
        const org = orgs[0]
        if (!org) {
          setError('No organisation found.')
          return
        }
        setOrgId(org.org_id)
        const [v, h] = await Promise.all([
          listAmlProgramVersions(org.org_id),
          getAmlProgramHealth(org.org_id),
        ])
        setVersions(v.versions)
        setFullHistoryAvailable(v.full_history_available)
        setHealth(h)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load AML program data.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const viewVersion = async (version: number) => {
    if (!orgId) return
    setError('')
    setDetail(null)
    try {
      const d = await getAmlProgramVersion(orgId, version)
      setDetail(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to retrieve this version.')
    }
  }

  const submitExport = async () => {
    if (!orgId || !exportReason.trim()) {
      setError('A reason is required to export.')
      return
    }
    setExportBusy(true)
    try {
      await exportAmlProgram(orgId, exportReason.trim())
      setExportDone(true)
      setExportReason('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setExportBusy(false)
    }
  }

  const current = versions.find(v => v.is_current)

  if (loading) {
    return <div className="min-h-screen bg-[#060d1a] text-white flex items-center justify-center">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-[#060d1a] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" /> AML/CTF Program
          </h1>
          <p className="text-slate-400 text-sm mt-1">Version history, verification, and export audit trail.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {health && !health.up_to_date && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">
                Program Health: {health.score}/100 — {health.suggestions.length} improvement{health.suggestions.length === 1 ? '' : 's'} available
              </p>
              <ul className="text-sm text-slate-300 mt-2 space-y-1">
                {health.suggestions.map((s, i) => (
                  <li key={i}>• {s.title} <span className="text-slate-500">({s.category})</span></li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-2">Regenerate your program to bring it up to date.</p>
            </div>
          </div>
        )}

        {health && health.up_to_date && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <p className="font-semibold text-green-300">Program Health: 100/100 — fully up to date</p>
          </div>
        )}

        {current && (
          <div className="rounded-xl border border-slate-800 bg-[#0d1526] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCode className="w-8 h-8 text-blue-400" />
              <div>
                <p className="font-semibold">Verification — version {current.version}</p>
                <p className="text-xs text-slate-400 font-mono">{current.content_hash.slice(0, 16)}…</p>
              </div>
            </div>
            <a
              href={`${WEB}/verify/aml-program/${current.qr_token}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Open verification page →
            </a>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-[#0d1526] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold">Version History</h2>
            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
            >
              <Download className="w-4 h-4" /> Export with audit trail
            </button>
          </div>

          {!fullHistoryAvailable && (
            <div className="px-4 py-2 bg-amber-500/10 text-amber-300 text-xs border-b border-slate-800">
              Subscription inactive — only the latest version is accessible. Reactivate to view full history.
            </div>
          )}

          <ul className="divide-y divide-slate-800">
            {versions.map(v => (
              <li key={v.version} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {v.locked ? <Lock className="w-4 h-4 text-slate-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  <span>Version {v.version}</span>
                  {v.is_current && (
                    <span className="text-[10px] uppercase tracking-wide bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{v.item_count} controls</span>
                </div>
                <button
                  onClick={() => viewVersion(v.version)}
                  className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-40"
                  disabled={v.locked}
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        </div>

        {detail && (
          <div className="rounded-xl border border-slate-800 bg-[#0d1526] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Version {detail.version} — {detail.item_count} controls</h3>
              <p className="text-xs text-slate-500 font-mono">{detail.content_hash.slice(0, 16)}…</p>
            </div>
            <ul className="space-y-1 max-h-64 overflow-y-auto text-sm">
              {detail.items.map((item, idx) => (
                <li key={`${item.category}-${idx}`} className="text-slate-300">
                  <span className="text-slate-500">[{item.category}]</span> {item.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {exportOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-[#0d1526] border border-slate-800 rounded-xl p-6 max-w-sm w-full">
              {!exportDone ? (
                <>
                  <h3 className="font-semibold mb-2">Export AML Program</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    A reason is required and will be recorded in your audit trail.
                  </p>
                  <textarea
                    value={exportReason}
                    onChange={e => setExportReason(e.target.value)}
                    placeholder="e.g. Regulator requested evidence pack"
                    className="w-full bg-[#060d1a] border border-slate-700 rounded-lg p-2 text-sm mb-4"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setExportOpen(false)} className="text-sm text-slate-400 px-3 py-2">
                      Cancel
                    </button>
                    <button
                      onClick={submitExport}
                      disabled={exportBusy || !exportReason.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm rounded-lg px-4 py-2"
                    >
                      {exportBusy ? 'Exporting…' : 'Export'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <h3 className="font-semibold">Export complete</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                    This export has been logged to your audit trail with the reason provided.
                  </p>
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setExportOpen(false); setExportDone(false) }}
                      className="bg-blue-600 hover:bg-blue-500 text-sm rounded-lg px-4 py-2"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
