"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Plus, UserPlus, Briefcase, Users, Activity, AlertTriangle, Search,
  FileUp, FileBarChart, X,
} from "lucide-react";

const ACTIONS = [
  { label: "Add Customer", href: "/customers?action=new", icon: UserPlus },
  { label: "Add Business", href: "/customers?action=new&type=business", icon: Briefcase },
  { label: "Add Beneficiary", href: "/onboarding?action=kyb&type=beneficiary", icon: Users },
  { label: "Add Transaction", href: "/monitoring?action=new", icon: Activity },
  { label: "Create Case", href: "/mlro?action=new-case", icon: AlertTriangle },
  { label: "Run Screening", href: "/onboarding?action=screening", icon: Search },
  { label: "Upload Document", href: "/documents?action=upload", icon: FileUp },
  { label: "Generate Report", href: "/reporting?action=new", icon: FileBarChart },
];

export default function GlobalQuickActions() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="fixed top-20 right-4 z-40 lg:right-6">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Quick actions"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium shadow-lg transition-colors"
      >
        {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        Quick Actions
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-navy-700 bg-navy-800 shadow-2xl p-2">
          {ACTIONS.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-navy-700 hover:text-white transition-colors"
            >
              <Icon className="w-4 h-4 text-slate-500" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
