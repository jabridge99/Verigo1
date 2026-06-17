const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface BrandingConfig {
  company_name: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  primary_color: string;
  accent_color: string;
  bg_color: string;
  surface_color: string;
  text_color: string;
  custom_domain?: string | null;
  support_email: string;
  footer_text: string;
  hide_verigo_badge: boolean;
  tenant_id?: string;
  industry_id?: string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  company_name: "Verigo",
  primary_color: "#2563eb",
  accent_color: "#f59e0b",
  bg_color: "#060d1a",
  surface_color: "#0d1526",
  text_color: "#f1f5f9",
  support_email: "support@verigo.com.au",
  footer_text: "Australian Compliance Operating System",
  hide_verigo_badge: false,
};

export async function fetchBranding(industryId?: string): Promise<BrandingConfig> {
  try {
    const url = industryId
      ? `${API}/api/v1/branding?industry_id=${encodeURIComponent(industryId)}`
      : `${API}/api/v1/branding`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return DEFAULT_BRANDING;
    return await res.json();
  } catch {
    return DEFAULT_BRANDING;
  }
}

export async function saveBranding(data: Partial<BrandingConfig>): Promise<BrandingConfig> {
  const res = await fetch(`${API}/api/v1/branding`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to save branding");
  }
  return res.json();
}

export async function resetBranding(): Promise<void> {
  await fetch(`${API}/api/v1/branding`, {
    method: "DELETE",
    credentials: "include",
  });
}

/** Inject branding as CSS custom properties on <html>. Call client-side only. */
export function applyBrandingToDOM(b: BrandingConfig) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", b.primary_color);
  root.style.setProperty("--brand-accent", b.accent_color);
  root.style.setProperty("--brand-bg", b.bg_color);
  root.style.setProperty("--brand-surface", b.surface_color);
  root.style.setProperty("--brand-text", b.text_color);
}
