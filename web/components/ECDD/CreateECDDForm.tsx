"use client";

import { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { listCustomers } from "@/lib/api/customers";
import { createEcddRecord, type ECDDRecord } from "@/lib/api/reports";
import { TRIGGER_OPTIONS, SCORE_COLOR } from "./shared";

interface CustomerOption {
  id: string;
  full_name?: string;
  name?: string;
  customer_ref?: string;
}

function CustomerPicker({ value, onChange }: { value: { id: string; label: string } | null; onChange: (c: { id: string; label: string } | null) => void }) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim() || query === value?.label) { setResults([]); return; }
    const handle = setTimeout(async () => {
      try {
        const d = await listCustomers({ search: query, limit: 10 });
        setResults(d);
      } catch {}
    }, 300);
    return () => clearTimeout(handle);
  }, [query, value]);

  return (
    <div className="relative">
      <input type="text" className="field-input" placeholder="Search customer by name or reference…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(null); }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-navy-800 border border-navy-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {results.map(c => {
            const label = c.full_name || c.name || c.id;
            return (
              <button key={c.id} type="button"
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-navy-700 transition-colors flex items-center justify-between gap-2"
                onClick={() => { onChange({ id: c.id, label }); setQuery(label); setOpen(false); }}>
                <span>{label}</span>
                {c.customer_ref && <span className="text-xs text-slate-500 font-mono">{c.customer_ref}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CreateECDDForm({ onCreated }: { onCreated: (r: ECDDRecord) => void }) {
  const [customer, setCustomer] = useState<{ id: string; label: string } | null>(null);
  const [form, setForm] = useState({
    trigger_reason: "",
    trigger_reason_other: "",
    pep_status: 0,
    adverse_media_found: 0,
    adverse_media_details: "",
    beneficial_owner_verified: 0,
    beneficial_owner_details: "",
    source_of_wealth_verified: 0,
    source_of_funds: "",
    source_of_wealth_notes: "",
    purpose_of_transaction: "",
    high_tax_risk: 0,
    tax_risk_notes: "",
    investment_legitimacy_notes: "",
    analyst_notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggle = (field: string) =>
    setForm(f => ({ ...f, [field]: (f as any)[field] ? 0 : 1 }));

  const computeScore = () => {
    let score = 0;
    if (form.pep_status) score += 30;
    if (form.adverse_media_found) score += 35;
    if (!form.beneficial_owner_verified) score += 20;
    if (!form.source_of_wealth_verified) score += 15;
    if (form.high_tax_risk) score += 10;
    score = Math.min(score, 100);
    const recommendation = form.adverse_media_found || score >= 80 ? "reject"
      : form.pep_status || score >= 50 ? "monitor" : "approve";
    return { score, recommendation };
  };

  const { score, recommendation } = computeScore();

  const buildRecord = (): ECDDRecord => ({
    id: String(Date.now()), ecdd_id: `ECDD-${Math.random().toString(36).slice(2, 12).toUpperCase()}`,
    customer_id: customer?.id ?? "", trigger_reason: form.trigger_reason, trigger_reason_other: form.trigger_reason_other,
    pep_status: form.pep_status, adverse_media_found: form.adverse_media_found,
    beneficial_owner_verified: form.beneficial_owner_verified,
    source_of_wealth_verified: form.source_of_wealth_verified,
    source_of_funds: form.source_of_funds, source_of_wealth_notes: form.source_of_wealth_notes,
    purpose_of_transaction: form.purpose_of_transaction,
    high_tax_risk: form.high_tax_risk, tax_risk_notes: form.tax_risk_notes,
    investment_legitimacy_notes: form.investment_legitimacy_notes,
    enhanced_risk_score: score, recommendation, analyst_notes: form.analyst_notes,
    status: "pending", created_at: new Date().toISOString(),
  });

  const isValid = !!customer && form.trigger_reason.length > 0
    && (form.trigger_reason !== "other" || form.trigger_reason_other.trim().length > 0);

  const handleSubmit = async () => {
    if (!isValid) { setError("Select a customer, trigger reason, and (if Other) describe it."); return; }
    setError("");
    setSubmitting(true);
    try {
      onCreated(await createEcddRecord({ customer_id: customer!.id, ...form }));
    } catch {
      onCreated(buildRecord());
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">New ECDD Assessment</h2>
      <p className="text-slate-500 text-sm mb-6">Single-page enhanced due diligence assessment — fill in what applies, then submit.</p>

      <div className="card space-y-5">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Customer *</label>
          <CustomerPicker value={customer} onChange={setCustomer} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Trigger reason *</label>
          <select className="field-input" value={form.trigger_reason}
            onChange={e => setForm(f => ({ ...f, trigger_reason: e.target.value }))}>
            <option value="">Select a trigger reason…</option>
            <optgroup label="Common (AUSTRAC / FATF)">
              {TRIGGER_OPTIONS.filter(o => o.primary).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
            <optgroup label="Other indicators">
              {TRIGGER_OPTIONS.filter(o => !o.primary).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          </select>
          {form.trigger_reason === "other" && (
            <textarea className="field-input min-h-[80px] resize-none mt-2" placeholder="Describe the trigger reason…"
              value={form.trigger_reason_other} onChange={e => setForm(f => ({ ...f, trigger_reason_other: e.target.value }))} />
          )}
        </div>

        <div className="border-t border-navy-700 pt-4 space-y-3">
          <p className="text-sm text-slate-400">PEP & adverse media</p>
          {[
            { field: "pep_status", label: "PEP identified", desc: "Customer is a politically exposed person", points: 30 },
            { field: "adverse_media_found", label: "Adverse media found", desc: "Negative news or adverse media coverage identified", points: 35 },
          ].map(({ field, label, desc, points }) => (
            <div key={field} className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              (form as any)[field] ? "bg-red-500/10 border-red-500/30" : "bg-navy-900 border-navy-700 hover:border-navy-600"
            }`} onClick={() => toggle(field)}>
              <div>
                <div className="text-sm font-medium text-slate-200">{label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">+{points} pts</span>
                <div className={`w-10 h-5 rounded-full transition-colors relative ${(form as any)[field] ? "bg-red-500" : "bg-navy-600"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${(form as any)[field] ? "left-5" : "left-0.5"}`} />
                </div>
              </div>
            </div>
          ))}
          <textarea className="field-input min-h-[70px] resize-none" placeholder="Adverse media / PEP details (sources, dates)…"
            value={form.adverse_media_details} onChange={e => setForm(f => ({ ...f, adverse_media_details: e.target.value }))} />
        </div>

        <div className="border-t border-navy-700 pt-4 space-y-3">
          <p className="text-sm text-slate-400">Beneficial ownership</p>
          <div className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
            form.beneficial_owner_verified ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/5 border-red-500/20 hover:border-red-500/30"
          }`} onClick={() => toggle("beneficial_owner_verified")}>
            <div>
              <div className="text-sm font-medium text-slate-200">Beneficial owner verified</div>
              <div className="text-xs text-slate-500 mt-0.5">UBO chain identified and documented</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">−20 risk pts if verified</span>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${form.beneficial_owner_verified ? "bg-emerald-500" : "bg-navy-600"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.beneficial_owner_verified ? "left-5" : "left-0.5"}`} />
              </div>
            </div>
          </div>
          <textarea className="field-input min-h-[70px] resize-none" placeholder="UBO names, ownership percentages, verification evidence…"
            value={form.beneficial_owner_details} onChange={e => setForm(f => ({ ...f, beneficial_owner_details: e.target.value }))} />
        </div>

        <div className="border-t border-navy-700 pt-4 space-y-3">
          <p className="text-sm text-slate-400">Source of funds & wealth</p>
          <textarea className="field-input min-h-[60px] resize-none" placeholder="Source of funds — e.g. salary, business revenue, sale of asset…"
            value={form.source_of_funds} onChange={e => setForm(f => ({ ...f, source_of_funds: e.target.value }))} />
          <div className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
            form.source_of_wealth_verified ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/5 border-red-500/20 hover:border-red-500/30"
          }`} onClick={() => toggle("source_of_wealth_verified")}>
            <div>
              <div className="text-sm font-medium text-slate-200">Source of wealth verified</div>
              <div className="text-xs text-slate-500 mt-0.5">Customer's overall wealth origin confirmed with evidence</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">−15 risk pts if verified</span>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${form.source_of_wealth_verified ? "bg-emerald-500" : "bg-navy-600"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.source_of_wealth_verified ? "left-5" : "left-0.5"}`} />
              </div>
            </div>
          </div>
          <textarea className="field-input min-h-[60px] resize-none" placeholder="Source of wealth evidence — bank statements, tax returns, business financials…"
            value={form.source_of_wealth_notes} onChange={e => setForm(f => ({ ...f, source_of_wealth_notes: e.target.value }))} />
        </div>

        <div className="border-t border-navy-700 pt-4 space-y-3">
          <p className="text-sm text-slate-400">Purpose & tax risk</p>
          <textarea className="field-input min-h-[70px] resize-none" placeholder="Purpose of transaction / relationship — e.g. property purchase, business investment…"
            value={form.purpose_of_transaction} onChange={e => setForm(f => ({ ...f, purpose_of_transaction: e.target.value }))} />
          <div className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
            form.high_tax_risk ? "bg-red-500/10 border-red-500/30" : "bg-navy-900 border-navy-700 hover:border-navy-600"
          }`} onClick={() => toggle("high_tax_risk")}>
            <div>
              <div className="text-sm font-medium text-slate-200">High tax-risk indicators present</div>
              <div className="text-xs text-slate-500 mt-0.5">Tax haven jurisdiction, complex structuring, or evasion red flags</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">+10 pts</span>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${form.high_tax_risk ? "bg-red-500" : "bg-navy-600"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.high_tax_risk ? "left-5" : "left-0.5"}`} />
              </div>
            </div>
          </div>
          <textarea className="field-input min-h-[60px] resize-none" placeholder="Tax risk indicator details…"
            value={form.tax_risk_notes} onChange={e => setForm(f => ({ ...f, tax_risk_notes: e.target.value }))} />
        </div>

        <div className="border-t border-navy-700 pt-4 space-y-3">
          <p className="text-sm text-slate-400">Investment legitimacy & notes</p>
          <textarea className="field-input min-h-[90px] resize-none" placeholder="Assessment of whether the investment activity is consistent with the customer's profile, declared occupation, and economic rationale…"
            value={form.investment_legitimacy_notes} onChange={e => setForm(f => ({ ...f, investment_legitimacy_notes: e.target.value }))} />
          <textarea className="field-input min-h-[60px] resize-none" placeholder="Analyst notes — internal notes for the compliance file…"
            value={form.analyst_notes} onChange={e => setForm(f => ({ ...f, analyst_notes: e.target.value }))} />
        </div>

        <div className={`rounded-lg border p-4 text-center ${
          recommendation === "reject" ? "bg-red-500/10 border-red-500/30" :
          recommendation === "monitor" ? "bg-amber-500/10 border-amber-500/30" :
          "bg-emerald-500/10 border-emerald-500/30"
        }`}>
          <div className={`text-3xl font-bold ${SCORE_COLOR(score)}`}>{score}/100</div>
          <div className="text-sm font-medium mt-1 capitalize" style={{ color: recommendation === "reject" ? "#f87171" : recommendation === "monitor" ? "#fbbf24" : "#34d399" }}>
            Indicative recommendation: {recommendation}
          </div>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <button type="button" disabled={submitting} onClick={handleSubmit} className="btn-primary w-full justify-center">
          {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><ShieldCheck className="w-4 h-4" />Create ECDD Assessment</>}
        </button>
      </div>
    </div>
  );
}
