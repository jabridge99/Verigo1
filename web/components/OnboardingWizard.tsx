'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { industries } from '@/lib/industries'
import {
  updateOrganisation,
  generateAmlProgram,
  generateRiskAssessment,
  acknowledgeAmlAccountability,
  createFirstCustomer,
  type AmlProgram,
  type RiskAssessment,
  type FirstCustomerInput,
} from '@/lib/signup'

type Step =
  | 'industry'
  | 'company'
  | 'compliance'
  | 'risk'
  | 'generating'
  | 'program'
  | 'assessing'
  | 'assessment'
  | 'customer'
  | 'done'

const STEP_ORDER: Step[] = ['industry', 'company', 'compliance', 'risk', 'program', 'assessment', 'customer', 'done']

// Milestone progress shown to the user: setup (25%), AML program (50%),
// risk assessment (75%), first customer onboarded (100%).
const MILESTONE_PCT: Record<Step, number> = {
  industry: 25,
  company: 25,
  compliance: 25,
  risk: 25,
  generating: 50,
  program: 50,
  assessing: 75,
  assessment: 75,
  customer: 100,
  done: 100,
}

const RISK_PROFILES: { id: 'low' | 'standard' | 'high'; label: string; description: string }[] = [
  { id: 'low', label: 'Low', description: 'Limited exposure, simple products, low-risk customer base.' },
  { id: 'standard', label: 'Standard', description: 'Typical exposure for your industry.' },
  { id: 'high', label: 'High', description: 'Complex products, cross-border activity, or higher-risk customers.' },
]

// Map the marketing-site industry slug to the customer-record IndustryType enum.
function customerIndustryFor(industryId: string): FirstCustomerInput['industry'] {
  if (industryId === 'digital-currency-exchange') return 'cryptocurrency'
  if (industryId === 'real-estate') return 'real_estate'
  if (['remittance-provider', 'foreign-exchange', 'payment-service-provider'].includes(industryId)) return 'fintech'
  return 'other'
}

export default function OnboardingWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org') ?? ''

  const [step, setStep] = useState<Step>('industry')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [industryId, setIndustryId] = useState('')
  const [abn, setAbn] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [officerName, setOfficerName] = useState('')
  const [officerEmail, setOfficerEmail] = useState('')
  const [program, setProgram] = useState<AmlProgram | null>(null)
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null)
  const [accountabilityAck, setAccountabilityAck] = useState(false)
  const [ackSaving, setAckSaving] = useState(false)

  const [customer, setCustomer] = useState({
    full_name: '',
    date_of_birth: '',
    nationality: '',
    country_of_residence: '',
    id_number: '',
    id_type: '',
    address: '',
    email: '',
    phone: '',
  })

  if (!orgId) {
    return (
      <div className="pub-card">
        <ErrorBanner message="No organisation selected. Please start sign-up again." />
      </div>
    )
  }

  async function withLoading(fn: () => Promise<void>, onError: string) {
    setError('')
    setLoading(true)
    try {
      await fn()
    } catch (err: any) {
      setError(err.message ?? onError)
    } finally {
      setLoading(false)
    }
  }

  function handleChooseIndustry(e: React.FormEvent) {
    e.preventDefault()
    withLoading(async () => {
      await updateOrganisation(orgId, { industry_id: industryId })
      setStep('company')
    }, 'Failed to save industry')
  }

  function handleCompanyDetails(e: React.FormEvent) {
    e.preventDefault()
    withLoading(async () => {
      await updateOrganisation(orgId, { abn, business_address: businessAddress, phone })
      setStep('compliance')
    }, 'Failed to save company details')
  }

  function handleComplianceOfficer(e: React.FormEvent) {
    e.preventDefault()
    withLoading(async () => {
      await updateOrganisation(orgId, {
        compliance_officer_name: officerName,
        compliance_officer_email: officerEmail,
      })
      setStep('risk')
    }, 'Failed to save compliance officer')
  }

  async function handleChooseRisk(profile: 'low' | 'standard' | 'high') {
    setError('')
    setLoading(true)
    try {
      await updateOrganisation(orgId, { risk_profile: profile })
      setStep('generating')
      const generated = await generateAmlProgram(orgId)
      setProgram(generated)
      setStep('program')
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate AML program')
      setStep('risk')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateAssessment() {
    setError('')
    setLoading(true)
    setStep('assessing')
    try {
      const generated = await generateRiskAssessment(orgId)
      setAssessment(generated)
      setStep('assessment')
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate risk assessment')
      setStep('program')
    } finally {
      setLoading(false)
    }
  }

  async function handleAccountabilityChange(checked: boolean) {
    setAccountabilityAck(checked)
    if (!checked) return
    setAckSaving(true)
    try {
      await acknowledgeAmlAccountability(orgId)
    } catch (err: any) {
      setAccountabilityAck(false)
      setError(err.message ?? 'Failed to record acknowledgement')
    } finally {
      setAckSaving(false)
    }
  }

  function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault()
    withLoading(async () => {
      await createFirstCustomer({
        ...customer,
        industry: customerIndustryFor(industryId),
      })
      setStep('done')
    }, 'Failed to create customer')
  }

  function skipTo(next: Step) {
    setError('')
    setStep(next)
  }

  const stepIndex = STEP_ORDER.indexOf(
    step === 'generating' ? 'risk' : step === 'assessing' ? 'program' : step
  )
  const progressPct = MILESTONE_PCT[step]

  return (
    <div className="pub-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Onboarding progress</span>
        <span className="text-xs font-bold text-blue-600">{progressPct}%</span>
      </div>
      <div className="flex items-center gap-2 mb-6">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${stepIndex >= i ? 'bg-blue-600' : 'bg-slate-200'}`} />
        ))}
      </div>

      {step === 'industry' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Choose your industry</h2>
          <p className="text-sm text-slate-500 mb-6">Step 1 of 7</p>
          <form onSubmit={handleChooseIndustry} className="space-y-4">
            <select required value={industryId} onChange={e => setIndustryId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
              <option value="">Select your industry</option>
              {industries.map(i => (
                <option key={i.id} value={i.id}>
                  {i.label}{i.regime === 'expanded' ? ' (Tranche 2 — 2026)' : ''}
                </option>
              ))}
            </select>
            {error && <ErrorBanner message={error} />}
            <NextButton loading={loading} />
          </form>
        </>
      )}

      {step === 'company' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Company details</h2>
          <p className="text-sm text-slate-500 mb-6">Step 2 of 7</p>
          <form onSubmit={handleCompanyDetails} className="space-y-4">
            <Field label="ABN" value={abn} onChange={setAbn} placeholder="12 345 678 901" />
            <Field label="Business address" value={businessAddress} onChange={setBusinessAddress} placeholder="1 Example St, Sydney NSW 2000" />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+61 2 9000 0000" />
            {error && <ErrorBanner message={error} />}
            <NextButton loading={loading} />
            <SkipButton loading={loading} onClick={() => skipTo('compliance')} />
          </form>
        </>
      )}

      {step === 'compliance' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Compliance officer</h2>
          <p className="text-sm text-slate-500 mb-6">Step 3 of 7 — who is your AML/CTF Compliance Officer (MLRO)?</p>
          <form onSubmit={handleComplianceOfficer} className="space-y-4">
            <Field label="Full name" value={officerName} onChange={setOfficerName} placeholder="Jane Smith" />
            <Field label="Email" value={officerEmail} onChange={setOfficerEmail} placeholder="jane@company.com.au" type="email" />
            {error && <ErrorBanner message={error} />}
            <NextButton loading={loading} />
            <SkipButton loading={loading} onClick={() => skipTo('risk')} />
          </form>
        </>
      )}

      {step === 'risk' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Risk appetite</h2>
          <p className="text-sm text-slate-500 mb-6">Step 4 of 7 — this shapes the review cadence of your AML/CTF program.</p>
          <div className="space-y-3">
            {RISK_PROFILES.map(p => (
              <button key={p.id} type="button" disabled={loading} onClick={() => handleChooseRisk(p.id)}
                className="w-full text-left rounded-xl border border-slate-200 px-4 py-3 hover:border-blue-500 hover:bg-blue-50/50 transition-colors disabled:opacity-50">
                <p className="font-semibold text-slate-900 text-sm">{p.label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{p.description}</p>
              </button>
            ))}
          </div>
          {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
        </>
      )}

      {step === 'generating' && (
        <div className="py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-slate-600 text-sm">Step 5 of 7 — generating your AML/CTF program…</p>
        </div>
      )}

      {step === 'program' && program && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-bold text-slate-900">Your AML/CTF program is ready</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            {program.items.length} controls generated for a {program.risk_profile}-risk profile.
          </p>
          <ul className="space-y-2 max-h-56 overflow-y-auto mb-6">
            {program.items.map(item => (
              <li key={item.title} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{item.title}</span>
              </li>
            ))}
          </ul>
          {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
          <button type="button" onClick={handleGenerateAssessment} className="pub-btn-primary w-full justify-center py-3">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </>
      )}

      {step === 'assessing' && (
        <div className="py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-slate-600 text-sm">Step 6 of 7 — generating your risk assessment…</p>
        </div>
      )}

      {step === 'assessment' && assessment && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-bold text-slate-900">Your risk assessment is ready</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Overall rating: <span className="font-semibold text-slate-900">{assessment.overall_rating}</span>
          </p>
          <ul className="space-y-3 max-h-56 overflow-y-auto mb-6">
            {assessment.factors.map(f => (
              <li key={f.factor} className="text-sm">
                <p className="font-semibold text-slate-900">{f.label} <span className="text-xs font-normal text-slate-400">({f.rating})</span></p>
                <p className="text-slate-500 text-xs">{f.description}</p>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setStep('customer')} className="pub-btn-primary w-full justify-center py-3">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </>
      )}

      {step === 'customer' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Onboard your first customer</h2>
          <p className="text-sm text-slate-500 mb-6">Step 7 of 7</p>
          <form onSubmit={handleCreateCustomer} className="space-y-4">
            <Field label="Full name" value={customer.full_name} onChange={v => setCustomer({ ...customer, full_name: v })} placeholder="Alex Customer" required />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date of birth" value={customer.date_of_birth} onChange={v => setCustomer({ ...customer, date_of_birth: v })} type="date" required />
              <Field label="Nationality" value={customer.nationality} onChange={v => setCustomer({ ...customer, nationality: v })} placeholder="Australian" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Country of residence" value={customer.country_of_residence} onChange={v => setCustomer({ ...customer, country_of_residence: v })} placeholder="Australia" required />
              <Field label="ID type" value={customer.id_type} onChange={v => setCustomer({ ...customer, id_type: v })} placeholder="Passport" required />
            </div>
            <Field label="ID number" value={customer.id_number} onChange={v => setCustomer({ ...customer, id_number: v })} placeholder="PA1234567" required />
            <Field label="Address" value={customer.address} onChange={v => setCustomer({ ...customer, address: v })} placeholder="2 Customer Rd" required />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email" value={customer.email} onChange={v => setCustomer({ ...customer, email: v })} type="email" placeholder="alex@example.com" required />
              <Field label="Phone" value={customer.phone} onChange={v => setCustomer({ ...customer, phone: v })} placeholder="0400000000" required />
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" disabled={loading} className="pub-btn-primary w-full justify-center py-3 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Onboard Customer <ArrowRight className="w-4 h-4" /></>}
            </button>
            <SkipButton loading={loading} onClick={() => skipTo('done')} />
          </form>
        </>
      )}

      {step === 'done' && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-bold text-slate-900">You're all set up</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Your organisation, AML/CTF program, risk assessment, and first customer are ready to go.
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={accountabilityAck}
              disabled={ackSaving}
              onChange={e => handleAccountabilityChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-amber-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-amber-900">
              As the industry owner, I acknowledge that <strong>my organisation</strong> — not Verigo — is
              accountable for maintaining and operating its AML/CTF program on an ongoing basis.
            </span>
          </label>
          {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
          <button
            type="button"
            disabled={!accountabilityAck || ackSaving}
            onClick={() => router.push('/dashboard')}
            className="pub-btn-primary w-full justify-center py-3 disabled:opacity-50"
          >
            Enter Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input type={type} required={required} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  )
}

function NextButton({ loading }: { loading: boolean }) {
  return (
    <button type="submit" disabled={loading} className="pub-btn-primary w-full justify-center py-3 disabled:opacity-50">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
    </button>
  )
}

function SkipButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={loading} onClick={onClick}
      className="w-full text-center text-sm text-slate-400 hover:text-slate-600 disabled:opacity-50">
      Skip for now
    </button>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
      <p className="text-sm text-red-600">{message}</p>
    </div>
  )
}
