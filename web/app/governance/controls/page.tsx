"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, Plus, Search, RefreshCw, CheckCircle, AlertTriangle,
  ClipboardCheck, Wrench, User,
} from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type RiskArea =
  | "cdd" | "edd" | "pep_screening" | "sanctions_screening" | "transaction_monitoring"
  | "ifti_reporting" | "smr_reporting" | "ttr_reporting" | "travel_rule"
  | "record_keeping" | "training" | "governance" | "beneficial_ownership"
  | "outsourcing" | "custom";

type ControlStatus = "active" | "inactive" | "under_review" | "remediation" | "suspended";
type Effectiveness = "effective" | "largely_effective" | "partially_effective" | "ineffective" | "not_tested";
type Frequency = "continuous" | "daily" | "weekly" | "monthly" | "quarterly" | "semi_annual" | "annual" | "ad_hoc" | "per_transaction";

interface Control {
  id: string;
  control_ref: string;
  name: string;
  description?: string | null;
  control_type: string;
  risk_area: RiskArea;
  control_owner: string;
  business_unit?: string | null;
  frequency: Frequency;
  is_key_control: boolean;
  status: ControlStatus;
  effectiveness: Effectiveness;
  last_tested_date?: string | null;
  next_test_date?: string | null;
}

const RISK_AREA_LABELS: Record<RiskArea, string> = {
  cdd: "CDD", edd: "EDD", pep_screening: "PEP Screening", sanctions_screening: "Sanctions Screening",
  transaction_monitoring: "Transaction Monitoring", ifti_reporting: "IFTI Reporting", smr_reporting: "SMR Reporting",
  ttr_reporting: "TTR Reporting", travel_rule: "Travel Rule", record_keeping: "Record Keeping",
  training: "Training", governance: "Governance", beneficial_ownership: "Beneficial Ownership",
  outsourcing: "Outsourcing", custom: "Custom",
};

const STATUS_COLOR: Record<ControlStatus, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  inactive: "bg-slate-600/20 text-slate-500",
  under_review: "bg-brand-500/20 text-brand-300",
  remediation: "bg-amber-500/20 text-amber-300",
  suspended: "bg-red-500/20 text-red-300",
};

const EFFECTIVENESS_COLOR: Record<Effectiveness, string> = {
  effective: "text-emerald-400",
  largely_effective: "text-emerald-400",
  partially_effective: "text-amber-400",
  ineffective: "text-red-400",
  not_tested: "text-slate-500",
};

const DEMO_CONTROLS: Control[] = [
  { id: "ctl_1", control_ref: "CTL-TM-001", name: "Daily Alert Triage Review", control_type: "detective", risk_area: "transaction_monitoring", control_owner: "MLRO Office", frequency: "daily", is_key_control: true, status: "active", effectiveness: "effective", last_tested_date: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), next_test_date: new Date(Date.now() + 70 * 86400000).toISOString().slice(0, 10) },
  { id: "ctl_2", control_ref: "CTL-CDD-001", name: "Customer Identity Verification Dual Control", control_type: "preventive", risk_area: "cdd", control_owner: "Onboarding Team", frequency: "continuous", is_key_control: true, status: "active", effectiveness: "largely_effective", last_tested_date: new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10), next_test_date: new Date(Date.now() + 50 * 86400000).toISOString().slice(0, 10) },
  { id: "ctl_3", control_ref: "CTL-PEP-001", name: "PEP Screening Match Review", control_type: "detective", risk_area: "pep_screening", control_owner: "Compliance Analyst", frequency: "continuous", is_key_control: true, status: "remediation", effectiveness: "partially_effective", last_tested_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), next_test_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) },
  { id: "ctl_4", control_ref: "CTL-SMR-001", name: "SMR Filing Timeliness Control", control_type: "preventive", risk_area: "smr_reporting", control_owner: "MLRO", frequency: "monthly", is_key_control: true, status: "active", effectiveness: "effective", last_tested_date: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), next_test_date: new Date(Date.now() + 75 * 86400000).toISOString().slice(0, 10) },
  { id: "ctl_5", control_ref: "CTL-TRN-001", name: "Annual Training Completion Tracking", control_type: "preventive", risk_area: "training", control_owner: "HR / Compliance", frequency: "quarterly", is_key_control: false, status: "under_review", effectiveness: "not_tested", next_test_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) },
];

type Tab = "list" | "create";

export default function ControlsPage() {
  const [tab, setTab] = useState<Tab>("list");
  const [controls, setControls] = useState<Control[]>(DEMO_CONTROLS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskAreaFilter, setRiskAreaFilter] = useState("all");
  const [selected, setSelected] = useState<Control | null>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchControls = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/governance/controls`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); if (d.length) setControls(d); }
    } catch {}
  }, []);

  useEffect(() => { fetchControls(); }, [fetchControls]);

  const openControl = async (c: Control) => {
    setSelected(c);
    try {
      const res = await fetch(`${API}/api/v1/governance/controls/${c.id}/tests`, { credentials: "include" });
      setTests(res.ok ? await res.json() : []);
    } catch { setTests([]); }
  };

  const recordTest = async (control: Control, result: "pass" | "fail") => {
    const payload = {
      test_date: new Date().toISOString().slice(0, 10),
      sample_size: 10,
      passed_samples: result === "pass" ? 10 : 4,
      failed_samples: result === "pass" ? 0 : 6,
      result: result === "pass" ? "pass" : "fail",
    };
    try {
      const res = await fetch(`${API}/api/v1/governance/controls/${control.id}/tests`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const test = await res.json();
        setTests(prev => [test, ...prev]);
        const newEff: Effectiveness = result === "pass" ? "effective" : "ineffective";
        setControls(prev => prev.map(c => c.id === control.id ? { ...c, effectiveness: newEff, last_tested_date: payload.test_date } : c));
        setSelected(prev => prev ? { ...prev, effectiveness: newEff, last_tested_date: payload.test_date } : prev);
        showToast("success", `Test recorded — ${result === "pass" ? "passed" : "failed"}`);
        return;
      }
    } catch {}
    const newEff: Effectiveness = result === "pass" ? "effective" : "ineffective";
    setTests(prev => [{ id: `t_${Date.now()}`, ...payload, calculated_effectiveness: newEff, created_at: new Date().toISOString() }, ...prev]);
    setControls(prev => prev.map(c => c.id === control.id ? { ...c, effectiveness: newEff, last_tested_date: payload.test_date } : c));
    setSelected(prev => prev ? { ...prev, effectiveness: newEff, last_tested_date: payload.test_date } : prev);
    showToast("success", `Test recorded — ${result === "pass" ? "passed" : "failed"}`);
  };

  const filtered = controls.filter(c => {
    const q = search.toLowerCase();
    return (!search || c.name.toLowerCase().includes(q) || c.control_ref.toLowerCase().includes(q))
      && (statusFilter === "all" || c.status === statusFilter)
      && (riskAreaFilter === "all" || c.risk_area === riskAreaFilter);
  });

  const stats = {
    total: controls.length,
    keyControls: controls.filter(c => c.is_key_control).length,
    ineffective: controls.filter(c => c.effectiveness === "ineffective" || c.effectiveness === "partially_effective").length,
    overdueTest: controls.filter(c => c.next_test_date && new Date(c.next_test_date) < new Date()).length,
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Governance Controls</h1>
            <p className="text-slate-500 text-sm mt-0.5">Control register — testing, effectiveness, owners, remediation</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchControls} className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setTab("create")} className="btn-primary text-sm py-2 px-4">
              <Plus className="w-4 h-4" /> New Control
            </button>
          </div>
        </div>
      </div>

      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          {[
            { label: "Total Controls", count: stats.total, color: "text-slate-200" },
            { label: "Key Controls", count: stats.keyControls, color: "text-brand-400" },
            { label: "Below Effective", count: stats.ineffective, color: "text-amber-400" },
            { label: "Test Overdue", count: stats.overdueTest, color: "text-red-400" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-slate-500 text-xs">{label}</span>
              <span className={`font-bold text-sm ${color}`}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-navy-800 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { id: "list" as Tab, label: "Register", Icon: ShieldCheck },
            { id: "create" as Tab, label: "New Control", Icon: Plus },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                tab === id ? "border-brand-400 text-brand-400" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === "list" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                  placeholder="Search controls…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select value={riskAreaFilter} onChange={e => setRiskAreaFilter(e.target.value)}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                <option value="all">Risk Area — All</option>
                {Object.entries(RISK_AREA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
                <option value="all">Status — All</option>
                {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-navy-700">
              <table className="w-full text-sm">
                <thead className="bg-navy-800 border-b border-navy-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Ref</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Control</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Risk Area</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Owner</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Frequency</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Effectiveness</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-500">No controls found</td></tr>
                  ) : filtered.map(c => (
                    <tr key={c.id} className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors" onClick={() => openControl(c)}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.control_ref}</td>
                      <td className="px-4 py-3 text-slate-200">
                        {c.name}
                        {c.is_key_control && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/30">KEY</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{RISK_AREA_LABELS[c.risk_area]}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{c.control_owner}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 capitalize">{c.frequency.replace("_", " ")}</td>
                      <td className="px-4 py-3">
                        <span className={clsx("font-medium text-xs capitalize", EFFECTIVENESS_COLOR[c.effectiveness])}>
                          {c.effectiveness.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[c.status])}>
                          {c.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-slate-500 text-right">{filtered.length} of {controls.length} controls</div>
          </div>
        )}

        {tab === "create" && (
          <CreateControlForm onCreated={(c) => {
            setControls(prev => [c, ...prev]);
            showToast("success", `${c.control_ref} created`);
            setTab("list");
          }} />
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-xs text-slate-500 mb-1">{selected.control_ref}</div>
                <h2 className="text-lg font-semibold text-slate-100">{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 text-lg leading-none">&times;</button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[selected.status])}>
                {selected.status.replace("_", " ")}
              </span>
              <span className={clsx("text-xs font-medium capitalize", EFFECTIVENESS_COLOR[selected.effectiveness])}>
                {selected.effectiveness.replace(/_/g, " ")}
              </span>
              {selected.is_key_control && <span className="px-1.5 py-0.5 rounded text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/30">KEY CONTROL</span>}
            </div>

            {selected.description && (
              <div className="text-sm text-slate-300 leading-relaxed">{selected.description}</div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg p-3 bg-navy-900 border border-navy-700">
                <div className="text-slate-500 mb-0.5 flex items-center gap-1"><User className="w-3 h-3" />Owner</div>
                <div className="text-slate-200">{selected.control_owner}</div>
              </div>
              <div className="rounded-lg p-3 bg-navy-900 border border-navy-700">
                <div className="text-slate-500 mb-0.5">Risk area</div>
                <div className="text-slate-200">{RISK_AREA_LABELS[selected.risk_area]}</div>
              </div>
              <div className="rounded-lg p-3 bg-navy-900 border border-navy-700">
                <div className="text-slate-500 mb-0.5">Last tested</div>
                <div className="text-slate-200">{selected.last_tested_date ? new Date(selected.last_tested_date).toLocaleDateString("en-AU") : "Never"}</div>
              </div>
              <div className="rounded-lg p-3 bg-navy-900 border border-navy-700">
                <div className="text-slate-500 mb-0.5">Next test due</div>
                <div className="text-slate-200">{selected.next_test_date ? new Date(selected.next_test_date).toLocaleDateString("en-AU") : "—"}</div>
              </div>
            </div>

            <div className="border-t border-navy-700 pt-4 space-y-2">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5" /> Record control test
              </div>
              <div className="flex gap-2">
                <button onClick={() => recordTest(selected, "pass")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors">
                  <CheckCircle className="w-3.5 h-3.5" /> Record Pass
                </button>
                <button onClick={() => recordTest(selected, "fail")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors">
                  <Wrench className="w-3.5 h-3.5" /> Record Fail
                </button>
              </div>
            </div>

            <div className="border-t border-navy-700 pt-4 space-y-2">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Test history</div>
              {tests.length === 0 ? (
                <div className="text-xs text-slate-600">No tests recorded yet</div>
              ) : tests.map(t => (
                <div key={t.id} className="flex items-center justify-between text-xs border-b border-navy-800 last:border-0 py-1.5">
                  <span className="text-slate-300">{t.test_date}</span>
                  <span className={clsx("capitalize", t.result?.includes("fail") ? "text-red-400" : "text-emerald-400")}>{t.result}</span>
                  <span className="text-slate-500">{t.sample_size} samples</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function CreateControlForm({ onCreated }: { onCreated: (c: Control) => void }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    control_type: "detective",
    risk_area: "transaction_monitoring" as RiskArea,
    control_owner: "",
    business_unit: "",
    frequency: "monthly" as Frequency,
    control_method: "manual_review",
    is_key_control: false,
    next_test_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);

  const buildControl = (): Control => ({
    id: `ctl_${Date.now()}`,
    control_ref: `CTL-${Math.floor(Math.random() * 900 + 100)}`,
    name: form.name,
    description: form.description,
    control_type: form.control_type,
    risk_area: form.risk_area,
    control_owner: form.control_owner,
    business_unit: form.business_unit,
    frequency: form.frequency,
    is_key_control: form.is_key_control,
    status: "active",
    effectiveness: "not_tested",
    next_test_date: form.next_test_date,
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/governance/controls`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated(await res.json());
    } catch {
      onCreated(buildControl());
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">New Governance Control</h2>
      <p className="text-slate-500 text-sm mb-6">Register a control with its owner, testing frequency, and risk area for the program's three-lines-of-defence model.</p>

      <div className="card space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Control name *</label>
          <input className="field-input" placeholder="e.g. Daily Alert Triage Review"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400">Description</label>
          <textarea className="field-input min-h-[70px] resize-none" placeholder="What the control does and how it operates…"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Risk area *</label>
            <select className="field-input" value={form.risk_area}
              onChange={e => setForm(f => ({ ...f, risk_area: e.target.value as RiskArea }))}>
              {Object.entries(RISK_AREA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Control type *</label>
            <select className="field-input" value={form.control_type}
              onChange={e => setForm(f => ({ ...f, control_type: e.target.value }))}>
              {["preventive", "detective", "corrective", "compensating", "automated", "manual", "hybrid"].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Control owner *</label>
            <input className="field-input" placeholder="user_id or team name"
              value={form.control_owner} onChange={e => setForm(f => ({ ...f, control_owner: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Business unit</label>
            <input className="field-input" placeholder="e.g. Compliance"
              value={form.business_unit} onChange={e => setForm(f => ({ ...f, business_unit: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Test frequency *</label>
            <select className="field-input" value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value as Frequency }))}>
              {["continuous", "daily", "weekly", "monthly", "quarterly", "semi_annual", "annual", "ad_hoc", "per_transaction"].map(f => (
                <option key={f} value={f}>{f.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400">Next test date</label>
            <input type="date" className="field-input" value={form.next_test_date}
              onChange={e => setForm(f => ({ ...f, next_test_date: e.target.value }))} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={form.is_key_control}
            onChange={e => setForm(f => ({ ...f, is_key_control: e.target.checked }))} />
          Mark as key control
        </label>
      </div>

      <div className="flex justify-end mt-5">
        <button type="button" disabled={!form.name || !form.control_owner || submitting} onClick={handleSubmit} className="btn-primary disabled:opacity-40">
          {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><ShieldCheck className="w-4 h-4" />Create Control</>}
        </button>
      </div>
    </div>
  );
}
