"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle, Clock, RefreshCw, Plus } from "lucide-react";
import RecordsTable from "@/components/ECDD/RecordsTable";
import CreateECDDForm from "@/components/ECDD/CreateECDDForm";
import DetailDrawer from "@/components/ECDD/DetailDrawer";
import {
  listEcddRecords,
  decideEcddRecord,
  type ECDDRecord,
} from '@/lib/api/reports'

const DEMO_RECORDS: ECDDRecord[] = [
  { id: "1", ecdd_id: "ECDD-DEMO00001", customer_id: "3", trigger_reason: "Sanctions screening hit — OFAC SDN list match on transaction counterparty", pep_status: 0, adverse_media_found: 1, beneficial_owner_verified: 0, source_of_wealth_verified: 0, enhanced_risk_score: 70, recommendation: "reject", status: "pending", created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "2", ecdd_id: "ECDD-DEMO00002", customer_id: "2", trigger_reason: "PEP identified — customer declared as foreign politically exposed person", pep_status: 1, adverse_media_found: 0, beneficial_owner_verified: 1, source_of_wealth_verified: 0, enhanced_risk_score: 45, recommendation: "monitor", status: "pending", created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "3", ecdd_id: "ECDD-DEMO00003", customer_id: "1", trigger_reason: "Periodic review — 12-month scheduled ECDD refresh", pep_status: 0, adverse_media_found: 0, beneficial_owner_verified: 1, source_of_wealth_verified: 1, enhanced_risk_score: 0, recommendation: "approve", status: "completed", created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "4", ecdd_id: "ECDD-DEMO00004", customer_id: "5", trigger_reason: "Unusual transaction pattern — structuring detected across 3 accounts", pep_status: 0, adverse_media_found: 0, beneficial_owner_verified: 0, source_of_wealth_verified: 1, enhanced_risk_score: 20, recommendation: "monitor", status: "pending", created_at: new Date(Date.now() - 259200000).toISOString() },
];

type Tab = "records" | "create";

export default function ECDDDashboard() {
  const [tab, setTab] = useState<Tab>("records");
  const [records, setRecords] = useState<ECDDRecord[]>(DEMO_RECORDS);
  const [selected, setSelected] = useState<ECDDRecord | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  };

  const fetchRecords = useCallback(async () => {
    try {
      const d = await listEcddRecords();
      if (d.length) setRecords(d);
    } catch {}
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const decideECDD = async (ecddId: string, status: string, decisionNotes: string) => {
    const now = new Date().toISOString();
    try {
      const updated = await decideEcddRecord(ecddId, { status, decision_notes: decisionNotes });
      setRecords(prev => prev.map(r => r.ecdd_id === ecddId ? updated : r));
      setSelected(prev => prev?.ecdd_id === ecddId ? updated : prev);
      showToast("success", `${ecddId} marked ${status}`);
      return;
    } catch {}
    setRecords(prev => prev.map(r => r.ecdd_id === ecddId ? { ...r, status, decision_notes: decisionNotes, last_revised_at: now } : r));
    setSelected(prev => prev?.ecdd_id === ecddId ? { ...prev, status, decision_notes: decisionNotes, last_revised_at: now } : prev);
    showToast("success", `${ecddId} marked ${status} (demo)`);
  };

  const stats = {
    total: records.length,
    pending: records.filter(r => r.status === "pending").length,
    approve: records.filter(r => r.recommendation === "approve").length,
    monitor: records.filter(r => r.recommendation === "monitor").length,
    reject: records.filter(r => r.recommendation === "reject").length,
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200">
      {/* Header */}
      <div className="border-b border-navy-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Enhanced Customer Due Diligence</h1>
            <p className="text-slate-500 text-sm mt-0.5">ECDD assessments — PEP · Adverse media · Source of wealth</p>
          </div>
          <div className="flex items-center gap-3">
            {stats.pending > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-sm font-medium">
                <Clock className="w-4 h-4" />{stats.pending} pending
              </div>
            )}
            <button onClick={fetchRecords} className="btn-secondary text-sm py-2 px-4">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setTab("create")} className="btn-primary text-sm py-2 px-4">
              <Plus className="w-4 h-4" /> New ECDD
            </button>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="bg-navy-800/50 border-b border-navy-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto">
          {[
            { label: "Total",   count: stats.total,   color: "text-slate-200" },
            { label: "Pending", count: stats.pending, color: "text-amber-400" },
            { label: "Approve", count: stats.approve, color: "text-emerald-400" },
            { label: "Monitor", count: stats.monitor, color: "text-amber-400" },
            { label: "Reject",  count: stats.reject,  color: "text-red-400" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-slate-500 text-xs">{label}</span>
              <span className={`font-bold text-sm ${color}`}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-navy-800 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { id: "records" as Tab, label: "Records", Icon: ShieldCheck },
            { id: "create" as Tab, label: "New Assessment", Icon: Plus },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                tab === id ? "border-brand-400 text-brand-400" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {tab === "records" && (
          <RecordsTable records={records} onSelect={setSelected} />
        )}

        {tab === "create" && (
          <CreateECDDForm
            onCreated={(r) => {
              setRecords(prev => [r, ...prev]);
              showToast("success", `${r.ecdd_id} created — score ${r.enhanced_risk_score.toFixed(0)}/100`);
              setTab("records");
            }}
          />
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <DetailDrawer
          record={selected}
          onClose={() => setSelected(null)}
          onDecide={decideECDD}
          onExported={(msg) => showToast("success", msg)}
        />
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
