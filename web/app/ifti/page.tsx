"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface IFTIRecord {
  ifti_id: string;
  direction: "incoming" | "outgoing";
  status: "draft" | "ready" | "submitted";
  date_received: string;
  date_available: string;
  currency_code: string;
  total_amount: number;
  transfer_type: string;
  transaction_reference: string;
  oc_full_name: string;
  bc_full_name: string;
  reason_for_transfer: string;
  reporter_full_name: string;
  reporter_email: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-yellow-900/40 text-yellow-300",
  ready:     "bg-blue-900/40 text-blue-300",
  submitted: "bg-green-900/40 text-green-300",
};

const DIR_STYLE: Record<string, string> = {
  incoming: "bg-cyan-900/40 text-cyan-300",
  outgoing: "bg-orange-900/40 text-orange-300",
};

// ── Field sections for the create/edit form ───────────────────────────────────

const TRANSFER_TYPES = ["Money", "Property"];
const CURRENCIES = ["AUD", "USD", "EUR", "GBP", "CNY", "JPY", "HKD", "SGD", "NZD", "CAD", "INR"];
const BUSINESS_STRUCTURES = ["Association", "Company", "Government body", "Partnership", "Registered body", "Trust"];
const ID_TYPES = [
  "Alien registration number", "Bank account", "Benefits card/ID", "Birth certificate",
  "Business registration/licence", "Credit/debit card", "Customer account/ID", "Driver's licence",
  "Employee ID", "Employer number", "Identity card/number", "Membership ID", "Passport",
  "Photo ID", "Security ID", "Social security ID", "Student ID",
  "Tax number/ID (except Australian tax file numbers (TFN))", "Telephone/fax number",
  "Other (provide description)",
];

interface FormData {
  direction: "incoming" | "outgoing";
  date_received: string; date_available: string;
  currency_code: string; total_amount: string; transfer_type: string;
  property_description: string; transaction_reference: string;
  oc_full_name: string; oc_other_name: string; oc_dob: string;
  oc_address: string; oc_city: string; oc_state: string; oc_postcode: string; oc_country: string;
  oc_phone: string; oc_email: string; oc_occupation: string; oc_abn: string;
  oc_customer_number: string; oc_account_number: string; oc_business_structure: string;
  oc_id1_type: string; oc_id1_number: string; oc_id1_issuer: string;
  oc_id2_type: string; oc_id2_number: string; oc_id2_issuer: string;
  bc_full_name: string; bc_dob: string; bc_business_name: string;
  bc_address: string; bc_city: string; bc_state: string; bc_postcode: string; bc_country: string;
  bc_phone: string; bc_email: string; bc_occupation: string; bc_abn: string;
  bc_account_number: string; bc_institution_name: string; bc_institution_city: string; bc_institution_country: string;
  retail_id_number: string;
  accept_full_name: string; accept_address: string; accept_city: string;
  accept_state: string; accept_postcode: string; accept_country: string;
  accept_phone: string; accept_email: string; accept_occupation: string;
  accept_abn: string; accept_business_structure: string;
  is_accepting_money: string; is_sending_instruction: string;
  recv_full_name: string; recv_address: string; recv_city: string;
  recv_state: string; recv_postcode: string; recv_country: string;
  is_distributing: string; has_retail_outlet: string;
  reason_for_transfer: string;
  reporter_full_name: string; reporter_job_title: string; reporter_phone: string; reporter_email: string;
}

const EMPTY_FORM: FormData = {
  direction: "outgoing",
  date_received: "", date_available: "", currency_code: "AUD",
  total_amount: "", transfer_type: "Money", property_description: "",
  transaction_reference: "",
  oc_full_name: "", oc_other_name: "", oc_dob: "", oc_address: "", oc_city: "",
  oc_state: "", oc_postcode: "", oc_country: "Australia",
  oc_phone: "", oc_email: "", oc_occupation: "", oc_abn: "",
  oc_customer_number: "", oc_account_number: "", oc_business_structure: "",
  oc_id1_type: "", oc_id1_number: "", oc_id1_issuer: "",
  oc_id2_type: "", oc_id2_number: "", oc_id2_issuer: "",
  bc_full_name: "", bc_dob: "", bc_business_name: "", bc_address: "", bc_city: "",
  bc_state: "", bc_postcode: "", bc_country: "",
  bc_phone: "", bc_email: "", bc_occupation: "", bc_abn: "",
  bc_account_number: "", bc_institution_name: "", bc_institution_city: "", bc_institution_country: "",
  retail_id_number: "",
  accept_full_name: "", accept_address: "", accept_city: "", accept_state: "",
  accept_postcode: "", accept_country: "Australia",
  accept_phone: "", accept_email: "", accept_occupation: "", accept_abn: "",
  accept_business_structure: "",
  is_accepting_money: "Yes", is_sending_instruction: "Yes",
  recv_full_name: "", recv_address: "", recv_city: "", recv_state: "",
  recv_postcode: "", recv_country: "",
  is_distributing: "Yes", has_retail_outlet: "No",
  reason_for_transfer: "",
  reporter_full_name: "", reporter_job_title: "", reporter_phone: "", reporter_email: "",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, name, form, onChange, type = "text", options, half, required }: {
  label: string; name: keyof FormData; form: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  type?: string; options?: string[]; half?: boolean; required?: boolean;
}) {
  const cls = `${half ? "w-full" : "w-full"} bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500`;
  return (
    <div className={half ? "col-span-1" : "col-span-2"}>
      <label className="block text-xs text-gray-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {options ? (
        <select value={form[name] || ""} onChange={e => onChange(name, e.target.value)} className={cls}>
          <option value="">— select —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[name] || ""} onChange={e => onChange(name, e.target.value)}
          placeholder={label} className={cls} />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 border-b border-[#1e3a5f] pb-1">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

// ── Form Modal ────────────────────────────────────────────────────────────────

function FormModal({ initial, onClose, onSaved }: {
  initial?: Partial<FormData>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [step, setStep] = useState(0);

  const set = useCallback((k: keyof FormData, v: string) =>
    setForm(f => ({ ...f, [k]: v })), []);

  const save = async () => {
    if (!form.date_received || !form.total_amount || !form.oc_full_name) {
      setErr("Date received, amount and ordering customer name are required"); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, total_amount: parseFloat(form.total_amount) || 0 };
      await apiFetch("/api/v1/ifti/", { method: "POST", body: JSON.stringify(payload) });
      onSaved(); onClose();
    } catch (e: unknown) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  const STEPS = [
    "Transaction", "Ordering Customer", "Beneficiary Customer",
    "Accepting / Distributing", "Reason & Reporter"
  ];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e3a5f]">
          <div>
            <h2 className="text-lg font-bold">New IFTI Report</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              AUSTRAC International Funds Transfer Instruction — Designated Remittance Arrangement
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2">✕</button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-[#1e3a5f] px-5 pt-3 gap-1">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`px-3 py-2 rounded-t text-xs font-medium transition-colors ${
                step === i ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}>
              {i + 1}. {s}
            </button>
          ))}
        </div>

        <div className="p-5">
          {err && <p className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-700 rounded p-2">{err}</p>}

          {/* Step 0: Transaction details */}
          {step === 0 && (
            <>
              <Section title="Transaction Direction">
                <div className="col-span-2 flex gap-3">
                  {(["outgoing", "incoming"] as const).map(d => (
                    <button key={d} onClick={() => set("direction", d)}
                      className={`flex-1 py-3 rounded-lg border text-sm font-semibold transition-colors ${
                        form.direction === d
                          ? d === "outgoing" ? "bg-orange-600 border-orange-500 text-white" : "bg-cyan-700 border-cyan-500 text-white"
                          : "bg-[#152440] border-[#1e3a5f] text-gray-400 hover:border-gray-400"
                      }`}>
                      {d === "outgoing" ? "▲ IFTI-OUT — Money leaving Australia" : "▼ IFTI-IN — Money arriving in Australia"}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="Transaction Details">
                <Field label="Date Received (DD/MM/YYYY)" name="date_received" form={form} onChange={set} required half />
                <Field label="Date Available (DD/MM/YYYY)" name="date_available" form={form} onChange={set} required half />
                <Field label="Currency Code" name="currency_code" form={form} onChange={set} options={CURRENCIES} half />
                <Field label="Total Amount/Value" name="total_amount" form={form} onChange={set} type="number" half required />
                <Field label="Type of Transfer" name="transfer_type" form={form} onChange={set} options={TRANSFER_TYPES} half />
                <Field label="Transaction Reference Number" name="transaction_reference" form={form} onChange={set} half />
                <Field label="Description of Property (if not money)" name="property_description" form={form} onChange={set} />
              </Section>
            </>
          )}

          {/* Step 1: Ordering customer */}
          {step === 1 && (
            <>
              <Section title="Ordering Customer Identity">
                <Field label="Full Name" name="oc_full_name" form={form} onChange={set} required half />
                <Field label="If known by any other name" name="oc_other_name" form={form} onChange={set} half />
                <Field label="Date of Birth (DD/MM/YYYY)" name="oc_dob" form={form} onChange={set} half />
                <Field label="Business Structure (if not individual)" name="oc_business_structure" form={form} onChange={set} options={BUSINESS_STRUCTURES} half />
              </Section>
              <Section title="Ordering Customer Address">
                <Field label="Street Address" name="oc_address" form={form} onChange={set} />
                <Field label="City/Town/Suburb" name="oc_city" form={form} onChange={set} half />
                <Field label="State" name="oc_state" form={form} onChange={set} half />
                <Field label="Postcode" name="oc_postcode" form={form} onChange={set} half />
                <Field label="Country" name="oc_country" form={form} onChange={set} half />
              </Section>
              <Section title="Ordering Customer Contact">
                <Field label="Phone" name="oc_phone" form={form} onChange={set} half />
                <Field label="Email" name="oc_email" form={form} onChange={set} half />
                <Field label="Occupation / Business Activity" name="oc_occupation" form={form} onChange={set} />
                <Field label="ABN / ACN / ARBN" name="oc_abn" form={form} onChange={set} half />
                <Field label="Customer Number (remitter)" name="oc_customer_number" form={form} onChange={set} half />
                <Field label="Account Number (held by remitter)" name="oc_account_number" form={form} onChange={set} half />
              </Section>
              {form.direction === "outgoing" && (
                <Section title="Ordering Customer ID Documents (IFTI-OUT required)">
                  <Field label="ID Type (1)" name="oc_id1_type" form={form} onChange={set} options={ID_TYPES} half />
                  <Field label="ID Number" name="oc_id1_number" form={form} onChange={set} half />
                  <Field label="Issuer" name="oc_id1_issuer" form={form} onChange={set} half />
                  <Field label="ID Type (2)" name="oc_id2_type" form={form} onChange={set} options={ID_TYPES} half />
                  <Field label="ID Number (2)" name="oc_id2_number" form={form} onChange={set} half />
                  <Field label="Issuer (2)" name="oc_id2_issuer" form={form} onChange={set} half />
                </Section>
              )}
            </>
          )}

          {/* Step 2: Beneficiary customer */}
          {step === 2 && (
            <>
              <Section title="Beneficiary Customer Identity">
                <Field label="Full Name" name="bc_full_name" form={form} onChange={set} half />
                <Field label="Date of Birth (DD/MM/YYYY)" name="bc_dob" form={form} onChange={set} half />
                <Field label="Trading/Business Name (if applicable)" name="bc_business_name" form={form} onChange={set} />
                <Field label="Business Structure (if not individual)" name="bc_business_structure" form={form} onChange={set} options={BUSINESS_STRUCTURES} half />
                <Field label="ABN / ACN / ARBN" name="bc_abn" form={form} onChange={set} half />
              </Section>
              <Section title="Beneficiary Customer Address">
                <Field label="Street Address" name="bc_address" form={form} onChange={set} />
                <Field label="City/Town/Suburb" name="bc_city" form={form} onChange={set} half />
                <Field label="State" name="bc_state" form={form} onChange={set} half />
                <Field label="Postcode" name="bc_postcode" form={form} onChange={set} half />
                <Field label="Country" name="bc_country" form={form} onChange={set} half />
                <Field label="Occupation / Business Activity" name="bc_occupation" form={form} onChange={set} />
              </Section>
              <Section title="Beneficiary Account Details">
                <Field label="Account Number" name="bc_account_number" form={form} onChange={set} half />
                <Field label="Name of Institution" name="bc_institution_name" form={form} onChange={set} half />
                <Field label="Institution City" name="bc_institution_city" form={form} onChange={set} half />
                <Field label="Institution Country" name="bc_institution_country" form={form} onChange={set} half />
              </Section>
            </>
          )}

          {/* Step 3: Accepting / distributing entities */}
          {step === 3 && (
            <>
              <Section title="Person/Organisation Accepting Transfer Instruction">
                <div className="col-span-2 text-xs text-gray-400 -mt-1 mb-1">
                  This is typically your business (the reporting entity).
                </div>
                <Field label="Retail Outlet / Location ID" name="retail_id_number" form={form} onChange={set} half />
                <Field label="Full Name / Business Name" name="accept_full_name" form={form} onChange={set} half />
                <Field label="Street Address" name="accept_address" form={form} onChange={set} />
                <Field label="City/Town/Suburb" name="accept_city" form={form} onChange={set} half />
                <Field label="State" name="accept_state" form={form} onChange={set} half />
                <Field label="Postcode" name="accept_postcode" form={form} onChange={set} half />
                <Field label="Country" name="accept_country" form={form} onChange={set} half />
                {form.direction === "incoming" && (
                  <>
                    <Field label="Phone" name="accept_phone" form={form} onChange={set} half />
                    <Field label="Email" name="accept_email" form={form} onChange={set} half />
                    <Field label="Occupation / Activity" name="accept_occupation" form={form} onChange={set} half />
                    <Field label="ABN / ACN" name="accept_abn" form={form} onChange={set} half />
                    <Field label="Business Structure" name="accept_business_structure" form={form} onChange={set} options={BUSINESS_STRUCTURES} half />
                  </>
                )}
                <Field label="Accepting money or property?" name="is_accepting_money" form={form} onChange={set} options={["Yes", "No"]} half />
                <Field label="Sending transfer instruction?" name="is_sending_instruction" form={form} onChange={set} options={["Yes", "No"]} half />
              </Section>
              <Section title="Person/Organisation Receiving Transfer Instruction">
                <div className="col-span-2 text-xs text-gray-400 -mt-1 mb-1">
                  The overseas counterpart receiving your transfer instruction.
                </div>
                <Field label="Full Name / Business Name" name="recv_full_name" form={form} onChange={set} half />
                <Field label="Street Address" name="recv_address" form={form} onChange={set} half />
                <Field label="City/Town/Suburb" name="recv_city" form={form} onChange={set} half />
                <Field label="State" name="recv_state" form={form} onChange={set} half />
                <Field label="Postcode" name="recv_postcode" form={form} onChange={set} half />
                <Field label="Country" name="recv_country" form={form} onChange={set} half />
                <Field label="Is this org distributing money or property?" name="is_distributing" form={form} onChange={set} options={["Yes", "No"]} half />
                <Field label="Separate retail outlet for distribution?" name="has_retail_outlet" form={form} onChange={set} options={["Yes", "No"]} half />
              </Section>
            </>
          )}

          {/* Step 4: Reason + Reporter */}
          {step === 4 && (
            <>
              <Section title="Reason for Transfer">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Reason for the transfer<span className="text-red-400 ml-0.5">*</span></label>
                  <textarea value={form.reason_for_transfer}
                    onChange={e => set("reason_for_transfer", e.target.value)}
                    placeholder="e.g. Family Support, Living Expenses, Education Fees, Gift"
                    rows={3}
                    className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              </Section>
              <Section title="Person Completing This Report">
                <Field label="Full Name" name="reporter_full_name" form={form} onChange={set} half required />
                <Field label="Job Title" name="reporter_job_title" form={form} onChange={set} half />
                <Field label="Phone" name="reporter_phone" form={form} onChange={set} half />
                <Field label="Email" name="reporter_email" form={form} onChange={set} half />
              </Section>
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-sm text-blue-200">
                <p className="font-semibold mb-1">Ready to submit?</p>
                <p className="text-xs">
                  Once saved as a draft, go to the IFTI list, select records and click
                  <strong> Export Excel</strong>. Open the downloaded file, verify the data,
                  then copy and paste into AUSTRAC Online and click Submit.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-[#1e3a5f]">
          <div className="flex gap-2">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
              className="px-4 py-2 bg-[#152440] rounded text-sm disabled:opacity-40">← Back</button>
            {step < STEPS.length - 1 && (
              <button onClick={() => setStep(s => s + 1)}
                className="px-4 py-2 bg-[#152440] hover:bg-[#1e3a5f] rounded text-sm">Next →</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-700 rounded text-sm">Cancel</button>
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold disabled:opacity-50">
              {saving ? "Saving…" : "Save Draft"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IFTIPage() {
  const [records, setRecords] = useState<IFTIRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"outgoing" | "incoming">("outgoing");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/v1/ifti/?direction=${tab}`)
      .then(setRecords)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); setSelected(new Set()); }, [load]);

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(selected.size === records.length ? new Set() : new Set(records.map(r => r.ifti_id)));

  const exportExcel = async (onlySelected = false) => {
    setExporting(true);
    try {
      let url = `${API}/api/v1/ifti/export/${tab}`;
      let method = "GET";
      let body: string | undefined;

      if (onlySelected && selected.size > 0) {
        url = `${API}/api/v1/ifti/export/batch`;
        method = "POST";
        body = JSON.stringify({ ifti_ids: [...selected], direction: tab });
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);

      const blob = await res.blob();
      const label = tab === "outgoing" ? "OUT" : "IN";
      const filename = `IFTI_DRA_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e: unknown) { setError(String(e)); }
    finally { setExporting(false); }
  };

  const markSubmitted = async (id: string) => {
    if (!confirm("Mark this IFTI as submitted to AUSTRAC?")) return;
    try {
      await apiFetch(`/api/v1/ifti/${id}/submitted`, { method: "POST" });
      load();
    } catch (e: unknown) { setError(String(e)); }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm("Delete this IFTI draft?")) return;
    try {
      await apiFetch(`/api/v1/ifti/${id}`, { method: "DELETE" });
      load();
    } catch (e: unknown) { setError(String(e)); }
  };

  const markReady = async (id: string) => {
    await apiFetch(`/api/v1/ifti/${id}/ready`, { method: "POST" });
    load();
  };

  const formatAmt = (n: number) =>
    n?.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-[#060d1a] text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">IFTI Reports</h1>
            <p className="text-gray-400 text-sm mt-1">
              International Funds Transfer Instructions — Designated Remittance Arrangement (AUSTRAC)
            </p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold whitespace-nowrap">
            + New IFTI Record
          </button>
        </div>

        {/* AUSTRAC instructions banner */}
        <div className="bg-[#0d1b2e] border border-blue-700/50 rounded-xl p-4 mb-5 text-sm">
          <p className="font-semibold text-blue-300 mb-1">How to submit to AUSTRAC</p>
          <ol className="text-gray-400 text-xs space-y-0.5 list-decimal list-inside">
            <li>Create IFTI records below (one per transaction ≥ AUD $10,000 equivalent)</li>
            <li>Select the records to report and click <strong className="text-white">Export Excel</strong></li>
            <li>Open the downloaded .xlsx file — verify all data matches your transaction records</li>
            <li>Log in to <strong className="text-white">AUSTRAC Online</strong>, open the IFTI-DRA IN or OUT spreadsheet template</li>
            <li>Copy and paste your rows into the AUSTRAC template, then click <strong className="text-white">Submit</strong></li>
            <li>Return here and mark records as Submitted</li>
          </ol>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-600 rounded-lg p-3 text-red-300 text-sm mb-4">
            {error} <button onClick={() => setError("")} className="ml-2 opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Direction tabs */}
        <div className="flex gap-1 mb-4 bg-[#0d1b2e] p-1 rounded-lg w-fit">
          <button onClick={() => setTab("outgoing")}
            className={`px-5 py-2 rounded text-sm font-medium transition-colors ${
              tab === "outgoing" ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white"
            }`}>
            ▲ IFTI-DRA OUT (Leaving Australia)
          </button>
          <button onClick={() => setTab("incoming")}
            className={`px-5 py-2 rounded text-sm font-medium transition-colors ${
              tab === "incoming" ? "bg-cyan-700 text-white" : "text-gray-400 hover:text-white"
            }`}>
            ▼ IFTI-DRA IN (Arriving in Australia)
          </button>
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-gray-400">
            {selected.size > 0 ? `${selected.size} selected` : `${records.length} record${records.length !== 1 ? "s" : ""}`}
          </span>
          <div className="flex-1" />
          {selected.size > 0 && (
            <button onClick={() => exportExcel(true)} disabled={exporting}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-semibold disabled:opacity-50">
              {exporting ? "Generating…" : `⬇ Export Selected (${selected.size})`}
            </button>
          )}
          <button onClick={() => exportExcel(false)} disabled={exporting || records.length === 0}
            className="px-4 py-2 bg-green-800 hover:bg-green-700 rounded text-sm font-semibold disabled:opacity-50">
            {exporting ? "Generating…" : "⬇ Export All as Excel"}
          </button>
        </div>

        {/* Table */}
        <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 mb-2">No {tab} IFTI records yet.</p>
              <button onClick={() => setShowForm(true)}
                className="text-blue-400 hover:text-blue-300 text-sm">+ Create your first IFTI record →</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-[#1e3a5f]">
                  <th className="p-3 text-left w-8">
                    <input type="checkbox" checked={selected.size === records.length && records.length > 0}
                      onChange={toggleAll} className="accent-blue-500" />
                  </th>
                  <th className="p-3 text-left">IFTI ID</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Ordering Customer</th>
                  <th className="p-3 text-left">Beneficiary</th>
                  <th className="p-3 text-left">Reason</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.ifti_id}
                    className={`border-b border-[#1e3a5f]/40 hover:bg-[#152440]/40 transition-colors ${
                      selected.has(r.ifti_id) ? "bg-blue-900/10" : ""
                    }`}>
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(r.ifti_id)}
                        onChange={() => toggleSelect(r.ifti_id)} className="accent-blue-500" />
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-xs text-blue-300">{r.ifti_id}</span>
                    </td>
                    <td className="p-3 text-xs text-gray-300">{r.date_received || "—"}</td>
                    <td className="p-3 font-semibold text-green-300">
                      {r.total_amount ? formatAmt(r.total_amount) : "—"}
                    </td>
                    <td className="p-3 text-xs">{r.oc_full_name || "—"}</td>
                    <td className="p-3 text-xs text-gray-400">{r.bc_full_name || "—"}</td>
                    <td className="p-3 text-xs text-gray-400 max-w-[160px] truncate">
                      {r.reason_for_transfer || "—"}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {r.status === "draft" && (
                          <button onClick={() => markReady(r.ifti_id)}
                            className="text-xs px-2 py-1 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 rounded">
                            Mark Ready
                          </button>
                        )}
                        {r.status === "ready" && (
                          <button onClick={() => markSubmitted(r.ifti_id)}
                            className="text-xs px-2 py-1 bg-green-900/40 hover:bg-green-800/60 text-green-300 rounded">
                            Submitted ✓
                          </button>
                        )}
                        {r.status !== "submitted" && (
                          <button onClick={() => deleteRecord(r.ifti_id)}
                            className="text-xs px-2 py-1 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary row */}
        {records.length > 0 && (
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>
              Total: <strong className="text-green-400">
                {formatAmt(records.reduce((s, r) => s + (r.total_amount || 0), 0))}
              </strong> across {records.length} transaction{records.length !== 1 ? "s" : ""}
            </span>
            <span>
              {records.filter(r => r.status === "submitted").length} submitted ·{" "}
              {records.filter(r => r.status === "ready").length} ready ·{" "}
              {records.filter(r => r.status === "draft").length} draft
            </span>
          </div>
        )}
      </div>

      {showForm && (
        <FormModal
          initial={{ direction: tab }}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
