"use client";

import { useState, useEffect } from "react";

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

interface Credential {
  credential_id: string; provider: string; label: string;
  key_hint: string; status: string; is_default: boolean;
  last_tested_at: string | null; last_error: string | null;
}

const PROVIDER_CATEGORIES: Record<string, { label: string; providers: string[] }> = {
  identity_verification: { label: "Identity Verification", providers: ["greenid", "sumsub", "trulioo", "jumio", "onfido"] },
  aml_sanctions: { label: "AML / Sanctions", providers: ["complyadvantage", "lexisnexis", "dowjones", "worldcheck"] },
  business_verification: { label: "Business Verification", providers: ["creditorwatch", "equifax_au"] },
  address: { label: "Address Validation", providers: ["loqate", "google_maps"] },
  communications: { label: "Communications", providers: ["sendgrid", "twilio"] },
};

const STATUS_COLOURS: Record<string, string> = {
  active: "text-green-400 bg-green-900/30",
  inactive: "text-gray-400 bg-gray-800",
  error: "text-red-400 bg-red-900/30",
};

const PROVIDER_FIELD_HINTS: Record<string, string[]> = {
  greenid: ["api_key", "account_id"],
  sumsub: ["app_token", "secret_key"],
  trulioo: ["api_key"],
  jumio: ["api_token", "api_secret"],
  onfido: ["api_token"],
  complyadvantage: ["api_key"],
  lexisnexis: ["api_key", "org_id"],
  dowjones: ["username", "password"],
  worldcheck: ["api_key", "api_secret", "url"],
  creditorwatch: ["api_key"],
  equifax_au: ["client_id", "client_secret"],
  loqate: ["api_key"],
  google_maps: ["api_key"],
  sendgrid: ["api_key"],
  twilio: ["account_sid", "auth_token"],
};

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [provider, setProvider] = useState("sumsub");
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const hints = PROVIDER_FIELD_HINTS[provider] || ["api_key"];

  const save = async () => {
    if (Object.values(fields).some((v) => !v.trim())) { setErr("Fill in all credential fields"); return; }
    setSaving(true);
    try {
      await apiFetch("/api/v1/connectors/", {
        method: "POST",
        body: JSON.stringify({ provider, label: label || provider, credentials: fields }),
      });
      onSaved();
      onClose();
    } catch (e: unknown) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-bold mb-4">Add Provider Credential</h3>
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Provider</label>
            <select value={provider} onChange={(e) => { setProvider(e.target.value); setFields({}); }}
              className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm">
              {Object.entries(PROVIDER_CATEGORIES).map(([, cat]) =>
                cat.providers.map((p) => <option key={p} value={p}>{p}</option>)
              )}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Label (optional)</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`My ${provider} key`}
              className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm" />
          </div>
          {hints.map((h) => (
            <div key={h}>
              <label className="text-xs text-gray-400 mb-1 block font-mono">{h}</label>
              <input type="password" value={fields[h] || ""} onChange={(e) => setFields({ ...fields, [h]: e.target.value })}
                placeholder={`Enter ${h}`}
                className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm font-mono" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-700 rounded text-sm">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Save Credential"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeprecationBanner() {
  return (
    <div className="mb-6 rounded-xl border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
      This legacy connector store is being superseded by the{" "}
      <a href="/api-integrations" className="font-semibold underline">Integrations Hub</a>
      , which adds OAuth, health/usage monitoring, credential-expiry alerting, and an audit
      trail. Existing credentials here keep working; configure new providers in the Hub.
    </div>
  );
}

export default function ConnectorsPage() {
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    apiFetch("/api/v1/connectors/")
      .then(setCreds).catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const testCred = async (id: string) => {
    setTesting(id);
    try {
      const r = await apiFetch(`/api/v1/connectors/${id}/test`, { method: "POST" });
      setTestResults((prev) => ({ ...prev, [id]: { success: r.success, message: r.message } }));
      load();
    } catch (e: unknown) {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: String(e) } }));
    } finally { setTesting(null); }
  };

  const deleteCred = async (id: string) => {
    if (!confirm("Delete this credential?")) return;
    await apiFetch(`/api/v1/connectors/${id}`, { method: "DELETE" });
    load();
  };

  const allProviders = new Set(Object.values(PROVIDER_CATEGORIES).flatMap((c) => c.providers));
  const configuredProviders = new Set(creds.map((c) => c.provider));
  const unconfigured = [...allProviders].filter((p) => !configuredProviders.has(p));

  return (
    <div className="min-h-screen bg-[#060d1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <DeprecationBanner />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Connector Marketplace</h1>
            <p className="text-gray-400 text-sm mt-1">
              Bring-your-own-credentials for identity, AML & business verification providers
            </p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold">
            + Add Provider
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {/* Configured Credentials */}
        {creds.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Configured ({creds.length})</h2>
            <div className="grid gap-3">
              {creds.map((c) => (
                <div key={c.credential_id} className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{c.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[c.status] || "text-gray-400"}`}>
                        {c.status}
                      </span>
                      {c.is_default && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400">default</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      Provider: <span className="font-mono text-gray-300">{c.provider}</span>
                      {" · "}Key: <span className="font-mono text-gray-300">{c.key_hint || "—"}</span>
                      {c.last_tested_at && ` · Tested: ${new Date(c.last_tested_at).toLocaleString()}`}
                    </p>
                    {c.last_error && <p className="text-xs text-red-400 mt-1">{c.last_error}</p>}
                    {testResults[c.credential_id] && (
                      <p className={`text-xs mt-1 ${testResults[c.credential_id].success ? "text-green-400" : "text-red-400"}`}>
                        {testResults[c.credential_id].success ? "✓" : "✗"} {testResults[c.credential_id].message}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => testCred(c.credential_id)} disabled={testing === c.credential_id}
                      className="px-3 py-1.5 bg-[#152440] hover:bg-[#1e3a5f] rounded text-xs disabled:opacity-50">
                      {testing === c.credential_id ? "Testing…" : "Test"}
                    </button>
                    <button onClick={() => deleteCred(c.credential_id)}
                      className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded text-xs">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provider Catalogue */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Available Providers ({unconfigured.length} unconfigured)
          </h2>
          <div className="grid gap-6">
            {Object.entries(PROVIDER_CATEGORIES).map(([, cat]) => (
              <div key={cat.label}>
                <h3 className="text-xs text-gray-500 mb-2">{cat.label}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.providers.map((p) => {
                    const configured = configuredProviders.has(p);
                    return (
                      <div key={p} className={`border rounded-lg p-3 flex items-center justify-between ${
                        configured ? "border-green-800 bg-green-900/10" : "border-[#1e3a5f] bg-[#0d1b2e]"
                      }`}>
                        <div>
                          <p className="font-mono text-sm font-medium">{p}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{PROVIDER_FIELD_HINTS[p]?.join(", ")}</p>
                        </div>
                        {configured ? (
                          <span className="text-green-400 text-xs">✓ Set up</span>
                        ) : (
                          <button onClick={() => setShowAdd(true)}
                            className="text-xs text-blue-400 hover:text-blue-300">
                            Add →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {loading && <p className="text-gray-500 text-sm mt-6">Loading…</p>}
        {showAdd && <AddModal onClose={() => setShowAdd(false)} onSaved={load} />}
      </div>
    </div>
  );
}
