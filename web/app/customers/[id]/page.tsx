"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ShieldCheck, FileText, Activity, Search,
  User, FolderOpen, BarChart2, FileCheck, Briefcase, Scale,
  ClipboardList, StickyNote, CheckSquare, History, Users, Wallet,
  RefreshCw, Download, Sliders,
} from "lucide-react";
import clsx from "clsx";
import { DEMO_CUSTOMERS, getCustomerProfile } from "@/lib/demoCustomers";
import QuickActions from "@/components/QuickActions";
import { getStoredUser } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const RISK_COLOR: Record<string, string> = {
  low:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
};

const RISK_BAR: Record<string, string> = {
  low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-orange-500", critical: "bg-red-500",
};

const REC_COLOR: Record<string, string> = {
  approve: "text-emerald-400", monitor: "text-amber-400", reject: "text-red-400",
};

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "documents", label: "Documents", icon: FolderOpen },
  { key: "beneficiaries", label: "Beneficiaries", icon: Users },
  { key: "risk", label: "Risk Assessment", icon: BarChart2 },
  { key: "kyc", label: "KYC/KYB", icon: FileCheck },
  { key: "screening", label: "Screening", icon: Search },
  { key: "sofsow", label: "SOF/SOW · CDD", icon: Wallet },
  { key: "transactions", label: "Transactions", icon: Activity },
  { key: "cases", label: "Cases", icon: Scale },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "timeline", label: "Timeline", icon: ClipboardList },
] as const;

type TabKey = typeof TABS[number]["key"];

interface Workspace {
  customer: any;
  business_detail: any;
  beneficial_owners: any[];
  documents: any[];
  corporate_documents: any[];
  screening: { records: any[]; latest_by_type: Record<string, any>; open_alerts: any[] };
  onboarding_checklist: any;
  risk: { risk_score: number; risk_level: string; history: any[] };
  sof_sow: { source_of_funds?: string; source_of_funds_verified?: boolean; source_of_wealth?: string; source_of_wealth_verified?: boolean };
  cdd: { cdd_level?: string; last_reviewed_date?: string; last_reviewed_by?: string; next_review_date?: string };
  reviews: any[];
  notes: any[];
  cases: { open: any[]; closed: any[]; escalated: any[]; smr_linked: any[] };
  transactions: { recent: any[]; total_count: number; recent_volume_aud: number };
  assigned_officer?: string;
}

function buildDemoWorkspace(customerId: string): Workspace | null {
  const customer = DEMO_CUSTOMERS.find(c => c.customer_id === customerId);
  if (!customer) return null;
  const profile = getCustomerProfile(customer);
  return {
    customer: {
      id: customer.customer_id,
      customer_ref: customer.customer_id,
      full_name: customer.full_name,
      customer_type: "individual",
      status: customer.status,
      risk_level: customer.risk_level,
      risk_score: customer.risk_score,
      cdd_level: "standard",
      is_pep: !!customer.is_pep,
      is_sanctions_match: false,
      is_adverse_media: false,
      source_of_funds: "Employment income",
      source_of_wealth: "Salary and savings",
      nationality: customer.nationality,
      country_of_residence: customer.country_of_residence,
      occupation: customer.occupation,
      employer_name: null,
      tax_residency_country: customer.country_of_residence,
      email: customer.email,
      relationship_manager: "demo_officer",
      last_reviewed_date: null,
      next_review_date: null,
      created_at: customer.created_at,
    },
    business_detail: null,
    beneficial_owners: [],
    documents: [],
    corporate_documents: [],
    screening: {
      records: [],
      latest_by_type: { pep: { status: "clear", screened_at: customer.created_at, provider: "demo" } },
      open_alerts: profile.open_alerts > 0 ? [{ id: "al_demo", severity: "medium", summary: "Demo open alert", status: "open" }] : [],
    },
    onboarding_checklist: null,
    risk: { risk_score: customer.risk_score, risk_level: customer.risk_level, history: [] },
    sof_sow: { source_of_funds: "Employment income", source_of_funds_verified: true, source_of_wealth: "Salary and savings", source_of_wealth_verified: false },
    cdd: { cdd_level: "standard", last_reviewed_date: undefined, last_reviewed_by: undefined, next_review_date: undefined },
    reviews: [],
    notes: [],
    cases: { open: [], closed: [], escalated: [], smr_linked: [] },
    transactions: { recent: [], total_count: profile.transaction_count, recent_volume_aud: profile.total_transacted },
    assigned_officer: "demo_officer",
  };
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [tab, setTab] = useState<TabKey>("profile");
  const [ws, setWs] = useState<Workspace | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ reason: "", risk_level: "", risk_score: "", status: "", classification: "", monitoring_level: "" });
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const user = typeof window !== "undefined" ? getStoredUser() : null;
  const isMlro = user?.role === "mlro" || user?.role === "admin";

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wr, tr] = await Promise.all([
        fetch(`${API}/api/v1/customers/${id}/workspace`, { credentials: "include" }),
        fetch(`${API}/api/v1/customers/${id}/timeline?limit=100`, { credentials: "include" }),
      ]);
      if (!wr.ok) throw new Error("api");
      setWs(await wr.json());
      setTimeline(tr.ok ? (await tr.json()).events || [] : []);
      setDemo(false);
    } catch {
      const fallback = buildDemoWorkspace(id);
      setWs(fallback);
      setTimeline([]);
      setDemo(true);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submitOverride = async () => {
    if (!overrideForm.reason) { showToast("error", "Reason is required"); return; }
    const body: Record<string, any> = { reason: overrideForm.reason };
    if (overrideForm.risk_level) body.risk_level = overrideForm.risk_level;
    if (overrideForm.risk_score) body.risk_score = parseFloat(overrideForm.risk_score);
    if (overrideForm.status) body.status = overrideForm.status;
    if (overrideForm.classification) body.classification = overrideForm.classification;
    if (overrideForm.monitoring_level) body.monitoring_level = overrideForm.monitoring_level;
    try {
      const res = await fetch(`${API}/api/v1/customers/${id}/override`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast("success", "Override applied");
        setShowOverride(false);
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("error", err.detail || "Override failed");
      }
    } catch { showToast("error", "Network error"); }
  };

  if (loading && !ws) {
    return <div className="min-h-screen bg-navy-900 text-slate-200 flex items-center justify-center"><p className="text-slate-400">Loading customer workspace…</p></div>;
  }

  if (!ws) {
    return (
      <div className="min-h-screen bg-navy-900 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-3">Customer {id} not found.</p>
          <Link href="/customers" className="text-brand-400 hover:underline text-sm">Back to Customers</Link>
        </div>
      </div>
    );
  }

  const c = ws.customer;
  const riskLevel = ws.risk.risk_level || c.risk_level;
  const riskScore = ws.risk.risk_score ?? c.risk_score ?? 0;

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      {/* Header */}
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-100">{c.full_name}</h1>
              {c.is_pep ? <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">PEP</span> : null}
              {c.is_sanctions_match ? <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-300 border border-red-500/30">SANCTIONS</span> : null}
              {c.is_adverse_media ? <span className="px-1.5 py-0.5 rounded text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">ADVERSE MEDIA</span> : null}
              <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", RISK_COLOR[riskLevel] || "")}>
                {riskLevel} risk
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5 font-mono">{c.customer_ref || c.id} · {c.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-44">
              <div className="flex-1 h-2 rounded-full bg-navy-700">
                <div className={`h-full rounded-full ${RISK_BAR[riskLevel]}`} style={{ width: `${riskScore}%` }} />
              </div>
              <span className="text-xs text-slate-400 w-8 text-right">{Number(riskScore).toFixed(0)}</span>
            </div>
            {isMlro && (
              <button onClick={() => setShowOverride(v => !v)} className="btn-secondary text-xs py-1.5 px-3">
                <Sliders className="w-3.5 h-3.5" /> MLRO Override
              </button>
            )}
          </div>
        </div>
      </div>

      {demo && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample workspace data
          </div>
        </div>
      )}

      {showOverride && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-sm">MLRO Override — manual correction</h3>
            <div className="grid grid-cols-2 gap-3">
              <select value={overrideForm.risk_level} onChange={e => setOverrideForm(f => ({ ...f, risk_level: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm">
                <option value="">Risk level (no change)</option>
                {["low", "medium", "high", "critical"].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="number" placeholder="Risk score override" value={overrideForm.risk_score}
                onChange={e => setOverrideForm(f => ({ ...f, risk_score: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" />
              <select value={overrideForm.status} onChange={e => setOverrideForm(f => ({ ...f, status: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm">
                <option value="">Status (no change)</option>
                {["pending", "kyc_in_progress", "kyc_approved", "kyc_rejected", "active", "suspended", "closed"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input placeholder="Customer classification" value={overrideForm.classification}
                onChange={e => setOverrideForm(f => ({ ...f, classification: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Monitoring level" value={overrideForm.monitoring_level}
                onChange={e => setOverrideForm(f => ({ ...f, monitoring_level: e.target.value }))}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <input placeholder="Reason for override (required)" value={overrideForm.reason}
              onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button onClick={submitOverride} className="btn-primary text-sm py-2 px-4">Apply Override</button>
              <button onClick={() => setShowOverride(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="border-b border-navy-800 bg-navy-800/40 px-6 py-3">
        <div className="max-w-6xl mx-auto">
          <QuickActions actions={[
            { label: "Start KYC", href: `/onboarding?customer=${c.customer_ref || c.id}&action=kyc`, icon: ShieldCheck },
            { label: "Start KYB", href: `/onboarding?customer=${c.customer_ref || c.id}&action=kyb`, icon: ShieldCheck },
            { label: "Run Screening", href: `/onboarding?customer=${c.customer_ref || c.id}&action=screening`, icon: Search },
            { label: "Create Transaction", href: `/monitoring?customer=${c.customer_ref || c.id}&action=new`, icon: Activity },
            { label: "Create Case", href: `/mlro?customer=${c.customer_ref || c.id}&action=new-case`, icon: AlertTriangle },
            { label: "Upload Document", href: `/documents?customer=${c.customer_ref || c.id}&action=upload`, icon: FileText },
            { label: "Refresh", onClick: load, icon: RefreshCw },
          ]} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-navy-800 bg-navy-900 px-6 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                  active ? "border-brand-400 text-brand-400" : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {tab === "profile" && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Status", value: c.status?.replace(/_/g, " ") },
                { label: "Customer Type", value: c.customer_type?.replace(/_/g, " ") },
                { label: "CDD Level", value: c.cdd_level?.replace(/_/g, " ") },
                { label: "Occupation", value: c.occupation || "—" },
                { label: "Employer", value: c.employer_name || "—" },
                { label: "Nationality", value: c.nationality || "—" },
                { label: "Residence", value: c.country_of_residence || "—" },
                { label: "Tax Residency", value: c.tax_residency_country || "—" },
                { label: "Assigned Officer", value: ws.assigned_officer || c.relationship_manager || "—" },
                { label: "Last Reviewed", value: ws.cdd.last_reviewed_date || "—" },
                { label: "Next Review", value: ws.cdd.next_review_date || c.next_review_date || "—" },
                { label: "Onboarded", value: c.created_at ? new Date(c.created_at).toLocaleDateString("en-AU") : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-navy-700 bg-navy-800 p-4">
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className="text-sm text-slate-200 capitalize truncate">{value}</div>
                </div>
              ))}
            </div>
            {ws.business_detail && (
              <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Business Details</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Legal Name", value: ws.business_detail.legal_name },
                    { label: "Trading Name", value: ws.business_detail.trading_name },
                    { label: "ABN", value: ws.business_detail.abn },
                    { label: "ACN", value: ws.business_detail.acn },
                    { label: "Business Type", value: ws.business_detail.business_type },
                    { label: "Industry Sector", value: ws.business_detail.industry_sector },
                    { label: "Country of Incorporation", value: ws.business_detail.country_of_incorporation },
                    { label: "ASIC Status", value: ws.business_detail.asic_status },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-sm">
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="text-slate-200">{value || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "documents" && (
          <div className="space-y-3">
            {[...ws.documents, ...ws.corporate_documents].length === 0 ? (
              <EmptyTabState title="No documents yet" description="Upload ID, proof of address or business documents." actionLabel="Upload document" actionHref={`/documents?customer=${c.customer_ref || c.id}&action=upload`} />
            ) : (
              [...ws.documents, ...ws.corporate_documents].map((d: any) => (
                <div key={d.id} className="rounded-xl border border-navy-700 bg-navy-800 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-200">{d.file_name || d.document_type || "Document"}</div>
                    <div className="text-xs text-slate-500 capitalize">{(d.category || d.document_type || "").replace(/_/g, " ")} · {d.status || "active"}</div>
                  </div>
                  {d.id && !demo && (
                    <a href={`${API}/api/v1/documents/${d.id}/download`} className="btn-secondary text-xs py-1.5 px-3"><Download className="w-3.5 h-3.5" /> Download</a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "beneficiaries" && (
          <div className="space-y-3">
            {ws.beneficial_owners.length === 0 ? (
              <EmptyTabState title="No beneficial owners / beneficiaries linked" description="Add a UBO, director or beneficiary — reuse an existing customer record where possible." actionLabel="Manage beneficiaries" actionHref={`/onboarding?customer=${c.customer_ref || c.id}&action=kyb`} />
            ) : (
              ws.beneficial_owners.map((b: any) => (
                <div key={b.id} className="rounded-xl border border-navy-700 bg-navy-800 p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm text-slate-200">{b.full_name}</div>
                    <div className="text-xs text-slate-500 capitalize">{b.ubo_type?.replace(/_/g, " ")} {b.role_title ? `· ${b.role_title}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>Ownership: {b.ownership_percentage ?? "—"}%</span>
                    <span>Control: {b.control_percentage ?? "—"}%</span>
                    {b.is_pep && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">PEP</span>}
                    <span className={b.verified ? "text-emerald-400" : "text-slate-500"}>{b.verified ? "Verified" : "Unverified"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "risk" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Risk Overview</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { icon: AlertTriangle, label: "Open alerts", value: ws.screening.open_alerts.length, urgent: ws.screening.open_alerts.length > 0 },
                  { icon: Scale, label: "Open cases", value: ws.cases.open.length, urgent: ws.cases.open.length > 0 },
                  { icon: ShieldCheck, label: "SMR-linked cases", value: ws.cases.smr_linked.length, urgent: ws.cases.smr_linked.length > 0 },
                  { icon: Activity, label: "Transactions", value: ws.transactions.total_count, sub: `AUD $${(ws.transactions.recent_volume_aud / 1000).toFixed(0)}k recent`, urgent: false },
                ].map(({ icon: Icon, label, value, urgent, sub }: any) => (
                  <div key={label} className={`rounded-lg p-3 border ${urgent ? "bg-red-500/10 border-red-500/20" : "bg-navy-900 border-navy-700"}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${urgent ? "text-red-400" : "text-slate-500"}`} />
                      <span className="text-xs text-slate-500">{label}</span>
                    </div>
                    <div className={`text-xl font-bold ${urgent ? "text-red-300" : "text-slate-100"}`}>{value}</div>
                    {sub && <div className="text-xs mt-0.5 text-slate-500">{sub}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Risk Score History</div>
              {ws.risk.history.length === 0 ? (
                <p className="text-sm text-slate-500">No score history recorded.</p>
              ) : (
                <div className="space-y-2">
                  {ws.risk.history.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{h.scored_at ? new Date(h.scored_at).toLocaleString("en-AU") : "—"} · {h.trigger}</span>
                      <span className="text-slate-200">{h.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "kyc" && (
          <div className="space-y-4">
            <QuickActions actions={[
              { label: "Refresh Verification", href: `/onboarding?customer=${c.customer_ref || c.id}&action=kyc`, icon: RefreshCw },
              { label: "Send KYC Link", href: `/onboarding?customer=${c.customer_ref || c.id}&action=kyc-link`, icon: ShieldCheck },
              { label: "Request Updated Documents", href: `/documents?customer=${c.customer_ref || c.id}&action=request`, icon: FileText },
            ]} />
            {ws.onboarding_checklist ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(ws.onboarding_checklist).filter(([k]) => k.endsWith("_verified") || k.endsWith("_screened")).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-navy-700 bg-navy-800 p-4 flex items-center justify-between">
                    <span className="text-sm text-slate-300 capitalize">{k.replace(/_/g, " ")}</span>
                    <div className={`w-2 h-2 rounded-full ${v ? "bg-emerald-400" : "bg-slate-600"}`} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyTabState title="No onboarding checklist yet" description="KYC/KYB verification status will appear once onboarding starts." />
            )}
          </div>
        )}

        {tab === "screening" && (
          <div className="space-y-4">
            <QuickActions actions={[
              { label: "Refresh Screening", href: `/onboarding?customer=${c.customer_ref || c.id}&action=screening`, icon: RefreshCw },
              { label: "PEP", href: `/onboarding?customer=${c.customer_ref || c.id}&action=screening&type=pep`, icon: Search },
              { label: "Sanctions", href: `/onboarding?customer=${c.customer_ref || c.id}&action=screening&type=sanctions`, icon: Search },
              { label: "Adverse Media", href: `/onboarding?customer=${c.customer_ref || c.id}&action=screening&type=adverse_media`, icon: Search },
              { label: "Watchlists", href: `/onboarding?customer=${c.customer_ref || c.id}&action=screening&type=watchlist`, icon: Search },
              { label: "Crypto Screening", href: `/onboarding?customer=${c.customer_ref || c.id}&action=screening&type=crypto`, icon: Search },
            ]} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(ws.screening.latest_by_type).length === 0 ? (
                <div className="col-span-full"><EmptyTabState title="No screening recorded" description="Run PEP, sanctions, adverse media or watchlist screening for this customer." /></div>
              ) : (
                Object.entries(ws.screening.latest_by_type).map(([type, v]: [string, any]) => (
                  <div key={type} className="rounded-xl border border-navy-700 bg-navy-800 p-4">
                    <div className="text-xs text-slate-500 capitalize mb-1">{type.replace(/_/g, " ")}</div>
                    <div className="text-sm text-slate-200 capitalize">{v.status}</div>
                    <div className="text-xs text-slate-500 mt-1">{v.screened_at ? new Date(v.screened_at).toLocaleDateString("en-AU") : "—"} {v.provider ? `· ${v.provider}` : ""}</div>
                  </div>
                ))
              )}
            </div>
            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Open Alerts ({ws.screening.open_alerts.length})</div>
              {ws.screening.open_alerts.length === 0 ? (
                <p className="text-sm text-slate-500">No open screening alerts.</p>
              ) : (
                <div className="space-y-2">
                  {ws.screening.open_alerts.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-200">{a.summary || "Alert"}</span>
                      <span className="text-xs text-slate-500 capitalize">{a.severity} · {a.status} {a.assigned_to ? `· ${a.assigned_to}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "sofsow" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Source of Funds / Wealth</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500">Source of Funds</div>
                  <div className="text-sm text-slate-200">{ws.sof_sow.source_of_funds || "—"}</div>
                  <div className={`text-xs mt-1 ${ws.sof_sow.source_of_funds_verified ? "text-emerald-400" : "text-slate-500"}`}>{ws.sof_sow.source_of_funds_verified ? "Verified" : "Not verified"}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Source of Wealth</div>
                  <div className="text-sm text-slate-200">{ws.sof_sow.source_of_wealth || "—"}</div>
                  <div className={`text-xs mt-1 ${ws.sof_sow.source_of_wealth_verified ? "text-emerald-400" : "text-slate-500"}`}>{ws.sof_sow.source_of_wealth_verified ? "Verified" : "Not verified"}</div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">CDD / ECDD</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                {[
                  { label: "CDD Level", value: ws.cdd.cdd_level },
                  { label: "Last Reviewed", value: ws.cdd.last_reviewed_date },
                  { label: "Reviewed By", value: ws.cdd.last_reviewed_by },
                  { label: "Next Review", value: ws.cdd.next_review_date },
                ].map(({ label, value }) => (
                  <div key={label} className="text-sm">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="text-slate-200 capitalize">{value || "—"}</div>
                  </div>
                ))}
              </div>
              {ws.reviews.length === 0 ? (
                <p className="text-sm text-slate-500">No reviews recorded.</p>
              ) : (
                <div className="space-y-2">
                  {ws.reviews.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 capitalize">{r.review_type} · {r.review_date}</span>
                      <span className={REC_COLOR[r.outcome] || "text-slate-400"}>{r.outcome || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "transactions" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-slate-300">{ws.transactions.total_count} total · AUD ${ws.transactions.recent_volume_aud?.toLocaleString()} recent volume</div>
              <Link href={`/monitoring?customer=${c.customer_ref || c.id}&action=new`} className="btn-primary text-xs py-1.5 px-3"><Activity className="w-3.5 h-3.5" /> Create Transaction</Link>
            </div>
            {ws.transactions.recent.length === 0 ? (
              <EmptyTabState title="No transactions" description="No transactions recorded for this customer yet." />
            ) : (
              ws.transactions.recent.map((t: any) => (
                <div key={t.id} className="rounded-xl border border-navy-700 bg-navy-800 p-3 flex items-center justify-between text-sm">
                  <span className="capitalize text-slate-300">{t.direction} · {t.amount_aud ?? t.amount}</span>
                  <span className="text-xs text-slate-500">risk {t.risk_score ?? "—"} · {t.created_at ? new Date(t.created_at).toLocaleDateString("en-AU") : "—"}</span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "cases" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Link href={`/mlro?customer=${c.customer_ref || c.id}&action=new-case`} className="btn-primary text-xs py-1.5 px-3"><AlertTriangle className="w-3.5 h-3.5" /> Create Case</Link>
            </div>
            {[
              { label: "Open", items: ws.cases.open },
              { label: "Escalated", items: ws.cases.escalated },
              { label: "SMR-Linked", items: ws.cases.smr_linked },
              { label: "Closed", items: ws.cases.closed },
            ].map(({ label, items }) => (
              <div key={label} className="rounded-xl border border-navy-700 bg-navy-800 p-4">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">{label} ({items.length})</div>
                {items.length === 0 ? (
                  <p className="text-sm text-slate-500">None.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((cs: any) => (
                      <Link key={cs.id} href={`/mlro?case=${cs.id}`} className="flex items-center justify-between text-sm hover:text-brand-300">
                        <span className="text-slate-200">{cs.case_ref}</span>
                        <span className="text-xs text-slate-500 capitalize">{cs.case_type?.replace(/_/g, " ")} · {cs.severity} · {cs.status?.replace(/_/g, " ")}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-3">
            {ws.notes.length === 0 ? (
              <EmptyTabState title="No notes" description="Officer and MLRO notes for this customer will appear here." />
            ) : (
              ws.notes.map((n: any) => (
                <div key={n.id} className="rounded-xl border border-navy-700 bg-navy-800 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 capitalize">{n.note_type} {n.is_confidential && <span className="text-amber-400">· confidential</span>}</span>
                    <span className="text-xs text-slate-500">{n.created_by} · {n.created_at ? new Date(n.created_at).toLocaleDateString("en-AU") : "—"}</span>
                  </div>
                  <p className="text-sm text-slate-200">{n.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "timeline" && (
          <div className="space-y-2">
            {timeline.length === 0 ? (
              <EmptyTabState title="No timeline events" description="Customer creation, screening, transactions, cases and reviews will appear here chronologically." />
            ) : (
              timeline.map((e: any, i: number) => (
                <div key={i} className="rounded-lg border border-navy-700 bg-navy-800 p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-200">{e.label}</div>
                    <div className="text-xs text-slate-500 capitalize">{e.type?.replace(/_/g, " ")} {e.actor ? `· ${e.actor}` : ""}</div>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{e.at ? new Date(e.at).toLocaleString("en-AU") : "—"}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function EmptyTabState({ title, description, actionLabel, actionHref }: { title: string; description: string; actionLabel?: string; actionHref?: string }) {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-800 p-8 text-center">
      <p className="text-slate-200 font-medium mb-1">{title}</p>
      <p className="text-slate-500 text-sm mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
