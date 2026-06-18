"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  FolderOpen, Upload, Download, Archive, Trash2, FileText,
  File, Image, Search, Filter, AlertTriangle, CheckCircle,
  HardDrive, X, Plus,
} from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Doc {
  doc_id: string;
  filename: string;
  mime_type?: string;
  size_bytes: number;
  category: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  uploaded_by: string;
  status: string;
  created_at?: string;
}

const CATEGORIES = [
  "kyc", "aml", "report", "case", "ecdd", "contract", "policy", "correspondence", "other",
];

const DEMO_DOCS: Doc[] = [
  { doc_id: "DOC-A1B2C3", filename: "passport_nguyen_trading.pdf", mime_type: "application/pdf", size_bytes: 2_450_000, category: "kyc", description: "Certified copy of director passport", entity_type: "customer", entity_id: "ACE-00192", uploaded_by: "USR-ADMIN", status: "active", created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { doc_id: "DOC-D4E5F6", filename: "aml_assessment_q2_2025.pdf", mime_type: "application/pdf", size_bytes: 1_100_000, category: "aml", description: "Q2 2025 AML risk assessment", entity_type: "report", entity_id: "RPT-0041", uploaded_by: "USR-MLRO", status: "active", created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { doc_id: "DOC-G7H8I9", filename: "bank_statement_oct2025.xlsx", mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size_bytes: 385_000, category: "kyc", description: "3-month bank statement for EDD", entity_type: "customer", entity_id: "ACE-00201", uploaded_by: "USR-ADMIN", status: "active", created_at: new Date(Date.now() - 86400000 * 14).toISOString() },
  { doc_id: "DOC-J0K1L2", filename: "case_evidence_CASE-2025-0088.pdf", mime_type: "application/pdf", size_bytes: 980_000, category: "case", description: "Transaction screenshots and correspondence", entity_type: "case", entity_id: "CASE-2025-0088", uploaded_by: "USR-MLRO", status: "active", created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
  { doc_id: "DOC-M3N4O5", filename: "aml_ctf_policy_v3.pdf", mime_type: "application/pdf", size_bytes: 4_200_000, category: "policy", description: "AML/CTF Program Policy — current version", uploaded_by: "USR-ADMIN", status: "active", created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { doc_id: "DOC-P6Q7R8", filename: "austrac_correspondence_jan2025.pdf", mime_type: "application/pdf", size_bytes: 560_000, category: "correspondence", description: "AUSTRAC acknowledgement of TTR submission", uploaded_by: "USR-MLRO", status: "archived", created_at: new Date(Date.now() - 86400000 * 60).toISOString() },
];

const CAT_COLOR: Record<string, string> = {
  kyc: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  aml: "text-red-400 bg-red-500/10 border-red-500/20",
  report: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  case: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  ecdd: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  contract: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  policy: "text-green-400 bg-green-500/10 border-green-500/20",
  correspondence: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  other: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

function fileIcon(mime?: string) {
  if (!mime) return <File className="w-5 h-5" />;
  if (mime.startsWith("image/")) return <Image className="w-5 h-5" />;
  if (mime.includes("pdf")) return <FileText className="w-5 h-5" />;
  return <File className="w-5 h-5" />;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function relTime(iso?: string): string {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>(DEMO_DOCS);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCat, setUploadCat] = useState("other");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadEntity, setUploadEntity] = useState("");
  const [uploadEntityId, setUploadEntityId] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [stats, setStats] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const user = typeof window !== "undefined" ? getStoredUser() : null;
  const canDelete = user?.role === "admin" || user?.role === "mlro";

  useEffect(() => { if (!user) { router.push("/login"); return; } load(); }, []);

  

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dr, sr] = await Promise.all([
        fetch(`${API}/api/v1/documents?limit=200`, { credentials: "include" }),
        fetch(`${API}/api/v1/documents/stats`, { credentials: "include" }),
      ]);
      if (!dr.ok) throw new Error("api");
      setDocs(await dr.json());
      if (sr.ok) setStats(await sr.json());
    } catch {
      setDemo(true);
      setStats({ total: DEMO_DOCS.length, total_bytes: DEMO_DOCS.reduce((s, d) => s + d.size_bytes, 0), by_category: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("category", uploadCat);
      if (uploadDesc) fd.append("description", uploadDesc);
      if (uploadEntity) fd.append("entity_type", uploadEntity);
      if (uploadEntityId) fd.append("entity_id", uploadEntityId);

      const res = await fetch(`${API}/api/v1/documents`, {
        method: "POST", credentials: "include", body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }
      const newDoc: Doc = await res.json();
      setDocs(prev => [newDoc, ...prev]);
      setShowUpload(false);
      setUploadFile(null); setUploadDesc(""); setUploadEntity(""); setUploadEntityId("");
    } catch (e: any) {
      // Demo mode: add locally
      const fakeDoc: Doc = {
        doc_id: `DOC-${Date.now()}`,
        filename: uploadFile.name,
        mime_type: uploadFile.type,
        size_bytes: uploadFile.size,
        category: uploadCat,
        description: uploadDesc,
        entity_type: uploadEntity || undefined,
        entity_id: uploadEntityId || undefined,
        uploaded_by: user?.user_id ?? "you",
        status: "active",
        created_at: new Date().toISOString(),
      };
      setDocs(prev => [fakeDoc, ...prev]);
      setShowUpload(false);
      setUploadFile(null); setUploadDesc(""); setUploadEntity(""); setUploadEntityId("");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: Doc) => {
    try {
      const res = await fetch(`${API}/api/v1/documents/${doc.doc_id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Download not available in demo mode");
    }
  };

  const handleArchive = async (doc_id: string) => {
    setDocs(prev => prev.map(d => d.doc_id === doc_id ? { ...d, status: "archived" } : d));
    try {
      await fetch(`${API}/api/v1/documents/${doc_id}/archive`, { method: "POST", credentials: "include" });
    } catch {}
  };

  const handleDelete = async (doc_id: string) => {
    if (!confirm("Permanently delete this document?")) return;
    setDocs(prev => prev.filter(d => d.doc_id !== doc_id));
    try {
      await fetch(`${API}/api/v1/documents/${doc_id}`, { method: "DELETE", credentials: "include" });
    } catch {}
  };

  const visible = docs.filter(d => {
    if (!showArchived && d.status !== "active") return false;
    if (catFilter !== "all" && d.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return d.filename.toLowerCase().includes(q) ||
        (d.description ?? "").toLowerCase().includes(q) ||
        (d.entity_id ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-navy-950 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><FolderOpen className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Document Vault</h1>
              <p className="text-sm text-slate-400">Compliance documents, KYC records, and evidence</p>
            </div>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />Upload Document
          </button>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — showing sample documents
          </div>
        )}

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-xl font-bold">{stats.total}</div>
              <div className="text-xs text-slate-400">Documents</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-xl font-bold">{fmtSize(stats.total_bytes)}</div>
              <div className="text-xs text-slate-400">Storage used</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-xl font-bold">{docs.filter(d => d.status === "active").length}</div>
              <div className="text-xs text-slate-400">Active</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <div className="text-xl font-bold">{docs.filter(d => d.status === "archived").length}</div>
              <div className="text-xs text-slate-400">Archived</div>
            </div>
          </div>
        )}

        {/* Upload modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="bg-navy-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Upload Document</h3>
                <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/50 transition-colors"
              >
                {uploadFile ? (
                  <div>
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm font-medium">{uploadFile.name}</p>
                    <p className="text-xs text-slate-400">{fmtSize(uploadFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Click to select a file</p>
                    <p className="text-xs text-slate-500 mt-1">PDF, images, Word, Excel, CSV — max 50 MB</p>
                  </div>
                )}
                <input
                  ref={fileRef} type="file" className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <select
                value={uploadCat} onChange={e => setUploadCat(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
              >
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
              </select>

              <input
                value={uploadDesc} onChange={e => setUploadDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={uploadEntity} onChange={e => setUploadEntity(e.target.value)}
                  placeholder="Entity type (customer…)"
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  value={uploadEntityId} onChange={e => setUploadEntityId(e.target.value)}
                  placeholder="Entity ID (ACE-…)"
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {uploadError && <p className="text-red-400 text-sm">{uploadError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  {uploading ? "Uploading…" : "Upload"}
                </button>
                <button
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
                >Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search files…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all" className="bg-slate-900">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
          </select>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${showArchived ? "border-blue-500 text-blue-400 bg-blue-500/10" : "border-white/10 text-slate-400 hover:text-white"}`}
          >
            {showArchived ? "Hiding archived" : "Show archived"}
          </button>
        </div>

        {/* Document list */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            No documents found
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(doc => (
              <div
                key={doc.doc_id}
                className={`rounded-xl border p-4 transition-all ${doc.status === "archived" ? "bg-white/2 border-white/5 opacity-60" : "bg-white/5 border-white/10 hover:bg-white/7"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-slate-400 flex-shrink-0 mt-0.5">{fileIcon(doc.mime_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm truncate max-w-xs">{doc.filename}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CAT_COLOR[doc.category] ?? CAT_COLOR.other}`}>
                        {doc.category}
                      </span>
                      {doc.status === "archived" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/20">archived</span>
                      )}
                    </div>
                    {doc.description && <p className="text-xs text-slate-400 mb-1">{doc.description}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span>{fmtSize(doc.size_bytes)}</span>
                      {doc.entity_id && <span>{doc.entity_type}: <span className="text-slate-400 font-mono">{doc.entity_id}</span></span>}
                      <span>{relTime(doc.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Download"
                    ><Download className="w-4 h-4" /></button>
                    {doc.status === "active" && (
                      <button
                        onClick={() => handleArchive(doc.doc_id)}
                        className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-colors"
                        title="Archive"
                      ><Archive className="w-4 h-4" /></button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(doc.doc_id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      ><Trash2 className="w-4 h-4" /></button>
                    )}
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
