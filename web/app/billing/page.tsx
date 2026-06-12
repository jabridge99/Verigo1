"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, Check, Star, Zap, Shield, Crown,
  ChevronDown, ChevronUp, ExternalLink, AlertTriangle,
  Calendar, Receipt, Settings, ArrowRight, Sparkles,
} from "lucide-react";
import { getStoredUser, getToken } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface Plan {
  plan: string;
  name: string;
  monthly_aud: number | null;
  annual_aud: number | null;
  annual_discount_pct: number;
  features: string[];
  limits: Record<string, number>;
}

interface Subscription {
  subscription_id: string;
  industry_id: string;
  plan: string;
  interval: string;
  status: string;
  base_price_aud: number | null;
  custom_monthly_aud: number | null;
  custom_annual_aud: number | null;
  annual_discount_pct: number;
  trial_ends_at?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  notes?: string;
}

interface Invoice {
  invoice_id: string;
  amount_aud: number;
  tax_aud: number;
  total_aud: number;
  status: string;
  period_start?: string;
  period_end?: string;
  paid_at?: string;
  stripe_hosted_url?: string;
  stripe_pdf_url?: string;
  created_at?: string;
}

// ── Demo data ──────────────────────────────────────────────────────────────────

const DEMO_SUB: Subscription = {
  subscription_id: "SUB-DEMO001",
  industry_id: "dce-001",
  plan: "professional",
  interval: "annual",
  status: "active",
  base_price_aud: 7670.40,
  custom_monthly_aud: null,
  custom_annual_aud: null,
  annual_discount_pct: 20,
  current_period_end: new Date(Date.now() + 86400000 * 47).toISOString(),
  cancel_at_period_end: false,
};

const DEMO_INVOICES: Invoice[] = [
  { invoice_id: "INV-001", amount_aud: 6975.00, tax_aud: 697.50, total_aud: 7672.50, status: "paid", period_start: new Date(Date.now() - 86400000 * 365).toISOString(), period_end: new Date().toISOString(), paid_at: new Date(Date.now() - 86400000 * 364).toISOString(), created_at: new Date(Date.now() - 86400000 * 365).toISOString() },
  { invoice_id: "INV-002", amount_aud: 6975.00, tax_aud: 697.50, total_aud: 7672.50, status: "paid", period_start: new Date(Date.now() - 86400000 * 730).toISOString(), period_end: new Date(Date.now() - 86400000 * 365).toISOString(), paid_at: new Date(Date.now() - 86400000 * 729).toISOString(), created_at: new Date(Date.now() - 86400000 * 730).toISOString() },
];

// ── Admin VVIP panel ──────────────────────────────────────────────────────────

function AdminPricingPanel({ sub, onUpdate }: { sub: Subscription | null; onUpdate: () => void }) {
  const [industryId, setIndustryId] = useState(sub?.industry_id ?? "");
  const [plan, setPlan] = useState(sub?.plan ?? "professional");
  const [interval, setInterval] = useState(sub?.interval ?? "monthly");
  const [customMonthly, setCustomMonthly] = useState(sub?.custom_monthly_aud?.toString() ?? "");
  const [customAnnual, setCustomAnnual] = useState(sub?.custom_annual_aud?.toString() ?? "");
  const [discountPct, setDiscountPct] = useState(sub?.annual_discount_pct?.toString() ?? "20");
  const [notes, setNotes] = useState(sub?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const body: any = { plan, interval, notes };
      if (customMonthly) body.custom_monthly_aud = parseFloat(customMonthly);
      if (customAnnual)  body.custom_annual_aud  = parseFloat(customAnnual);
      if (discountPct)   body.annual_discount_pct = parseFloat(discountPct);
      const res = await fetch(`${API}/api/v1/billing/admin/${industryId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Save failed");
      setMsg("Saved successfully");
      onUpdate();
    } catch (e: any) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-amber-400" />
        <h3 className="font-semibold text-amber-400">Admin — VVIP / Custom Pricing Override</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Industry ID</label>
          <input value={industryId} onChange={e => setIndustryId(e.target.value)}
            placeholder="dce-001" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Plan</label>
          <select value={plan} onChange={e => setPlan(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500">
            {["starter","professional","enterprise","vvip","free_trial"].map(p => (
              <option key={p} value={p} className="bg-slate-900">{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Interval</label>
          <select value={interval} onChange={e => setInterval(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500">
            <option value="monthly" className="bg-slate-900">Monthly</option>
            <option value="annual"  className="bg-slate-900">Annual</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Annual discount %</label>
          <input value={discountPct} onChange={e => setDiscountPct(e.target.value)}
            type="number" min="0" max="100" step="1"
            placeholder="20" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Custom monthly AUD (blank = catalogue)</label>
          <input value={customMonthly} onChange={e => setCustomMonthly(e.target.value)}
            type="number" min="0" step="0.01"
            placeholder="e.g. 1500.00" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Custom annual AUD (blank = auto-calc)</label>
          <input value={customAnnual} onChange={e => setCustomAnnual(e.target.value)}
            type="number" min="0" step="0.01"
            placeholder="e.g. 15000.00" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500" />
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1 block">Deal notes (internal)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="VVIP deal negotiated by CEO, includes on-site training…"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500 resize-none" />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-sm font-medium transition-colors">
          {saving ? "Saving…" : "Apply Override"}
        </button>
        {msg && <span className={`text-sm ${msg.includes("success") ? "text-green-400" : "text-red-400"}`}>{msg}</span>}
      </div>
    </div>
  );
}

// ── Plan card ──────────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter:      <Zap className="w-5 h-5" />,
  professional: <Shield className="w-5 h-5" />,
  enterprise:   <Star className="w-5 h-5" />,
  vvip:         <Crown className="w-5 h-5" />,
};
const PLAN_COLORS: Record<string, string> = {
  starter:      "border-blue-500/30 hover:border-blue-500/60",
  professional: "border-purple-500/30 hover:border-purple-500/60",
  enterprise:   "border-amber-500/30 hover:border-amber-500/60",
  vvip:         "border-rose-500/30 hover:border-rose-500/60",
};
const PLAN_BADGE: Record<string, string> = {
  professional: "bg-purple-500/20 text-purple-400",
  enterprise:   "bg-amber-500/20 text-amber-400",
  vvip:         "bg-rose-500/20 text-rose-400",
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function fmtAUD(n?: number | null) {
  if (n == null) return "Custom";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

// ── Main page ─────────────────────────────────────────────────────────────────

function BillingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(DEMO_SUB);
  const [invoices, setInvoices] = useState<Invoice[]>(DEMO_INVOICES);
  const [interval, setInterval] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [tab, setTab] = useState<"plans" | "invoices" | "admin">("plans");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const user = typeof window !== "undefined" ? getStoredUser() : null;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    // Show success toast if returning from Stripe checkout
    if (params.get("mock_checkout") === "1" || params.get("session_id")) {
      setTab("plans");
    }
    load();
  }, [interval]);

  const auth = () => ({ Authorization: `Bearer ${getToken()}` });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pr, sr, ir] = await Promise.all([
        fetch(`${API}/api/v1/billing/plans?discount_pct=${interval === "annual" ? 20 : 0}`),
        fetch(`${API}/api/v1/billing/subscription`, { headers: auth() }),
        fetch(`${API}/api/v1/billing/invoices`, { headers: auth() }),
      ]);
      if (!pr.ok || !sr.ok) throw new Error("api");
      setPlans(await pr.json());
      setSub(await sr.json());
      if (ir.ok) setInvoices(await ir.json());
    } catch {
      setDemo(true);
    } finally {
      setLoading(false);
    }
  }, [interval]);

  const checkout = async (planKey: string) => {
    if (planKey === "vvip") {
      window.location.href = `mailto:sales@verigo.com.au?subject=VVIP Enquiry`;
      return;
    }
    setCheckingOut(planKey);
    try {
      const res = await fetch(`${API}/api/v1/billing/checkout`, {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planKey,
          interval,
          success_url: `${APP_URL}/billing?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${APP_URL}/billing`,
        }),
      });
      if (!res.ok) throw new Error();
      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch {
      // Mock mode — simulate redirect
      alert(`[Demo] Would redirect to Stripe Checkout for ${planKey} ${interval} plan.`);
    } finally {
      setCheckingOut(null);
    }
  };

  const openPortal = async () => {
    try {
      const res = await fetch(`${API}/api/v1/billing/portal?return_url=${encodeURIComponent(APP_URL + "/billing")}`, { headers: auth() });
      if (!res.ok) throw new Error();
      const { portal_url } = await res.json();
      window.location.href = portal_url;
    } catch {
      alert("[Demo] Would open Stripe Customer Portal.");
    }
  };

  const cancelSub = async () => {
    try {
      await fetch(`${API}/api/v1/billing/subscription/cancel?at_period_end=true`, { method: "POST", headers: auth() });
      setSub(prev => prev ? { ...prev, cancel_at_period_end: true } : prev);
    } catch {
      setSub(prev => prev ? { ...prev, cancel_at_period_end: true } : prev);
    }
    setShowCancelConfirm(false);
  };

  const STATUS_COLOR: Record<string, string> = {
    active: "bg-green-500/20 text-green-400",
    trialing: "bg-blue-500/20 text-blue-400",
    past_due: "bg-red-500/20 text-red-400",
    canceled: "bg-slate-500/20 text-slate-400",
    unpaid: "bg-red-500/20 text-red-400",
    free_trial: "bg-blue-500/20 text-blue-400",
  };

  return (
    <div className="min-h-screen bg-navy-950 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><CreditCard className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">Billing & Subscription</h1>
            <p className="text-sm text-slate-400">Manage your plan, payments, and invoices</p>
          </div>
        </div>

        {demo && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Demo mode — Stripe not configured. Set STRIPE_SECRET_KEY to enable live payments.
          </div>
        )}

        {/* Current subscription bar */}
        {sub && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                {PLAN_ICONS[sub.plan] ?? <Shield className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[sub.status] ?? "bg-slate-500/20 text-slate-400"}`}>
                    {sub.status}
                  </span>
                  {sub.cancel_at_period_end && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/20">
                      Cancels {fmtDate(sub.current_period_end)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-400">
                  {sub.interval === "annual"
                    ? `${fmtAUD(sub.custom_annual_aud ?? sub.base_price_aud)}/year`
                    : `${fmtAUD(sub.custom_monthly_aud ?? sub.base_price_aud)}/month`}
                  {sub.current_period_end && ` · Renews ${fmtDate(sub.current_period_end)}`}
                  {sub.trial_ends_at && ` · Trial ends ${fmtDate(sub.trial_ends_at)}`}
                </div>
                {sub.notes && <div className="text-xs text-amber-400 mt-0.5">{sub.notes}</div>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={openPortal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm transition-colors">
                <Settings className="w-4 h-4" />Manage
              </button>
              {!sub.cancel_at_period_end && sub.status === "active" && (
                <button onClick={() => setShowCancelConfirm(true)}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-sm text-slate-400 hover:text-red-400 transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cancel confirm */}
        {showCancelConfirm && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-4">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-400">Cancel subscription?</p>
              <p className="text-xs text-slate-400">Access continues until the end of your current period.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={cancelSub} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm transition-colors">Confirm</button>
              <button onClick={() => setShowCancelConfirm(false)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors">Keep plan</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/10">
          {([
            ["plans", "Plans", CreditCard],
            ["invoices", "Invoices", Receipt],
            ...(isAdmin ? [["admin", "Admin Override", Crown]] : []),
          ] as [string, string, React.ElementType][]).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === id ? "border-blue-500 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ── Plans tab ─────────────────────────────────────────────────── */}
        {tab === "plans" && (
          <div>
            {/* Annual/monthly toggle */}
            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-1">
                <button onClick={() => setInterval("monthly")}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${interval === "monthly" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
                  Monthly
                </button>
                <button onClick={() => setInterval("annual")}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${interval === "annual" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
                  Annual
                  <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {(plans.length ? plans : [
                { plan: "starter", name: "Starter", monthly_aud: 299, annual_aud: 2870.40, annual_discount_pct: 20, features: ["Up to 500 customers","AML monitoring","KYC/KYB","AUSTRAC reporting","Standard support"], limits: {} },
                { plan: "professional", name: "Professional", monthly_aud: 799, annual_aud: 7670.40, annual_discount_pct: 20, features: ["5,000 customers","Rule builder","ECDD","Case management","Webhooks & API","50 GB vault","Priority support"], limits: {} },
                { plan: "enterprise", name: "Enterprise", monthly_aud: 1999, annual_aud: 19190.40, annual_discount_pct: 20, features: ["Unlimited customers","White-label","Custom domain","Multi-tenant","500 GB vault","SLA 99.9%","Dedicated AM"], limits: {} },
                { plan: "vvip", name: "VVIP", monthly_aud: null, annual_aud: null, annual_discount_pct: 20, features: ["Everything in Enterprise","Custom SLA","On-site training","Regulatory liaison","Custom integrations"], limits: {} },
              ]).map(p => {
                const isCurrent = sub?.plan === p.plan;
                const price = interval === "annual" ? p.annual_aud : p.monthly_aud;
                const isVVIP = p.plan === "vvip";

                return (
                  <div key={p.plan}
                    className={`relative rounded-xl border p-5 flex flex-col transition-all ${PLAN_COLORS[p.plan] ?? "border-white/10"} ${isCurrent ? "ring-1 ring-blue-500/50" : ""} bg-white/3`}>
                    {p.plan === "professional" && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-600 text-white text-xs font-semibold whitespace-nowrap">
                        Most Popular
                      </div>
                    )}
                    {isVVIP && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-rose-600 text-white text-xs font-semibold whitespace-nowrap">
                        <Sparkles className="w-3 h-3 inline mr-1" />Bespoke
                      </div>
                    )}

                    <div className={`p-2 rounded-lg w-fit mb-3 ${PLAN_BADGE[p.plan] ?? "bg-blue-500/20 text-blue-400"}`}>
                      {PLAN_ICONS[p.plan] ?? <Shield className="w-5 h-5" />}
                    </div>

                    <h3 className="font-bold text-lg mb-1">{p.name}</h3>

                    <div className="mb-4">
                      {price != null ? (
                        <>
                          <span className="text-3xl font-bold">{fmtAUD(price)}</span>
                          <span className="text-slate-400 text-sm">/{interval === "annual" ? "year" : "month"}</span>
                          {interval === "annual" && p.monthly_aud && (
                            <p className="text-xs text-green-400 mt-0.5">
                              {fmtAUD(p.monthly_aud * 12 * (1 - p.annual_discount_pct / 100) / 12)}/mo equivalent
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-2xl font-bold text-rose-400">Custom pricing</span>
                      )}
                    </div>

                    <ul className="space-y-1.5 flex-1 mb-5">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <div className="w-full py-2 rounded-lg bg-white/10 text-center text-sm text-slate-400 font-medium">
                        Current plan
                      </div>
                    ) : (
                      <button
                        onClick={() => checkout(p.plan)}
                        disabled={checkingOut === p.plan}
                        className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                          isVVIP
                            ? "bg-rose-600 hover:bg-rose-700 text-white"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                        } disabled:opacity-50`}
                      >
                        {checkingOut === p.plan ? "Redirecting…" : isVVIP ? "Contact Sales" : "Upgrade"}
                        {!isVVIP && <ArrowRight className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* GST note */}
            <p className="text-center text-xs text-slate-500 mt-6">
              All prices in AUD. GST (10%) added at checkout. Annual plans billed as a single payment.
            </p>
          </div>
        )}

        {/* ── Invoices tab ──────────────────────────────────────────────── */}
        {tab === "invoices" && (
          <div>
            {invoices.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />No invoices yet
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => (
                  <div key={inv.invoice_id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-4">
                    <Receipt className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-sm text-slate-300">{inv.invoice_id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          inv.status === "paid" ? "bg-green-500/20 text-green-400" :
                          inv.status === "open" ? "bg-amber-500/20 text-amber-400" :
                          "bg-slate-500/20 text-slate-400"
                        }`}>{inv.status}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {fmtDate(inv.period_start)} – {fmtDate(inv.period_end)}
                        {inv.paid_at && ` · Paid ${fmtDate(inv.paid_at)}`}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold">{fmtAUD(inv.total_aud)}</div>
                      <div className="text-xs text-slate-500">incl. {fmtAUD(inv.tax_aud)} GST</div>
                    </div>
                    <div className="flex gap-1">
                      {inv.stripe_hosted_url && (
                        <a href={inv.stripe_hosted_url} target="_blank" rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Admin tab ─────────────────────────────────────────────────── */}
        {tab === "admin" && isAdmin && (
          <div className="space-y-5">
            <AdminPricingPanel sub={sub} onUpdate={load} />

            {/* All subscriptions list */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />All Tenant Subscriptions
              </h3>
              <AllSubscriptions />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AllSubscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/billing/admin/all`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      setSubs(await res.json());
    } catch {
      setSubs([DEMO_SUB]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;
  if (!subs.length) return <div className="text-slate-500 text-sm">No subscriptions yet.</div>;

  return (
    <div className="space-y-2">
      {subs.map(s => (
        <div key={s.subscription_id} className="flex items-center gap-3 text-sm py-2 border-b border-white/5 last:border-0">
          <span className="font-mono text-slate-400 text-xs w-32 truncate">{s.industry_id}</span>
          <span className="flex-1">{s.plan}</span>
          <span className="text-slate-400">{s.interval}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            s.status === "active" ? "bg-green-500/20 text-green-400" :
            s.status === "trialing" ? "bg-blue-500/20 text-blue-400" :
            "bg-slate-500/20 text-slate-400"
          }`}>{s.status}</span>
          {(s.custom_monthly_aud || s.custom_annual_aud) && (
            <span className="text-xs text-amber-400">custom price</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#060d1a] flex items-center justify-center"><div className="text-slate-400">Loading...</div></div>}>
      <BillingContent />
    </Suspense>
  );
}
