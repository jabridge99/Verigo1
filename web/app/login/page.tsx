'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, ArrowRight, Loader2, AlertCircle, Mail } from 'lucide-react'
import { loginWithPassword, requestMagicLink, verifyMagicLink } from '@/lib/auth'

type Mode = 'password' | 'magic-request' | 'magic-verify'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicToken, setMagicToken] = useState('')
  const [devToken, setDevToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWithPassword(email, password)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicRequest(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await requestMagicLink(email)
      setSent(true)
      if (res.dev_token) {
        setDevToken(res.dev_token)
        setMagicToken(res.dev_token)
      }
      setMode('magic-verify')
    } catch (err: any) {
      setError(err.message ?? 'Failed to send magic link')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await verifyMagicLink(magicToken)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Invalid magic link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-white/50 mt-2 text-sm">Sign in to your Verigo workspace</p>
        </div>

        <div className="card">
          <div className="flex gap-2 mb-6">
            {(['password', 'magic-request'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === m || (mode === 'magic-verify' && m === 'magic-request') ? 'bg-brand-600 text-white' : 'bg-navy-700 text-white/50 hover:text-white'}`}>
                {m === 'password' ? 'Password' : 'Magic Link'}
              </button>
            ))}
          </div>

          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="field-input" placeholder="jane@company.com.au" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm text-white/60">Password</label>
                  <button type="button" onClick={() => { setMode('magic-request'); setError('') }}
                    className="text-xs text-brand-400 hover:text-brand-300">Forgot password?</button>
                </div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="field-input" placeholder="••••••••••••" />
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {mode === 'magic-request' && (
            <form onSubmit={handleMagicRequest} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="field-input" placeholder="jane@company.com.au" />
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="btn-secondary w-full justify-center py-3 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" /><span>Send Magic Link</span></>}
              </button>
            </form>
          )}

          {mode === 'magic-verify' && (
            <form onSubmit={handleMagicVerify} className="space-y-4">
              {sent && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-300">Magic link created for <strong>{email}</strong>.</p>
                  {devToken && <p className="text-xs text-white/40 mt-1">Dev mode: token pre-filled below.</p>}
                </div>
              )}
              <div>
                <label className="block text-sm text-white/60 mb-1">Magic link token</label>
                <input type="text" value={magicToken} onChange={e => setMagicToken(e.target.value)} required
                  className="field-input font-mono text-xs" placeholder="Paste your magic link token" />
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Verify &amp; Sign In</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <button type="button" onClick={() => setMode('magic-request')}
                className="w-full text-center text-xs text-white/40 hover:text-white/60">
                ← Request a new link
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-white/40 text-sm mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/start-trial" className="text-brand-400 hover:text-brand-300">Start 7-day free trial</Link>
        </p>
      </div>
    </div>
  )
}
