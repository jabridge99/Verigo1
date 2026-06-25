"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldCheck, Briefcase, Cog, BarChartHorizontal } from "lucide-react";

const TABS = [
  { href: "/analytics/executive", label: "Executive", icon: LayoutDashboard },
  { href: "/analytics/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/analytics/mlro", label: "MLRO", icon: Briefcase },
  { href: "/analytics/operations", label: "Operations", icon: Cog },
  { href: "/analytics/benchmarking", label: "Benchmarking", icon: BarChartHorizontal },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <div className="border-b border-white/10 px-4 sticky top-0 bg-navy-950/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"
                }`}>
                <Icon className="w-4 h-4" />{label}
              </Link>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}
