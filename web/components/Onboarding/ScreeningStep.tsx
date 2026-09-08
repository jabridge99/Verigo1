"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Session {
  session_id: string;
  applicant_name: string;
  applicant_email: string;
  status: string;
  customer_id?: string;
}

interface CategoryBreakdown {
  score: number;
  status: string;
  label: string;
}

interface IdentityScore {
  customer_id: string;
  composite_score: number;
  decision: "pass" | "ecdd_required" | "fail";
  breakdown: Record<string, CategoryBreakdown>;
  weight_per_category: number;
}

const DECISION_STYLE: Record<string, { color: string; bar: string; Icon: any; label: string }> = {
  pass:          { color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30", bar: "bg-emerald-500", Icon: ShieldCheck, label: "Pass" },
  ecdd_required: { color: "text-amber-300 bg-amber-500/15 border-amber-500/30",       bar: "bg-amber-500",   Icon: AlertTriangle, label: "ECDD required" },
  fail:          { color: "text-red-300 bg-red-500/15 border-red-500/30",             bar: "bg-red-500",     Icon: XCircle, label: "Fail" },
};

const CATEGORY_ORDER = ["ocr", "manual", "pep", "sanctions", "adverse_media", "company"];

export default function ScreeningStep({ sessions }: { sessions: Session[] }) {
  const [selected, setSelected] = useState<Session | null>(null);
  const [score, setScore] = useState<IdentityScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [customerStatus, setCustomerStatus] = useState<string | null>(null);

  const screenable = sessions.filter(s => !!s.customer_id);

  const loadScore = useCallback(() => {
    if (!selected?.customer_id) { setScore(null); return; }
    setLoading(true);
    setError(null);
    fetch(`${API}/api/v1/screening/customers/${selected.customer_id}/identity-score`, { credentials: "include" })
      .then(res => { if (!res.ok) throw new Error("Failed to load identity score"); return res.json(); })
      .then(setScore)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => {
    setCustomerStatus(null);
    loadScore();
  }, [loadScore]);

  const applyDecision = useCallback(async () => {
    if (!selected?.customer_id) return;
    setDeciding(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/v1/screening/customers/${selected.customer_id}/identity-score/decide`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setScore(data);
      setCustomerStatus(data.customer_status);
    } catch (e: any) {
      setError(e.message || "Failed to apply decision");
    } finally {
      setDeciding(false);
    }
  }, [selected]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Select customer</p>
        <div className="space-y-1 max-h-[28rem] overflow-y-auto pr-1">
          {screenable.length === 0 && (
            <p className="text-sm text-slate-500 py-4">No applicants have a customer record yet — complete the applicant step first.</p>
          )}
          {screenable.map(s => (
            <button
              key={s.session_id}
              onClick={() => setSelected(s)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selected?.session_id === s.session_id ? "bg-brand-600/15 text-brand-400 border border-brand-500/40" : "text-slate-300 hover:bg-navy-800 border border-transparent"
              }`}
            >
              <div className="font-medium">{s.applicant_name}</div>
              <div className="text-xs text-slate-500">{s.applicant_email}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        {!selected ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm border border-dashed border-navy-700 rounded-xl">
            Select a customer to view their identity verification score
          </div>
        ) : loading ? (
          <div className="h-64 flex items-center justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-400 p-4 border border-red-500/20 rounded-xl bg-red-500/10">{error}</div>
        ) : score ? (
          <div className="space-y-5">
            <div className={clsx("flex items-center justify-between rounded-xl border p-5", DECISION_STYLE[score.decision].color)}>
              <div className="flex items-center gap-3">
                {(() => { const Icon = DECISION_STYLE[score.decision].Icon; return <Icon className="w-8 h-8" />; })()}
                <div>
                  <div className="text-lg font-bold">{DECISION_STYLE[score.decision].label}</div>
                  <div className="text-xs opacity-80">100-point identity check composite</div>
                </div>
              </div>
              <div className="text-3xl font-bold">{score.composite_score.toFixed(0)}%</div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-navy-700 bg-navy-800/50 p-4">
              <div className="text-sm text-slate-400">
                {customerStatus ? (
                  <>Customer status: <span className="text-slate-200 font-medium">{customerStatus}</span></>
                ) : (
                  "Apply this decision to update the customer's KYC status."
                )}
              </div>
              <button
                onClick={applyDecision}
                disabled={deciding}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white transition-colors"
              >
                {deciding ? "Applying…" : "Apply decision"}
              </button>
            </div>

            <div className="space-y-3">
              {CATEGORY_ORDER.map(key => {
                const cat = score.breakdown[key];
                if (!cat) return null;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{cat.label}</span>
                      <span className="text-slate-400 text-xs capitalize">{cat.status.replace(/_/g, " ")} · {cat.score.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-navy-700">
                      <div
                        className={clsx("h-full rounded-full", cat.score >= 80 ? "bg-emerald-500" : cat.score >= 50 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">Each category weighted evenly at {(score.weight_per_category * 100).toFixed(1)}%. Pass ≥80%, ECDD 50–79%, Fail &lt;50%. A confirmed PEP or sanctions match forces ECDD or Fail regardless of score.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
