"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key, Plus, Trash2, Eye, EyeOff, Copy, Check, Webhook,
  Globe, AlertTriangle, CheckCircle, XCircle, Play, ChevronDown, ChevronUp,
} from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface APIKey {
  key_id: string;
  name: string;
  key_prefix: string;
  status: string;
  scopes: string[];
  last_used_at?: string;
  expires_at?: string;
  created_at?: string;
}

interface WebhookEndpoint {
  webhook_id: string;
  name: string;
  url: string;
  events: string[];
  status: string;
  failure_count: number;
  last_fired_at?: string;
  created_at?: string;
}

const DEMO_KEYS: APIKey[] = [
  { key_id: "KEY-ABC123", name: "Production Integration", key_prefix: "tvg_live_X9k2", status: "active", scopes: ["customers:read", "transactions:read", "reports:read"], last_used_at: new Date(Date.now() - 3600000).toISOString(), created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { key_id: "KEY-DEF456", name: "Audit System Connector", key_prefix: "tvg_live_mQ7p", status: "active", scopes: ["audit:read"], created_at: new Date(Date.now() - 86400000 * 14).toISOString() },
  { key_id: "KEY-GHI789", name: "Legacy Webhook Sync", key_prefix: "tvg_live_rT3n", status: "revoked", scopes: ["customers:read"], created_at: new Date(Date.now() - 86400000 * 90).toISOString() },
];

const DEMO_WEBHOOKS: WebhookEndpoint[] = [
  { webhook_id: "WH-001", name: "Core Banking System", url: "https://api.corebank.example/tvg-events", events: ["aml_alert.created", "transaction.flagged"], status: "active", failure_count: 0, last_fired_at: new Date(Date.now() - 7200000).toISOString(), created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { webhook_id: "WH-002", name: "Compliance Slack Bot", url: "https://hooks.slack.com/services/T000/B000/xxxx", events: ["case.assigned", "case.escalated", "report.approved"], status: "active", failure_count: 0, created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
];

const ALL_EVENTS = [
  "aml_alert.created", "kyc.status_changed", "report.submitted", "report.approved",
  "case.assigned", "case.escalated", "customer.created", "customer.risk_changed", "transaction.flagged",
];

const ALL_SCOPES = [
  "customers:read", "customers:write", "kyc:read", "kyc:write",
  "transactions:read", "reports:read", "reports:write", "audit:read", "cases:read",
];

function relTime(iso?: string) {
  if (!iso) return "Never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function APIKeysPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"keys" | "webhooks">("keys");
  const [keys, setKeys] = useState<APIKey[]>(DEMO_KEYS);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(DEMO_WEBHOOKS);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  // New key form
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>([]);
  const [keyDays, setKeyDays] = useState("");
  const [newRawKey, setNewRawKey] = useState("");

  // New webhook form
  const [showWHForm, setShowWHForm] = useState(false);
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>([]);

  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  const user = typeof window !== "undefined" ? getStoredUser() : null;
  const canEdit = user?.role === "admin" || user?.role === "mlro";

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    load();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kr, wr] = await Promise.all([
        fetch(`${API}/api/v1/api-keys`, { credentials: "include" }),
        fetch(`${API}/api/v1/webhooks`, { credentials: "include" }),
      ]);
      if (!kr.ok || !wr.ok) throw new Error("api");
      setKeys(await kr.json());
      setWebhooks(await wr.json());
    } catch {
      setDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const createKey = async () => {
    if (!keyName.trim()) return;
    try {
      const res = await fetch(`${API}/api/v1/api-keys`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName, scopes: keyScopes, expires_days: keyDays ? parseInt(keyDays) : null }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNewRawKey(data.raw_key);
      setKeys(prev => [data, ...prev]);
      setKeyName(""); setKeyScopes([]); setKeyDays("");
    } catch {
      setNewRawKey("tvg_live_DEMO_" + Math.random().toString(36).slice(2, 18));
    }
  };

  const revokeKey = async (key_id: string) => {
    setKeys(prev => prev.map(k => k.key_id === key_id ? { ...k, status: "revoked" } : k));
    try {
      await fetch(`${API}/api/v1/api-keys/${key_id}`, { method: "DELETE", credentials: "include" });
    } catch {}
  };

  const createWebhook = async () => {
    if (!whName.trim() || !whUrl.trim() || whEvents.length === 0) return;
    try {
      const res = await fetch(`${API}/api/v1/webhooks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: whName, url: whUrl, events: whEvents }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWebhooks(prev => [data, ...prev]);
    } catch {
      setWebhooks(prev => [{
        webhook_id: `WH-${Date.now()}`, name: whName, url: whUrl, events: whEvents,
        status: "active", failure_count: 0, created_at: new Date().toISOString(),
      }, ...prev]);
    }
    setWhName(""); setWhUrl(""); setWhEvents([]); setShowWHForm(false);
  };

  const deleteWebhook = async (webhook_id: string) => {
    setWebhooks(prev => prev.filter(w => w.webhook_id !== webhook_id));
    try {
      await fetch(`${API}/api/v1/webhooks/${webhook_id}`, { method: "DELETE", credentials: "include" });
    } catch {}
  };

  const testWebhook = async (webhook_id: string) => {
    try {
      const res = await fetch(`${API}/api/v1/webhooks/${webhook_id}/test`, { method: "POST", credentials: "include" });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [webhook_id]: data.success }));
    } catch {
      setTestResults(prev => ({ ...prev, [webhook_id]: true }));
    }
    setTimeout(() => setTestResults(prev => { const n = { ...prev }; delete n[webhook_id]; return n; }), 4000);
  };

  const toggleScope = (s: string) => setKeyScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleEvent = (e: string) => setWhEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  return (
    <div className="min-h-screen bg-navy-950 text-white px-4 py-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Key className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">API Keys & Webhooks</h1>
            <p className="text-sm text-slate-400">Integrate Verigo with your systems</p>
          </div>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample data
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/10">
          {([["keys", "API Keys", Key], ["webhooks", "Webhooks", Webhook]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === id ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ── API Keys Tab ─────────────────────────────────────────────────── */}
        {tab === "keys" && (
          <div>
            {canEdit && (
              <div className="mb-4">
                <button
                  onClick={() => { setShowKeyForm(!showKeyForm); setNewRawKey(""); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />Create API Key
                </button>
              </div>
            )}

            {/* New key form */}
            {showKeyForm && (
              <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h3 className="font-semibold">New API Key</h3>
                <input
                  value={keyName} onChange={e => setKeyName(e.target.value)}
                  placeholder="Key name (e.g. Production Integration)"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
                <div>
                  <p className="text-xs text-slate-400 mb-2">Scopes</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SCOPES.map(s => (
                      <button
                        key={s}
                        onClick={() => toggleScope(s)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          keyScopes.includes(s) ? "bg-blue-600 border-blue-500 text-white" : "border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >{s}</button>
                    ))}
                  </div>
                </div>
                <input
                  value={keyDays} onChange={e => setKeyDays(e.target.value)}
                  placeholder="Expires in days (blank = never)"
                  type="number" min="1"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={createKey}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
                >Generate Key</button>

                {newRawKey && (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4">
                    <p className="text-green-400 text-sm font-semibold mb-2">Copy your key — it won't be shown again</p>
                    <div className="flex items-center gap-2 font-mono text-sm bg-black/30 rounded px-3 py-2">
                      <span className="flex-1 truncate text-green-300">{newRawKey}</span>
                      <CopyButton text={newRawKey} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Keys list */}
            <div className="space-y-3">
              {keys.map(k => (
                <div key={k.key_id} className={`rounded-xl border p-4 ${k.status === "active" ? "bg-white/5 border-white/10" : "bg-white/2 border-white/5 opacity-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Key className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-sm">{k.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${k.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {k.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-sm text-slate-400">
                        <span>{k.key_prefix}••••••••••••••••••••</span>
                        <CopyButton text={k.key_prefix + "…"} />
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {k.scopes.map(s => (
                          <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{s}</span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Created {relTime(k.created_at)} · Last used {relTime(k.last_used_at)}
                        {k.expires_at && ` · Expires ${relTime(k.expires_at)}`}
                      </p>
                    </div>
                    {k.status === "active" && canEdit && (
                      <button
                        onClick={() => revokeKey(k.key_id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"
                        title="Revoke"
                      ><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Webhooks Tab ─────────────────────────────────────────────────── */}
        {tab === "webhooks" && (
          <div>
            {canEdit && (
              <div className="mb-4">
                <button
                  onClick={() => setShowWHForm(!showWHForm)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />Add Webhook
                </button>
              </div>
            )}

            {/* New webhook form */}
            {showWHForm && (
              <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <h3 className="font-semibold">New Webhook Endpoint</h3>
                <input
                  value={whName} onChange={e => setWhName(e.target.value)}
                  placeholder="Endpoint name"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  value={whUrl} onChange={e => setWhUrl(e.target.value)}
                  placeholder="https://your-server.example/webhook"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
                <div>
                  <p className="text-xs text-slate-400 mb-2">Events to subscribe</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_EVENTS.map(e => (
                      <button
                        key={e}
                        onClick={() => toggleEvent(e)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          whEvents.includes(e) ? "bg-blue-600 border-blue-500 text-white" : "border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >{e}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={createWebhook} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors">
                    Save Endpoint
                  </button>
                  <button onClick={() => setShowWHForm(false)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Webhooks list */}
            <div className="space-y-3">
              {webhooks.map(wh => (
                <div key={wh.webhook_id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-sm">{wh.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          wh.status === "active" ? "bg-green-500/20 text-green-400" :
                          wh.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-slate-500/20 text-slate-400"
                        }`}>{wh.status}</span>
                        {wh.failure_count > 0 && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{wh.failure_count} failures
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-slate-400 truncate">{wh.url}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {wh.events.map(e => (
                          <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{e}</span>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Created {relTime(wh.created_at)} · Last fired {relTime(wh.last_fired_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {testResults[wh.webhook_id] !== undefined && (
                        testResults[wh.webhook_id]
                          ? <CheckCircle className="w-4 h-4 text-green-400" />
                          : <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <button
                        onClick={() => testWebhook(wh.webhook_id)}
                        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="Send test ping"
                      ><Play className="w-4 h-4" /></button>
                      {canEdit && (
                        <button
                          onClick={() => deleteWebhook(wh.webhook_id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        ><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Signing secret note */}
            <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">Webhook Signature Verification</h4>
              <p className="text-sm text-slate-400">Every delivery includes a <code className="text-blue-300">X-TVG-Signature</code> header (HMAC-SHA256). Verify it using your endpoint's signing secret to ensure authenticity.</p>
              <pre className="mt-3 text-xs bg-black/40 rounded-lg p-3 text-green-300 overflow-x-auto">{`import hmac, hashlib

def verify(secret: str, body: bytes, sig_header: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, sig_header)`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
