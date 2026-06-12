"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("[PWA] SW registration failed:", err));
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Only show if not already dismissed this session and not already installed
      const dismissed = sessionStorage.getItem("tvg_install_dismissed");
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!dismissed && !isStandalone) {
        setShowBanner(true);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowBanner(false);
    setInstallPrompt(null);
  };

  const dismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem("tvg_install_dismissed", "1");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[60] animate-in slide-in-from-bottom">
      <div className="rounded-2xl border border-white/10 bg-navy-900/95 backdrop-blur-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-brand-600/20 text-brand-400 flex-shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white text-sm">Install Verigo</h4>
            <p className="text-xs text-white/60 mt-0.5">
              Add to your home screen for instant access and offline support.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={install}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="text-white/40 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
