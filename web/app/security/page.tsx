"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}

async function apiFetch(path: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

interface Alert { severity: string; type: string; message: string; ip_address?: string }
interface Summary {
  period_days: number; total_events: number; failed_logins: number;
  mfa_failures: number; role_changes: number; user_suspensions: number;
  invalid_magic_links: number;
  brute_force_candidates: { ip: string; failed_attempts: number }[];
}
interface MfaStatus { total_users: number; mfa_enabled: number; mfa_disabled: number; adoption_pct: number }
interface Event { event_id: string; event_type: string; user_id: string; ip_address: string; created_at: string }

const SEVERITY_COLOURS: Record<string, string> = {
  critical: "bg-red-900/60 border-red-500 text-red-300",
  high: "bg-orange-900/60 border-orange-500 text-orange-300",
  medium: "bg-yellow-900/60 border-yellow-500 text-yellow-300",
  low: "bg-blue-900/60 border-blue-500 text-blue-300",
};

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div className={`border rounded-lg p-3 text-sm ${SEVERITY_COLOURS[alert.severity] || "bg-gray-800 border-gray-600 text-gray-300"}`}>
      <div className="flex items-start gap-2">
        <span className="font-bold uppercase text-xs tracking-wide mt-0.5">{alert.severity}</span>
        <span>{alert.message}</span>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, colour }: { label: string; value: number | string; sub?: string; colour?: string }) {
  return (
    <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-5">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colour || "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function SecurityDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/api/v1/security/summary?days=${days}`),
      apiFetch("/api/v1/security/alerts"),
      apiFetch("/api/v1/security/mfa-status"),
      apiFetch(`/api/v1/security/events?days=${days}&limit=20`),
    ])
      .then(([s, a, m, e]) => {
        setSummary(s);
        setAlerts(a.alerts || []);
        setMfa(m);
        setEvents(e.events || []);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  const EVENT_COLOURS: Record<string, string> = {
    login_failed: "text-red-400",
    login_success: "text-green-400",
    mfa_failed: "text-orange-400",
    mfa_enabled: "text-blue-400",
    mfa_disabled: "text-orange-400",
    role_changed: "text-yellow-400",
    user_suspended: "text-red-400",
    user_registered: "text-green-400",
    magic_link_invalid: "text-purple-400",
  };

  return (
    <div className="min-h-screen bg-[#060d1a] text-white p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Security Monitor</h1>
            <p className="text-gray-400 text-sm mt-1">Real-time threat detection & compliance events</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Period:</span>
            {[1, 7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  days === d ? "bg-blue-600 text-white" : "bg-[#0d1b2e] text-gray-400 hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-500 rounded-lg p-3 text-red-300 text-sm mb-4">
            {error} — ensure you are logged in as admin/mlro.
          </div>
        )}

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-3">
              ⚠ Active Alerts ({alerts.length})
            </h2>
            <div className="grid gap-2">
              {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <KpiCard label="Total Events" value={summary.total_events} />
            <KpiCard label="Failed Logins" value={summary.failed_logins}
              colour={summary.failed_logins > 50 ? "text-red-400" : "text-white"} />
            <KpiCard label="MFA Failures" value={summary.mfa_failures}
              colour={summary.mfa_failures > 10 ? "text-orange-400" : "text-white"} />
            <KpiCard label="Role Changes" value={summary.role_changes}
              colour={summary.role_changes > 0 ? "text-yellow-400" : "text-white"} />
            <KpiCard label="Suspensions" value={summary.user_suspensions}
              colour={summary.user_suspensions > 0 ? "text-red-400" : "text-white"} />
            <KpiCard label="Invalid Magic Links" value={summary.invalid_magic_links} />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* MFA Adoption */}
          {mfa && (
            <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">MFA Adoption</h2>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-28 h-28">
                  <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e3a5f" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#3b82f6" strokeWidth="3"
                      strokeDasharray={`${mfa.adoption_pct} ${100 - mfa.adoption_pct}`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{mfa.adoption_pct}%</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-center">
                  <p className="text-green-400 font-bold text-lg">{mfa.mfa_enabled}</p>
                  <p className="text-gray-400">Enabled</p>
                </div>
                <div className="text-center">
                  <p className="text-red-400 font-bold text-lg">{mfa.mfa_disabled}</p>
                  <p className="text-gray-400">Disabled</p>
                </div>
              </div>
              {mfa.adoption_pct < 80 && (
                <p className="text-xs text-yellow-400 mt-3 text-center">
                  ⚠ MFA adoption below 80% — consider enforcing MFA
                </p>
              )}
            </div>
          )}

          {/* Brute Force Candidates */}
          <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Brute Force Suspects
            </h2>
            {!summary?.brute_force_candidates?.length ? (
              <p className="text-gray-500 text-sm">No suspicious IPs detected</p>
            ) : (
              <div className="space-y-2">
                {summary.brute_force_candidates.slice(0, 8).map((bf, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-red-300">{bf.ip}</span>
                    <span className="bg-red-900/40 text-red-400 px-2 py-0.5 rounded text-xs">
                      {bf.failed_attempts} attempts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Type Breakdown */}
          {summary && (
            <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Event Breakdown</h2>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Failed Logins", v: summary.failed_logins, c: "bg-red-500" },
                  { label: "MFA Failures", v: summary.mfa_failures, c: "bg-orange-500" },
                  { label: "Role Changes", v: summary.role_changes, c: "bg-yellow-500" },
                  { label: "Suspensions", v: summary.user_suspensions, c: "bg-red-700" },
                  { label: "Invalid Links", v: summary.invalid_magic_links, c: "bg-purple-500" },
                ].map((row) => {
                  const pct = summary.total_events > 0 ? Math.round((row.v / summary.total_events) * 100) : 0;
                  return (
                    <div key={row.label}>
                      <div className="flex justify-between text-gray-400 mb-0.5">
                        <span>{row.label}</span>
                        <span>{row.v}</span>
                      </div>
                      <div className="h-1.5 bg-[#1e3a5f] rounded-full overflow-hidden">
                        <div className={`h-full ${row.c} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Recent Security Events
          </h2>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-gray-500 text-sm">No events in selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-[#1e3a5f]">
                    <th className="text-left py-2 pr-4">Time</th>
                    <th className="text-left py-2 pr-4">Event</th>
                    <th className="text-left py-2 pr-4">User ID</th>
                    <th className="text-left py-2">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.event_id} className="border-b border-[#1e3a5f]/40 hover:bg-[#152440]/40">
                      <td className="py-2 pr-4 text-gray-400 font-mono text-xs">
                        {e.created_at ? new Date(e.created_at).toLocaleString() : "—"}
                      </td>
                      <td className={`py-2 pr-4 font-medium ${EVENT_COLOURS[e.event_type] || "text-gray-300"}`}>
                        {e.event_type}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-400">{e.user_id || "—"}</td>
                      <td className="py-2 font-mono text-xs text-gray-400">{e.ip_address || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
