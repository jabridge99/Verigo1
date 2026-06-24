"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarClock, AlertTriangle, CheckCircle, Clock, RefreshCw,
  LayoutList, CalendarDays, GanttChartSquare, ChevronLeft, ChevronRight,
} from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ItemType =
  | "customer_review" | "kyc_expiry" | "edd_review" | "policy_review" | "control_test"
  | "training_expiry" | "ttr_deadline" | "ifti_deadline" | "smr_deadline"
  | "aml_program_review" | "risk_assessment_review" | "independent_review"
  | "high_risk_customer_review" | "austrac_obligation" | "board_reporting" | "other";

type ItemStatus = "scheduled" | "in_progress" | "completed" | "overdue" | "cancelled" | "escalated";

interface CalendarItem {
  id: string;
  item_type: ItemType;
  status: ItemStatus;
  title: string;
  description?: string;
  due_date: string;
  customer_id?: string | null;
  assigned_to?: string | null;
  is_recurring: boolean;
  recurrence_months?: number | null;
  is_overdue: boolean;
  completed_at?: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<ItemType, string> = {
  customer_review: "Customer Review Cycle",
  kyc_expiry: "KYC Document Expiry",
  edd_review: "EDD Review",
  policy_review: "Policy Review",
  control_test: "Control Test",
  training_expiry: "Training Renewal",
  ttr_deadline: "TTR Deadline (AUSTRAC)",
  ifti_deadline: "IFTI Deadline (AUSTRAC)",
  smr_deadline: "SMR Deadline (AUSTRAC)",
  aml_program_review: "AML Program Review",
  risk_assessment_review: "Risk Assessment Review",
  independent_review: "Independent Review",
  high_risk_customer_review: "High Risk Customer Review",
  austrac_obligation: "AUSTRAC Obligation",
  board_reporting: "Board Reporting",
  other: "Other",
};

const STATUS_COLOR: Record<ItemStatus, string> = {
  scheduled: "bg-slate-500/20 text-slate-300",
  in_progress: "bg-brand-500/20 text-brand-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  overdue: "bg-red-500/20 text-red-300",
  cancelled: "bg-slate-600/20 text-slate-500",
  escalated: "bg-amber-500/20 text-amber-300",
};

const DEMO_ITEMS: CalendarItem[] = [
  { id: "cal_1", item_type: "aml_program_review", status: "scheduled", title: "Annual AML/CTF Program Review", due_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10), is_recurring: true, recurrence_months: 12, is_overdue: false, created_at: new Date().toISOString() },
  { id: "cal_2", item_type: "policy_review", status: "overdue", title: "CDD Policy — Annual Review", due_date: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10), is_recurring: true, recurrence_months: 12, is_overdue: true, created_at: new Date().toISOString() },
  { id: "cal_3", item_type: "control_test", status: "scheduled", title: "Q2 Transaction Monitoring Control Test", due_date: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10), is_recurring: true, recurrence_months: 3, is_overdue: false, created_at: new Date().toISOString() },
  { id: "cal_4", item_type: "training_expiry", status: "scheduled", title: "Annual AML Refresher — Compliance Team", due_date: new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10), is_recurring: true, recurrence_months: 12, is_overdue: false, created_at: new Date().toISOString() },
  { id: "cal_5", item_type: "independent_review", status: "in_progress", title: "External Independent Review — FY25", due_date: new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10), is_recurring: false, is_overdue: false, created_at: new Date().toISOString() },
  { id: "cal_6", item_type: "high_risk_customer_review", status: "escalated", title: "High-Risk Customer Review — PEP Cohort", due_date: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10), is_recurring: true, recurrence_months: 12, is_overdue: true, created_at: new Date().toISOString() },
  { id: "cal_7", item_type: "risk_assessment_review", status: "scheduled", title: "ML/TF Risk Assessment Refresh", due_date: new Date(Date.now() + 18 * 86400000).toISOString().slice(0, 10), is_recurring: true, recurrence_months: 24, is_overdue: false, created_at: new Date().toISOString() },
  { id: "cal_8", item_type: "board_reporting", status: "scheduled", title: "Quarterly Board Compliance Report", due_date: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10), is_recurring: true, recurrence_months: 3, is_overdue: false, created_at: new Date().toISOString() },
];

interface Dashboard {
  open_items: number;
  overdue: number;
  due_within_30_days: number;
  by_type: Record<string, number>;
  pending_reminders: number;
}

const DEMO_DASHBOARD: Dashboard = {
  open_items: DEMO_ITEMS.filter(i => i.status !== "completed").length,
  overdue: DEMO_ITEMS.filter(i => i.is_overdue).length,
  due_within_30_days: DEMO_ITEMS.length,
  by_type: {},
  pending_reminders: 3,
};

type View = "list" | "calendar" | "timeline";

export default function ComplianceCalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>(DEMO_ITEMS);
  const [dashboard, setDashboard] = useState<Dashboard>(DEMO_DASHBOARD);
  const [view, setView] = useState<View>("list");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [iRes, dRes] = await Promise.all([
        fetch(`${API}/api/v1/compliance-calendar`, { credentials: "include" }),
        fetch(`${API}/api/v1/compliance-calendar/dashboard`, { credentials: "include" }),
      ]);
      if (iRes.ok) { const d = await iRes.json(); if (d.length) setItems(d); }
      if (dRes.ok) { const d = await dRes.json(); setDashboard(d); }
    } catch {}
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const completeItem = async (id: string) => {
    try {
      await fetch(`${API}/api/v1/compliance-calendar/${id}/complete`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {}
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: "completed", completed_at: new Date().toISOString() } : i));
    setSelected(prev => prev?.id === id ? { ...prev, status: "completed" } : prev);
    showToast("success", "Item marked complete");
  };

  const filtered = items.filter(i =>
    (typeFilter === "all" || i.item_type === typeFilter) &&
    (statusFilter === "all" || i.status === statusFilter)
  );

  const sorted = [...filtered].sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Compliance Calendar</h1>
            <p className="text-slate-500 text-sm mt-0.5">Scheduled reviews, deadlines, and renewals across the program</p>
          </div>
          <button onClick={fetchAll} className="btn-secondary text-sm py-2 px-4">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dashboard widgets */}
      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Open Items", value: dashboard.open_items, icon: LayoutList, color: "text-slate-200" },
            { label: "Overdue", value: dashboard.overdue, icon: AlertTriangle, color: "text-red-400" },
            { label: "Due in 30 Days", value: dashboard.due_within_30_days, icon: Clock, color: "text-amber-400" },
            { label: "Pending Reminders", value: dashboard.pending_reminders, icon: CalendarClock, color: "text-brand-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card flex items-center gap-3 py-3">
              <Icon className={`w-5 h-5 ${color}`} />
              <div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View switcher + filters */}
      <div className="border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            {[
              { id: "list" as View, label: "List", Icon: LayoutList },
              { id: "calendar" as View, label: "Calendar", Icon: CalendarDays },
              { id: "timeline" as View, label: "Timeline", Icon: GanttChartSquare },
            ].map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setView(id)}
                className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  view === id ? "border-brand-500/40 bg-brand-500/10 text-brand-300" : "border-navy-700 text-slate-400 hover:text-slate-200")}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500">
              <option value="all">Type — All</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500">
              <option value="all">Status — All</option>
              {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {view === "list" && (
          <div className="overflow-x-auto rounded-xl border border-navy-700">
            <table className="w-full text-sm">
              <thead className="bg-navy-800 border-b border-navy-700">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Title</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Due Date</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Recurring</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-500">No calendar items found</td></tr>
                ) : sorted.map(i => (
                  <tr key={i.id} className="border-b border-navy-800 hover:bg-navy-800/40 cursor-pointer transition-colors" onClick={() => setSelected(i)}>
                    <td className="px-4 py-3 text-slate-200">{i.title}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{TYPE_LABELS[i.item_type]}</td>
                    <td className={clsx("px-4 py-3 text-xs", i.is_overdue ? "text-red-400 font-medium" : "text-slate-400")}>
                      {new Date(i.due_date).toLocaleDateString("en-AU")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[i.status])}>
                        {i.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {i.is_recurring ? `Every ${i.recurrence_months}mo` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {i.status !== "completed" && (
                        <button onClick={e => { e.stopPropagation(); completeItem(i.id); }}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "calendar" && (
          <CalendarMonthView
            items={sorted}
            monthOffset={monthOffset}
            setMonthOffset={setMonthOffset}
            onSelect={setSelected}
          />
        )}

        {view === "timeline" && (
          <div className="space-y-3">
            {sorted.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No calendar items found</div>
            ) : sorted.map(i => (
              <div key={i.id} onClick={() => setSelected(i)}
                className="flex items-center gap-4 card cursor-pointer hover:border-brand-500/30 transition-colors">
                <div className={clsx("w-2 h-10 rounded-full", i.is_overdue ? "bg-red-500" : i.status === "completed" ? "bg-emerald-500" : "bg-brand-500")} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-200">{i.title}</div>
                  <div className="text-xs text-slate-500">{TYPE_LABELS[i.item_type]}</div>
                </div>
                <div className={clsx("text-xs font-medium", i.is_overdue ? "text-red-400" : "text-slate-400")}>
                  {new Date(i.due_date).toLocaleDateString("en-AU")}
                </div>
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[i.status])}>
                  {i.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-slate-500 mb-1">{TYPE_LABELS[selected.item_type]}</div>
                <h2 className="text-lg font-semibold text-slate-100">{selected.title}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 text-lg leading-none">&times;</button>
            </div>
            <span className={clsx("inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize", STATUS_COLOR[selected.status])}>
              {selected.status.replace("_", " ")}
            </span>
            {selected.description && (
              <div className="text-sm text-slate-300 leading-relaxed">{selected.description}</div>
            )}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg p-3 bg-navy-900 border border-navy-700">
                <div className="text-slate-500 mb-0.5">Due date</div>
                <div className={selected.is_overdue ? "text-red-400 font-medium" : "text-slate-200"}>
                  {new Date(selected.due_date).toLocaleDateString("en-AU")}
                </div>
              </div>
              <div className="rounded-lg p-3 bg-navy-900 border border-navy-700">
                <div className="text-slate-500 mb-0.5">Recurrence</div>
                <div className="text-slate-200">{selected.is_recurring ? `Every ${selected.recurrence_months} months` : "One-off"}</div>
              </div>
            </div>
            {selected.status !== "completed" && (
              <button onClick={() => completeItem(selected.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-500/15 border border-teal-500/25 text-teal-300 text-sm font-medium hover:bg-teal-500/25 transition-colors w-full justify-center">
                <CheckCircle className="w-4 h-4" /> Mark Complete
              </button>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function CalendarMonthView({
  items, monthOffset, setMonthOffset, onSelect,
}: {
  items: CalendarItem[];
  monthOffset: number;
  setMonthOffset: (fn: (n: number) => number) => void;
  onSelect: (i: CalendarItem) => void;
}) {
  const base = new Date();
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const itemsByDay: Record<number, CalendarItem[]> = {};
  items.forEach(i => {
    const d = new Date(i.due_date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      itemsByDay[d.getDate()] = [...(itemsByDay[d.getDate()] || []), i];
    }
  });

  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonthOffset(n => n - 1)} className="p-2 rounded-lg hover:bg-navy-800 text-slate-400">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-medium text-slate-200">
          {base.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
        </div>
        <button onClick={() => setMonthOffset(n => n + 1)} className="p-2 rounded-lg hover:bg-navy-800 text-slate-400">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2 text-xs text-slate-500 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, idx) => (
          <div key={idx} className={clsx("min-h-[80px] rounded-lg border p-1.5", day ? "border-navy-700 bg-navy-800/40" : "border-transparent")}>
            {day && (
              <>
                <div className="text-xs text-slate-500 mb-1">{day}</div>
                <div className="space-y-1">
                  {(itemsByDay[day] || []).slice(0, 3).map(i => (
                    <div key={i.id} onClick={() => onSelect(i)}
                      className={clsx("text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer",
                        i.is_overdue ? "bg-red-500/20 text-red-300" : "bg-brand-500/20 text-brand-300")}>
                      {i.title}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
