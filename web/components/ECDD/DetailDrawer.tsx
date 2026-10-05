"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Download, User, Scale } from "lucide-react";
import clsx from "clsx";
import QuickActions from "@/components/QuickActions";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import type { ECDDRecord } from "@/lib/api/reports";
import { TRIGGER_LABEL, REC_TONE, STATUS_TONE, STATUS_COLOR, SCORE_COLOR } from "./shared";

function exportEcdd(r: ECDDRecord, onExported: () => void) {
  const lines = [
    `ENHANCED CUSTOMER DUE DILIGENCE ASSESSMENT`,
    `ECDD ID: ${r.ecdd_id}`,
    `Customer ID: ${r.customer_id}`,
    `Status: ${r.status}`,
    `Recommendation: ${r.recommendation || "—"}`,
    `Enhanced risk score: ${r.enhanced_risk_score}/100`,
    "",
    `Trigger reason:\n${TRIGGER_LABEL[r.trigger_reason] || r.trigger_reason}${r.trigger_reason_other ? ` — ${r.trigger_reason_other}` : ""}`,
    "",
    `PEP status: ${r.pep_status ? "Yes" : "No"}`,
    `Adverse media found: ${r.adverse_media_found ? "Yes" : "No"}`,
    `Beneficial owner verified: ${r.beneficial_owner_verified ? "Yes" : "No"}`,
    `Source of wealth verified: ${r.source_of_wealth_verified ? "Yes" : "No"}`,
    r.source_of_funds ? `\nSource of funds:\n${r.source_of_funds}` : "",
    r.purpose_of_transaction ? `\nPurpose of transaction:\n${r.purpose_of_transaction}` : "",
    r.tax_risk_notes ? `\nTax risk indicators:\n${r.tax_risk_notes}` : "",
    r.investment_legitimacy_notes ? `\nInvestment legitimacy:\n${r.investment_legitimacy_notes}` : "",
    r.analyst_notes ? `\nAnalyst notes:\n${r.analyst_notes}` : "",
    "",
    `Created: ${r.created_at ? new Date(r.created_at).toLocaleString("en-AU") : "—"}`,
  ].filter(Boolean).join("\n");
  const blob = new Blob([lines], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${r.ecdd_id}.txt`; a.click();
  URL.revokeObjectURL(url);
  onExported();
}

const DECISION_STATUSES = ["pending", "completed", "rejected"] as const;

function DecisionPanel({ record, onDecide }: { record: ECDDRecord; onDecide: (ecddId: string, status: string, notes: string) => Promise<void> }) {
  const [status, setStatus] = useState(record.status);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setStatus(record.status); setNotes(""); }, [record.id, record.status]);

  const submit = async () => {
    if (!notes.trim()) return;
    setSubmitting(true);
    try { await onDecide(record.ecdd_id, status, notes); } finally { setSubmitting(false); }
  };

  return (
    <div className="border-t border-navy-700 pt-4 space-y-3">
      <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Decision — accept, reject, or revert</div>
      <p className="text-xs text-slate-500">
        Status is fully reversible — a completed or rejected assessment can be moved back to any other status. Every change is timestamped and requires a rationale.
      </p>

      <div className="flex gap-2">
        {DECISION_STATUSES.map(s => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={clsx("flex-1 px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-colors",
              status === s ? STATUS_COLOR[s] + " border-current" : "bg-navy-900 border-navy-700 text-slate-500 hover:border-navy-600")}>
            {s}
          </button>
        ))}
      </div>

      <textarea className="field-input min-h-[80px] resize-none" placeholder="Decision notes — why is this customer being accepted, rejected, or reverted? (required)"
        value={notes} onChange={e => setNotes(e.target.value)} />

      <button type="button" disabled={submitting || !notes.trim() || status === record.status} onClick={submit}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-medium transition-colors w-full justify-center">
        {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {status === record.status ? "Select a different status to revise" : `Record decision — mark ${status}`}
      </button>

      {(record.decided_by || record.decided_at) && (
        <div className="text-xs text-slate-500 space-y-0.5 pt-1">
          {record.decision_notes && <div className="text-slate-400 italic">&ldquo;{record.decision_notes}&rdquo;</div>}
          {record.decided_by && <div>Decided by: {record.decided_by}</div>}
          {record.decided_at && <div>Decided at: {new Date(record.decided_at).toLocaleString("en-AU")}</div>}
          {record.last_revised_at && <div>Last revised: {new Date(record.last_revised_at).toLocaleString("en-AU")}</div>}
        </div>
      )}
    </div>
  );
}

export default function DetailDrawer({ record, onClose, onDecide, onExported }: {
  record: ECDDRecord;
  onClose: () => void;
  onDecide: (ecddId: string, status: string, notes: string) => Promise<void>;
  onExported: (msg: string) => void;
}) {
  return (
    <Drawer onClose={onClose} size="lg">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-xs text-slate-500 mb-1">{record.ecdd_id}</div>
          <div className="flex items-center gap-2 flex-wrap">
            {record.recommendation && (
              <Badge tone={REC_TONE[record.recommendation] ?? "neutral"} bordered>
                {record.recommendation}
              </Badge>
            )}
            <Badge tone={STATUS_TONE[record.status] ?? "neutral"}>
              {record.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => exportEcdd(record, () => onExported(`${record.ecdd_id} exported`))} title="Export assessment" className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 hover:text-brand-400 transition-colors">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-navy-700 text-slate-400 text-lg leading-none">&times;</button>
        </div>
      </div>

      {/* Risk score dial */}
      <div className="rounded-xl bg-navy-900 border border-navy-700 p-4 text-center">
        <div className={`text-5xl font-bold ${SCORE_COLOR(record.enhanced_risk_score)}`}>
          {record.enhanced_risk_score.toFixed(0)}
        </div>
        <div className="text-slate-500 text-xs mt-1">Enhanced Risk Score / 100</div>
        <div className="mt-3 h-2 rounded-full bg-navy-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${record.enhanced_risk_score >= 80 ? "bg-red-500" : record.enhanced_risk_score >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${record.enhanced_risk_score}%` }}
          />
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Trigger reason</div>
        <div className="text-sm text-slate-300 leading-relaxed">
          {TRIGGER_LABEL[record.trigger_reason] || record.trigger_reason}
          {record.trigger_reason === "other" && record.trigger_reason_other ? ` — ${record.trigger_reason_other}` : ""}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "PEP status", value: record.pep_status ? "⚠ Yes — PEP identified" : "✓ Not a PEP", ok: !record.pep_status },
          { label: "Adverse media", value: record.adverse_media_found ? "⚠ Adverse media found" : "✓ No adverse media", ok: !record.adverse_media_found },
          { label: "Beneficial owner", value: record.beneficial_owner_verified ? "✓ Verified" : "✗ Not verified", ok: !!record.beneficial_owner_verified },
          { label: "Source of wealth", value: record.source_of_wealth_verified ? "✓ Verified" : "✗ Not verified", ok: !!record.source_of_wealth_verified },
        ].map(({ label, value, ok }) => (
          <div key={label} className={`rounded-lg p-3 border text-xs ${ok ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            <div className="text-slate-500 mb-0.5">{label}</div>
            <div className={ok ? "text-emerald-300" : "text-red-300"}>{value}</div>
          </div>
        ))}
      </div>

      {[
        { label: "Source of funds", value: record.source_of_funds },
        { label: "Purpose of transaction", value: record.purpose_of_transaction },
        { label: "Tax risk indicators", value: record.tax_risk_notes },
        { label: "Investment legitimacy", value: record.investment_legitimacy_notes },
        { label: "Analyst notes", value: record.analyst_notes },
      ].filter(f => f.value).map(f => (
        <div key={f.label}>
          <div className="text-xs text-slate-500 mb-1 uppercase tracking-wide">{f.label}</div>
          <div className="text-sm text-slate-300 leading-relaxed bg-navy-900 rounded-lg p-3 border border-navy-700">{f.value}</div>
        </div>
      ))}

      <div className="text-xs text-slate-500">
        Created: {record.created_at ? new Date(record.created_at).toLocaleString("en-AU") : "—"}
      </div>

      {/* Score breakdown */}
      <div className="rounded-lg bg-navy-900 border border-navy-700 p-4">
        <div className="text-xs font-medium text-slate-400 mb-3">Score breakdown</div>
        {[
          { label: "PEP identified", points: 30, active: !!record.pep_status },
          { label: "Adverse media", points: 35, active: !!record.adverse_media_found },
          { label: "BO not verified", points: 20, active: !record.beneficial_owner_verified },
          { label: "SOW not verified", points: 15, active: !record.source_of_wealth_verified },
        ].map(({ label, points, active }) => (
          <div key={label} className="flex items-center justify-between py-1.5 border-b border-navy-800 last:border-0 text-xs">
            <span className={active ? "text-slate-200" : "text-slate-600 line-through"}>{label}</span>
            <span className={active ? "text-red-400 font-medium" : "text-slate-600"}>
              {active ? `+${points}` : `+0`}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-navy-700 pt-4 space-y-3">
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Quick actions</div>
        <QuickActions actions={[
          { label: "Escalate to MLRO", href: `/mlro?customer=${record.customer_id}&action=new-case&ecdd=${record.ecdd_id}`, icon: Scale },
          { label: "View Customer", href: `/customers/${record.customer_id}`, icon: User },
        ]} />
      </div>

      <DecisionPanel record={record} onDecide={onDecide} />
    </Drawer>
  );
}
