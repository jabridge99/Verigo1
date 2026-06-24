const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface PlanPrice {
  plan: string;
  name: string;
  monthly_aud: number | null;
  annual_aud: number | null;
  annual_discount_pct: number;
}

export const DEFAULT_PLAN_PRICES: Record<string, PlanPrice> = {
  starter: { plan: "starter", name: "Starter", monthly_aud: 59, annual_aud: 599, annual_discount_pct: 20 },
  professional: { plan: "professional", name: "Professional", monthly_aud: 79, annual_aud: 799, annual_discount_pct: 20 },
  enterprise: { plan: "enterprise", name: "Enterprise", monthly_aud: 299, annual_aud: 2999, annual_discount_pct: 20 },
};

/** Live plan pricing from the backend catalogue, keyed by plan slug.
 * Falls back to DEFAULT_PLAN_PRICES if the API is unreachable, so marketing
 * pages never break — but normally reflects whatever admins set via the
 * billing admin pricing endpoints. */
export async function fetchPlanPrices(): Promise<Record<string, PlanPrice>> {
  try {
    const res = await fetch(`${API}/api/v1/billing/plans`, { next: { revalidate: 300 } });
    if (!res.ok) return DEFAULT_PLAN_PRICES;
    const plans: PlanPrice[] = await res.json();
    const byPlan: Record<string, PlanPrice> = {};
    for (const p of plans) byPlan[p.plan] = p;
    return { ...DEFAULT_PLAN_PRICES, ...byPlan };
  } catch {
    return DEFAULT_PLAN_PRICES;
  }
}

export function formatAud(amount: number | null): string {
  if (amount == null) return "Custom";
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function annualSavingsPct(monthly: number | null, annual: number | null): number | null {
  if (!monthly || !annual) return null;
  const fullYear = monthly * 12;
  if (fullYear <= 0) return null;
  return Math.round((1 - annual / fullYear) * 100);
}
