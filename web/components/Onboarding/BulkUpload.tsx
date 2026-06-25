"use client";

import { useState, useCallback } from "react";
import { Upload, AlertCircle, CheckCircle, Download } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface UploadResult {
  batch_id: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  errors?: Array<{ row: number; error: string }>;
}

interface Props {
  industryId: string;
  onComplete: (batchId: string) => void;
}

export default function BulkUpload({ industryId, onComplete }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const endpoint = ext === "xlsx" || ext === "xls" ? "/import/excel" : "/import/csv";
    const form = new FormData();
    form.append("industry_id", industryId);
    form.append("file", file);
    try {
      const res = await fetch(`${API}/api/v1/onboarding${endpoint}`, { method: "POST", credentials: "include", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      if (data.batch_id) onComplete(data.batch_id);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [industryId, onComplete]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer
          ${dragging ? "border-brand-400 bg-brand-500/10" : "border-navy-600 hover:border-navy-500"}`}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <span>Uploading and processing…</span>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium mb-1">Drop CSV or Excel file here</p>
            <p className="text-slate-500 text-sm">or click to browse — .csv, .xlsx supported</p>
          </>
        )}
      </div>

      <a
        href="/api/v1/onboarding/import/template"
        download="onboarding_template.csv"
        className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
      >
        <Download className="w-4 h-4" />
        Download CSV template
      </a>

      {result && (
        <div className="rounded-xl border border-navy-700 bg-navy-800 p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle className="w-5 h-5" />
            Import complete
          </div>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-xl font-bold text-slate-200">{result.total_rows}</div>
              <div className="text-slate-500">Total rows</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-400">{result.success_rows}</div>
              <div className="text-slate-500">Imported</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-400">{result.error_rows}</div>
              <div className="text-slate-500">Skipped</div>
            </div>
          </div>
          {result.errors && result.errors.length > 0 && (
            <div className="mt-3 border-t border-navy-700 pt-3 space-y-1">
              {result.errors.map((e, i) => (
                <div key={i} className="text-xs text-red-400 flex gap-2">
                  <span className="text-slate-500">Row {e.row}:</span>
                  {e.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-red-400 text-sm p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
