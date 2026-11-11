"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import NavigationHeader from "@/components/NavigationHeader";
import DisputeWorkbench from "@/components/DisputeWorkbench";
import WebhookSimulatorModal from "@/components/WebhookSimulatorModal";
import SettingsModal from "@/components/SettingsModal";
import NewDisputeModal from "@/components/NewDisputeModal";
import { useAppContext } from "@/lib/app-context";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const {
    stats,
    isSandboxLive,
    searchQuery,
    setSearchQuery,
    selectedDisputeDetail,
    closeDisputeWorkbench,
    refreshWorkbench,
    refreshData,
    resetSeedData,
    isResetting,
    showWebhookModal,
    setShowWebhookModal,
    showSettingsModal,
    setShowSettingsModal,
    showNewDisputeModal,
    setShowNewDisputeModal,
  } = useAppContext();

  return (
    <div className="app-shell">
      {/* Left Collapsible Persistent Sidebar */}
      <Sidebar
        urgentCount={stats?.urgentCount || 0}
        onOpenSettingsModal={() => setShowSettingsModal(true)}
      />

      {/* Main Content Area */}
      <div className="content-wrapper">
        {/* Top Header Bar */}
        <NavigationHeader
          urgentCount={stats?.urgentCount || 0}
          isSandboxLive={isSandboxLive}
          onOpenWebhookModal={() => setShowWebhookModal(true)}
          onOpenSettingsModal={() => setShowSettingsModal(true)}
          onOpenNewDisputeModal={() => setShowNewDisputeModal(true)}
          onResetData={resetSeedData}
          isResetting={isResetting}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Dynamic Route Children */}
        <div className="flex-1 w-full">
          {children}
        </div>

        {/* Unified SaaS Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 px-6 mt-auto">
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">AutoSettle AI</span>
              <span>•</span>
              <span>Autonomous PayPal Dispute Resolution</span>
            </div>
            <div>
              Adheres strictly to PayPal Disputes Policy — Never invents evidence, never guarantees dispute wins.
            </div>
          </div>
        </footer>
      </div>

      {/* Flagship Dispute Workbench Modal / Drawer (Available across all views) */}
      {selectedDisputeDetail && (
        <DisputeWorkbench
          dispute={selectedDisputeDetail}
          onClose={closeDisputeWorkbench}
          onRefresh={refreshWorkbench}
        />
      )}

      {/* Webhook Simulator Modal */}
      {showWebhookModal && (
        <WebhookSimulatorModal
          onClose={() => setShowWebhookModal(false)}
          onSuccess={() => refreshData(true)}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onSaved={() => refreshData(true)}
        />
      )}

      {/* New Dispute Modal */}
      {showNewDisputeModal && (
        <NewDisputeModal
          onClose={() => setShowNewDisputeModal(false)}
          onCreated={() => refreshData(true)}
        />
      )}
    </div>
  );
}
