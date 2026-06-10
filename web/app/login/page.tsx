import Link from 'next/link'
import { Shield, ArrowRight } from 'lucide-react'

export const metadata = { title: 'Login | Trust Verify Go' }

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-white/50 mt-2 text-sm">Sign in to your Trust Verify Go workspace</p>
        </div>
        <div className="card">
          <form className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Email address</label>
              <input type="email" className="field-input" placeholder="jane@company.com.au" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm text-white/60">Password</label>
                <Link href="#" className="text-xs text-brand-400 hover:text-brand-300">Forgot password?</Link>
              </div>
              <input type="password" className="field-input" placeholder="••••••••••••" />
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-3">Sign In <ArrowRight className="w-4 h-4" /></button>
          </form>
          <div className="relative my-6">
            <div className="border-t border-white/10" />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-navy-800 px-3 text-xs text-white/40">or</span>
          </div>
          <button className="btn-secondary w-full justify-center">Sign in with Magic Link (Email)</button>
        </div>
        <p className="text-center text-white/40 text-sm mt-6">
          Don&apos;t have an account? <Link href="/start-trial" className="text-brand-400 hover:text-brand-300">Start 7-day free trial</Link>
        </p>
      </div>
    </div>
  )
}
