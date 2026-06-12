"use client";

import { useState } from "react";
import { CheckCircle, Upload, ChevronRight, ChevronLeft, Shield, AlertCircle } from "lucide-react";
import clsx from "clsx";

interface Step { step: number; name: string; description: string; }
interface PortalData {
  session_id: string; applicant_name: string; applicant_email: string;
  applicant_company?: string; customer_type: string; status: string;
  current_step: number; total_steps: number; completion_pct: number;
  collected_data?: Record<string, any>; steps: Step[];
}

export default function CustomerPortal({ token, data }: { token: string; data: PortalData }) {
  const [currentStep, setCurrentStep] = useState(data.current_step);
  const [formData, setFormData] = useState<Record<string, any>>(data.collected_data || {});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(data.status === "completed" || data.status === "rejected");
  const [completionResult, setCompletionResult] = useState<any>(null);
  const isLastStep = currentStep === data.total_steps;

  const handleNext = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch(`/api/v1/onboarding/portal/${token}/step`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: currentStep, data: formData }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (isLastStep) {
        const sub = await fetch(`/api/v1/onboarding/portal/${token}/submit`, { method: "POST" });
        setCompletionResult(await sub.json());
        setCompleted(true);
      } else {
        setCurrentStep(s => s + 1);
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally { setSubmitting(false); }
  };

  const update = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  if (completed) {
    const rejected = completionResult?.status === "rejected" || data.status === "rejected";
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className={clsx("w-20 h-20 rounded-full flex items-center justify-center mx-auto", rejected ? "bg-red-500/20" : "bg-emerald-500/20")}>
            {rejected ? <AlertCircle className="w-10 h-10 text-red-400" /> : <CheckCircle className="w-10 h-10 text-emerald-400" />}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">{rejected ? "Application Under Review" : "Application Submitted"}</h2>
            <p className="text-slate-400">{rejected ? "Your application requires additional review. A compliance officer will contact you shortly." : "Thank you! Your application has been received and is being reviewed. You'll hear from us within 1–2 business days."}</p>
          </div>
          {completionResult?.customer_id && (
            <div className="card p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="text-slate-200 font-mono">{completionResult.customer_id}</span></div>
              {completionResult.risk_level && <div className="flex justify-between"><span className="text-slate-500">Risk assessment</span><span className="text-slate-200 capitalize">{completionResult.risk_level}</span></div>}
            </div>
          )}
          <div className="flex items-center gap-2 justify-center text-xs text-slate-500">
            <Shield className="w-4 h-4" /> Secured by Verigo
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-brand-400 text-xs font-medium mb-0.5"><Shield className="w-3.5 h-3.5" />Verigo — Secure Onboarding</div>
            <h1 className="font-bold text-slate-100">Welcome, {data.applicant_name}</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-1">Step {currentStep + 1} of {data.total_steps + 1}</div>
            <div className="w-32 h-1.5 bg-navy-700 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${(currentStep / data.total_steps) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-navy-800 px-6 overflow-x-auto">
        <div className="max-w-2xl mx-auto flex gap-0">
          {data.steps.map(s => (
            <div key={s.step} className={clsx("px-3 py-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
              s.step === currentStep ? "border-brand-400 text-brand-400" :
              s.step < currentStep ? "border-emerald-600 text-emerald-500" : "border-transparent text-slate-600"
            )}>
              {s.step < currentStep && <CheckCircle className="w-3 h-3 inline mr-1" />}{s.name}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-100 mb-1">{data.steps[currentStep]?.name}</h2>
          <p className="text-slate-400 text-sm">{data.steps[currentStep]?.description}</p>
        </div>
        <div className="card p-6 space-y-5">
          {currentStep === 0 && <WelcomeStep data={data} />}
          {currentStep === 1 && <IdentityStep formData={formData} update={update} />}
          {currentStep === 2 && <AddressStep formData={formData} update={update} />}
          {currentStep === 3 && <FundsStep formData={formData} update={update} />}
          {currentStep === 4 && <DeclarationsStep formData={formData} update={update} />}
          {currentStep === 5 && <ReviewStep formData={formData} data={data} />}
        </div>
        {error && (
          <div className="mt-4 flex items-start gap-2 text-red-400 text-sm p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
          </div>
        )}
        <div className="flex justify-between mt-6">
          <button onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={currentStep === 0 || submitting} className="btn-secondary flex items-center gap-2 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />Back
          </button>
          <button onClick={handleNext} disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> :
              isLastStep ? "Submit Application" : <><span>Continue</span><ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ data }: { data: PortalData }) {
  return (
    <div className="space-y-4">
      <p className="text-slate-300">To complete your onboarding, we need to verify your identity. This takes approximately <strong className="text-slate-100">5–10 minutes</strong>.</p>
      <div className="space-y-2">
        {["Government-issued photo ID (passport or driver’s licence)","Proof of residential address (utility bill or bank statement)","Source of funds declaration"].map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
            <CheckCircle className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />{item}
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-brand-500/10 border border-brand-500/20 p-3 text-sm text-brand-300">
        Your details are protected under the Australian Privacy Act 1988 and processed securely.
      </div>
    </div>
  );
}

function IdentityStep({ formData, update }: { formData: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="ID type" required>
          <select className="field-input" value={formData.id_type || ""} onChange={e => update("id_type", e.target.value)}>
            <option value="">Select…</option>
            <option value="passport">Passport</option>
            <option value="drivers_licence">Driver's Licence</option>
            <option value="national_id">National ID</option>
          </select>
        </Field>
        <Field label="ID number" required>
          <input className="field-input" placeholder="e.g. PA1234567" value={formData.id_number || ""} onChange={e => update("id_number", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date of birth" required>
          <input type="date" className="field-input" value={formData.date_of_birth || ""} onChange={e => update("date_of_birth", e.target.value)} />
        </Field>
        <Field label="Nationality" required>
          <input className="field-input" placeholder="e.g. Australian" value={formData.nationality || ""} onChange={e => update("nationality", e.target.value)} />
        </Field>
      </div>
      <div className="border-2 border-dashed border-navy-600 rounded-xl p-6 text-center">
        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Upload front of ID document</p>
        <p className="text-xs text-slate-600 mt-1">JPG, PNG or PDF — max 10MB</p>
        <input type="file" accept="image/*,.pdf" className="hidden" id="id-doc" onChange={() => update("document_uploaded", true)} />
        <label htmlFor="id-doc" className="btn-secondary text-xs mt-3 inline-block cursor-pointer">Choose file</label>
      </div>
    </div>
  );
}

function AddressStep({ formData, update }: { formData: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Residential address" required>
        <input className="field-input" placeholder="Street address" value={formData.address || ""} onChange={e => update("address", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="City"><input className="field-input" placeholder="City" value={formData.city || ""} onChange={e => update("city", e.target.value)} /></Field>
        <Field label="Postcode"><input className="field-input" placeholder="Postcode" value={formData.postcode || ""} onChange={e => update("postcode", e.target.value)} /></Field>
      </div>
      <Field label="Country of residence" required>
        <input className="field-input" placeholder="e.g. Australia" value={formData.country_of_residence || ""} onChange={e => update("country_of_residence", e.target.value)} />
      </Field>
      <div className="border-2 border-dashed border-navy-600 rounded-xl p-6 text-center">
        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">Upload proof of address</p>
        <p className="text-xs text-slate-600 mt-1">Utility bill or bank statement — dated within 90 days</p>
        <input type="file" accept="image/*,.pdf" className="hidden" id="addr-doc" onChange={() => update("address_doc_uploaded", true)} />
        <label htmlFor="addr-doc" className="btn-secondary text-xs mt-3 inline-block cursor-pointer">Choose file</label>
      </div>
    </div>
  );
}

function FundsStep({ formData, update }: { formData: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Occupation" required>
        <input className="field-input" placeholder="e.g. Software Engineer" value={formData.occupation || ""} onChange={e => update("occupation", e.target.value)} />
      </Field>
      <Field label="Primary source of funds" required>
        <select className="field-input" value={formData.source_of_funds || ""} onChange={e => update("source_of_funds", e.target.value)}>
          <option value="">Select…</option>
          <option value="employment">Employment income</option>
          <option value="business">Business income</option>
          <option value="investments">Investments / dividends</option>
          <option value="savings">Personal savings</option>
          <option value="inheritance">Inheritance / gift</option>
          <option value="property_sale">Property sale</option>
          <option value="pension">Pension / superannuation</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Expected annual transaction volume">
        <select className="field-input" value={formData.annual_volume || ""} onChange={e => update("annual_volume", e.target.value)}>
          <option value="">Select…</option>
          <option value="under_10k">Under $10,000</option>
          <option value="10k_50k">$10,000 – $50,000</option>
          <option value="50k_250k">$50,000 – $250,000</option>
          <option value="over_250k">Over $250,000</option>
        </select>
      </Field>
    </div>
  );
}

function DeclarationsStep({ formData, update }: { formData: any; update: (k: string, v: any) => void }) {
  return (
    <div className="space-y-5">
      <Checkbox id="is_pep" label="I am, or am closely associated with, a Politically Exposed Person (PEP)" description="A PEP is a person who holds or has held a prominent public role domestically or internationally." checked={!!formData.is_pep} onChange={v => update("is_pep", v)} />
      <Checkbox id="is_beneficial_owner" label="I am the beneficial owner of the funds used in this account" checked={formData.is_beneficial_owner !== false} onChange={v => update("is_beneficial_owner", v)} />
      <Checkbox id="third_party_funds" label="Funds will be used on behalf of a third party" checked={!!formData.third_party_funds} onChange={v => update("third_party_funds", v)} />
      <div className="border-t border-navy-700 pt-5">
        <Checkbox id="terms" label="I confirm that all information provided is accurate and I consent to identity verification" checked={!!formData.terms_accepted} onChange={v => update("terms_accepted", v)} />
      </div>
    </div>
  );
}

function ReviewStep({ formData, data }: { formData: any; data: PortalData }) {
  const rows = [
    { label: "Full name", value: data.applicant_name },
    { label: "Email", value: data.applicant_email },
    { label: "ID type", value: formData.id_type },
    { label: "ID number", value: formData.id_number },
    { label: "Date of birth", value: formData.date_of_birth },
    { label: "Address", value: formData.address },
    { label: "Country", value: formData.country_of_residence },
    { label: "Occupation", value: formData.occupation },
    { label: "Source of funds", value: formData.source_of_funds?.replace(/_/g, " ") },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Please review your information before submitting.</p>
      <div className="space-y-2">
        {rows.filter(r => r.value).map(({ label, value }) => (
          <div key={label} className="flex justify-between text-sm py-2 border-b border-navy-800 last:border-0">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-200 capitalize">{value}</span>
          </div>
        ))}
      </div>
      {!formData.terms_accepted && (
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4" />Please go back and accept the declarations to proceed.
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-400">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

function Checkbox({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer group">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-navy-500 bg-navy-700 accent-brand-500" />
      <div>
        <div className="text-sm text-slate-200 group-hover:text-white transition-colors">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
      </div>
    </label>
  );
}
