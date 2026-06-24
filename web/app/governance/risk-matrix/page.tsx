"use client"

import { useEffect, useState } from "react"
import {
  Scale, RotateCcw, History, Plus, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, X, Save,
} from "lucide-react"
import clsx from "clsx"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

type Category =
  | "customer" | "geographic" | "product" | "transaction" | "behaviour"
  | "crypto" | "professional_service" | "delivery_channel" | "custom"

type RiskLevel = "low" | "medium" | "high" | "critical"

const CATEGORY_LABELS: Record<Category, string> = {
  customer: "Customer",
  geographic: "Geography",
  product: "Product",
  transaction: "Transaction",
  behaviour: "Behaviour",
  crypto: "Crypto",
  professional_service: "Professional Service",
  delivery_channel: "Delivery Channel",
  custom: "Custom",
}

const LEVEL_COLOR: Record<RiskLevel, string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-300",
  medium: "bg-amber-100 text-amber-700 border-amber-300",
  high: "bg-orange-100 text-orange-700 border-orange-300",
  critical: "bg-red-100 text-red-700 border-red-300",
}

interface Factor {
  id: string
  category: Category
  factor_key: string
  label: string
  description: string | null
  weight: number
  is_active: boolean
  is_system: boolean
  display_order: number
  updated_by: string | null
  updated_at: string | null
}

interface Profile {
  id: string
  risk_level: RiskLevel
  score_min: number
  score_max: number
  review_frequency_months: number
  edd_required: boolean
  enhanced_monitoring: boolean
  senior_approval_required: boolean
  description: string | null
  updated_at: string | null
}

interface VersionEntry {
  id: string
  version_number: number
  change_type: string
  change_summary: string
  changed_by: string
  change_reason: string | null
  created_at: string
}

const DEMO_FACTORS: Record<string, Factor[]> = {
  customer: [
    { id: "orf_1", category: "customer", factor_key: "pep_status", label: "Politically Exposed Person", description: "Customer or beneficial owner is a PEP", weight: 0.25, is_active: true, is_system: true, display_order: 0, updated_by: null, updated_at: null },
    { id: "orf_2", category: "customer", factor_key: "high_risk_rating", label: "High Customer Risk Rating", description: "Customer has existing high/critical risk profile", weight: 0.20, is_active: true, is_system: true, display_order: 1, updated_by: null, updated_at: null },
    { id: "orf_3", category: "customer", factor_key: "adverse_media", label: "Adverse Media Presence", description: "Customer appears in adverse media screening", weight: 0.15, is_active: true, is_system: true, display_order: 2, updated_by: null, updated_at: null },
    { id: "orf_4", category: "customer", factor_key: "entity_complexity", label: "Complex Entity Structure", description: "Multiple layers of ownership or control", weight: 0.15, is_active: true, is_system: true, display_order: 3, updated_by: null, updated_at: null },
    { id: "orf_5", category: "customer", factor_key: "non_face_to_face", label: "Non-Face-to-Face Onboarding", description: "Customer onboarded digitally or through introducer", weight: 0.10, is_active: true, is_system: true, display_order: 4, updated_by: null, updated_at: null },
    { id: "orf_6", category: "customer", factor_key: "new_customer", label: "New Customer Relationship", description: "Relationship established within the last 90 days", weight: 0.10, is_active: true, is_system: true, display_order: 5, updated_by: null, updated_at: null },
    { id: "orf_7", category: "customer", factor_key: "customer_type", label: "Business Entity Type", description: "Corporate, trust or association (vs individual)", weight: 0.05, is_active: true, is_system: true, display_order: 6, updated_by: null, updated_at: null },
  ],
  geographic: [
    { id: "orf_8", category: "geographic", factor_key: "fatf_blacklist", label: "FATF Call-to-Action Jurisdiction", description: "Transaction or customer linked to FATF blacklist country", weight: 0.35, is_active: true, is_system: true, display_order: 0, updated_by: null, updated_at: null },
    { id: "orf_9", category: "geographic", factor_key: "sanctioned_country", label: "Sanctioned Jurisdiction", description: "Transaction to/from UN/DFAT sanctioned country", weight: 0.30, is_active: true, is_system: true, display_order: 1, updated_by: null, updated_at: null },
    { id: "orf_10", category: "geographic", factor_key: "fatf_greylist", label: "FATF Greylist Jurisdiction", description: "Transaction or customer linked to FATF greylist country", weight: 0.20, is_active: true, is_system: true, display_order: 2, updated_by: null, updated_at: null },
    { id: "orf_11", category: "geographic", factor_key: "cross_border", label: "Cross-Border Transaction", description: "Transaction crosses national borders", weight: 0.10, is_active: true, is_system: true, display_order: 3, updated_by: null, updated_at: null },
    { id: "orf_12", category: "geographic", factor_key: "high_risk_region", label: "AUSTRAC High-Risk Region", description: "Jurisdiction on AUSTRAC watch list", weight: 0.05, is_active: true, is_system: true, display_order: 4, updated_by: null, updated_at: null },
  ],
  product: [
    { id: "orf_13", category: "product", factor_key: "crypto", label: "Cryptocurrency Transaction", description: "Purchase, transfer or receipt of cryptocurrency", weight: 0.30, is_active: true, is_system: true, display_order: 0, updated_by: null, updated_at: null },
    { id: "orf_14", category: "product", factor_key: "remittance", label: "International Remittance", description: "Cross-border money transfer or remittance", weight: 0.25, is_active: true, is_system: true, display_order: 1, updated_by: null, updated_at: null },
    { id: "orf_15", category: "product", factor_key: "cash", label: "Cash Transaction", description: "Physical cash deposit or withdrawal", weight: 0.20, is_active: true, is_system: true, display_order: 2, updated_by: null, updated_at: null },
    { id: "orf_16", category: "product", factor_key: "real_estate", label: "Real Estate Settlement", description: "Property purchase or settlement", weight: 0.15, is_active: true, is_system: true, display_order: 3, updated_by: null, updated_at: null },
    { id: "orf_17", category: "product", factor_key: "prepaid_card", label: "Prepaid or Anonymous Instrument", description: "Prepaid card, money order or bearer instrument", weight: 0.10, is_active: true, is_system: true, display_order: 4, updated_by: null, updated_at: null },
  ],
  transaction: [
    { id: "orf_18", category: "transaction", factor_key: "structuring", label: "Structuring Indicators", description: "Patterns suggesting deliberate threshold avoidance", weight: 0.35, is_active: true, is_system: true, display_order: 0, updated_by: null, updated_at: null },
    { id: "orf_19", category: "transaction", factor_key: "near_threshold", label: "Near-Threshold Amount", description: "Transaction within 10% of AUD 10,000 TTR threshold", weight: 0.25, is_active: true, is_system: true, display_order: 1, updated_by: null, updated_at: null },
    { id: "orf_20", category: "transaction", factor_key: "high_value", label: "High-Value Transaction", description: "Single transaction above AUD 50,000", weight: 0.20, is_active: true, is_system: true, display_order: 2, updated_by: null, updated_at: null },
    { id: "orf_21", category: "transaction", factor_key: "round_number", label: "Unusual Round Number", description: "Suspiciously round amount (e.g. exactly AUD 9,000)", weight: 0.10, is_active: true, is_system: true, display_order: 3, updated_by: null, updated_at: null },
    { id: "orf_22", category: "transaction", factor_key: "rapid_succession", label: "Rapid Successive Transactions", description: "Multiple transactions within a short time window", weight: 0.10, is_active: true, is_system: true, display_order: 4, updated_by: null, updated_at: null },
  ],
  behaviour: [
    { id: "orf_23", category: "behaviour", factor_key: "occupation_mismatch", label: "Occupation/Income Mismatch", description: "Transaction inconsistent with declared occupation", weight: 0.30, is_active: true, is_system: true, display_order: 0, updated_by: null, updated_at: null },
    { id: "orf_24", category: "behaviour", factor_key: "dormant_reactivation", label: "Dormant Account Reactivation", description: "Account inactive for 90+ days suddenly becomes active", weight: 0.25, is_active: true, is_system: true, display_order: 1, updated_by: null, updated_at: null },
    { id: "orf_25", category: "behaviour", factor_key: "unusual_channel", label: "Unusual Payment Channel", description: "Payment method inconsistent with customer's usual behaviour", weight: 0.20, is_active: true, is_system: true, display_order: 2, updated_by: null, updated_at: null },
    { id: "orf_26", category: "behaviour", factor_key: "new_country", label: "New Geographic Footprint", description: "Transaction to/from country not in customer's profile", weight: 0.15, is_active: true, is_system: true, display_order: 3, updated_by: null, updated_at: null },
    { id: "orf_27", category: "behaviour", factor_key: "velocity_breach", label: "Transaction Velocity Anomaly", description: "Transaction rate exceeds established baseline", weight: 0.10, is_active: true, is_system: true, display_order: 4, updated_by: null, updated_at: null },
  ],
  delivery_channel: [
    { id: "orf_28", category: "delivery_channel", factor_key: "third_party", label: "Third-Party / Agent Channel", description: "Transaction via unregulated third-party or agent", weight: 0.35, is_active: true, is_system: true, display_order: 0, updated_by: null, updated_at: null },
    { id: "orf_29", category: "delivery_channel", factor_key: "online_digital", label: "Online / Digital Channel", description: "Transaction initiated via website or mobile app", weight: 0.30, is_active: true, is_system: true, display_order: 1, updated_by: null, updated_at: null },
    { id: "orf_30", category: "delivery_channel", factor_key: "atm", label: "ATM or Unattended Terminal", description: "Transaction through ATM or kiosk", weight: 0.20, is_active: true, is_system: true, display_order: 2, updated_by: null, updated_at: null },
    { id: "orf_31", category: "delivery_channel", factor_key: "branch", label: "Branch / In-Person", description: "Transaction conducted in person at a branch", weight: 0.15, is_active: true, is_system: true, display_order: 3, updated_by: null, updated_at: null },
  ],
}

const DEMO_PROFILES: Profile[] = [
  { id: "orp_1", risk_level: "low", score_min: 0.0, score_max: 25.0, review_frequency_months: 36, edd_required: false, enhanced_monitoring: false, senior_approval_required: false, description: "Standard CDD. Periodic review every 3 years.", updated_at: null },
  { id: "orp_2", risk_level: "medium", score_min: 25.01, score_max: 50.0, review_frequency_months: 24, edd_required: false, enhanced_monitoring: true, senior_approval_required: false, description: "Standard CDD with enhanced monitoring. Review every 2 years.", updated_at: null },
  { id: "orp_3", risk_level: "high", score_min: 50.01, score_max: 75.0, review_frequency_months: 12, edd_required: true, enhanced_monitoring: true, senior_approval_required: false, description: "Enhanced Due Diligence required. Annual review.", updated_at: null },
  { id: "orp_4", risk_level: "critical", score_min: 75.01, score_max: 100.0, review_frequency_months: 6, edd_required: true, enhanced_monitoring: true, senior_approval_required: true, description: "Maximum EDD. 6-monthly review. Senior approval required.", updated_at: null },
]

const DEMO_VERSIONS: VersionEntry[] = [
  { id: "rmv_1", version_number: 1, change_type: "seeded_defaults", change_summary: "System defaults seeded at first access", changed_by: "system", change_reason: "Initial setup", created_at: "2026-01-10T09:00:00Z" },
]

function toast(msg: string, kind: "success" | "error" = "success") {
  const el = document.createElement("div")
  el.textContent = msg
  el.className = clsx(
    "fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
    kind === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
  )
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

export default function RiskMatrixPage() {
  const [tab, setTab] = useState<"factors" | "profiles" | "versions">("factors")
  const [byCategory, setByCategory] = useState<Record<string, Factor[]>>(DEMO_FACTORS)
  const [weightTotals, setWeightTotals] = useState<Record<string, number>>({})
  const [profiles, setProfiles] = useState<Profile[]>(DEMO_PROFILES)
  const [versions, setVersions] = useState<VersionEntry[]>(DEMO_VERSIONS)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["customer"]))
  const [editFactor, setEditFactor] = useState<Factor | null>(null)
  const [addFactorCat, setAddFactorCat] = useState<Category | null>(null)
  const [restoreOpen, setRestoreOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [fRes, pRes, vRes] = await Promise.all([
          fetch(`${API}/api/v1/risk-matrix/factors?active_only=false`),
          fetch(`${API}/api/v1/risk-matrix/profiles`),
          fetch(`${API}/api/v1/risk-matrix/versions`),
        ])
        if (!fRes.ok || !pRes.ok || !vRes.ok) throw new Error("fetch failed")
        const fData = await fRes.json()
        const pData = await pRes.json()
        const vData = await vRes.json()
        setByCategory(fData.by_category)
        setWeightTotals(fData.weight_totals)
        setProfiles(pData.profiles)
        setVersions(vData)
      } catch {
        const totals: Record<string, number> = {}
        Object.entries(DEMO_FACTORS).forEach(([cat, items]) => {
          totals[cat] = Math.round(items.reduce((s, f) => s + f.weight, 0) * 100) / 100
        })
        setWeightTotals(totals)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function toggleCategory(cat: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  async function saveFactor(factor: Factor, weight: number, isActive: boolean) {
    try {
      const res = await fetch(
        `${API}/api/v1/risk-matrix/factors/${factor.id}?reason=${encodeURIComponent("Adjusted via Risk Matrix console")}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weight, is_active: isActive }) }
      )
      if (!res.ok) throw new Error("save failed")
    } catch {
      // demo fallback below regardless
    }
    setByCategory(prev => ({
      ...prev,
      [factor.category]: prev[factor.category].map(f =>
        f.id === factor.id ? { ...f, weight, is_active: isActive } : f
      ),
    }))
    setWeightTotals(prev => ({
      ...prev,
      [factor.category]: Math.round(
        (byCategory[factor.category] ?? []).reduce(
          (s, f) => s + (f.id === factor.id ? weight : f.weight), 0
        ) * 100
      ) / 100,
    }))
    setEditFactor(null)
    toast("Risk factor updated")
  }

  async function addFactor(cat: Category, payload: { factor_key: string; label: string; description: string; weight: number }) {
    try {
      const res = await fetch(
        `${API}/api/v1/risk-matrix/factors?reason=${encodeURIComponent("Added via Risk Matrix console")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: cat, ...payload, display_order: (byCategory[cat]?.length ?? 0) }),
        }
      )
      if (res.ok) {
        const created = await res.json()
        setByCategory(prev => ({ ...prev, [cat]: [...(prev[cat] ?? []), created] }))
        setAddFactorCat(null)
        toast("Custom risk factor added")
        return
      }
      throw new Error("add failed")
    } catch {
      const newFactor: Factor = {
        id: `orf_local_${Date.now()}`,
        category: cat,
        factor_key: payload.factor_key,
        label: payload.label,
        description: payload.description,
        weight: payload.weight,
        is_active: true,
        is_system: false,
        display_order: byCategory[cat]?.length ?? 0,
        updated_by: null,
        updated_at: null,
      }
      setByCategory(prev => ({ ...prev, [cat]: [...(prev[cat] ?? []), newFactor] }))
      setAddFactorCat(null)
      toast("Custom risk factor added (offline)")
    }
  }

  async function restoreDefaults(section: string) {
    try {
      const res = await fetch(
        `${API}/api/v1/risk-matrix/restore-defaults?section=${section}&reason=${encodeURIComponent("Restored via Risk Matrix console")}`,
        { method: "POST" }
      )
      if (!res.ok) throw new Error("restore failed")
      toast(`Restored ${section} to defaults`)
    } catch {
      if (section === "factors" || section === "all") setByCategory(DEMO_FACTORS)
      if (section === "profiles" || section === "all") setProfiles(DEMO_PROFILES)
      toast(`Restored ${section} to defaults (offline)`)
    }
    setRestoreOpen(false)
  }

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading risk matrix…</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-700" /> Risk Matrix
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Industry-specific risk weighting, profile thresholds, and full version history.
          </p>
        </div>
        <button
          onClick={() => setRestoreOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RotateCcw className="w-4 h-4" /> Restore Defaults
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(["factors", "profiles", "versions"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
              tab === t ? "border-blue-700 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {t === "factors" ? "Risk Factors" : t === "profiles" ? "Risk Profiles" : "Version History"}
          </button>
        ))}
      </div>

      {tab === "factors" && (
        <div className="space-y-3">
          {Object.entries(byCategory).map(([cat, factors]) => {
            const total = weightTotals[cat] ?? factors.reduce((s, f) => s + (f.is_active ? f.weight : 0), 0)
            const balanced = Math.abs(total - 1.0) <= 0.01
            const isOpen = expanded.has(cat)
            return (
              <div key={cat} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="font-medium text-gray-900">{CATEGORY_LABELS[cat as Category] ?? cat}</span>
                    <span className="text-xs text-gray-400">({factors.length} factors)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                      balanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    )}>
                      {balanced ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      Weight total: {(total * 100).toFixed(0)}%
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                          <th className="px-4 py-2 font-medium">Factor</th>
                          <th className="px-4 py-2 font-medium">Description</th>
                          <th className="px-4 py-2 font-medium">Weight</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                          <th className="px-4 py-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {factors.map(f => (
                          <tr key={f.id} className="border-t border-gray-100">
                            <td className="px-4 py-2 font-medium text-gray-800">
                              {f.label}
                              {!f.is_system && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">CUSTOM</span>}
                            </td>
                            <td className="px-4 py-2 text-gray-500 max-w-md">{f.description}</td>
                            <td className="px-4 py-2 text-gray-700">{(f.weight * 100).toFixed(0)}%</td>
                            <td className="px-4 py-2">
                              <span className={clsx("text-xs px-2 py-0.5 rounded-full", f.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                                {f.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => setEditFactor(f)} className="text-xs font-medium text-blue-700 hover:underline">Edit</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-2 border-t border-gray-100">
                      <button
                        onClick={() => setAddFactorCat(cat as Category)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add custom factor
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === "profiles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map(p => (
            <div key={p.id} className={clsx("rounded-xl border p-4", LEVEL_COLOR[p.risk_level].split(" ").slice(2).join(" "))}>
              <div className="flex items-center justify-between mb-2">
                <span className={clsx("text-xs font-semibold px-2 py-1 rounded-full border", LEVEL_COLOR[p.risk_level])}>
                  {p.risk_level.toUpperCase()}
                </span>
                <span className="text-sm font-mono text-gray-600">{p.score_min}–{p.score_max}</span>
              </div>
              <p className="text-sm text-gray-700 mb-3">{p.description}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>Review cycle: <strong>{p.review_frequency_months}mo</strong></div>
                <div>EDD: <strong>{p.edd_required ? "Required" : "Not required"}</strong></div>
                <div>Monitoring: <strong>{p.enhanced_monitoring ? "Enhanced" : "Standard"}</strong></div>
                <div>Approval: <strong>{p.senior_approval_required ? "Senior required" : "Standard"}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "versions" && (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {versions.length === 0 && <div className="p-6 text-sm text-gray-500">No version history yet.</div>}
          {versions.map(v => (
            <div key={v.id} className="flex items-start gap-3 px-4 py-3">
              <History className="w-4 h-4 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">
                  v{v.version_number} · {v.change_summary}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {v.change_type} · by {v.changed_by} · {new Date(v.created_at).toLocaleString()}
                  {v.change_reason && <> · "{v.change_reason}"</>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editFactor && (
        <EditFactorModal factor={editFactor} onClose={() => setEditFactor(null)} onSave={saveFactor} />
      )}
      {addFactorCat && (
        <AddFactorModal category={addFactorCat} onClose={() => setAddFactorCat(null)} onSave={addFactor} />
      )}
      {restoreOpen && (
        <RestoreModal onClose={() => setRestoreOpen(false)} onConfirm={restoreDefaults} />
      )}
    </div>
  )
}

function EditFactorModal({ factor, onClose, onSave }: {
  factor: Factor
  onClose: () => void
  onSave: (f: Factor, weight: number, isActive: boolean) => void
}) {
  const [weight, setWeight] = useState(Math.round(factor.weight * 100))
  const [isActive, setIsActive] = useState(factor.is_active)

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{factor.label}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Weight (%)</label>
        <input
          type="number" min={0} max={100} value={weight}
          onChange={e => setWeight(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          Active
        </label>
        <button
          onClick={() => onSave(factor, weight / 100, isActive)}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-800"
        >
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </div>
    </div>
  )
}

function AddFactorModal({ category, onClose, onSave }: {
  category: Category
  onClose: () => void
  onSave: (cat: Category, payload: { factor_key: string; label: string; description: string; weight: number }) => void
}) {
  const [label, setLabel] = useState("")
  const [description, setDescription] = useState("")
  const [weight, setWeight] = useState(10)

  function submit() {
    if (!label.trim()) return
    const factor_key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 100)
    onSave(category, { factor_key, label: label.trim(), description, weight: weight / 100 })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Add Custom Factor — {CATEGORY_LABELS[category]}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Weight (%)</label>
            <input type="number" min={0} max={100} value={weight} onChange={e => setWeight(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <button onClick={submit} className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-800">
          <Plus className="w-4 h-4" /> Add Factor
        </button>
      </div>
    </div>
  )
}

function RestoreModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (section: string) => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Restore Defaults</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          This will delete custom factors and reset system factors/profiles to VeriGo industry defaults.
          This action is logged and cannot be undone.
        </p>
        <div className="space-y-2">
          <button onClick={() => onConfirm("factors")} className="w-full border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
            Restore Risk Factors Only
          </button>
          <button onClick={() => onConfirm("profiles")} className="w-full border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
            Restore Risk Profiles Only
          </button>
          <button onClick={() => onConfirm("all")} className="w-full bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700">
            Restore All to Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
