"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-8 h-8 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">You're offline</h1>
        <p className="text-slate-400 text-sm mb-6">
          Verigo needs an internet connection to load live compliance data.
          Cached pages remain available — reconnect to sync the latest alerts and reports.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
