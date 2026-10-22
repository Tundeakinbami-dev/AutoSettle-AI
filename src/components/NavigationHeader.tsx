"use client";

import React from "react";
import {
  ShieldAlert,
  Zap,
  Radio,
  Settings,
  RotateCcw,
  PlusCircle,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

interface NavigationHeaderProps {
  urgentCount: number;
  isSandboxLive: boolean;
  onOpenWebhookModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenNewDisputeModal: () => void;
  onResetData: () => void;
  isResetting: boolean;
}

export default function NavigationHeader({
  urgentCount,
  isSandboxLive,
  onOpenWebhookModal,
  onOpenSettingsModal,
  onOpenNewDisputeModal,
  onResetData,
  isResetting,
}: NavigationHeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-[#0d131f]/90 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-sky-600 to-indigo-700 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0a0f1d] rounded-[10px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                  AutoSettle <span className="text-sky-400">AI</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-sky-300 border border-blue-500/20">
                  PayPal Hackathon
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Autonomous Dispute Resolution & Evidence Orchestration
              </p>
            </div>
          </div>

          {/* Urgent Warning Badge for Mobile */}
          {urgentCount > 0 && (
            <div className="md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium animate-pulse">
              <Zap className="w-3.5 h-3.5" />
              <span>{urgentCount} Urgent</span>
            </div>
          )}
        </div>

        {/* Center / Mode Badges */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-400">PayPal API:</span>
            <span className="font-medium text-slate-200">
              {isSandboxLive ? "Live Sandbox Active" : "Sandbox Simulation Mode"}
            </span>
            {!isSandboxLive && (
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Demo Data
              </span>
            )}
          </div>

          {urgentCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium glow-urgent animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>{urgentCount} dispute{urgentCount > 1 ? "s" : ""} expiring within 48h</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          <button
            onClick={onOpenWebhookModal}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition-all hover:border-sky-400/50 shadow-sm"
            title="Simulate incoming PayPal Webhook event"
          >
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span>Simulate Webhook</span>
          </button>

          <button
            onClick={onOpenNewDisputeModal}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>+ New Intake</span>
          </button>

          <button
            onClick={onResetData}
            disabled={isResetting}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-all disabled:opacity-50"
            title="Reset database to pristine demo disputes"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin text-sky-400" : "text-slate-400"}`} />
            <span className="hidden sm:inline">Reset Seed</span>
          </button>

          <button
            onClick={onOpenSettingsModal}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title="Merchant & PayPal API Settings"
          >
            <Settings className="w-4 h-4 text-slate-400 hover:text-slate-200" />
          </button>
        </div>
      </div>
    </header>
  );
}
