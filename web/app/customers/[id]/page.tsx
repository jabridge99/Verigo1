"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ShieldCheck, FileText, Activity, Search,
  User, FolderOpen, BarChart2, FileCheck, Briefcase, Scale,
  ClipboardList, StickyNote, CheckSquare, History,
} from "lucide-react";
import clsx from "clsx";
import { DEMO_CUSTOMERS, getCustomerProfile } from "@/lib/demoCustomers";
import QuickActions from "@/components/QuickActions";

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
  { key: "risk", label: "Risk Assessment", icon: BarChart2 },
  { key: "kyc", label: "KYC", icon: FileCheck },
  { key: "kyb", label: "KYB", icon: Briefcase },
  { key: "screening", label: "Screening", icon: Search },
  { key: "transactions", label: "Transactions", icon: Activity },
  { key: "cases", label: "Cases", icon: Scale },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "audit", label: "Audit History", icon: History },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "timeline", label: "Timeline", icon: ClipboardList },
] as const;

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [tab, setTab] = useState<typeof TABS[number]["key"]>("profile");

  const customer = DEMO_CUSTOMERS.find(c => c.customer_id === id);

  if (!customer) {
    return (
      <div className="min-h-screen bg-navy-900 text-slate-200 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-3">Customer {id} not found.</p>
          <Link href="/customers" className="text-brand-400 hover:underline text-sm">Back to Customers</Link>
        </div>
      </div>
    );
  }

  const profile = getCustomerProfile(customer);

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      {/* Header */}
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-100">{customer.full_name}</h1>
              {customer.is_pep ? <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">PEP</span> : null}
              <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border capitalize", RISK_COLOR[customer.risk_level] || "")}>
                {customer.risk_level} risk
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5 font-mono">{customer.customer_id} · {customer.email}</p>
          </div>
          <div className="flex items-center gap-1.5 w-44">
            <div className="flex-1 h-2 rounded-full bg-navy-700">
              <div className={`h-full rounded-full ${RISK_BAR[customer.risk_level]}`} style={{ width: `${customer.risk_score}%` }} />
            </div>
            <span className="text-xs text-slate-400 w-8 text-right">{customer.risk_score.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="border-b border-navy-800 bg-navy-800/40 px-6 py-3">
        <div className="max-w-6xl mx-auto">
          <QuickActions actions={[
            { label: "Start KYC", href: `/onboarding?customer=${customer.customer_id}&action=kyc`, icon: ShieldCheck },
            { label: "Start KYB", href: `/onboarding?customer=${customer.customer_id}&action=kyb`, icon: ShieldCheck },
            { label: "Run Screening", href: `/onboarding?customer=${customer.customer_id}&action=screening`, icon: Search },
            { label: "Create Transaction", href: `/monitoring?customer=${customer.customer_id}&action=new`, icon: Activity },
            { label: "Create Case", href: `/mlro?customer=${customer.customer_id}&action=new-case`, icon: AlertTriangle },
            { label: "Request Documents", href: `/documents?customer=${customer.customer_id}&action=request`, icon: FileText },
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Status", value: customer.status.replace(/_/g, " ") },
              { label: "KYC", value: profile.kyc_status || "—" },
              { label: "Industry", value: customer.industry.replace(/_/g, " ") },
              { label: "Occupation", value: customer.occupation || "—" },
              { label: "Nationality", value: customer.nationality },
              { label: "Residence", value: customer.country_of_residence },
              { label: "Email", value: customer.email },
              { label: "Onboarded", value: customer.created_at ? new Date(customer.created_at).toLocaleDateString("en-AU") : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-navy-700 bg-navy-800 p-4">
                <div className="text-xs text-slate-500 mb-1">{label}</div>
                <div className="text-sm text-slate-200 capitalize truncate">{value}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "risk" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">AML Exposure</div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { icon: AlertTriangle, label: "Total alerts", value: profile.alert_count, sub: `${profile.open_alerts} open`, urgent: profile.open_alerts > 0 },
                  { icon: FileText, label: "Reports", value: profile.report_count, sub: `${profile.open_reports} open`, urgent: profile.open_reports > 0 },
                  { icon: ShieldCheck, label: "ECDD reviews", value: profile.ecdd_count, sub: profile.ecdd_recommendation ? `→ ${profile.ecdd_recommendation}` : "none", urgent: profile.ecdd_recommendation === "reject" },
                  { icon: Activity, label: "Transactions", value: profile.transaction_count, sub: profile.total_transacted ? `AUD $${(profile.total_transacted / 1000).toFixed(0)}k total` : "—", urgent: false },
                ].map(({ icon: Icon, label, value, sub, urgent }) => (
                  <div key={label} className={`rounded-lg p-3 border ${urgent ? "bg-red-500/10 border-red-500/20" : "bg-navy-900 border-navy-700"}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${urgent ? "text-red-400" : "text-slate-500"}`} />
                      <span className="text-xs text-slate-500">{label}</span>
                    </div>
                    <div className={`text-xl font-bold ${urgent ? "text-red-300" : "text-slate-100"}`}>{value}</div>
                    <div className={`text-xs mt-0.5 ${urgent && profile.ecdd_recommendation ? REC_COLOR[profile.ecdd_recommendation] || "text-slate-500" : urgent ? "text-red-400" : "text-slate-500"}`}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-navy-700 bg-navy-800 p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Risk Factors</div>
              <div className="space-y-2">
                {[
                  { label: "PEP status", active: !!customer.is_pep, note: customer.is_pep ? "Politically exposed person" : "Not a PEP" },
                  { label: "High-risk country", active: ["Russia", "Iran", "North Korea", "Syria"].includes(customer.country_of_residence), note: customer.country_of_residence },
                  { label: "High-risk industry", active: ["cryptocurrency", "real_estate"].includes(customer.industry), note: customer.industry.replace(/_/g, " ") },
                  { label: "Open alerts", active: profile.open_alerts > 0, note: `${profile.open_alerts} unresolved` },
                  { label: "Open reports", active: profile.open_reports > 0, note: `${profile.open_reports} pending` },
                  { label: "ECDD recommendation", active: ["monitor", "reject"].includes(profile.ecdd_recommendation || ""), note: profile.ecdd_recommendation || "no ECDD" },
                ].map(({ label, active, note }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${active ? "bg-red-400" : "bg-emerald-500"}`} />
                      <span className={active ? "text-slate-200" : "text-slate-500"}>{label}</span>
                    </div>
                    <span className={active ? "text-slate-300" : "text-slate-600"}>{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "kyc" && (
          <EmptyTabState
            title="KYC verification"
            description={`Current status: ${profile.kyc_status || "not started"}.`}
            actionLabel="Send verification link"
            actionHref={`/onboarding?customer=${customer.customer_id}&action=kyc`}
          />
        )}

        {tab === "kyb" && (
          <EmptyTabState
            title="KYB verification"
            description="Business verification, beneficial owners, and company extract."
            actionLabel="Start KYB"
            actionHref={`/onboarding?customer=${customer.customer_id}&action=kyb`}
          />
        )}

        {tab === "screening" && (
          <EmptyTabState
            title="PEP, sanctions and adverse media screening"
            description="No screening run recorded for this customer yet."
            actionLabel="Run screening"
            actionHref={`/onboarding?customer=${customer.customer_id}&action=screening`}
          />
        )}

        {tab === "documents" && (
          <EmptyTabState
            title="Documents"
            description="ID documents, proof of address, and business documents for this customer."
            actionLabel="Request documents"
            actionHref={`/documents?customer=${customer.customer_id}&action=request`}
          />
        )}

        {tab === "transactions" && (
          <EmptyTabState
            title={`${profile.transaction_count} transactions · AUD $${profile.total_transacted.toLocaleString()}`}
            description="View this customer's transaction history in Monitoring."
            actionLabel="View transactions"
            actionHref={`/monitoring?customer=${customer.customer_id}`}
          />
        )}

        {tab === "cases" && (
          <EmptyTabState
            title="Cases"
            description="No open cases for this customer."
            actionLabel="Create case"
            actionHref={`/mlro?customer=${customer.customer_id}&action=new-case`}
          />
        )}

        {tab === "reports" && (
          <EmptyTabState
            title={`${profile.report_count} reports · ${profile.open_reports} open`}
            description="TTR, IFTI and SMR reports filed for this customer."
            actionLabel="View reports"
            actionHref={`/reporting?customer=${customer.customer_id}`}
          />
        )}

        {tab === "audit" && (
          <EmptyTabState
            title="Audit history"
            description="Immutable log of all actions and changes for this customer."
            actionLabel="View audit trail"
            actionHref={`/audit?customer=${customer.customer_id}`}
          />
        )}

        {(tab === "notes" || tab === "tasks" || tab === "timeline") && (
          <EmptyTabState
            title={TABS.find(t => t.key === tab)?.label || ""}
            description="Not yet recorded for this customer."
          />
        )}
      </div>
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
