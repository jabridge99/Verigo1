import React, { useState } from 'react'
import { Shield, CheckCircle, Clock, Upload, Camera, AlertCircle, ChevronRight, FileText, User } from 'lucide-react'

const STEPS = [
  { id: 'personal',  label: 'Personal Details',  icon: User,     status: 'done' },
  { id: 'document',  label: 'ID Document',        icon: FileText, status: 'done' },
  { id: 'selfie',    label: 'Selfie Verification', icon: Camera,   status: 'review' },
  { id: 'address',   label: 'Address Proof',       icon: FileText, status: 'pending' },
]

const INFO_ROWS = [
  { label: 'Full name',    value: 'Sarah Mitchell' },
  { label: 'Date of birth', value: '12 / 03 / 1991' },
  { label: 'Email',        value: 'sarah.m@email.com' },
  { label: 'Phone',        value: '+61 412 345 678' },
  { label: 'Address',      value: '24 Green St, Surry Hills NSW 2010' },
]

export default function KYC() {
  const [uploading, setUploading] = useState(null)
  const [uploaded,  setUploaded]  = useState({})

  const handleUpload = key => {
    setUploading(key)
    setTimeout(() => {
      setUploading(null)
      setUploaded(prev => ({ ...prev, [key]: true }))
    }, 1500)
  }

  const overallStatus = 'Under Review' // 'Verified' | 'Under Review' | 'Not Started'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">KYC & Identity</h1>
        <p className="text-sm text-slate-500 mt-0.5">Verify your identity to unlock full wallet features and higher withdrawal limits.</p>
      </div>

      {/* Status banner */}
      <div className={`rounded-2xl p-5 flex items-center gap-4 ${
        overallStatus === 'Verified'
          ? 'bg-eco-50 border border-eco-100'
          : 'bg-amber-50 border border-amber-100'
      }`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          overallStatus === 'Verified' ? 'bg-eco-100' : 'bg-amber-100'
        }`}>
          {overallStatus === 'Verified'
            ? <CheckCircle className="w-5 h-5 text-eco-700" />
            : <Clock className="w-5 h-5 text-amber-700" />
          }
        </div>
        <div>
          <div className={`font-semibold ${overallStatus === 'Verified' ? 'text-eco-900' : 'text-amber-900'}`}>
            {overallStatus === 'Verified' ? 'Identity Verified' : 'Verification Under Review'}
          </div>
          <div className={`text-sm mt-0.5 ${overallStatus === 'Verified' ? 'text-eco-700' : 'text-amber-700'}`}>
            {overallStatus === 'Verified'
              ? 'All documents approved. Full access unlocked.'
              : 'Your selfie is being reviewed. Usually complete within 24 hours.'
            }
          </div>
        </div>
      </div>

      {/* Progress steps */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Verification Steps</h2>
        <div className="space-y-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isDone    = s.status === 'done'
            const isReview  = s.status === 'review'
            const isPending = s.status === 'pending'
            return (
              <div key={s.id} className="flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isDone ? 'bg-eco-100' : isReview ? 'bg-amber-100' : 'bg-slate-100'
                }`}>
                  {isDone
                    ? <CheckCircle className="w-4 h-4 text-eco-700" />
                    : <Icon className={`w-4 h-4 ${isReview ? 'text-amber-600' : 'text-slate-400'}`} />
                  }
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{s.label}</div>
                  <div className="text-xs text-slate-400">
                    {isDone ? 'Approved' : isReview ? 'Under review' : 'Not started'}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isDone ? 'bg-eco-50 text-eco-700'
                  : isReview ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
                }`}>
                  {isDone ? 'Done' : isReview ? 'Review' : 'Pending'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Personal Details</h2>
        <div className="space-y-3">
          {INFO_ROWS.map(r => (
            <div key={r.label} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
              <span className="text-sm text-slate-500">{r.label}</span>
              <span className="text-sm font-semibold text-slate-900">{r.value}</span>
            </div>
          ))}
        </div>
        <button className="mt-4 text-sm font-semibold text-eco-700 hover:underline flex items-center gap-1">
          Request update <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Address proof upload */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Address Proof</h2>
        <p className="text-sm text-slate-500 mb-4">Upload a utility bill, bank statement, or government letter (dated within 3 months).</p>

        {uploaded.address ? (
          <div className="flex items-center gap-3 bg-eco-50 border border-eco-100 rounded-xl p-4">
            <CheckCircle className="w-5 h-5 text-eco-700 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-eco-900">Document uploaded</div>
              <div className="text-xs text-eco-700 mt-0.5">Pending review — typically 24 hours.</div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => handleUpload('address')}
            disabled={uploading === 'address'}
            className="w-full border-2 border-dashed border-slate-200 hover:border-eco-400 rounded-xl p-8 text-center transition-colors group"
          >
            {uploading === 'address' ? (
              <div className="text-sm text-slate-500">Uploading…</div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-slate-300 group-hover:text-eco-500 mx-auto mb-2 transition-colors" />
                <div className="text-sm font-semibold text-slate-700">Click to upload</div>
                <div className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG — max 10 MB</div>
              </>
            )}
          </button>
        )}
      </div>

      {/* Limits info */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Shield className="w-4 h-4" /> Verification Limits
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-500 mb-0.5">Monthly withdrawal</div>
            <div className="font-bold text-slate-900">$10,000</div>
            <div className="text-[11px] text-eco-700 mt-0.5">Verified tier</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-500 mb-0.5">Transfer limit</div>
            <div className="font-bold text-slate-900">Unlimited</div>
            <div className="text-[11px] text-eco-700 mt-0.5">Verified tier</div>
          </div>
        </div>
        <p className="text-xs text-slate-400">Unverified accounts: max $500/month withdrawal, $100 transfers.</p>
      </div>
    </div>
  )
}
