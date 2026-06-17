'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { industries } from '@/lib/industries'
import {
  registerAccount,
  confirmEmailVerification,
  createOrganisation,
  setOrganisationIndustry,
  setOrganisationRiskProfile,
  generateAmlProgram,
  type AmlProgram,
} from '@/lib/signup'

type Step = 'account' | 'verify' | 'organisation' | 'industry' | 'risk' | 'generating' | 'done'

const RISK_PROFILES: { id: 'low' | 'standard' | 'high'; label: string; description: string }[] = [
  { id: 'low', label: 'Low', description: 'Limited exposure, simple products, low-risk customer base.' },
  { id: 'standard', label: 'Standard', description: 'Typical exposure for your industry.' },
  { id: 'high', label: 'High', description: 'Complex products, cross-border activity, or higher-risk customers.' },
]

export default function SignupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('account')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industryId, setIndustryId] = useState('')
  const [riskProfile, setRiskProfile] = useState<'low' | 'standard' | 'high' | ''>('')

  const [verifyToken, setVerifyToken] = useState('')
  const [devVerifyToken, setDevVerifyToken] = useState('')
  const [orgId, setOrgId] = useState('')
  const [program, setProgram] = useState<AmlProgram | null>(null)

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await registerAccount({ email, password, full_name: fullName })
      if (result.dev_verify_email_token) {
        setDevVerifyToken(result.dev_verify_email_token)
        setVerifyToken(result.dev_verify_email_token)
      }
      setStep('verify')
    } catch (err: any) {
      setError(err.message ?? 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmEmailVerification(verifyToken)
      setStep('organisation')
    } catch (err: any) {
      setError(err.message ?? 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateOrganisation(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const org = await createOrganisation(companyName)
      setOrgId(org.org_id)
      setStep('industry')
    } catch (err: any) {
      setError(err.message ?? 'Failed to create organisation')
    } finally {
      setLoading(false)
    }
  }

  async function handleChooseIndustry(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await setOrganisationIndustry(orgId, industryId)
      setStep('risk')
    } catch (err: any) {
      setError(err.message ?? 'Failed to save industry')
    } finally {
      setLoading(false)
    }
  }

  async function handleChooseRisk(profile: 'low' | 'standard' | 'high') {
    setError('')
    setLoading(true)
    setRiskProfile(profile)
    try {
      await setOrganisationRiskProfile(orgId, profile)
      setStep('generating')
      const generated = await generateAmlProgram(orgId)
      setProgram(generated)
      setStep('done')
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate AML program')
      setStep('risk')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pub-card">
      <div className="flex items-center gap-2 mb-6">
        {(['account', 'verify', 'organisation', 'industry', 'risk', 'done'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${
              step === s || (step === 'generating' && s === 'risk') ||
              ['account', 'verify', 'organisation', 'industry', 'risk', 'generating', 'done'].indexOf(step) > i
                ? 'bg-blue-600'
                : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {step === 'account' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Create your account</h2>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Work email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="jane@company.com.au" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input type="password" required minLength={12} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Minimum 12 characters" />
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" disabled={loading} className="pub-btn-primary w-full justify-center py-3 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
            </button>
            <p className="text-slate-400 text-xs text-center">
              By creating an account you agree to our{' '}
              <Link href="#" className="underline hover:text-slate-600">Terms of Service</Link>{' '}
              and{' '}
              <Link href="#" className="underline hover:text-slate-600">Privacy Policy</Link>.
            </p>
          </form>
        </>
      )}

      {step === 'verify' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Verify your email</h2>
          <p className="text-sm text-slate-500 mb-6">We sent a verification link to <strong>{email}</strong>.</p>
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            {devVerifyToken && (
              <p className="text-xs text-slate-400">Dev mode: verification token pre-filled below.</p>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Verification token</label>
              <input type="text" required value={verifyToken} onChange={e => setVerifyToken(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Paste your verification token" />
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" disabled={loading} className="pub-btn-primary w-full justify-center py-3 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify Email <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </>
      )}

      {step === 'organisation' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Create your organisation</h2>
          <form onSubmit={handleCreateOrganisation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Company name</label>
              <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Acme Pty Ltd" />
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" disabled={loading} className="pub-btn-primary w-full justify-center py-3 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Organisation <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </>
      )}

      {step === 'industry' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-6">Choose your industry</h2>
          <form onSubmit={handleChooseIndustry} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Industry</label>
              <select required value={industryId} onChange={e => setIndustryId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                <option value="">Select your industry</option>
                {industries.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.label}{i.regime === 'expanded' ? ' (Tranche 2 — 2026)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {error && <ErrorBanner message={error} />}
            <button type="submit" disabled={loading} className="pub-btn-primary w-full justify-center py-3 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </>
      )}

      {step === 'risk' && (
        <>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Choose your risk profile</h2>
          <p className="text-sm text-slate-500 mb-6">This shapes the review cadence of your AML/CTF program.</p>
          <div className="space-y-3">
            {RISK_PROFILES.map(p => (
              <button
                key={p.id}
                type="button"
                disabled={loading}
                onClick={() => handleChooseRisk(p.id)}
                className="w-full text-left rounded-xl border border-slate-200 px-4 py-3 hover:border-blue-500 hover:bg-blue-50/50 transition-colors disabled:opacity-50"
              >
                <p className="font-semibold text-slate-900 text-sm">{p.label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{p.description}</p>
              </button>
            ))}
          </div>
          {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
          {loading && (
            <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Saving risk profile…
            </div>
          )}
        </>
      )}

      {step === 'generating' && (
        <div className="py-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-slate-600 text-sm">Generating your AML/CTF program…</p>
        </div>
      )}

      {step === 'done' && program && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-bold text-slate-900">Your AML/CTF program is ready</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            {program.items.length} controls generated for a {program.risk_profile}-risk profile.
          </p>
          <ul className="space-y-2 max-h-64 overflow-y-auto mb-6">
            {program.items.map(item => (
              <li key={item.title} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{item.title}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="pub-btn-primary w-full justify-center py-3"
          >
            Enter Dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
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

