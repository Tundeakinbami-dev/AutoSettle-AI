"use client";

import React from "react";
import {
  ShieldAlert,
  Zap,
  Radio,
  Settings,
  RotateCcw,
  PlusCircle,
  Search,
  Bell,
} from "lucide-react";

interface NavigationHeaderProps {
  urgentCount: number;
  isSandboxLive: boolean;
  onOpenWebhookModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenNewDisputeModal: () => void;
  onResetData: () => void;
  isResetting: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export default function NavigationHeader({
  urgentCount,
  isSandboxLive,
  onOpenWebhookModal,
  onOpenSettingsModal,
  onOpenNewDisputeModal,
  onResetData,
  isResetting,
  searchQuery = "",
  onSearchChange,
}: NavigationHeaderProps) {
  return (
    <header className="top-header-bar">
      {/* Search Input Bar with Keyboard Shortcut */}
      <div className="header-search-container">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search disputes, transactions, buyers..."
          className="header-search-input"
        />
        <kbd className="header-kbd">⌘K</kbd>
      </div>

      {/* Middle & Right Actions */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Sandbox API Status Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isSandboxLive ? "bg-emerald-400" : "bg-blue-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isSandboxLive ? "bg-emerald-500" : "bg-blue-600"
              }`}
            />
          </span>
          <span className="text-slate-500 font-medium">PayPal API:</span>
          <span className="font-semibold text-slate-700">
            {isSandboxLive ? "Live Sandbox" : "Simulation Mode"}
          </span>
        </div>

        {/* Urgent Alert Pill */}
        {urgentCount > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-rose-500" />
            <span>{urgentCount} Expiring Soon</span>
          </div>
        )}

        {/* Simulate Webhook Button */}
        <button
          onClick={onOpenWebhookModal}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all shadow-sm"
          title="Simulate incoming PayPal dispute webhook"
        >
          <Radio className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Simulate Webhook</span>
        </button>

        {/* Reset Seed Button */}
        <button
          onClick={onResetData}
          disabled={isResetting}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-all disabled:opacity-50 shadow-sm"
          title="Reset database to pristine demo disputes"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 ${
              isResetting ? "animate-spin text-blue-600" : "text-slate-400"
            }`}
          />
          <span className="hidden md:inline">Reset Seed</span>
        </button>

        {/* New Intake Button (Dribbble Primary Button) */}
        <button
          onClick={onOpenNewDisputeModal}
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all active:scale-[0.98]"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Intake</span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => alert(`${urgentCount} urgent dispute(s) require action.`)}
          className="relative p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-all shadow-sm"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-slate-500" />
          {urgentCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettingsModal}
          className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-all shadow-sm"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-slate-500 hover:text-slate-700" />
        </button>
      </div>
    </header>
  );
}
