"use client";

import React from "react";
import { Info } from "lucide-react";

interface DemoModeBannerProps {
  isSandboxLive?: boolean;
}

export default function DemoModeBanner({ isSandboxLive = false }: DemoModeBannerProps) {
  if (isSandboxLive) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">PayPal Sandbox Connected:</span>
          <span>Live PayPal REST API sandbox calls enabled for customer dispute operations.</span>
        </div>
        <span className="hidden sm:inline font-mono text-[11px] bg-emerald-100/70 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
          ENV: SANDBOX
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-900 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
          <Info className="w-3.5 h-3.5 text-amber-700" />
        </div>
        <div>
          <span className="font-bold mr-1.5 text-amber-950">DEMO & SIMULATION MODE:</span>
          <span className="text-amber-800">
            Operating with synthetic dispute scenarios. Rebuttal generation and PayPal submission run in offline simulation mode without real financial liability.
          </span>
        </div>
      </div>
      <div className="hidden lg:flex items-center gap-2 shrink-0">
        <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300 font-semibold">
          ZERO LIVE API CALLS
        </span>
      </div>
    </div>
  );
}
