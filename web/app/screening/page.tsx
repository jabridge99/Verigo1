"use client";

import { useState } from "react";
import { Zap, Shield, User, Search, Building2, MapPin, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Category = "sanctions" | "pep" | "adverse_media" | "company" | "address";

const TABS: { id: Category; label: string; icon: any; placeholder: string }[] = [
  { id: "sanctions", label: "Sanctions", icon: Shield, placeholder: "Full name to screen…" },
  { id: "pep", label: "PEP", icon: User, placeholder: "Full name to screen…" },
  { id: "adverse_media", label: "Adverse Media", icon: Search, placeholder: "Full name to screen…" },
  { id: "company", label: "Company", icon: Building2, placeholder: "Company or registry name…" },
  { id: "address", label: "Address", icon: MapPin, placeholder: "Address to validate…" },
];

interface Result {
  category: string;
  query: string;
  match_found: boolean;
  matches?: { name: string; id: string; list: string }[];
  lists_checked?: string[];
  match_count?: number;
  status?: string;
  valid?: boolean;
  normalized?: string;
  note?: string;
  disclaimer: string;
}

export default function ScreeningHubPage() {
  const [tab, setTab] = useState<Category>("sanctions");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const active = TABS.find(t => t.id === tab)!;

  const runScreen = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/v1/screening/quick-screen`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: tab, query: query.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message || "Screening failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Zap className="w-6 h-6 text-brand-400" /> Screening Hub
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Unified intelligence — sanctions, PEP, adverse media, company registry, address validation.
        </p>
      </div>

      <div className="flex gap-1 bg-navy-800/50 border border-navy-700 rounded-xl p-1 w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setQuery(""); setResult(null); setError(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? "bg-white text-navy-900" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-navy-800/40 border border-navy-700 rounded-xl p-6 space-y-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") runScreen(); }}
          placeholder={active.placeholder}
          className="w-full px-4 py-3 rounded-lg bg-navy-900 border border-navy-700 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={runScreen}
          disabled={loading || !query.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Run Screen
        </button>

        {error && (
          <div className="flex items-start gap-2 text-red-400 text-sm p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div className={`rounded-lg border p-4 space-y-2 ${
            result.match_found || result.valid === false
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-emerald-500/30 bg-emerald-500/10"
          }`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {result.match_found || result.valid === false ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
              {result.category === "address"
                ? result.valid ? "Address appears valid" : "Address could not be validated"
                : result.match_found ? "Potential match found" : "No matches found"}
            </div>
            {result.matches && result.matches.length > 0 && (
              <ul className="text-sm text-slate-300 space-y-1">
                {result.matches.map(m => (
                  <li key={m.id}>{m.name} — {m.list}</li>
                ))}
              </ul>
            )}
            {result.normalized && (
              <p className="text-sm text-slate-300">Normalized: {result.normalized}</p>
            )}
            <p className="text-xs text-slate-500">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
