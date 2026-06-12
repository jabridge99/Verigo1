"use client";

import { useState, useEffect } from "react";
import {
  Palette, Save, RotateCcw, Eye, Shield, CheckCircle,
  AlertTriangle, Globe, Mail, Type, Image,
} from "lucide-react";
import { getStoredUser, getToken } from "@/lib/auth";
import { fetchBranding, saveBranding, resetBranding, applyBrandingToDOM, DEFAULT_BRANDING, BrandingConfig } from "@/lib/branding";
import { useRouter } from "next/navigation";

const PRESET_PALETTES = [
  { name: "Verigo", primary: "#2563eb", accent: "#f59e0b", bg: "#060d1a" },
  { name: "Midnight Green",  primary: "#059669", accent: "#34d399", bg: "#022c22" },
  { name: "Royal Purple",    primary: "#7c3aed", accent: "#a78bfa", bg: "#0d0414" },
  { name: "Crimson",         primary: "#dc2626", accent: "#fbbf24", bg: "#0c0303" },
  { name: "Ocean",           primary: "#0284c7", accent: "#38bdf8", bg: "#020b14" },
  { name: "Slate Pro",       primary: "#475569", accent: "#94a3b8", bg: "#0a0d12" },
];

function ColorSwatch({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-slate-400 w-32 flex-shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={value || "#000000"}
          onChange={e => onChange(e.target.value)}
          className="w-9 h-9 rounded cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder="#2563eb"
          className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm font-mono focus:outline-none focus:border-blue-500"
        />
        <div className="w-8 h-8 rounded-lg border border-white/10 flex-shrink-0" style={{ background: value || "transparent" }} />
      </div>
    </div>
  );
}

export default function BrandingPage() {
  const router = useRouter();
  const [config, setConfig] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [demo, setDemo] = useState(false);

  const user = typeof window !== "undefined" ? getStoredUser() : null;

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (user.role !== "admin") { router.push("/dashboard"); return; }
    load();
  }, []);

  const load = async () => {
    const b = await fetchBranding(user?.industry_id ?? undefined);
    setConfig(b);
    if (!b.tenant_id) setDemo(true);
  };

  const set = (key: keyof BrandingConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await saveBranding(getToken()!, config);
      setConfig(updated);
      applyBrandingToDOM(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all branding to Verigo defaults?")) return;
    try {
      await resetBranding(getToken()!);
      setConfig(DEFAULT_BRANDING);
      applyBrandingToDOM(DEFAULT_BRANDING);
    } catch {
      setConfig(DEFAULT_BRANDING);
    }
  };

  const applyPreset = (p: typeof PRESET_PALETTES[0]) => {
    setConfig(prev => ({ ...prev, primary_color: p.primary, accent_color: p.accent, bg_color: p.bg }));
    setSaved(false);
  };

  return (
    <div className="min-h-screen bg-navy-950 text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><Palette className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">White-label Branding</h1>
              <p className="text-sm text-slate-400">Customise the platform for your organisation</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPreview(!preview)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${preview ? "border-purple-500 text-purple-400 bg-purple-500/10" : "border-white/10 text-slate-400 hover:text-white"}`}
            >
              <Eye className="w-4 h-4" />Preview
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {saved ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : saved ? "Saved!" : "Save Changes"}
            </button>
          </div>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            No active tenant found for your account — changes will save to defaults only.
          </div>
        )}
        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {/* Live preview strip */}
        {preview && (
          <div
            className="mb-6 rounded-xl border border-white/10 p-4 overflow-hidden"
            style={{ background: config.bg_color || "#060d1a" }}
          >
            <div className="flex items-center gap-3 mb-3">
              {config.logo_url ? (
                <img src={config.logo_url} alt="logo" className="h-8 object-contain" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: config.primary_color }}>
                  <Shield className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="font-bold text-lg text-white">{config.company_name || "Your Company"}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: config.primary_color }}>
                Primary Button
              </span>
              <span className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: config.accent_color }}>
                Accent Button
              </span>
            </div>
            {!config.hide_tvg_badge && (
              <p className="text-xs mt-3" style={{ color: config.primary_color }}>Powered by Verigo</p>
            )}
            <p className="text-xs text-slate-500 mt-1">{config.footer_text}</p>
          </div>
        )}

        <div className="space-y-6">

          {/* Identity */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold">Identity</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-32 flex-shrink-0">Company name</label>
                <input
                  value={config.company_name || ""}
                  onChange={e => set("company_name", e.target.value)}
                  placeholder="Your Company Name"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-32 flex-shrink-0">Footer tagline</label>
                <input
                  value={config.footer_text || ""}
                  onChange={e => set("footer_text", e.target.value)}
                  placeholder="Your Compliance Platform"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-32 flex-shrink-0">Support email</label>
                <input
                  value={config.support_email || ""}
                  onChange={e => set("support_email", e.target.value)}
                  placeholder="compliance@yourcompany.com"
                  type="email"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-32 flex-shrink-0">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Hide TVG badge</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => set("hide_tvg_badge", !config.hide_tvg_badge)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${config.hide_tvg_badge ? "bg-blue-600" : "bg-white/10"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.hide_tvg_badge ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm text-slate-400">Remove "Powered by Verigo"</span>
                </label>
              </div>
            </div>
          </section>

          {/* Colours */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold">Colour Palette</h3>
            </div>

            {/* Presets */}
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2">Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_PALETTES.map(p => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs transition-colors"
                  >
                    <span className="flex gap-0.5">
                      {[p.primary, p.accent, p.bg].map((c, i) => (
                        <span key={i} className="w-3 h-3 rounded-full border border-white/20" style={{ background: c }} />
                      ))}
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <ColorSwatch label="Primary colour" value={config.primary_color || ""} onChange={v => set("primary_color", v)} />
              <ColorSwatch label="Accent colour"  value={config.accent_color || ""}  onChange={v => set("accent_color", v)} />
              <ColorSwatch label="Background"      value={config.bg_color || ""}      onChange={v => set("bg_color", v)} />
            </div>
          </section>

          {/* Logos */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Image className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold">Logos & Icons</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <label className="text-sm text-slate-400 w-32 flex-shrink-0 pt-2">Logo URL</label>
                <div className="flex-1 space-y-2">
                  <input
                    value={config.logo_url || ""}
                    onChange={e => set("logo_url", e.target.value || null)}
                    placeholder="https://cdn.yourcompany.com/logo.svg"
                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {config.logo_url && (
                    <img src={config.logo_url} alt="logo preview" className="h-10 object-contain rounded border border-white/10 p-1 bg-white/5" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-400 w-32 flex-shrink-0">Favicon URL</label>
                <input
                  value={config.favicon_url || ""}
                  onChange={e => set("favicon_url", e.target.value || null)}
                  placeholder="https://cdn.yourcompany.com/favicon.ico"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </section>

          {/* Domain */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold">Custom Domain</h3>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-400 w-32 flex-shrink-0">Domain</label>
              <input
                value={config.custom_domain || ""}
                onChange={e => set("custom_domain", e.target.value || null)}
                placeholder="compliance.yourcompany.com"
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-slate-500 mt-3 ml-0">
              Add a CNAME record pointing <code className="text-blue-400">compliance.yourcompany.com</code> → <code className="text-blue-400">app.verigo.com.au</code>, then enter the domain above.
            </p>
          </section>

          {/* CSS snippet */}
          <section className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Embed branding in external tools</h4>
            <p className="text-sm text-slate-400 mb-3">Fetch your brand CSS variables from the public endpoint to style external portals consistently.</p>
            <pre className="text-xs bg-black/40 rounded-lg p-3 text-green-300 overflow-x-auto">{`/* Load in your <head> */
<link rel="stylesheet" href="${process.env.NEXT_PUBLIC_API_URL ?? "https://api.verigo.com.au"}/api/v1/branding/css?industry_id=YOUR_INDUSTRY_ID" />`}</pre>
          </section>

        </div>
      </div>
    </div>
  );
}
