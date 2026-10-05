import type { BadgeTone } from "@/components/ui/badge";

// AUSTRAC/FATF-aligned ECDD trigger categories — 5 primary indicators
// surfaced first, the remaining EDDTrigger members below, plus "Other"
// which reveals a free-text elaboration field (trigger_reason_other).
export const TRIGGER_OPTIONS: { value: string; label: string; primary?: boolean }[] = [
  { value: "pep_match", label: "PEP match", primary: true },
  { value: "sanctions_match", label: "Sanctions / watchlist match", primary: true },
  { value: "adverse_media", label: "Adverse media", primary: true },
  { value: "high_risk_country", label: "High-risk country exposure", primary: true },
  { value: "unusual_activity", label: "Unusual transaction activity", primary: true },
  { value: "high_risk_score", label: "High risk score" },
  { value: "complex_ownership", label: "Complex ownership structure" },
  { value: "high_value_customer", label: "High-value customer" },
  { value: "crypto_exposure", label: "Crypto / virtual asset exposure" },
  { value: "cash_intensive", label: "Cash-intensive business" },
  { value: "compliance_discretion", label: "Compliance discretion" },
  { value: "other", label: "Other (specify)" },
];
export const TRIGGER_LABEL: Record<string, string> = Object.fromEntries(TRIGGER_OPTIONS.map(o => [o.value, o.label]));

export const REC_TONE: Record<string, BadgeTone> = {
  approve: "success",
  monitor: "warning",
  reject: "danger",
};

export const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "neutral",
  completed: "teal",
  rejected: "danger",
};

// Local color map for the decision-status toggle buttons (not a Badge pill —
// uses "border-current" to pick up the active selection's own text color).
export const STATUS_COLOR: Record<string, string> = {
  pending: "bg-slate-500/20 text-slate-300",
  completed: "bg-teal-500/20 text-teal-300",
  rejected: "bg-red-500/20 text-red-300",
};

export const SCORE_COLOR = (s: number) =>
  s >= 80 ? "text-red-400" : s >= 50 ? "text-amber-400" : "text-emerald-400";
