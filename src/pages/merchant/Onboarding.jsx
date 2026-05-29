import React, { useState } from 'react'
import {
  CheckCircle, Clock, XCircle, Upload, Shield, Leaf,
  Package, Rocket, AlertTriangle, Lock, Phone, Mail,
  Building2, FileText, BadgeCheck,
} from 'lucide-react'

// ── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 'business',  label: 'Business Details',           icon: Building2, shortLabel: 'Business' },
  { id: 'verify',    label: 'Sustainability Verification', icon: Leaf,      shortLabel: 'Verify' },
  { id: 'catalogue', label: 'Product Catalogue',          icon: Package,   shortLabel: 'Catalogue' },
  { id: 'golive',    label: 'Go Live',                    icon: Rocket,    shortLabel: 'Go Live' },
]

// 0 = Business Details (completed), 1 = Sustainability Verification (current)
const DEFAULT_STEP = 1

// ── Step 2 — Sustainability Verification data ─────────────────────────────────

const SUST_CRITERIA = [
  {
    id: 'abn_verified',
    label: 'ABN & Business Registration',
    description: 'Australian Business Number validated against ASIC register.',
    status: 'passed',
  },
  {
    id: 'cert_docs',
    label: 'Sustainability Certifications',
    description: 'One or more recognised eco-certifications on file (ISO 14001, BCorp, R2, etc.).',
    status: 'pending',
  },
  {
    id: 'sust_statement',
    label: 'Sustainability Statement',
    description: 'Written statement describing environmental practices and measurable impact.',
    status: 'pending',
  },
  {
    id: 'product_claims',
    label: 'Product Claims Verification',
    description: 'All sustainability claims on listed products are verifiable and accurate.',
    status: 'failed',
  },
  {
    id: 'supply_chain',
    label: 'Supply Chain Transparency',
    description: 'Evidence of ethical sourcing and supply chain accountability.',
    status: 'pending',
  },
]

const CRITERIA_META = {
  passed:  { icon: CheckCircle, color: 'text-eco-600',   bg: 'bg-eco-50',   border: 'border-eco-200',   label: 'Passed' },
  pending: { icon: Clock,       color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Under Review' },
  failed:  { icon: XCircle,     color: 'text-red-500',   bg: 'bg-red-50',   border: 'border-red-200',   label: 'Action Required' },
}

// ── Step 1 — Business Details (completed) ────────────────────────────────────

const BUSINESS_DATA = {
  name: 'The Green Cycle',
  abn: '83 142 667 013',
  address: '14 Innovation Ave, Surry Hills NSW 2010',
  contact: 'Sarah Chen — Head of Partnerships',
  email: 'partnerships@thegreencycle.com.au',
  phone: '+61 2 9876 5432',
  category: 'Electronics Refurbishment',
  website: 'thegreencycle.com.au',
}

// ── Upload row ────────────────────────────────────────────────────────────────

function UploadRow({ label, description, uploaded }) {
  const [file, setFile] = useState(uploaded || null)
  return (
    <div className={`flex items-center justify-between gap-4 p-3 rounded-xl border transition-colors ${file ? 'bg-eco-50 border-eco-200' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${file ? 'text-eco-600' : 'text-slate-400'}`} />
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${file ? 'text-eco-700' : 'text-slate-700'}`}>{label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{file ? file : description}</p>
        </div>
      </div>
      {file ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <CheckCircle className="w-4 h-4 text-eco-500" />
          <button onClick={() => setFile(null)} className="text-[10px] text-slate-400 hover:text-red-500">Remove</button>
        </div>
      ) : (
        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer hover:border-eco-400 hover:text-eco-700 transition-colors flex-shrink-0">
          <Upload className="w-3.5 h-3.5" />
          Upload
          <input type="file" className="hidden" onChange={e => {
            if (e.target.files?.[0]) setFile(e.target.files[0].name)
          }} />
        </label>
      )}
    </div>
  )
}

// ── Go-live checklist ─────────────────────────────────────────────────────────

const GO_LIVE_CHECKLIST = [
  'Business details verified',
  'Sustainability credentials reviewed and approved',
  'At least 3 active product listings',
  'Bank account / payout details configured',
  'Platform agreement signed',
  'Welcome email sent to merchant contact',
]

// ── Main page ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(DEFAULT_STEP)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Merchant Onboarding</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Complete all 4 steps to go live on the EcoBin Rewards Marketplace
        </p>
      </div>

      {/* Progress stepper */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const done    = i < currentStep
            const current = i === currentStep
            const locked  = i > currentStep

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => !locked && setCurrentStep(i)}
                  disabled={locked}
                  className={`flex flex-col items-center gap-2 flex-1 transition-opacity ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    done    ? 'bg-eco-500 border-eco-500' :
                    current ? 'bg-white border-eco-500 shadow-md shadow-eco-100' :
                              'bg-white border-slate-200'
                  }`}>
                    {done
                      ? <CheckCircle className="w-5 h-5 text-white" />
                      : locked
                        ? <Lock className="w-4 h-4 text-slate-400" />
                        : <Icon className={`w-4 h-4 ${current ? 'text-eco-600' : 'text-slate-400'}`} />
                    }
                  </div>
                  <div className="text-center">
                    <p className={`text-[10px] font-bold leading-tight ${
                      done ? 'text-eco-600' : current ? 'text-eco-700' : 'text-slate-400'
                    }`}>{step.shortLabel}</p>
                    {current && (
                      <p className="text-[9px] text-eco-500 font-semibold mt-0.5">Current</p>
                    )}
                    {done && (
                      <p className="text-[9px] text-eco-400 font-medium mt-0.5">Complete</p>
                    )}
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 max-w-16 rounded-full transition-colors ${i < currentStep ? 'bg-eco-400' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* ── Step 1 — Business Details (completed) ── */}
      {currentStep === 0 && (
        <div className="space-y-4">
          <div className="bg-eco-600 rounded-2xl px-5 py-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-white flex-shrink-0" />
            <div>
              <p className="font-bold text-white">Step 1 Completed</p>
              <p className="text-eco-100 text-xs mt-0.5">Business details verified and on file.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" /> Business Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Business Name',    value: BUSINESS_DATA.name },
                { label: 'ABN',              value: BUSINESS_DATA.abn },
                { label: 'Address',          value: BUSINESS_DATA.address },
                { label: 'Category',         value: BUSINESS_DATA.category },
                { label: 'Primary Contact',  value: BUSINESS_DATA.contact },
                { label: 'Website',          value: BUSINESS_DATA.website },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Mail className="w-3.5 h-3.5" /> {BUSINESS_DATA.email}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Phone className="w-3.5 h-3.5" /> {BUSINESS_DATA.phone}
              </div>
            </div>
          </div>

          <button onClick={() => setCurrentStep(1)}
            className="w-full py-3 bg-eco-600 text-white text-sm font-bold rounded-xl hover:bg-eco-700 transition-colors">
            Continue to Sustainability Verification
          </button>
        </div>
      )}

      {/* ── Step 2 — Sustainability Verification (current / default) ── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          {/* Awaiting review banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <Clock className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800">Awaiting Review</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Your verification documents have been submitted. Our sustainability team will review
                within <strong>2 business days</strong>. You will be notified by email when complete.
              </p>
            </div>
          </div>

          {/* Criteria checklist */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-eco-600" /> Sustainability Score Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Each criterion must pass before your account can go live. Items marked "Action Required" need your attention.
            </p>
            <div className="space-y-2.5 mt-1">
              {SUST_CRITERIA.map(criterion => {
                const meta = CRITERIA_META[criterion.status]
                const Icon = meta.icon
                return (
                  <div key={criterion.id} className={`flex items-start gap-3 p-3 rounded-xl border ${meta.bg} ${meta.border}`}>
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-bold text-slate-800">{criterion.label}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color} bg-white border ${meta.border}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{criterion.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upload documents */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-500" /> Supporting Documents
            </h2>
            <p className="text-xs text-slate-500">Upload PDF or image files. Max 10MB per file.</p>
            <div className="space-y-2">
              <UploadRow
                label="Business Certification"
                description="ASIC registration or equivalent — PDF or image"
                uploaded="ASIC_Certificate_2025.pdf"
              />
              <UploadRow
                label="Sustainability Report"
                description="Most recent annual sustainability or impact report"
              />
              <UploadRow
                label="Eco Certifications"
                description="ISO 14001, R2, BCorp, or other relevant certificates"
                uploaded="ISO14001_Certificate.pdf"
              />
              <UploadRow
                label="Product Certifications"
                description="Any product-level certifications (organic, fair trade, etc.)"
              />
            </div>
          </div>

          {/* Reviewer notes */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" /> Reviewer Notes
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700">Action Required — Product Claims</p>
                <p className="text-[11px] text-red-600 mt-1">
                  One or more product listings contain unverified sustainability claims. Please upload
                  supporting product certifications and update the affected listing descriptions to
                  use only verified claims. Specifically: "100% carbon neutral" claim on the Zero-Waste
                  Starter Box requires a third-party verification certificate.
                </p>
                <p className="text-[10px] text-red-500 mt-1.5">Reviewer: EcoBin Compliance Team · 28 May 2026</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700">Sustainability Statement — Under Review</p>
                <p className="text-[11px] text-amber-600 mt-1">
                  Your sustainability statement has been received and is currently being evaluated
                  by our team. No action required at this time.
                </p>
                <p className="text-[10px] text-amber-500 mt-1.5">Reviewer: EcoBin Sustainability Team · 27 May 2026</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setCurrentStep(0)}
              className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
              Back
            </button>
            <button
              className="flex-1 py-3 bg-slate-100 text-slate-400 text-sm font-bold rounded-xl cursor-not-allowed"
              disabled>
              Awaiting Approval
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 — Product Catalogue (locked) ── */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <Lock className="w-6 h-6 text-slate-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-slate-600">Step 3 Locked</p>
              <p className="text-slate-500 text-xs mt-0.5">
                Complete Sustainability Verification to unlock the Product Catalogue setup.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 opacity-60 pointer-events-none select-none">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-500" /> Product Catalogue Setup
            </h2>
            <div className="space-y-3">
              {[
                { step: '1', title: 'Add your first listing', desc: 'Create at least 3 product or voucher listings with accurate sustainability information.' },
                { step: '2', title: 'Set pricing in points', desc: 'Points are priced at $0.05 AUD each. A $25 product = 500 pts.' },
                { step: '3', title: 'Upload product images', desc: 'High-quality images increase conversion rates by up to 40%.' },
                { step: '4', title: 'Select sustainability tags', desc: 'Accurate tags improve discoverability in the eco-marketplace.' },
                { step: '5', title: 'Submit for listing review', desc: 'All listings are reviewed by EcoBin within 2 business days.' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-6 h-6 bg-eco-100 text-eco-700 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{item.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4 — Go Live (locked) ── */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <Lock className="w-6 h-6 text-slate-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-slate-600">Step 4 Locked</p>
              <p className="text-slate-500 text-xs mt-0.5">
                Complete all previous steps to unlock Go Live.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 opacity-60 pointer-events-none select-none">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-slate-500" /> Go Live Checklist
            </h2>
            <div className="space-y-2">
              {GO_LIVE_CHECKLIST.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-5 h-5 border-2 border-slate-200 rounded-full flex-shrink-0" />
                  <p className="text-xs font-medium text-slate-600">{item}</p>
                </div>
              ))}
            </div>
            <div className="bg-eco-950 rounded-xl px-4 py-4 text-center">
              <Rocket className="w-6 h-6 text-eco-400 mx-auto mb-2" />
              <p className="font-bold text-white text-sm">Ready to launch!</p>
              <p className="text-eco-300 text-xs mt-1">
                Once all items are checked, your listings go live to {' '}
                <strong className="text-eco-200">50,000+ EcoBin members</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Support card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-eco-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Phone className="w-5 h-5 text-eco-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-900 text-sm">Questions? Contact Merchant Support</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Our merchant success team is available Mon–Fri, 9am–5pm AEST.
            </p>
            <div className="flex flex-wrap gap-4 mt-3">
              <a href="mailto:merchants@ecobin.com.au"
                className="flex items-center gap-1.5 text-xs font-semibold text-eco-700 hover:text-eco-800">
                <Mail className="w-3.5 h-3.5" /> merchants@ecobin.com.au
              </a>
              <a href="tel:1800326246"
                className="flex items-center gap-1.5 text-xs font-semibold text-eco-700 hover:text-eco-800">
                <Phone className="w-3.5 h-3.5" /> 1800 ECO BIN
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
