"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("token") || "" : ""; }
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

interface Policy { policy_id: string; entity_scope: string; retention_years: number; legal_hold: boolean; notes: string | null }
interface Hold { hold_id: string; entity_scope: string; entity_id: string; reason: string; held_by: string; placed_at: string; active: boolean }
interface PurgeItem { scope: string; id: string; created_at: string; action: string }

const SCOPES = ["customer", "kyc_record", "document", "transaction", "audit_log", "report"];

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  customer: "Customer profiles & personal data",
  kyc_record: "KYC verification records",
  document: "Uploaded identity documents",
  transaction: "Financial transaction records",
  audit_log: "System audit trail",
  report: "Regulatory reports (TTR/IFTI/SMR)",
};

export default function RetentionPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [purge, setPurge] = useState<{ total_eligible: number; items: PurgeItem[] } | null>(null);
  const [tab, setTab] = useState<"policies" | "holds" | "purge">("policies");
  const [editing, setEditing] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [newHold, setNewHold] = useState({ entity_scope: "customer", entity_id: "", reason: "" });
  const [holdSaving, setHoldSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPolicies = () =>
    apiFetch("/api/v1/retention/policies").then((d: Policy[]) => setPolicies(d)).catch((e) => setError(e.message));

  const loadHolds = () =>
    apiFetch("/api/v1/retention/holds?active_only=false").then((d: Hold[]) => setHolds(d)).catch((e) => setError(e.message));

  const loadPurge = () =>
    apiFetch("/api/v1/retention/purge-report").then(setPurge).catch((e) => setError(e.message));

  useEffect(() => { loadPolicies(); loadHolds(); }, []);

  const savePolicy = async (scope: string) => {
    const years = editing[scope];
    if (years === undefined) return;
    setSaving(scope);
    try {
      await apiFetch("/api/v1/retention/policies", {
        method: "PUT",
        body: JSON.stringify({ entity_scope: scope, retention_years: years }),
      });
      await loadPolicies();
      const updated = { ...editing };
      delete updated[scope];
      setEditing(updated);
    } catch (e: unknown) { setError(String(e)); }
    finally { setSaving(null); }
  };

  const placeHold = async () => {
    if (!newHold.entity_id.trim() || !newHold.reason.trim()) { setError("Fill in entity ID and reason"); return; }
    setHoldSaving(true);
    try {
      await apiFetch("/api/v1/retention/holds", { method: "POST", body: JSON.stringify(newHold) });
      setNewHold({ entity_scope: "customer", entity_id: "", reason: "" });
      await loadHolds();
    } catch (e: unknown) { setError(String(e)); }
    finally { setHoldSaving(false); }
  };

  const releaseHold = async (holdId: string) => {
    if (!confirm("Release this legal hold?")) return;
    try {
      await apiFetch(`/api/v1/retention/holds/${holdId}/release`, { method: "POST" });
      await loadHolds();
    } catch (e: unknown) { setError(String(e)); }
  };

  const getPolicyYears = (scope: string) =>
    policies.find((p) => p.entity_scope === scope)?.retention_years ?? 7;

  return (
    <div className="min-h-screen bg-[#060d1a] text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Data Retention & Legal Hold</h1>
          <p className="text-gray-400 text-sm mt-1">
            AUSTRAC AML/CTF compliance — configurable retention periods, legal hold, deletion eligibility
          </p>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-500 rounded-lg p-3 text-red-300 text-sm mb-4">
            {error}
            <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#0d1b2e] p-1 rounded-lg w-fit">
          {(["policies", "holds", "purge"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); if (t === "purge") loadPurge(); }}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors capitalize ${
                tab === t ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
              }`}>
              {t === "holds" ? `Legal Holds (${holds.filter((h) => h.active).length})` : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Policies tab */}
        {tab === "policies" && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 mb-4">
              AUSTRAC statutory minimum: 7 years. ECDD / high-risk / PEP subjects: 10 years (auto-applied).
              Set 0 for indefinite retention.
            </div>
            {SCOPES.map((scope) => {
              const current = getPolicyYears(scope);
              const editVal = editing[scope];
              return (
                <div key={scope} className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium capitalize">{scope.replace("_", " ")}</p>
                    <p className="text-xs text-gray-500">{SCOPE_DESCRIPTIONS[scope]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} max={50}
                        value={editVal !== undefined ? editVal : current}
                        onChange={(e) => setEditing({ ...editing, [scope]: parseInt(e.target.value) || 0 })}
                        className="w-16 bg-[#152440] border border-[#1e3a5f] rounded px-2 py-1 text-sm text-center"
                      />
                      <span className="text-xs text-gray-400">years</span>
                    </div>
                    {editVal !== undefined && editVal !== current && (
                      <button onClick={() => savePolicy(scope)} disabled={saving === scope}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold disabled:opacity-50">
                        {saving === scope ? "Saving…" : "Save"}
                      </button>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      current === 7 ? "bg-blue-900/30 text-blue-400" :
                      current === 10 ? "bg-yellow-900/30 text-yellow-400" :
                      current === 0 ? "bg-purple-900/30 text-purple-400" : "bg-gray-800 text-gray-400"
                    }`}>
                      {current === 0 ? "Indefinite" : `${current}yr`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legal Holds tab */}
        {tab === "holds" && (
          <div className="space-y-6">
            {/* Place new hold */}
            <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-5">
              <h3 className="font-semibold mb-4">Place Legal Hold</h3>
              <div className="grid sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Entity Type</label>
                  <select value={newHold.entity_scope}
                    onChange={(e) => setNewHold({ ...newHold, entity_scope: e.target.value })}
                    className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm">
                    {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Entity ID</label>
                  <input value={newHold.entity_id} onChange={(e) => setNewHold({ ...newHold, entity_id: e.target.value })}
                    placeholder="CUST-XXXXXXXXXX"
                    className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Reason</label>
                  <input value={newHold.reason} onChange={(e) => setNewHold({ ...newHold, reason: e.target.value })}
                    placeholder="Regulatory investigation"
                    className="w-full bg-[#152440] border border-[#1e3a5f] rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <button onClick={placeHold} disabled={holdSaving}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-semibold disabled:opacity-50">
                {holdSaving ? "Placing…" : "Place Hold"}
              </button>
            </div>

            {/* Hold list */}
            <div className="space-y-2">
              {holds.length === 0 ? (
                <p className="text-gray-500 text-sm">No legal holds placed.</p>
              ) : holds.map((h) => (
                <div key={h.hold_id} className={`border rounded-xl p-4 flex flex-wrap items-start gap-3 ${
                  h.active ? "border-yellow-700 bg-yellow-900/10" : "border-[#1e3a5f] bg-[#0d1b2e] opacity-60"
                }`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm">{h.entity_id}</span>
                      <span className="text-xs text-gray-500">({h.entity_scope})</span>
                      {h.active
                        ? <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">Active</span>
                        : <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">Released</span>}
                    </div>
                    <p className="text-sm text-gray-300">{h.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Placed: {new Date(h.placed_at).toLocaleString()} by {h.held_by}
                    </p>
                  </div>
                  {h.active && (
                    <button onClick={() => releaseHold(h.hold_id)}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs">
                      Release
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purge Report tab */}
        {tab === "purge" && (
          <div>
            {!purge ? (
              <p className="text-gray-500 text-sm">Loading purge report…</p>
            ) : (
              <>
                <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-5 mb-4">
                  <p className="text-sm text-gray-400 mb-1">Records eligible for deletion</p>
                  <p className="text-4xl font-bold text-yellow-400">{purge.total_eligible}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Dry-run only — no records have been deleted. Review and action manually.
                  </p>
                </div>
                {purge.items.length === 0 ? (
                  <p className="text-gray-500 text-sm">No records are currently eligible for deletion.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase border-b border-[#1e3a5f]">
                          <th className="text-left py-2 pr-4">Scope</th>
                          <th className="text-left py-2 pr-4">ID</th>
                          <th className="text-left py-2 pr-4">Created</th>
                          <th className="text-left py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purge.items.map((item, i) => (
                          <tr key={i} className="border-b border-[#1e3a5f]/40 text-gray-300">
                            <td className="py-2 pr-4">{item.scope}</td>
                            <td className="py-2 pr-4 font-mono text-xs">{item.id}</td>
                            <td className="py-2 pr-4 text-xs">{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
                            <td className="py-2">
                              <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded">{item.action}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
