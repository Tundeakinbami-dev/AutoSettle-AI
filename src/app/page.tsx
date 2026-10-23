"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import NavigationHeader from "@/components/NavigationHeader";
import DashboardStats from "@/components/DashboardStats";
import DisputeConsoleTable from "@/components/DisputeConsoleTable";
import DisputeWorkbench from "@/components/DisputeWorkbench";
import WebhookSimulatorModal from "@/components/WebhookSimulatorModal";
import SettingsModal from "@/components/SettingsModal";
import NewDisputeModal from "@/components/NewDisputeModal";
import {
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

export default function Home() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [selectedDisputeDetail, setSelectedDisputeDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isSandboxLive, setIsSandboxLive] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNewDisputeModal, setShowNewDisputeModal] = useState(false);

  // Fetch disputes and stats
  const fetchData = useCallback(async () => {
    try {
      const [disputesRes, statsRes, settingsRes] = await Promise.all([
        fetch("/api/disputes"),
        fetch("/api/stats"),
        fetch("/api/settings"),
      ]);

      const disputesData = await disputesRes.json();
      const statsData = await statsRes.json();
      const settingsData = await settingsRes.json();

      if (disputesData.success) {
        setDisputes(disputesData.disputes);
      }
      if (statsData.success) {
        setStats(statsData.stats);
      }
      if (settingsData.success && settingsData.settings) {
        setIsSandboxLive(Boolean(settingsData.settings.hasLivePayPalConfig));
      }
    } catch (err) {
      console.error("Fetch data error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load single dispute for workbench
  const handleSelectDispute = async (disputeId: string) => {
    setSelectedDisputeId(disputeId);
    try {
      const res = await fetch(`/api/disputes/${disputeId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedDisputeDetail(data.dispute);
      }
    } catch (err) {
      console.error("Fetch single dispute error:", err);
    }
  };

  const handleRefreshWorkbench = async () => {
    if (selectedDisputeId) {
      await handleSelectDispute(selectedDisputeId);
    }
    await fetchData();
  };

  const handleResetData = async () => {
    if (!confirm("Reset database back to the 5 pristine demo dispute scenarios?")) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/disputes/reset-seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        if (selectedDisputeId) setSelectedDisputeDetail(null);
      }
    } catch (err) {
      console.error("Reset data error:", err);
    } finally {
      setIsResetting(false);
    }
  };

  const filteredDisputes = disputes.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.paypalDisputeId?.toLowerCase().includes(q) ||
      d.buyerName?.toLowerCase().includes(q) ||
      d.buyerEmail?.toLowerCase().includes(q) ||
      d.reason?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="app-shell">
      {/* Left Sidebar (Dribbble Design) */}
      <Sidebar
        activeNav={activeNav}
        onNavChange={(nav) => {
          setActiveNav(nav);
          if (nav === "disputes") {
            const el = document.getElementById("dispute-table-section");
            el?.scrollIntoView({ behavior: "smooth" });
          }
        }}
        urgentCount={stats?.urgentCount || 0}
        onOpenSettingsModal={() => setShowSettingsModal(true)}
        onOpenWebhookModal={() => setShowWebhookModal(true)}
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
          onResetData={handleResetData}
          isResetting={isResetting}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Page Inner Container */}
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
          {/* Hero Banner with Modern SaaS Aesthetics */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50/70 via-white to-sky-50/50 border border-blue-100 p-6 lg:p-7 shadow-sm">
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/70 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Subscription & Dispute Intelligence Engine</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  Autonomous PayPal Dispute Defense in{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600">
                    Minutes, Not Hours
                  </span>
                </h1>
                <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                  AutoSettle AI automates merchant evidence reconciliation, surfaces missing delivery confirmations, drafts factual rebuttal narratives, and submits directly to the <strong>PayPal Disputes REST API</strong> under merchant authorization.
                </p>

                {/* Pillars */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200/80">
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Zero Hallucination</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Disputes API v1</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Evidence Gap Radar</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Human-in-the-Loop</span>
                  </div>
                </div>
              </div>

              {/* Quick Action Button Box */}
              <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
                <button
                  onClick={() => setShowNewDisputeModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <span>+ Create Dispute Intake</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowWebhookModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <span>Simulate Webhook</span>
                </button>
              </div>
            </div>
          </section>

          {/* Dashboard Metrics (Top cards + Middle Area Chart & Breakdown) */}
          <section>
            <DashboardStats stats={stats} loading={loading} />
          </section>

          {/* Dispute Operations Console Table */}
          <section id="dispute-table-section" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Merchant Dispute Operations Console</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                    AG Grid Pro
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Prioritized queue of active disputes, deadlines, evidence completeness, and recommended actions.
                </p>
              </div>
            </div>

            <DisputeConsoleTable
              disputes={filteredDisputes}
              onSelectDispute={handleSelectDispute}
              loading={loading}
            />
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 px-6 mt-8">
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">AutoSettle AI</span>
              <span>•</span>
              <span>PayPal AI Hackathon 2026</span>
            </div>
            <div>
              Adheres strictly to PayPal Disputes Policy — Never invents evidence, never guarantees dispute wins.
            </div>
          </div>
        </footer>
      </div>

      {/* Flagship Dispute Workbench Modal / Drawer */}
      {selectedDisputeDetail && (
        <DisputeWorkbench
          dispute={selectedDisputeDetail}
          onClose={() => {
            setSelectedDisputeDetail(null);
            setSelectedDisputeId(null);
          }}
          onRefresh={handleRefreshWorkbench}
        />
      )}

      {/* Webhook Simulator Modal */}
      {showWebhookModal && (
        <WebhookSimulatorModal
          onClose={() => setShowWebhookModal(false)}
          onSuccess={fetchData}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onSaved={fetchData}
        />
      )}

      {/* New Dispute Modal */}
      {showNewDisputeModal && (
        <NewDisputeModal
          onClose={() => setShowNewDisputeModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
