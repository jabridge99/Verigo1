"use client";

import { useState } from "react";
import { Search, ChevronDown, ChevronUp, Bell, ExternalLink, AlertTriangle } from "lucide-react";
import clsx from "clsx";

interface Session {
  id: number;
  session_id: string;
  applicant_name: string;
  applicant_email: string;
  customer_type: string;
  status: string;
  current_step: number;
  total_steps: number;
  completion_pct: number;
  documents_uploaded: number;
  reminders_sent: number;
  sanctions_match?: boolean;
  risk_level?: string;
  risk_score?: number;
  created_at?: string;
}

const STATUS_COLORS: Record<string, string> = {
  invited: "bg-blue-500/20 text-blue-300",
  opened: "bg-purple-500/20 text-purple-300",
  in_progress: "bg-amber-500/20 text-amber-300",
  documents_submitted: "bg-cyan-500/20 text-cyan-300",
  verification_pending: "bg-orange-500/20 text-orange-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-red-500/20 text-red-300",
  expired: "bg-slate-500/20 text-slate-400",
  abandoned: "bg-slate-500/20 text-slate-400",
};

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

interface Props {
  sessions: Session[];
  onRemind: (sessionId: string) => void;
  onSelect: (session: Session) => void;
}

type SortKey = "applicant_name" | "status" | "completion_pct" | "created_at";

export default function ApplicantTable({ sessions, onRemind, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("created_at");
  const [asc, setAsc] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else { setSort(key); setAsc(true); }
  };

  const filtered = sessions
    .filter(s => {
      const q = search.toLowerCase();
      return (!search || s.applicant_name.toLowerCase().includes(q) || s.applicant_email.toLowerCase().includes(q))
        && (statusFilter === "all" || s.status === statusFilter);
    })
    .sort((a, b) => {
      let av: any = a[sort as keyof Session], bv: any = b[sort as keyof Session];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      return asc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const SortIcon = ({ k }: { k: SortKey }) => sort === k
    ? (asc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {Object.keys(STATUS_COLORS).map(s => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-navy-700">
        <table className="w-full text-sm">
          <thead className="bg-navy-800 border-b border-navy-700">
            <tr>
              <th className="text-left px-4 py-3 text-slate-400 font-medium cursor-pointer" onClick={() => toggleSort("applicant_name")}>Applicant <SortIcon k="applicant_name" /></th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium cursor-pointer" onClick={() => toggleSort("status")}>Status <SortIcon k="status" /></th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium cursor-pointer" onClick={() => toggleSort("completion_pct")}>Progress <SortIcon k="completion_pct" /></th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Risk</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Docs</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium cursor-pointer" onClick={() => toggleSort("created_at")}>Created <SortIcon k="created_at" /></th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">No applicants found</td></tr>
            ) : filtered.map(s => (
              <tr key={s.session_id} className="border-b border-navy-800 hover:bg-navy-800/50 cursor-pointer transition-colors" onClick={() => onSelect(s)}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-200">{s.applicant_name}</div>
                  <div className="text-xs text-slate-500">{s.applicant_email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLORS[s.status] || "bg-slate-500/20 text-slate-400")}>
                      {s.status.replace(/_/g, " ")}
                    </span>
                    {s.sanctions_match && <AlertTriangle className="w-4 h-4 text-red-400" />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${s.completion_pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{s.completion_pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {s.risk_level
                    ? <span className={clsx("text-xs font-medium capitalize", RISK_COLORS[s.risk_level])}>{s.risk_level}</span>
                    : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{s.documents_uploaded}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.created_at ? new Date(s.created_at).toLocaleDateString("en-AU") : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                    {["invited","opened","in_progress"].includes(s.status) && s.reminders_sent < 3 && (
                      <button onClick={() => onRemind(s.session_id)} className="p-1.5 rounded-lg bg-navy-700 hover:bg-navy-600 text-slate-400 hover:text-amber-400 transition-colors">
                        <Bell className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => onSelect(s)} className="p-1.5 rounded-lg bg-navy-700 hover:bg-navy-600 text-slate-400 hover:text-brand-400 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-500 text-right">{filtered.length} of {sessions.length} applicants</div>
    </div>
  );
}
