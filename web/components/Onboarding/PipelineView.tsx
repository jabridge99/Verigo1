"use client";

import { Mail, Eye, Clock, CheckCircle, XCircle, Timer } from "lucide-react";

interface PipelineStats {
  total: number;
  invited: number;
  opened: number;
  in_progress: number;
  completed: number;
  rejected: number;
  expired: number;
  avg_completion_pct: number;
  sanctions_matches: number;
}

export default function PipelineView({ stats }: { stats: PipelineStats }) {
  const stages = [
    { key: "invited",     label: "Invited",     count: stats.invited,     icon: Mail,        color: "text-blue-400",    bg: "bg-blue-500/10",    bar: "bg-blue-500" },
    { key: "opened",      label: "Opened",      count: stats.opened,      icon: Eye,         color: "text-purple-400",  bg: "bg-purple-500/10",  bar: "bg-purple-500" },
    { key: "in_progress", label: "In Progress", count: stats.in_progress, icon: Clock,       color: "text-amber-400",   bg: "bg-amber-500/10",   bar: "bg-amber-500" },
    { key: "completed",   label: "Completed",   count: stats.completed,   icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", bar: "bg-emerald-500" },
    { key: "rejected",    label: "Rejected",    count: stats.rejected,    icon: XCircle,     color: "text-red-400",     bg: "bg-red-500/10",     bar: "bg-red-500" },
    { key: "expired",     label: "Expired",     count: stats.expired,     icon: Timer,       color: "text-slate-400",   bg: "bg-slate-500/10",   bar: "bg-slate-500" },
  ];
  const total = stats.total || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stages.map(({ key, label, count, icon: Icon, color, bg }) => (
          <div key={key} className={`rounded-xl p-4 ${bg} border border-white/5`}>
            <div className={`flex items-center gap-2 mb-2 ${color}`}>
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-200">{count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{Math.round((count / total) * 100)}%</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Pipeline flow</div>
        <div className="flex rounded-full overflow-hidden h-4 gap-px">
          {stages.map(({ key, count, bar }) => count > 0 ? (
            <div key={key} className={`${bar} transition-all`} style={{ width: `${(count / total) * 100}%` }} />
          ) : null)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {stages.map(({ key, label, bar }) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className={`w-2 h-2 rounded-full ${bar}`} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-slate-200">{stats.total}</div><div className="text-xs text-slate-500 mt-0.5">Total applicants</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-brand-400">{stats.avg_completion_pct}%</div><div className="text-xs text-slate-500 mt-0.5">Avg completion</div></div>
        <div className="card p-4 text-center"><div className="text-2xl font-bold text-emerald-400">{total > 1 ? `${Math.round((stats.completed / total) * 100)}%` : "0%"}</div><div className="text-xs text-slate-500 mt-0.5">Conversion rate</div></div>
        <div className="card p-4 text-center"><div className={`text-2xl font-bold ${stats.sanctions_matches > 0 ? "text-red-400" : "text-slate-400"}`}>{stats.sanctions_matches}</div><div className="text-xs text-slate-500 mt-0.5">Sanctions flags</div></div>
      </div>
    </div>
  );
}
