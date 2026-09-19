"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, Plus, RefreshCw, AlertTriangle, CheckCircle, Clock,
  ChevronRight, ShieldAlert, Gavel, ListChecks,
} from "lucide-react";
import clsx from "clsx";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  listReviews,
  getOrgDashboard,
  getReviewDashboard,
  listFindings,
  listRecommendations,
  listActions,
  submitFindingResponse,
  startFindingRemediation,
  closeFinding as closeFindingApi,
  boardAcknowledge as boardAcknowledgeApi,
  type Review,
  type Finding,
  type Recommendation,
  type ActionItem,
  type ReviewDashboard as Dashboard,
  type OrgDashboard,
  type FindingRisk,
  type FindingStatus,
  type ReviewStatus,
} from "@/lib/api/independentReview";

const RISK_COLOR: Record<FindingRisk, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const FINDING_STATUS_COLOR: Record<string, string> = {
  open: "bg-slate-500/20 text-slate-300",
  response_submitted: "bg-brand-500/20 text-brand-300",
  in_remediation: "bg-amber-500/20 text-amber-300",
  closed: "bg-emerald-500/20 text-emerald-300",
  overdue: "bg-red-500/20 text-red-300",
  accepted_risk: "bg-purple-500/20 text-purple-300",
};

const REVIEW_STATUS_COLOR: Record<ReviewStatus, string> = {
  planned: "bg-slate-500/20 text-slate-300",
  in_progress: "bg-brand-500/20 text-brand-300",
  findings_issued: "bg-amber-500/20 text-amber-300",
  response_due: "bg-orange-500/20 text-orange-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  archived: "bg-slate-600/20 text-slate-500",
};

const DEMO_REVIEWS: Review[] = [
  { id: "rev_demo1", review_ref: "IR-2026-001", review_type: "external_independent", review_scope: "full_program", status: "response_due", overall_rating: "satisfactory_with_exceptions", title: "FY25 Independent AML/CTF Program Review", reviewer_name: "J. Carmichael", reviewer_firm: "Carmichael Risk Advisory", review_period_start: "2025-01-01", review_period_end: "2025-12-31", finding_count_critical: 1, finding_count_high: 2, finding_count_medium: 3, finding_count_low: 1, management_response_due: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), board_acknowledged: false, report_ref: "IR-RPT-2026-001" },
];

const DEMO_FINDINGS: Finding[] = [
  { id: "f1", finding_ref: "F-001", finding_number: 1, title: "CDD process inconsistent across onboarding channels", description: "Sampling of 25 new customer files found inconsistent application of CDD procedures between online and in-branch onboarding channels.", risk_rating: "high", category: "cdd_kyc", status: "in_remediation", policy_reference: "CDD Policy v3.2", affected_areas: ["Onboarding", "CDD"], management_response: "Compliance to standardise onboarding checklist across channels.", response_due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) },
  { id: "f2", finding_ref: "F-002", finding_number: 2, title: "Transaction monitoring rule thresholds not reviewed in 18 months", description: "No evidence of periodic threshold tuning review since program inception.", risk_rating: "critical", category: "transaction_monitoring", status: "open", affected_areas: ["Transaction Monitoring"], response_due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) },
];

type Tab = "reviews" | "create";

export default function IndependentReviewPage() {
  const router = useRouter();
  const user = typeof window !== "undefined" ? getStoredUser() : null;

  const [tab, setTab] = useState<Tab>("reviews");
  const [reviews, setReviews] = useState<Review[]>(DEMO_REVIEWS);
  const [orgDash, setOrgDash] = useState<OrgDashboard | null>(null);
  const [demo, setDemo] = useState(false);
  const [selected, setSelected] = useState<Review | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [actionsByRec, setActionsByRec] = useState<Record<string, ActionItem[]>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchReviews = useCallback(async () => {
    const [reviewsResult, dashResult] = await Promise.allSettled([
      listReviews(),
      getOrgDashboard(),
    ]);
    if (reviewsResult.status === "fulfilled") {
      if (reviewsResult.value.items.length) setReviews(reviewsResult.value.items);
    } else {
      setDemo(true);
    }
    if (dashResult.status === "fulfilled") setOrgDash(dashResult.value);
  }, []);

  useEffect(() => { if (!user) { router.push("/login"); return; } fetchReviews(); }, []);

  const openReview = async (r: Review) => {
    setSelected(r);
    setSelectedFinding(null);
    const [dashResult, findingsResult] = await Promise.allSettled([
      getReviewDashboard(r.id),
      listFindings(r.id),
    ]);
    setDashboard(dashResult.status === "fulfilled" ? dashResult.value : null);
    if (findingsResult.status === "fulfilled" && findingsResult.value.items.length) {
      setFindings(findingsResult.value.items);
    } else {
      setFindings(DEMO_FINDINGS);
    }
  };

  const openFinding = async (f: Finding) => {
    setSelectedFinding(f);
    if (!selected) return;
    try {
      const recResult = await listRecommendations(selected.id, f.id);
      const recs = recResult.items;
      setRecommendations(recs);
      const acts: Record<string, ActionItem[]> = {};
      await Promise.all(recs.map(async (rec) => {
        try {
          const ar = await listActions(selected.id, f.id, rec.id);
          acts[rec.id] = ar.items;
        } catch { acts[rec.id] = []; }
      }));
      setActionsByRec(acts);
    } catch { setRecommendations([]); setActionsByRec({}); }
  };

  const closeFinding = async (f: Finding) => {
    if (!selected) return;
    const evidence = prompt("Closure evidence (required):");
    if (!evidence) return;
    try {
      const updated = await closeFindingApi(selected.id, f.id, evidence);
      setFindings(prev => prev.map(x => x.id === f.id ? updated : x));
      setSelectedFinding(updated);
      showToast("success", `${f.finding_ref} closed`);
    } catch { showToast("error", "Failed to close finding"); }
  };

  const startRemediation = async (f: Finding) => {
    if (!selected) return;
    try {
      const updated = await startFindingRemediation(selected.id, f.id);
      setFindings(prev => prev.map(x => x.id === f.id ? updated : x));
      setSelectedFinding(updated);
      showToast("success", "Remediation started");
    } catch { showToast("error", "Failed to transition finding"); }
  };

  const submitResponse = async (f: Finding) => {
    if (!selected) return;
    const response = prompt("Management response:");
    if (!response) return;
    try {
      const updated = await submitFindingResponse(selected.id, f.id, response);
      setFindings(prev => prev.map(x => x.id === f.id ? updated : x));
      setSelectedFinding(updated);
      showToast("success", "Management response submitted");
    } catch { showToast("error", "Failed to submit response"); }
  };

  const boardAcknowledge = async (r: Review) => {
    try {
      const updated = await boardAcknowledgeApi(r.id);
      setReviews(prev => prev.map(x => x.id === r.id ? updated : x));
      if (selected?.id === r.id) setSelected(updated);
      showToast("success", "Board acknowledgement recorded");
    } catch { showToast("error", "Failed (MLRO role required)"); }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400"><ClipboardList className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Independent Review Suite</h1>
              <p className="text-slate-500 text-sm mt-0.5">Annual reviews, finding register, remediation tracking, and board sign-off</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchReviews} className="btn-secondary text-sm py-2 px-4"><RefreshCw className="w-4 h-4" /></button>
            <Link href="/governance/calendar?type=independent_review" className="btn-secondary text-sm py-2 px-4">View in Calendar</Link>
            <Link href="/governance/board-reports" className="btn-secondary text-sm py-2 px-4">Board Reports</Link>
          </div>
        </div>
      </div>

      {demo && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample review data
          </div>
        </div>
      )}

      {orgDash && (
        <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-4">
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Open Findings", value: orgDash.open_findings, icon: ShieldAlert, color: "text-red-400" },
              { label: "Critical/High Open", value: (orgDash.open_findings_by_risk?.critical ?? 0) + (orgDash.open_findings_by_risk?.high ?? 0), icon: AlertTriangle, color: "text-orange-400" },
              { label: "Overdue Actions", value: orgDash.overdue_actions, icon: Clock, color: "text-amber-400" },
              { label: "Pending Verification", value: orgDash.pending_verification, icon: ListChecks, color: "text-brand-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card flex items-center gap-3 py-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <div>
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Review list */}
        <div className={clsx("space-y-3", selected ? "lg:col-span-2" : "lg:col-span-5")}>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Reviews</h2>
          {reviews.map(r => (
            <div key={r.id} onClick={() => openReview(r)}
              className={clsx("card cursor-pointer hover:border-brand-500/30 transition-colors",
                selected?.id === r.id && "border-brand-500/50")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">{r.review_ref} · {r.review_type.replace(/_/g, " ")}</div>
                  <div className="font-medium text-slate-100 mt-0.5">{r.title}</div>
                  <div className="text-xs text-slate-500 mt-1">{r.reviewer_firm || r.reviewer_name || "—"}</div>
                </div>
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap", REVIEW_STATUS_COLOR[r.status])}>
                  {r.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs">
                {r.finding_count_critical > 0 && <span className="text-red-400 font-medium">{r.finding_count_critical} critical</span>}
                {r.finding_count_high > 0 && <span className="text-orange-400 font-medium">{r.finding_count_high} high</span>}
                {r.finding_count_medium > 0 && <span className="text-amber-400">{r.finding_count_medium} medium</span>}
                {r.finding_count_low > 0 && <span className="text-slate-400">{r.finding_count_low} low</span>}
                {!r.board_acknowledged && r.status === "completed" && (
                  <span className="ml-auto text-purple-300">Awaiting board sign-off</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Review detail */}
        {selected && (
          <div className="lg:col-span-3 space-y-5">
            <div className="card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs text-slate-500">{selected.review_ref}</div>
                  <h3 className="text-lg font-semibold text-slate-100">{selected.title}</h3>
                </div>
                {selected.status === "completed" && !selected.board_acknowledged && (
                  <button onClick={() => boardAcknowledge(selected)} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
                    <Gavel className="w-3.5 h-3.5" /> Board Acknowledge
                  </button>
                )}
              </div>

              {dashboard && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg p-3 bg-navy-900 border border-navy-700 text-center">
                    <div className="text-lg font-bold text-slate-100">{dashboard.findings.total}</div>
                    <div className="text-xs text-slate-500">Findings</div>
                  </div>
                  <div className="rounded-lg p-3 bg-navy-900 border border-navy-700 text-center">
                    <div className="text-lg font-bold text-amber-400">{dashboard.recommendations.open + dashboard.recommendations.in_progress}</div>
                    <div className="text-xs text-slate-500">Open Recs</div>
                  </div>
                  <div className="rounded-lg p-3 bg-navy-900 border border-navy-700 text-center">
                    <div className="text-lg font-bold text-red-400">{dashboard.actions.overdue.length}</div>
                    <div className="text-xs text-slate-500">Overdue Actions</div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Finding Register</div>
                {findings.length === 0 ? (
                  <div className="text-sm text-slate-500 py-4 text-center">No findings recorded</div>
                ) : findings.map(f => (
                  <div key={f.id} onClick={() => openFinding(f)}
                    className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer hover:border-brand-500/30 transition-colors",
                      selectedFinding?.id === f.id ? "border-brand-500/50 bg-navy-800/60" : "border-navy-700 bg-navy-900")}>
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap", RISK_COLOR[f.risk_rating])}>
                      {f.risk_rating}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">Finding #{String(f.finding_number).padStart(3, "0")} — {f.title}</div>
                    </div>
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap", FINDING_STATUS_COLOR[f.status])}>
                      {f.status.replace(/_/g, " ")}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {selectedFinding && (
              <div className="card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-xs text-slate-500">{selectedFinding.finding_ref} · {selectedFinding.category.replace(/_/g, " ")}</div>
                    <h4 className="font-semibold text-slate-100">{selectedFinding.title}</h4>
                  </div>
                  <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap", RISK_COLOR[selectedFinding.risk_rating])}>
                    Risk: {selectedFinding.risk_rating}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-3">{selectedFinding.description}</p>

                {selectedFinding.affected_areas && selectedFinding.affected_areas.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {selectedFinding.affected_areas.map(a => (
                      <Link key={a} href={a === "Training" ? "/governance/training" : a.toLowerCase().includes("control") ? "/governance/controls" : a.toLowerCase().includes("cdd") || a === "Onboarding" ? "/onboarding" : a.toLowerCase().includes("transaction") ? "/monitoring" : a.toLowerCase().includes("case") ? "/mlro" : "/governance/policies"}
                        className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-300 hover:bg-white/10 transition-colors">
                        {a}
                      </Link>
                    ))}
                  </div>
                )}

                {selectedFinding.policy_reference && (
                  <div className="text-xs text-slate-500 mb-3">Linked policy: <Link href="/governance/policies" className="text-brand-400 hover:underline">{selectedFinding.policy_reference}</Link></div>
                )}

                {selectedFinding.management_response && (
                  <div className="rounded-lg p-3 bg-navy-900 border border-navy-700 text-sm text-slate-300 mb-3">
                    <span className="text-xs text-slate-500 block mb-1">Management Response</span>
                    {selectedFinding.management_response}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap mb-4">
                  {selectedFinding.status === "open" && (
                    <button onClick={() => submitResponse(selectedFinding)} className="btn-secondary text-xs py-1.5 px-3">Submit Management Response</button>
                  )}
                  {selectedFinding.status === "response_submitted" && (
                    <button onClick={() => startRemediation(selectedFinding)} className="btn-secondary text-xs py-1.5 px-3">Start Remediation</button>
                  )}
                  {(selectedFinding.status === "in_remediation" || selectedFinding.status === "response_submitted") && (
                    <button onClick={() => closeFinding(selectedFinding)} className="btn-primary text-xs py-1.5 px-3">
                      <CheckCircle className="w-3.5 h-3.5" /> Close Finding
                    </button>
                  )}
                  {selectedFinding.status === "closed" && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Closed {selectedFinding.closed_at?.slice(0, 10)}</span>
                  )}
                </div>

                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Recommendations & Remediation Actions</div>
                {recommendations.length === 0 ? (
                  <div className="text-sm text-slate-500 py-2">No recommendations recorded</div>
                ) : recommendations.map(rec => (
                  <div key={rec.id} className="rounded-lg border border-navy-700 bg-navy-900 p-3 mb-2">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-sm text-slate-200">{rec.recommendation_ref} — {rec.description}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-300 capitalize whitespace-nowrap">{rec.status}</span>
                    </div>
                    {(actionsByRec[rec.id] || []).map(a => (
                      <div key={a.id} className="flex items-center gap-3 text-xs text-slate-400 pl-3 py-1 border-l border-navy-700">
                        <span className="flex-1">{a.title}</span>
                        {a.assigned_to && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.assigned_to}</span>}
                        {a.due_date && <span className={a.is_overdue ? "text-red-400" : ""}>{a.due_date}</span>}
                        <span className="capitalize">{a.status.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 pb-8">
        <p className="text-xs text-slate-600 italic">
          This module provides workflow tooling only. All compliance decisions remain with the reporting entity.
        </p>
      </div>
    </div>
  );
}
