"use client";

import React, { useState, useEffect, useCallback } from "react";
import NavigationHeader from "@/components/NavigationHeader";
import DashboardStats from "@/components/DashboardStats";
import DisputeConsoleTable from "@/components/DisputeConsoleTable";
import DisputeWorkbench from "@/components/DisputeWorkbench";
import WebhookSimulatorModal from "@/components/WebhookSimulatorModal";
import SettingsModal from "@/components/SettingsModal";
import NewDisputeModal from "@/components/NewDisputeModal";
import {
  ShieldAlert,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  Package,
  FileCheck,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export default function Home() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [selectedDisputeDetail, setSelectedDisputeDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isSandboxLive, setIsSandboxLive] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Header */}
      <NavigationHeader
        urgentCount={stats?.urgentCount || 0}
        isSandboxLive={isSandboxLive}
        onOpenWebhookModal={() => setShowWebhookModal(true)}
        onOpenSettingsModal={() => setShowSettingsModal(true)}
        onOpenNewDisputeModal={() => setShowNewDisputeModal(true)}
        onResetData={handleResetData}
        isResetting={isResetting}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Hero Banner with Product Promise & Architecture Highlights */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900/90 to-slate-950 border border-blue-500/20 p-6 md:p-8 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-sky-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PayPal AI Hackathon 2026 Submission</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Evidence-Backed PayPal Dispute Response in{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-300 to-indigo-300">
                Minutes, Not Hours
              </span>
            </h1>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-2xl">
              AutoSettle AI retrieves available transaction and fulfillment records, identifies critical evidence gaps, drafts a factual rebuttal narrative adhering to strict anti-hallucination guardrails, and submits directly to the <strong>PayPal Disputes REST API</strong> under merchant authorization.
            </p>

            {/* Core Architectural Pillars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Zero Evidence Hallucination</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Disputes API v1 Integration</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Evidence Gap Detection</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Human-in-the-Loop Gate</span>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Metrics */}
        <section>
          <DashboardStats stats={stats} loading={loading} />
        </section>

        {/* AG Grid Dispute Operations Console */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Merchant Dispute Operations Console</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  AG Grid
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Prioritized queue of active disputes, deadlines, evidence completeness, and recommended actions.
              </p>
            </div>
          </div>

          <DisputeConsoleTable
            disputes={disputes}
            onSelectDispute={handleSelectDispute}
            loading={loading}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090d16] py-5 mt-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">AutoSettle AI</span>
            <span>•</span>
            <span>Built for PayPal AI Hackathon</span>
          </div>
          <div>
            Adheres strictly to PayPal Disputes Policy — Never invents evidence, never guarantees dispute wins.
          </div>
        </div>
      </footer>

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
