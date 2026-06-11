'use client'
import { useState, useEffect } from 'react'
import { Building2, Search, CheckCircle, XCircle, Clock, Shield, ChevronRight, Globe, Phone, Mail, Hash, AlertTriangle, Edit2, Save, X } from 'lucide-react'
import clsx from 'clsx'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Tenant {
  tenant_id: string
  industry_id: string
  name: string
  display_name?: string
  status: string
  pack_id?: string
  contact_email?: string
  contact_name?: string
  phone?: string
  abn?: string
  austrac_id?: string
  settings?: Record<string, unknown>
  branding?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

const DEMO_TENANTS: Tenant[] = [
  { tenant_id: 'TENANT-DCE001', industry_id: 'dce', name: 'CryptoEdge Pty Ltd', display_name: 'CryptoEdge', status: 'active', pack_id: 'pack-dce', contact_email: 'compliance@cryptoedge.com.au', contact_name: 'Sarah Mitchell', phone: '+61 2 9876 5432', abn: '12 345 678 901', austrac_id: 'DCE-2024-001234', created_at: new Date(Date.now() - 86400000 * 90).toISOString() },
  { tenant_id: 'TENANT-REM002', industry_id: 'remittance', name: 'GlobalSend Finance', display_name: 'GlobalSend', status: 'active', pack_id: 'pack-remittance', contact_email: 'aml@globalsend.com.au', contact_name: 'James Nguyen', phone: '+61 3 8765 4321', abn: '98 765 432 109', austrac_id: 'REM-2024-005678', created_at: new Date(Date.now() - 86400000 * 60).toISOString() },
  { tenant_id: 'TENANT-FX003', industry_id: 'fx_dealer', name: 'AusFX Trading Pty Ltd', display_name: 'AusFX', status: 'active', pack_id: 'pack-fx', contact_email: 'kyc@ausfx.com.au', contact_name: 'Emma Brown', phone: '+61 7 5432 1098', abn: '55 444 333 222', austrac_id: 'FX-2024-009012', created_at: new Date(Date.now() - 86400000 * 45).toISOString() },
  { tenant_id: 'TENANT-RE004', industry_id: 'real_estate', name: 'Premier Properties Group', display_name: 'Premier Properties', status: 'suspended', pack_id: 'pack-real-estate', contact_email: 'compliance@premierprops.com.au', contact_name: 'David Chen', phone: '+61 8 6543 2109', abn: '77 888 999 000', created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { tenant_id: 'TENANT-ACC005', industry_id: 'accountant', name: 'Clarity Accounting Partners', display_name: 'Clarity Accounting', status: 'pending', pack_id: 'pack-accountant', contact_email: 'admin@clarityaccounting.com.au', contact_name: 'Lisa Park', phone: '+61 2 1234 5678', abn: '33 222 111 000', created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
]

const INDUSTRY_LABELS: Record<string, string> = {
  dce: 'Digital Currency Exchange',
  remittance: 'Remittance Provider',
  fx_dealer: 'FX Dealer',
  real_estate: 'Real Estate',
  accountant: 'Accountant',
  lawyer: 'Legal Services',
  casino: 'Casino / Gaming',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  suspended: 'bg-red-500/20 text-red-300 border border-red-500/30',
  pending: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
}
const STATUS_ICON: Record<string, React.ReactNode> = {
  active: <CheckCircle className="w-3 h-3" />,
  suspended: <XCircle className="w-3 h-3" />,
  pending: <Clock className="w-3 h-3" />,
}

const PACK_LABELS: Record<string, string> = {
  'pack-dce': 'DCE Pack',
  'pack-remittance': 'Remittance Pack',
  'pack-fx': 'FX Dealer Pack',
  'pack-real-estate': 'Real Estate Pack',
  'pack-accountant': 'Accountant Pack',
  'pack-lawyer': 'Legal Services Pack',
}
const PACKS = Object.entries(PACK_LABELS).map(([id, label]) => ({ id, label }))

const DEFAULT_FORM = { industry_id: '', name: '', display_name: '', contact_email: '', contact_name: '', phone: '', abn: '', austrac_id: '', pack_id: '', status: 'pending' }

export default function IndustryPage() {
  const [tenants, setTenants] = useState<Tenant[]>(DEMO_TENANTS)
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [tab, setTab] = useState<'list' | 'new'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Tenant>>({})
  const [newForm, setNewForm] = useState({ ...DEFAULT_FORM })
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ total: 5, active: 3, suspended: 1, pending: 1 })

  useEffect(() => {
    fetch(`${API}/api/v1/tenants/`).then(r => r.ok ? r.json() : null).then(d => d && setTenants(d)).catch(() => {})
    fetch(`${API}/api/v1/tenants/stats`).then(r => r.ok ? r.json() : null).then(d => d && setStats(d)).catch(() => {})
  }, [])

  const filtered = tenants.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.industry_id.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  async function doAction(tenantId: string, action: 'suspend' | 'activate') {
    try {
      const r = await fetch(`${API}/api/v1/tenants/${tenantId}/${action}`, { method: 'POST' })
      if (r.ok) {
        const updated: Tenant = await r.json()
        setTenants(prev => prev.map(t => t.tenant_id === tenantId ? updated : t))
        if (selected?.tenant_id === tenantId) setSelected(updated)
      }
    } catch {
      const newStatus = action === 'suspend' ? 'suspended' : 'active'
      setTenants(prev => prev.map(t => t.tenant_id === tenantId ? { ...t, status: newStatus } : t))
      if (selected?.tenant_id === tenantId) setSelected(s => s ? { ...s, status: newStatus } : s)
    }
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    try {
      const r = await fetch(`${API}/api/v1/tenants/${selected.tenant_id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) })
      const updated: Tenant = r.ok ? await r.json() : { ...selected, ...editForm }
      setTenants(prev => prev.map(t => t.tenant_id === selected.tenant_id ? updated : t))
      setSelected(updated)
    } catch {
      const patched = { ...selected, ...editForm }
      setTenants(prev => prev.map(t => t.tenant_id === selected.tenant_id ? patched : t))
      setSelected(patched)
    } finally { setSaving(false); setEditing(false) }
  }

  async function createTenant() {
    setSaving(true)
    try {
      const r = await fetch(`${API}/api/v1/tenants/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newForm) })
      const t: Tenant = r.ok ? await r.json() : { ...newForm, tenant_id: `TENANT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, created_at: new Date().toISOString() }
      setTenants(prev => [t, ...prev])
      setSelected(t)
    } catch {
      const fake: Tenant = { ...newForm, tenant_id: `TENANT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, created_at: new Date().toISOString() }
      setTenants(prev => [fake, ...prev])
      setSelected(fake)
    } finally { setSaving(false); setNewForm({ ...DEFAULT_FORM }); setTab('list') }
  }

  return (
    <main className="min-h-screen bg-navy-950 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-brand-600/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Industry Management</h1>
              <p className="text-sm text-white/50">Multi-tenant compliance configuration</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Tenants', value: stats.total, color: 'text-white' },
            { label: 'Active', value: stats.active, color: 'text-emerald-400' },
            { label: 'Suspended', value: stats.suspended, color: 'text-red-400' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-navy-800 border border-white/5 rounded-xl p-4">
              <div className={clsx('text-2xl font-bold', s.color)}>{s.value}</div>
              <div className="text-xs text-white/50 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          {(['list', 'new'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors', tab === t ? 'bg-brand-600 text-white' : 'bg-navy-800 text-white/60 hover:text-white')}>
              {t === 'list' ? 'Tenant List' : '+ New Tenant'}
            </button>
          ))}
        </div>

        {tab === 'list' && (
          <div className="flex gap-6 flex-col lg:flex-row">
            <div className={clsx('flex-1 min-w-0', selected && 'hidden lg:block')}>
              <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants..." className="field-input pl-9 w-full" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field-input">
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="space-y-3">
                {filtered.map(t => (
                  <button key={t.tenant_id} onClick={() => { setSelected(t); setEditing(false) }}
                    className={clsx('w-full text-left bg-navy-800 border rounded-xl p-4 transition-all hover:border-brand-500/50', selected?.tenant_id === t.tenant_id ? 'border-brand-500' : 'border-white/5')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white text-sm truncate">{t.name}</span>
                          <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0', STATUS_COLOR[t.status])}>
                            {STATUS_ICON[t.status]} {t.status}
                          </span>
                        </div>
                        <div className="text-xs text-white/40">{INDUSTRY_LABELS[t.industry_id] ?? t.industry_id}</div>
                        <div className="text-xs text-white/30 mt-1">{t.tenant_id}</div>
                        {t.pack_id && <div className="text-xs text-brand-400 mt-1">{PACK_LABELS[t.pack_id] ?? t.pack_id}</div>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30 shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && <div className="text-center py-12 text-white/30 text-sm">No tenants match your filters</div>}
              </div>
            </div>

            {selected && (
              <div className="w-full lg:w-[420px] shrink-0">
                <div className="bg-navy-800 border border-white/5 rounded-xl overflow-hidden sticky top-24">
                  <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{selected.display_name ?? selected.name}</div>
                      <div className="text-xs text-white/40">{selected.tenant_id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!editing && (
                        <button onClick={() => { setEditing(true); setEditForm({ name: selected.name, display_name: selected.display_name, contact_email: selected.contact_email, contact_name: selected.contact_name, phone: selected.phone, abn: selected.abn, austrac_id: selected.austrac_id, pack_id: selected.pack_id }) }}
                          className="p-1.5 rounded-lg bg-navy-700 text-white/60 hover:text-white">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg bg-navy-700 text-white/60 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <span className={clsx('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium', STATUS_COLOR[selected.status])}>
                        {STATUS_ICON[selected.status]} {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                      </span>
                      <div className="flex gap-2">
                        {selected.status !== 'active' && <button onClick={() => doAction(selected.tenant_id, 'activate')} className="px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 text-xs hover:bg-emerald-600/30">Activate</button>}
                        {selected.status === 'active' && <button onClick={() => doAction(selected.tenant_id, 'suspend')} className="px-3 py-1 rounded-lg bg-red-600/20 text-red-300 text-xs hover:bg-red-600/30">Suspend</button>}
                      </div>
                    </div>
                    {editing ? (
                      <div className="space-y-3">
                        {[
                          { label: 'Organisation Name', key: 'name' as const, type: 'text' },
                          { label: 'Display Name', key: 'display_name' as const, type: 'text' },
                          { label: 'Contact Name', key: 'contact_name' as const, type: 'text' },
                          { label: 'Contact Email', key: 'contact_email' as const, type: 'email' },
                          { label: 'Phone', key: 'phone' as const, type: 'text' },
                          { label: 'ABN', key: 'abn' as const, type: 'text' },
                          { label: 'AUSTRAC ID', key: 'austrac_id' as const, type: 'text' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="text-xs text-white/50 block mb-1">{f.label}</label>
                            <input type={f.type} value={(editForm as any)[f.key] ?? ''} onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))} className="field-input w-full" />
                          </div>
                        ))}
                        <div>
                          <label className="text-xs text-white/50 block mb-1">Compliance Pack</label>
                          <select value={editForm.pack_id ?? ''} onChange={e => setEditForm(f => ({ ...f, pack_id: e.target.value }))} className="field-input w-full">
                            <option value="">None assigned</option>
                            {PACKS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={saveEdit} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm disabled:opacity-50">
                            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
                          </button>
                          <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg bg-navy-700 text-white/60 hover:text-white text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {[
                          { icon: <Globe className="w-4 h-4" />, label: 'Industry', value: INDUSTRY_LABELS[selected.industry_id] ?? selected.industry_id },
                          { icon: <Shield className="w-4 h-4" />, label: 'Compliance Pack', value: selected.pack_id ? (PACK_LABELS[selected.pack_id] ?? selected.pack_id) : 'None assigned' },
                          { icon: <Mail className="w-4 h-4" />, label: 'Contact', value: selected.contact_name ? `${selected.contact_name}${selected.contact_email ? ` — ${selected.contact_email}` : ''}` : (selected.contact_email ?? '—') },
                          { icon: <Phone className="w-4 h-4" />, label: 'Phone', value: selected.phone ?? '—' },
                          { icon: <Hash className="w-4 h-4" />, label: 'ABN', value: selected.abn ?? '—' },
                          { icon: <AlertTriangle className="w-4 h-4" />, label: 'AUSTRAC ID', value: selected.austrac_id ?? 'Not registered' },
                        ].map(row => (
                          <div key={row.label} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                            <div className="text-white/30 mt-0.5 shrink-0">{row.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-white/40">{row.label}</div>
                              <div className="text-sm text-white mt-0.5 truncate">{row.value}</div>
                            </div>
                          </div>
                        ))}
                        {!selected.austrac_id && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-300">AUSTRAC registration ID not set. Add this for regulatory reporting compliance.</p>
                          </div>
                        )}
                        {selected.created_at && <div className="text-xs text-white/30">Created {new Date(selected.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'new' && (
          <div className="max-w-2xl">
            <div className="bg-navy-800 border border-white/5 rounded-xl p-6 space-y-5">
              <h2 className="text-lg font-semibold text-white">Register New Industry Tenant</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Industry ID <span className="text-red-400">*</span></label>
                  <select value={newForm.industry_id} onChange={e => setNewForm(f => ({ ...f, industry_id: e.target.value }))} className="field-input w-full">
                    <option value="">Select industry…</option>
                    {Object.entries(INDUSTRY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Compliance Pack</label>
                  <select value={newForm.pack_id} onChange={e => setNewForm(f => ({ ...f, pack_id: e.target.value }))} className="field-input w-full">
                    <option value="">None</option>
                    {PACKS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-white/50 block mb-1">Organisation Name <span className="text-red-400">*</span></label>
                  <input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Pty Ltd" className="field-input w-full" />
                </div>
                {['display_name', 'contact_name', 'contact_email', 'phone', 'abn', 'austrac_id'].map(key => (
                  <div key={key}>
                    <label className="text-xs text-white/50 block mb-1">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                    <input value={(newForm as any)[key]} onChange={e => setNewForm(f => ({ ...f, [key]: e.target.value }))} className="field-input w-full" />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={createTenant} disabled={saving || !newForm.industry_id || !newForm.name}
                  className="px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create Tenant'}
                </button>
                <button onClick={() => setTab('list')} className="px-4 py-2.5 rounded-lg bg-navy-700 text-white/60 hover:text-white text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
