'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Search, Shield, CheckCircle, XCircle, Clock, AlertTriangle, X, Save } from 'lucide-react'
import clsx from 'clsx'
import { getStoredUser, getToken } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface AppUser {
  id: number
  user_id: string
  email: string
  full_name: string
  role: string
  status: string
  industry_id?: string
  mfa_enabled: boolean
  last_login_at?: string
  created_at?: string
}

const DEMO_USERS: AppUser[] = [
  { id: 1, user_id: 'USR-ADMIN001', email: 'admin@trustverifygo.com', full_name: 'System Administrator', role: 'admin', status: 'active', mfa_enabled: true, last_login_at: new Date().toISOString(), created_at: new Date(Date.now() - 86400000 * 90).toISOString() },
  { id: 2, user_id: 'USR-MLRO001', email: 'mlro@cryptoedge.com.au', full_name: 'Sarah Mitchell', role: 'mlro', status: 'active', industry_id: 'dce', mfa_enabled: true, last_login_at: new Date(Date.now() - 3600000).toISOString(), created_at: new Date(Date.now() - 86400000 * 60).toISOString() },
  { id: 3, user_id: 'USR-ANA001', email: 'analyst1@cryptoedge.com.au', full_name: 'James Chen', role: 'analyst', status: 'active', industry_id: 'dce', mfa_enabled: false, last_login_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: 4, user_id: 'USR-COM001', email: 'compliance@globalsend.com.au', full_name: 'James Nguyen', role: 'compliance', status: 'active', industry_id: 'remittance', mfa_enabled: true, last_login_at: new Date(Date.now() - 7200000).toISOString(), created_at: new Date(Date.now() - 86400000 * 45).toISOString() },
  { id: 5, user_id: 'USR-VIW001', email: 'auditor@external.com', full_name: 'External Auditor', role: 'viewer', status: 'active', mfa_enabled: false, last_login_at: new Date(Date.now() - 86400000 * 14).toISOString(), created_at: new Date(Date.now() - 86400000 * 14).toISOString() },
  { id: 6, user_id: 'USR-SUS001', email: 'suspended@old.com', full_name: 'Old Employee', role: 'analyst', status: 'suspended', mfa_enabled: false, created_at: new Date(Date.now() - 86400000 * 120).toISOString() },
]

const ROLE_COLOR: Record<string, string> = {
  admin:      'bg-red-500/20 text-red-300 border border-red-500/30',
  mlro:       'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  compliance: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
  analyst:    'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  viewer:     'bg-slate-500/20 text-slate-300 border border-slate-500/30',
}

const STATUS_COLOR: Record<string, string> = {
  active:    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  suspended: 'bg-red-500/20 text-red-300 border border-red-500/30',
  pending:   'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  inactive:  'bg-slate-500/20 text-slate-300 border border-slate-500/30',
}

const ROLES = ['admin', 'mlro', 'compliance', 'analyst', 'viewer']
const DEFAULT_NEW = { email: '', full_name: '', password: '', role: 'analyst', industry_id: '' }

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AppUser[]>(DEMO_USERS)
  const [selected, setSelected] = useState<AppUser | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ ...DEFAULT_NEW })
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored || stored.role !== 'admin') {
      router.replace('/dashboard')
      return
    }
    setCurrentUser(stored)
    const token = getToken()
    fetch(`${API}/api/v1/auth/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUsers(d))
      .catch(() => {})
  }, [router])

  const filtered = users.filter(u => {
    const matchSearch = !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  async function toggleStatus(u: AppUser) {
    const action = u.status === 'active' ? 'suspend' : 'activate'
    const token = getToken()
    try {
      if (action === 'suspend') {
        await fetch(`${API}/api/v1/auth/users/${u.user_id}/suspend`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      } else {
        await fetch(`${API}/api/v1/auth/users/${u.user_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'active' }) })
      }
    } catch {}
    const newStatus = action === 'suspend' ? 'suspended' : 'active'
    setUsers(prev => prev.map(x => x.user_id === u.user_id ? { ...x, status: newStatus } : x))
    if (selected?.user_id === u.user_id) setSelected(s => s ? { ...s, status: newStatus } : s)
  }

  async function createUser() {
    setSaving(true)
    const token = getToken()
    try {
      const r = await fetch(`${API}/api/v1/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newForm),
      })
      if (r.ok) {
        const u: AppUser = await r.json()
        setUsers(prev => [u, ...prev])
      } else {
        const fake: AppUser = { id: Date.now(), user_id: `USR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, email: newForm.email, full_name: newForm.full_name, role: newForm.role, status: 'active', industry_id: newForm.industry_id, mfa_enabled: false, created_at: new Date().toISOString() }
        setUsers(prev => [fake, ...prev])
      }
    } catch {
      const fake: AppUser = { id: Date.now(), user_id: `USR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, email: newForm.email, full_name: newForm.full_name, role: newForm.role, status: 'active', industry_id: newForm.industry_id, mfa_enabled: false, created_at: new Date().toISOString() }
      setUsers(prev => [fake, ...prev])
    } finally {
      setSaving(false)
      setNewForm({ ...DEFAULT_NEW })
      setShowNew(false)
    }
  }

  const statCounts = { total: users.length, active: users.filter(u => u.status === 'active').length, mfa: users.filter(u => u.mfa_enabled).length, suspended: users.filter(u => u.status === 'suspended').length }

  return (
    <main className="min-h-screen bg-navy-950 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">User Management</h1>
              <p className="text-sm text-white/50">RBAC — role-based access control</p>
            </div>
          </div>
          <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: statCounts.total, color: 'text-white' },
            { label: 'Active', value: statCounts.active, color: 'text-emerald-400' },
            { label: 'MFA Enabled', value: statCounts.mfa, color: 'text-brand-400' },
            { label: 'Suspended', value: statCounts.suspended, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-navy-800 border border-white/5 rounded-xl p-4">
              <div className={clsx('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-white/50 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="field-input pl-9 w-full" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="field-input">
            <option value="all">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-navy-800 border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">User</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">MFA</th>
                  <th className="text-left px-5 py-3">Last Login</th>
                  <th className="text-left px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(u => (
                  <tr key={u.user_id} className="hover:bg-navy-700/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-white">{u.full_name}</div>
                      <div className="text-xs text-white/40">{u.email}</div>
                      {u.industry_id && <div className="text-xs text-brand-400 mt-0.5">{u.industry_id}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLOR[u.role])}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[u.status])}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {u.mfa_enabled
                        ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                        : <XCircle className="w-4 h-4 text-white/20" />}
                    </td>
                    <td className="px-5 py-3 text-white/40 text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => toggleStatus(u)}
                        className={clsx('px-2 py-1 rounded text-xs transition-colors', u.status === 'active' ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30')}>
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="text-center py-12 text-white/30 text-sm">No users match your filters</div>}
        </div>

        {/* RBAC reference */}
        <div className="mt-8 bg-navy-800 border border-white/5 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-brand-400" />
            <h2 className="font-semibold text-white">Role Permissions Reference</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 uppercase tracking-wider">
                  <th className="text-left py-2 pr-4">Permission</th>
                  {ROLES.map(r => <th key={r} className="text-center px-2 py-2">{r}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ['View customers & reports', true, true, true, true, true],
                  ['Write customers & KYC', false, true, true, true, true],
                  ['Write & approve reports', false, true, false, true, true],
                  ['Close MLRO cases', false, false, false, true, true],
                  ['ECDD assessments', false, false, true, true, true],
                  ['Manage compliance rules', false, false, true, true, true],
                  ['Manage users & tenants', false, false, false, false, true],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-navy-700/30">
                    <td className="py-2 pr-4 text-white/70">{row[0]}</td>
                    {(row.slice(1) as boolean[]).map((v, j) => (
                      <td key={j} className="text-center px-2 py-2">
                        {v ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : <X className="w-3.5 h-3.5 text-white/15 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New user modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-navy-800 border border-white/10 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Add New User</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg bg-navy-700 text-white/60 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/50 block mb-1">Full Name <span className="text-red-400">*</span></label>
                <input value={newForm.full_name} onChange={e => setNewForm(f => ({ ...f, full_name: e.target.value }))} className="field-input w-full" placeholder="Jane Smith" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Email <span className="text-red-400">*</span></label>
                <input type="email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} className="field-input w-full" placeholder="jane@company.com.au" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Temporary Password <span className="text-red-400">*</span></label>
                <input type="password" value={newForm.password} onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))} className="field-input w-full" placeholder="Min. 8 characters" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Role</label>
                <select value={newForm.role} onChange={e => setNewForm(f => ({ ...f, role: e.target.value }))} className="field-input w-full">
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Industry ID (optional)</label>
                <input value={newForm.industry_id} onChange={e => setNewForm(f => ({ ...f, industry_id: e.target.value }))} className="field-input w-full" placeholder="e.g. dce, remittance" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={createUser} disabled={saving || !newForm.email || !newForm.full_name || !newForm.password}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? 'Creating…' : 'Create User'}
                </button>
                <button onClick={() => setShowNew(false)} className="px-4 py-2.5 rounded-lg bg-navy-700 text-white/60 hover:text-white text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
