"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, AlertTriangle, Info, FileText, UserCheck, Shield, Zap, Clock } from "lucide-react";
import { getStoredUser, getToken } from "@/lib/auth";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Notif {
  id: number;
  notif_id: string;
  notif_type: string;
  priority: string;
  title: string;
  body: string;
  link?: string;
  entity_type?: string;
  entity_id?: string;
  read: boolean;
  emailed: boolean;
  created_at?: string;
}

const DEMO: Notif[] = [
  { id: 1, notif_id: "NOTIF-001", notif_type: "alert", priority: "urgent", title: "AML Alert: Structuring Pattern", body: "Customer ACE-00192 has triggered a structuring alert — 9 transactions under $10,000 in 48 hours.", link: "/monitoring", entity_type: "customer", entity_id: "ACE-00192", read: false, emailed: true, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, notif_id: "NOTIF-002", notif_type: "report_due", priority: "high", title: "TTR Due in 2 Days", body: "Threshold Transaction Report RPT-0041 must be submitted to AUSTRAC by Wednesday.", link: "/reporting", entity_type: "report", entity_id: "RPT-0041", read: false, emailed: false, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 3, notif_id: "NOTIF-003", notif_type: "case_assigned", priority: "high", title: "Case Assigned: CASE-2025-0088", body: "Sarah Chen has assigned a high-severity SAR investigation to you.", link: "/mlro", entity_type: "case", entity_id: "CASE-2025-0088", read: false, emailed: true, created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: 4, notif_id: "NOTIF-004", notif_type: "kyc_review", priority: "medium", title: "KYC Review Required", body: "KYC record for Nguyen Trading Pty Ltd requires MLRO sign-off.", link: "/customers", entity_type: "customer", entity_id: "KYC-9912", read: false, emailed: false, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 5, notif_id: "NOTIF-005", notif_type: "report_approved", priority: "medium", title: "Report Approved for Submission", body: "IFTI-00019 has been approved by MLRO and is ready to submit to AUSTRAC.", link: "/reporting", entity_type: "report", entity_id: "IFTI-00019", read: true, emailed: true, created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: 6, notif_id: "NOTIF-006", notif_type: "system", priority: "low", title: "System Maintenance Scheduled", body: "Trust Verify Go will undergo scheduled maintenance on Sunday 15 June 02:00–04:00 AEST.", read: true, emailed: false, created_at: new Date(Date.now() - 259200000).toISOString() },
];

const TYPE_ICON: Record<string, React.ReactNode> = {
  alert:           <AlertTriangle className="w-4 h-4" />,
  report_due:      <Clock className="w-4 h-4" />,
  report_approved: <FileText className="w-4 h-4" />,
  case_assigned:   <Shield className="w-4 h-4" />,
  case_escalated:  <Zap className="w-4 h-4" />,
  kyc_review:      <UserCheck className="w-4 h-4" />,
  ecdd_required:   <UserCheck className="w-4 h-4" />,
  system:          <Info className="w-4 h-4" />,
  magic_link:      <Info className="w-4 h-4" />,
};

const TYPE_COLOR: Record<string, string> = {
  alert:           "text-red-400 bg-red-500/10",
  report_due:      "text-amber-400 bg-amber-500/10",
  report_approved: "text-green-400 bg-green-500/10",
  case_assigned:   "text-blue-400 bg-blue-500/10",
  case_escalated:  "text-orange-400 bg-orange-500/10",
  kyc_review:      "text-purple-400 bg-purple-500/10",
  ecdd_required:   "text-purple-400 bg-purple-500/10",
  system:          "text-slate-400 bg-slate-500/10",
  magic_link:      "text-slate-400 bg-slate-500/10",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400 border border-red-500/30",
  high:   "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  medium: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  low:    "bg-slate-500/20 text-slate-400 border border-slate-500/30",
};

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>(DEMO);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);

  const user = typeof window !== "undefined" ? getStoredUser() : null;

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchNotifs();
  }, []);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/v1/notifications?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("api error");
      setNotifs(await res.json());
    } catch {
      setNotifs(DEMO);
      setDemo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = async (notif_id: string) => {
    setNotifs(prev => prev.map(n => n.notif_id === notif_id ? { ...n, read: true } : n));
    try {
      const token = getToken();
      await fetch(`${API}/api/v1/notifications/${notif_id}/read`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    try {
      const token = getToken();
      await fetch(`${API}/api/v1/notifications/read-all`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const types = ["all", ...Array.from(new Set(notifs.map(n => n.notif_type)))];

  const visible = notifs.filter(n => {
    if (filter === "unread" && n.read) return false;
    if (typeFilter !== "all" && n.notif_type !== typeFilter) return false;
    return true;
  });

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-navy-950 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-slate-400">{unreadCount} unread</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample notifications
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(["all", "unread"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${filter === f ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
              >
                {f === "all" ? "All" : "Unread"}
              </button>
            ))}
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          >
            {types.map(t => (
              <option key={t} value={t} className="bg-slate-900">
                {t === "all" ? "All types" : t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            No notifications
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(n => (
              <div
                key={n.notif_id}
                onClick={() => { if (!n.read) markRead(n.notif_id); if (n.link) router.push(n.link); }}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${
                  n.read
                    ? "bg-white/3 border-white/5 opacity-60 hover:opacity-80"
                    : "bg-white/7 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${TYPE_COLOR[n.notif_type] ?? "text-slate-400 bg-slate-500/10"}`}>
                    {TYPE_ICON[n.notif_type] ?? <Info className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{n.title}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />}
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">{n.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[n.priority]}`}>
                        {n.priority}
                      </span>
                      <span className="text-xs text-slate-500">{relativeTime(n.created_at)}</span>
                      {n.emailed && <span className="text-xs text-slate-500">· emailed</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
