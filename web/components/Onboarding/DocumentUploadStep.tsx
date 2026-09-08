"use client";

import { useCallback, useState } from "react";
import { Upload, CheckCircle, AlertCircle, FileText } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Session {
  session_id: string;
  applicant_name: string;
  applicant_email: string;
  status: string;
  documents_uploaded: number;
  customer_id?: string;
}

interface Props {
  sessions: Session[];
  onUploaded: (sessionId: string) => void;
}

export default function DocumentUploadStep({ sessions, onUploaded }: Props) {
  const [selected, setSelected] = useState<Session | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  const uploadFile = useCallback(async (file: File) => {
    if (!selected) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("category", "identity");
    // Tied to the customer record (not the onboarding session) so the
    // document shows up on the customer's profile, where compliance does
    // the actual KYC review.
    form.append("entity_type", "customer");
    form.append("entity_id", selected.customer_id || selected.session_id);
    try {
      const res = await fetch(`${API}/api/v1/documents`, { method: "POST", credentials: "include", body: form });
      if (!res.ok) throw new Error(await res.text());
      setRecent(prev => [file.name, ...prev]);
      onUploaded(selected.session_id);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [selected, onUploaded]);

  const eligible = sessions.filter(s => !["completed", "rejected", "expired", "abandoned"].includes(s.status));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-1">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Select applicant</p>
        <div className="space-y-1 max-h-[28rem] overflow-y-auto pr-1">
          {eligible.length === 0 && <p className="text-sm text-slate-500 py-4">No applicants awaiting documents.</p>}
          {eligible.map(s => (
            <button
              key={s.session_id}
              onClick={() => { setSelected(s); setRecent([]); setError(null); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selected?.session_id === s.session_id ? "bg-brand-600/15 text-brand-400 border border-brand-500/40" : "text-slate-300 hover:bg-navy-800 border border-transparent"
              }`}
            >
              <div className="font-medium">{s.applicant_name}</div>
              <div className="text-xs text-slate-500">{s.applicant_email} · {s.documents_uploaded} doc{s.documents_uploaded === 1 ? "" : "s"}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        {!selected ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm border border-dashed border-navy-700 rounded-xl">
            Select an applicant to upload identity documents on their behalf
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-slate-400">
              Uploading for <span className="text-slate-200 font-medium">{selected.applicant_name}</span>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) uploadFile(file);
              }}
              className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
                ${dragging ? "border-brand-400 bg-brand-500/10" : "border-navy-600 hover:border-navy-500"}`}
            >
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                  <span>Uploading…</span>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-300 font-medium mb-1">Drop ID document here</p>
                  <p className="text-slate-500 text-sm">or click to browse — passport, licence, proof of address</p>
                </>
              )}
            </div>

            {recent.length > 0 && (
              <div className="space-y-1.5">
                {recent.map((name, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-emerald-300">
                    <CheckCircle className="w-4 h-4" /> <FileText className="w-4 h-4" /> {name}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
