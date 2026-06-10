"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Bell, FileText, MoreHorizontal,
  Shield, Activity, FolderOpen, BarChart2, Settings, X,
  CreditCard, Webhook, Building2, ClipboardList, LogOut,
} from "lucide-react";
import { getStoredUser, getToken, clearUser } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Primary bottom-bar items (always visible)
const PRIMARY = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Alerts", href: "/notifications", icon: Bell, badge: true },
  { label: "Reports", href: "/reporting", icon: FileText },
];

// "More" sheet items
const MORE = [
  { label: "Monitoring", href: "/monitoring", icon: Activity },
  { label: "MLRO Cases", href: "/mlro", icon: Shield },
  { label: "ECDD", href: "/ecdd", icon: ClipboardList },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "Documents", href: "/documents", icon: FolderOpen },
  { label: "Audit Trail", href: "/audit", icon: ClipboardList },
  { label: "Onboarding", href: "/onboarding", icon: Users },
  { label: "Industry", href: "/industry", icon: Building2 },
  { label: "API & Webhooks", href: "/api-keys", icon: Webhook },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Branding", href: "/branding", icon: Settings },
  { label: "Users", href: "/users", icon: Users },
];

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);
  const [unread, setUnread] = useState(0);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    setAuthed(!!user);
    if (!user) return;

    const load = async () => {
      try {
        const res = await fetch(`${API}/api/v1/notifications/summary`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) setUnread((await res.json()).unread_count ?? 0);
      } catch { /* ignore */ }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [pathname]);

  // Hide on public/marketing pages and when not authenticated
  const hiddenRoutes = ["/", "/login", "/pricing", "/solutions", "/live-demo", "/start-trial", "/api-integrations", "/offline"];
  const isHidden = hiddenRoutes.some((r) => pathname === r || (r !== "/" && pathname.startsWith(r + "/")));
  if (isHidden || !authed) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const signOut = () => {
    clearUser();
    setShowMore(false);
    router.push("/login");
  };

  return (
    <>
      {/* Bottom tab bar — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-navy-900/95 backdrop-blur-xl">
        <div className="grid grid-cols-5 h-16">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 relative transition-colors ${
                  active ? "text-brand-400" : "text-white/50"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge && unread > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && <span className="absolute top-0 w-8 h-0.5 bg-brand-400 rounded-full" />}
              </Link>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              showMore ? "text-brand-400" : "text-white/50"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
        {/* Safe-area padding for notched devices */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      {/* More sheet */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-[55]" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-navy-900 rounded-t-3xl border-t border-white/10 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-navy-900 flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="font-semibold text-white">All Modules</h3>
              <button onClick={() => setShowMore(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4">
              {MORE.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-colors ${
                      active ? "bg-brand-600/20 text-brand-400" : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="px-4 pb-6">
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      )}

      {/* Spacer so content isn't hidden behind the bottom bar on mobile */}
      <div className="md:hidden h-16" />
    </>
  );
}
