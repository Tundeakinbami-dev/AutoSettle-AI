"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import {
  BarChart3,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Brain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Loader2,
  Info,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatsData {
  totalCount: number;
  actionRequired: number;
  urgentCount: number;
  totalVolume: number;
  winRate: number;
  aiAnalyzedCount: number;
  avgResponseMinutes: string;
  workflowCounts: {
    DRAFT: number;
    NEEDS_REVIEW: number;
    APPROVED: number;
    SUBMITTING: number;
    SUBMITTED: number;
    SUBMISSION_FAILED: number;
    AWAITING_CONFIRMATION: number;
  };
}

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  note,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{title}</span>
        <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
      {note && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />{note}
        </p>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      setStats(data.stats);
    } catch (e: any) {
      setError(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const wf = stats?.workflowCounts ?? {
    DRAFT: 0, NEEDS_REVIEW: 0, APPROVED: 0, SUBMITTING: 0,
    SUBMITTED: 0, SUBMISSION_FAILED: 0, AWAITING_CONFIRMATION: 0,
  };

  const workflowStages = [
    { label: "Draft", value: wf.DRAFT, color: "bg-slate-400" },
    { label: "Needs Review", value: wf.NEEDS_REVIEW, color: "bg-amber-400" },
    { label: "Approved", value: wf.APPROVED, color: "bg-blue-500" },
    { label: "Submitting", value: wf.SUBMITTING, color: "bg-indigo-500" },
    { label: "Submitted", value: wf.SUBMITTED, color: "bg-emerald-500" },
    { label: "Failed", value: wf.SUBMISSION_FAILED, color: "bg-rose-500" },
    { label: "Awaiting Confirmation", value: wf.AWAITING_CONFIRMATION, color: "bg-sky-500" },
  ];

  const totalWf = workflowStages.reduce((s, x) => s + x.value, 0);

  return (
    <div className="app-shell">
      <Sidebar
        activeNav="analytics"
        onNavChange={() => {}}
        urgentCount={stats?.urgentCount ?? 0}
      />

      <div className="content-wrapper">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </Link>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Analytics Dashboard</h1>
              <p className="text-[11px] text-slate-500">Real‑time metrics from live database</p>
            </div>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        <main className="flex-1 px-6 py-6 space-y-6 max-w-[1400px] mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <AlertTriangle className="w-10 h-10 text-rose-400" />
              <p className="text-sm font-semibold text-rose-600">Failed to load analytics</p>
              <p className="text-xs text-slate-500">{error}</p>
              <button onClick={fetchStats} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">
                Retry
              </button>
            </div>
          ) : stats ? (
            <>
              {/* Top Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Disputes"
                  value={stats.totalCount}
                  subtitle="All‑time dispute cases in DB"
                  icon={FileText}
                  iconColor="text-blue-600"
                  iconBg="bg-blue-50"
                />
                <MetricCard
                  title="Total Disputed Volume"
                  value={fmt(stats.totalVolume)}
                  subtitle="Aggregate financial exposure"
                  icon={TrendingUp}
                  iconColor="text-indigo-600"
                  iconBg="bg-indigo-50"
                />
                <MetricCard
                  title="Defense Win Rate"
                  value={`${stats.winRate}%`}
                  subtitle="Among resolved disputes"
                  icon={ShieldCheck}
                  iconColor="text-emerald-600"
                  iconBg="bg-emerald-50"
                  note={stats.winRate === 88 ? "No resolved disputes yet – showing seed default." : undefined}
                />
                <MetricCard
                  title="AI‑Analysed Cases"
                  value={stats.aiAnalyzedCount}
                  subtitle={`Out of ${stats.totalCount} total`}
                  icon={Brain}
                  iconColor="text-violet-600"
                  iconBg="bg-violet-50"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  title="Action Required"
                  value={stats.actionRequired}
                  subtitle="Disputes awaiting merchant action"
                  icon={AlertTriangle}
                  iconColor="text-amber-600"
                  iconBg="bg-amber-50"
                />
                <MetricCard
                  title="Urgent Deadlines"
                  value={stats.urgentCount}
                  subtitle="Due within 48 hours"
                  icon={Clock}
                  iconColor={stats.urgentCount > 0 ? "text-rose-600" : "text-emerald-600"}
                  iconBg={stats.urgentCount > 0 ? "bg-rose-50" : "bg-emerald-50"}
                />
                <MetricCard
                  title="Submitted to PayPal"
                  value={wf.SUBMITTED}
                  subtitle="Successfully submitted responses"
                  icon={CheckCircle2}
                  iconColor="text-emerald-600"
                  iconBg="bg-emerald-50"
                />
                <MetricCard
                  title="Submission Failures"
                  value={wf.SUBMISSION_FAILED}
                  subtitle="Failed PayPal API submissions"
                  icon={XCircle}
                  iconColor={wf.SUBMISSION_FAILED > 0 ? "text-rose-600" : "text-slate-400"}
                  iconBg={wf.SUBMISSION_FAILED > 0 ? "bg-rose-50" : "bg-slate-50"}
                />
              </div>

              {/* Response Workflow Pipeline */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-slate-900">Response Workflow Pipeline</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live distribution of all dispute cases across workflow states (from DB).
                  </p>
                </div>

                {/* Stacked bar */}
                {totalWf > 0 ? (
                  <>
                    <div className="flex h-4 rounded-full overflow-hidden gap-0.5 mb-4">
                      {workflowStages.filter((s) => s.value > 0).map((s) => (
                        <div
                          key={s.label}
                          className={`${s.color} transition-all`}
                          style={{ width: `${(s.value / totalWf) * 100}%` }}
                          title={`${s.label}: ${s.value}`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                      {workflowStages.map((s) => (
                        <div key={s.label} className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                            <span className="text-[11px] text-slate-500 font-medium">{s.label}</span>
                          </div>
                          <span className="text-lg font-bold text-slate-900 pl-4">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 text-sm text-slate-400">
                    No workflow data available yet. Create disputes to populate this chart.
                  </div>
                )}
              </div>

              {/* Evidence & AI Note */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                  <h2 className="text-sm font-bold text-slate-900 mb-1">AI Analysis Activity</h2>
                  <p className="text-xs text-slate-500 mb-4">Cases where AI gap analysis has been run.</p>
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-black text-violet-600">{stats.aiAnalyzedCount}</div>
                    <div className="text-xs text-slate-500">
                      of {stats.totalCount} disputes have been analysed by the deterministic AI engine.
                      {stats.aiAnalyzedCount < stats.totalCount && (
                        <span className="block mt-1 text-amber-600">
                          {stats.totalCount - stats.aiAnalyzedCount} case(s) still pending AI analysis.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                  <h2 className="text-sm font-bold text-slate-900 mb-1">Avg Response Velocity</h2>
                  <p className="text-xs text-slate-500 mb-4">Speed of AI‑assisted response preparation.</p>
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-black text-blue-600">{stats.avgResponseMinutes}</div>
                    <div className="text-xs text-slate-500">
                      Average AI analysis &amp; evidence packaging time vs ~4.8 hrs manual review.
                    </div>
                  </div>
                </div>
              </div>

              {/* Chargeback Trends – unavailable note */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-bold text-slate-900">Chargeback Trends Over Time</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                    Unavailable
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Time‑series chargeback trend data requires a dedicated
                  <code className="mx-1 text-[11px] bg-slate-100 px-1 rounded">/api/analytics/trends</code>
                  endpoint with date‑bucketed aggregation. This endpoint does not yet exist in the backend.
                  The existing <code className="mx-1 text-[11px] bg-slate-100 px-1 rounded">/api/stats</code>
                  endpoint provides only current‑state counts. No fabricated trend data is shown.
                </p>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
