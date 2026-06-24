"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

interface OrgIntegration {
  id: string;
  provider_id: string;
  provider_slug: string;
  is_enabled: boolean;
  credentials_configured: boolean;
  credential_expires_at: string | null;
  oauth_connected: boolean;
  oauth_expires_at: string | null;
  health_status: string;
  consecutive_failures: number;
  usage_count: number;
  last_used_at: string | null;
}

interface Provider {
  id: string;
  slug: string;
  name: string;
  category: string;
  integration_type: string;
  auth_type: string;
  description: string;
  capabilities: string[];
  required_credentials: { key: string; label: string; secret?: boolean }[];
  org_integration: OrgIntegration | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  kyc: "KYC",
  screening: "Screening",
  corporate_registry: "Company Registry",
  address_validation: "Address Validation",
  credit_financial: "Credit Checks",
  crm: "CRM",
  storage: "Storage",
  communications: "Communications",
  other: "Other",
};

const HEALTH_COLOURS: Record<string, string> = {
  healthy: "text-green-400 bg-green-900/30",
  degraded: "text-amber-400 bg-amber-900/30",
  down: "text-red-400 bg-red-900/30",
  unknown: "text-gray-400 bg-gray-800",
};

function ConnectionWizard({
  provider,
  onClose,
  onDone,
}: {
  provider: Provider;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ test_passed: boolean; message: string } | null>(null);
  const [err, setErr] = useState("");

  const isOAuth = provider.auth_type === "oauth2";
  const creds = provider.required_credentials.length
    ? provider.required_credentials
    : [{ key: "api_key", label: "API Key", secret: true }];

  const startOAuth = async () => {
    setSaving(true);
    setErr("");
    try {
      const r = await apiFetch(`/api/v1/integrations/${provider.slug}/oauth/authorize`, { method: "POST" });
      // In production this would window.location to r.authorize_url and the
      // provider would redirect back with ?code=&state=. Mocked here with a
      // synthetic code so the round trip can be demonstrated end-to-end.
      const code = `demo_${Date.now()}`;
      await apiFetch(`/api/v1/integrations/${provider.slug}/oauth/callback`, {
        method: "POST",
        body: JSON.stringify({ code, state: r.state }),
      });
      onDone();
      onClose();
    } catch (e: unknown) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveAndTest = async () => {
    if (creds.some((c) => !fields[c.key]?.trim())) {
      setErr("Fill in all required fields");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await apiFetch(`/api/v1/integrations/${provider.slug}/enable`, {
        method: "POST",
        body: JSON.stringify({
          credentials: fields,
          config: {},
          credential_expires_at: expiresAt || null,
        }),
      });
      const r = await apiFetch(`/api/v1/integrations/${provider.slug}/test`, { method: "POST" });
      setTestResult(r);
      setStep(3);
    } catch (e: unknown) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold">Connect {provider.name}</h3>
          <span className="text-xs text-gray-500">Step {step} of {isOAuth ? 1 : 3}</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">{provider.description}</p>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

        {isOAuth ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              {provider.name} uses OAuth2. You&apos;ll be redirected to sign in and grant
              VeriGo access; no API key is stored.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded text-sm">Cancel</button>
              <button onClick={startOAuth} disabled={saving}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold disabled:opacity-50">
                {saving ? "Connecting…" : `Connect with ${provider.name}`}
              </button>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-3">
            {creds.map((c) => (
              <div key={c.key}>
                <label className="text-xs text-gray-400 mb-1 block">{c.label}</label>
                <input
                  type={c.secret ? "password" : "text"}
                  value={fields[c.key] || ""}
                  onChange={(e) => setFields({ ...fields, [c.key]: e.target.value })}
                  placeholder={`Enter ${c.label}`}
                  className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm font-mono"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Credential expiry (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                If this provider issues keys with a known expiry, set it here to get an alert
                30 days before it lapses.
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded text-sm">Cancel</button>
              <button onClick={saveAndTest} disabled={saving}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold disabled:opacity-50">
                {saving ? "Saving…" : "Save & Test Connection"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-lg px-4 py-3 text-sm ${testResult?.test_passed ? "bg-green-900/30 text-green-300" : "bg-red-900/30 text-red-300"}`}>
              {testResult?.test_passed ? "✓ " : "✗ "} {testResult?.message}
            </div>
            <button onClick={() => { onDone(); onClose(); }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RotateModal({ provider, onClose, onDone }: { provider: Provider; onClose: () => void; onDone: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("Scheduled rotation");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const creds = provider.required_credentials.length
    ? provider.required_credentials
    : [{ key: "api_key", label: "API Key", secret: true }];

  const rotate = async () => {
    setSaving(true);
    setErr("");
    try {
      await apiFetch(`/api/v1/integrations/${provider.slug}/rotate-credentials`, {
        method: "POST",
        body: JSON.stringify({ new_credentials: fields, reason }),
      });
      onDone();
      onClose();
    } catch (e: unknown) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-bold mb-4">Rotate {provider.name} Credentials</h3>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <div className="space-y-3">
          {creds.map((c) => (
            <input key={c.key} type="password" placeholder={`New ${c.label}`}
              value={fields[c.key] || ""}
              onChange={(e) => setFields({ ...fields, [c.key]: e.target.value })}
              className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm font-mono" />
          ))}
          <input value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rotation"
            className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded text-sm">Cancel</button>
          <button onClick={rotate} disabled={saving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold disabled:opacity-50">
            {saving ? "Rotating…" : "Rotate"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsHubPage() {
  const [tab, setTab] = useState<"marketplace" | "dashboard" | "audit">("marketplace");
  const [byCategory, setByCategory] = useState<Record<string, Provider[]>>({});
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [wizardProvider, setWizardProvider] = useState<Provider | null>(null);
  const [rotateProvider, setRotateProvider] = useState<Provider | null>(null);
  const [monitoring, setMonitoring] = useState<Record<string, unknown> | null>(null);
  const [auditLog, setAuditLog] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCatalog = () => {
    setLoading(true);
    apiFetch(`/api/v1/integrations/catalog${search ? `?search=${encodeURIComponent(search)}` : ""}`)
      .then((r) => setByCategory(r.by_category))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadMonitoring = () => {
    apiFetch("/api/v1/integrations/monitoring").then(setMonitoring).catch((e) => setError(e.message));
  };

  const loadAudit = () => {
    apiFetch("/api/v1/integrations/audit-log").then(setAuditLog).catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadCatalog();
    loadMonitoring();
  }, []);

  useEffect(() => {
    if (tab === "dashboard") loadMonitoring();
    if (tab === "audit") loadAudit();
  }, [tab]);

  const allProviders = useMemo(() => Object.values(byCategory).flat(), [byCategory]);
  const visibleCategories = activeCategory === "all" ? Object.keys(byCategory) : [activeCategory];
  const expiring = (monitoring?.expiring_within_30_days as { provider_slug: string; credential_type: string; expires_at: string }[]) || [];

  return (
    <div className="min-h-screen bg-[#060d1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Integrations Hub</h1>
            <p className="text-gray-400 text-sm mt-1">
              Connect KYC, screening, registry, CRM, storage, and communications providers.
            </p>
          </div>
          <div className="flex gap-2">
            {(["marketplace", "dashboard", "audit"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-blue-600" : "bg-[#0d1b2e] border border-[#1e3a5f] text-gray-400"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {expiring.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
            <span className="font-semibold">{expiring.length} credential(s) expiring within 30 days:</span>{" "}
            {expiring.map((e) => `${e.provider_slug} (${e.credential_type})`).join(", ")}
            <button
              onClick={async () => { await apiFetch("/api/v1/integrations/expiry-check", { method: "POST" }); loadMonitoring(); }}
              className="ml-3 underline">re-check</button>
          </div>
        )}

        {tab === "marketplace" && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <button onClick={() => setActiveCategory("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeCategory === "all" ? "bg-blue-600" : "bg-[#0d1b2e] border border-[#1e3a5f] text-gray-400"}`}>
                All ({allProviders.length})
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) =>
                byCategory[key]?.length ? (
                  <button key={key} onClick={() => setActiveCategory(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${activeCategory === key ? "bg-blue-600" : "bg-[#0d1b2e] border border-[#1e3a5f] text-gray-400"}`}>
                    {label} ({byCategory[key].length})
                  </button>
                ) : null
              )}
              <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadCatalog()}
                placeholder="Search providers…"
                className="ml-auto bg-[#0d1b2e] border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-sm" />
            </div>

            {loading && <p className="text-gray-500 text-sm">Loading…</p>}

            <div className="space-y-8">
              {visibleCategories.map((cat) => byCategory[cat] ? (
                <div key={cat}>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
                    {CATEGORY_LABELS[cat] || cat}
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {byCategory[cat].map((p) => {
                      const oi = p.org_integration;
                      const connected = oi?.is_enabled && (oi.credentials_configured);
                      return (
                        <div key={p.slug} className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-4 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">{p.name}</span>
                            {connected ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEALTH_COLOURS[oi!.health_status]}`}>
                                {oi!.health_status}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">not connected</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] uppercase text-gray-600 font-mono">{p.auth_type}</span>
                            {connected ? (
                              <div className="flex gap-2">
                                <button onClick={() => setRotateProvider(p)} className="text-xs text-blue-400 hover:text-blue-300">Rotate</button>
                                <button
                                  onClick={async () => { await apiFetch(`/api/v1/integrations/${p.slug}/disable`, { method: "POST" }); loadCatalog(); }}
                                  className="text-xs text-red-400 hover:text-red-300">Disable</button>
                              </div>
                            ) : (
                              <button onClick={() => setWizardProvider(p)} className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                                Connect →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null)}
            </div>
          </>
        )}

        {tab === "dashboard" && monitoring && (
          <div>
            <div className="grid sm:grid-cols-4 gap-3 mb-6">
              {([
                ["Total", monitoring.total_integrations],
                ["Enabled", monitoring.enabled_count],
                ["Healthy", monitoring.healthy_count],
                ["Degraded/Down", monitoring.degraded_or_down_count],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold">{val}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              {(monitoring.integrations as Record<string, unknown>[]).map((i) => (
                <div key={i.provider_slug as string} className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-lg px-4 py-3 flex items-center justify-between text-sm">
                  <span>{i.provider_name as string}</span>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className={`px-2 py-0.5 rounded-full ${HEALTH_COLOURS[i.health_status as string]}`}>{i.health_status as string}</span>
                    <span>{i.usage_count as number} calls</span>
                    <span>{i.consecutive_failures as number} failures</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="grid gap-2">
            {auditLog.map((l) => (
              <div key={l.id as string} className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-gray-500">{l.provider_slug as string}</span>{" "}
                  <span className="font-semibold">{l.event_type as string}</span>
                  <p className="text-xs text-gray-500">{l.message as string}</p>
                </div>
                <span className={`text-xs ${l.success ? "text-green-400" : "text-red-400"}`}>
                  {l.success ? "✓" : "✗"} {new Date(l.created_at as string).toLocaleString()}
                </span>
              </div>
            ))}
            {auditLog.length === 0 && <p className="text-gray-500 text-sm">No audit events yet.</p>}
          </div>
        )}

        {wizardProvider && (
          <ConnectionWizard provider={wizardProvider} onClose={() => setWizardProvider(null)} onDone={loadCatalog} />
        )}
        {rotateProvider && (
          <RotateModal provider={rotateProvider} onClose={() => setRotateProvider(null)} onDone={loadCatalog} />
        )}
      </div>
    </div>
  );
}
