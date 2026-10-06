"use client";

import { useState } from "react";
import { Search, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, TableEmptyRow } from "@/components/ui/table";
import type { ECDDRecord } from "@/lib/api/reports";
import { TRIGGER_LABEL, REC_TONE, STATUS_TONE, SCORE_COLOR } from "./shared";

export default function RecordsTable({ records, onSelect }: { records: ECDDRecord[]; onSelect: (r: ECDDRecord) => void }) {
  const [search, setSearch] = useState("");
  const [recFilter, setRecFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (!search || r.ecdd_id.toLowerCase().includes(q) || (TRIGGER_LABEL[r.trigger_reason] || r.trigger_reason).toLowerCase().includes(q))
      && (recFilter === "all" || r.recommendation === recFilter)
      && (statusFilter === "all" || r.status === statusFilter);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
            placeholder="Search ECDD records…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={recFilter} onChange={e => setRecFilter(e.target.value)}
          className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
          {["all","approve","monitor","reject"].map(v => (
            <option key={v} value={v}>{v === "all" ? "Recommendation — All" : v.charAt(0).toUpperCase() + v.slice(1)}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500">
          {["all","pending","completed","rejected"].map(v => (
            <option key={v} value={v}>{v === "all" ? "Status — All" : v.charAt(0).toUpperCase() + v.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-navy-700">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>ECDD ID</TableHeaderCell>
              <TableHeaderCell>Trigger</TableHeaderCell>
              <TableHeaderCell>Risk Score</TableHeaderCell>
              <TableHeaderCell>Flags</TableHeaderCell>
              <TableHeaderCell>Recommendation</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell />
            </tr>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableEmptyRow colSpan={8}>No ECDD records found</TableEmptyRow>
            ) : filtered.map(r => (
              <TableRow key={r.ecdd_id} onClick={() => onSelect(r)}>
                <TableCell className="font-mono text-xs text-slate-400">{r.ecdd_id}</TableCell>
                <TableCell className="max-w-xs">
                  <div className="text-slate-300 text-xs line-clamp-2">{TRIGGER_LABEL[r.trigger_reason] || r.trigger_reason}{r.trigger_reason === "other" && r.trigger_reason_other ? ` — ${r.trigger_reason_other}` : ""}</div>
                </TableCell>
                <TableCell>
                  <span className={`font-bold text-sm ${SCORE_COLOR(r.enhanced_risk_score)}`}>
                    {r.enhanced_risk_score.toFixed(0)}
                  </span>
                  <span className="text-slate-600 text-xs">/100</span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {r.pep_status ? <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">PEP</span> : null}
                    {r.adverse_media_found ? <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-300 border border-red-500/30">Adverse</span> : null}
                    {!r.beneficial_owner_verified ? <span className="px-1.5 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">BO?</span> : null}
                    {!r.source_of_wealth_verified ? <span className="px-1.5 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">SOW?</span> : null}
                    {!r.pep_status && !r.adverse_media_found && r.beneficial_owner_verified && r.source_of_wealth_verified
                      ? <span className="text-slate-600 text-xs">None</span> : null}
                  </div>
                </TableCell>
                <TableCell>
                  {r.recommendation && (
                    <Badge tone={REC_TONE[r.recommendation] ?? "neutral"} bordered>
                      {r.recommendation}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {r.created_at ? new Date(r.created_at).toLocaleDateString("en-AU") : "—"}
                </TableCell>
                <TableCell>
                  <Eye className="w-4 h-4 text-slate-600 hover:text-brand-400 transition-colors" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-slate-500 text-right">{filtered.length} of {records.length} records</div>
    </div>
  );
}
