"use client";

import React, { useMemo } from "react";
import DisputeConsoleTable from "@/components/DisputeConsoleTable";
import { useAppContext } from "@/lib/app-context";
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";

export default function DisputesPage() {
  const {
    disputes,
    stats,
    loading,
    searchQuery,
    openDisputeWorkbench,
    refreshData,
  } = useAppContext();

  const filteredDisputes = useMemo(() => {
    if (!searchQuery.trim()) return disputes;
    const q = searchQuery.toLowerCase();
    return disputes.filter((d) =>
      d.paypalDisputeId?.toLowerCase().includes(q) ||
      d.buyerName?.toLowerCase().includes(q) ||
      d.buyerEmail?.toLowerCase().includes(q) ||
      d.reason?.toLowerCase().includes(q) ||
      d.transaction?.sellerTransactionId?.toLowerCase().includes(q)
    );
  }, [disputes, searchQuery]);

  const urgentCount = stats?.urgentCount || 0;
  const needsReviewCount = disputes.filter(
    (d) => d.responseWorkflowStatus === "NEEDS_REVIEW"
  ).length;
  const approvedCount = disputes.filter(
    (d) => d.responseWorkflowStatus === "APPROVED"
  ).length;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Merchant Dispute Operations Console</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono font-medium">
                AG Grid Pro
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Real-time queue of all active disputes, deadlines, evidence completeness, and recommended actions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshData(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Quick Status Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Disputes</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{disputes.length}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Needs Review</span>
            <div className="text-lg font-bold text-amber-700 mt-0.5">{needsReviewCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Approved (Ready)</span>
            <div className="text-lg font-bold text-indigo-700 mt-0.5">{approvedCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Urgent (&lt;48h)</span>
            <div className={`text-lg font-bold mt-0.5 ${urgentCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {urgentCount}
            </div>
          </div>
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
            urgentCount > 0 ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"
          }`}>
            <Clock className={`w-4 h-4 ${urgentCount > 0 ? "text-rose-600" : "text-emerald-600"}`} />
          </div>
        </div>
      </div>

      {/* Full AG Grid Table */}
      <section className="space-y-3">
        <DisputeConsoleTable
          disputes={filteredDisputes}
          onSelectDispute={openDisputeWorkbench}
          loading={loading}
        />
      </section>
    </div>
  );
}
