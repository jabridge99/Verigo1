"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

export interface QuickAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  variant?: "default" | "warning";
}

export default function QuickActions({ actions, className = "" }: { actions: QuickAction[]; className?: string }) {
  if (!actions.length) return null;

  return (
    <div className={`flex gap-2 overflow-x-auto ${className}`}>
      {actions.map(({ label, href, onClick, icon: Icon, variant = "default" }) => {
        const classes = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs font-medium whitespace-nowrap ${
          variant === "warning"
            ? "border-amber-500/30 text-amber-300 hover:bg-amber-500/15 hover:border-amber-500/50"
            : "border-navy-700 text-slate-300 hover:text-white hover:border-brand-500/40 hover:bg-navy-700"
        }`;
        if (href) {
          return (
            <Link key={label} href={href} className={classes}>
              <Icon className="w-3.5 h-3.5 text-slate-500" />
              {label}
            </Link>
          );
        }
        return (
          <button key={label} type="button" onClick={onClick} className={classes}>
            <Icon className="w-3.5 h-3.5 text-slate-500" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
