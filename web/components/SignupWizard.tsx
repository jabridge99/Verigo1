'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { registerAccount, confirmEmailVerification, createOrganisation } from '@/lib/signup'

type Step = 'account' | 'verify' | 'organisation'

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

  const [verifyToken, setVerifyToken] = useState('')
  const [devVerifyToken, setDevVerifyToken] = useState('')

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
      router.push(`/onboarding-setup?org=${org.org_id}`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to create organisation')
      setLoading(false)
    }
  }

  return (
    <div className="pub-card">
      <div className="flex items-center gap-2 mb-6">
        {(['account', 'verify', 'organisation'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${
              ['account', 'verify', 'organisation'].indexOf(step) >= i ? 'bg-blue-600' : 'bg-slate-200'
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
              <Link href="/terms" className="underline hover:text-slate-600">Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>.
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

