"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import {
  Zap,
  Search,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  User,
  CreditCard,
  Package,
  ShieldAlert,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  sellerTransactionId: string;
  paypalTransactionId?: string;
  grossAmount: number;
  currency: string;
  paymentStatus: string;
  paymentSource: string;
  payerEmail?: string;
  transactionTime: string;
}

interface DisputeRow {
  id: string;
  paypalDisputeId: string;
  status: string;
  disputeAmount: number;
  currency: string;
  reason: string;
  buyerName: string;
  buyerEmail: string;
  responseDueDate: string;
  responseWorkflowStatus: string;
  transaction: Transaction | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  REQUIRED_ACTION: "bg-rose-100 text-rose-700 border border-rose-200",
  UNDER_REVIEW: "bg-amber-100 text-amber-700 border border-amber-200",
  WAITING_FOR_SELLER: "bg-orange-100 text-orange-700 border border-orange-200",
  WAITING_FOR_BUYER: "bg-blue-100 text-blue-700 border border-blue-200",
  RESOLVED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  CLOSED: "bg-slate-100 text-slate-600 border border-slate-200",
};

const paymentStatusColors: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-rose-50 text-rose-700",
  REFUNDED: "bg-slate-50 text-slate-600",
};

function fmt(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs > 0) return `${hrs}h ago`;
  return "Just now";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/disputes?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      setDisputes(data.disputes || []);
    } catch (e: any) {
      setError(e.message || "Failed to load payment data");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statuses = ["ALL", "REQUIRED_ACTION", "UNDER_REVIEW", "WAITING_FOR_SELLER", "RESOLVED", "CLOSED"];

  const totalVolume = disputes.reduce((s, d) => s + (d.transaction?.grossAmount ?? d.disputeAmount), 0);
  const completedCount = disputes.filter((d) => d.transaction?.paymentStatus === "COMPLETED").length;
  const urgentCount = disputes.filter((d) => {
    const h = (new Date(d.responseDueDate).getTime() - Date.now()) / 3600000;
    return h > 0 && h <= 48 && d.status !== "RESOLVED";
  }).length;

  return (
    <div className="app-shell">
      <Sidebar
        activeNav="payments"
        onNavChange={() => {}}
        urgentCount={urgentCount}
      />

      <div className="content-wrapper">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </Link>
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Payment Intelligence</h1>
              <p className="text-[11px] text-slate-500">Transaction overview linked to dispute cases</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        <main className="flex-1 px-6 py-6 space-y-5 max-w-[1400px] mx-auto w-full">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Volume", value: fmt(totalVolume), icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Transactions", value: disputes.length, icon: CreditCard, color: "text-indigo-600", bg: "bg-indigo-50" },
              { label: "Completed", value: completedCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Urgent Deadlines", value: urgentCount, icon: Clock, color: urgentCount > 0 ? "text-rose-600" : "text-emerald-600", bg: urgentCount > 0 ? "bg-rose-50" : "bg-emerald-50" },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">{card.value}</div>
                    <div className="text-xs text-slate-500">{card.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by transaction ID, buyer name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    statusFilter === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {s === "ALL" ? "All" : s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <AlertTriangle className="w-10 h-10 text-rose-400" />
              <p className="text-sm font-semibold text-rose-600">Failed to load data</p>
              <p className="text-xs text-slate-500">{error}</p>
              <button onClick={fetchData} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold">
                Retry
              </button>
            </div>
          ) : disputes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <Package className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No transactions found</p>
              <p className="text-xs text-slate-400">Adjust your filters or seed the database.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Transaction ID", "Buyer", "Amount", "Payment Status", "Dispute Status", "Due Date", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((d) => (
                    <React.Fragment key={d.id}>
                      <tr
                        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                          expanded === d.id ? "bg-blue-50/40" : ""
                        }`}
                        onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                      >
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {d.transaction?.sellerTransactionId ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{d.buyerName}</div>
                          <div className="text-slate-400 text-[11px]">{d.buyerEmail}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {fmt(d.transaction?.grossAmount ?? d.disputeAmount, d.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            paymentStatusColors[d.transaction?.paymentStatus ?? ""] ?? "bg-slate-100 text-slate-600"
                          }`}>
                            {d.transaction?.paymentStatus ?? "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            statusColors[d.status] ?? "bg-slate-100 text-slate-600"
                          }`}>
                            {d.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(d.responseDueDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {expanded === d.id
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {expanded === d.id && (
                        <tr className="border-b border-slate-100 bg-blue-50/20">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div>
                                <p className="text-slate-400 mb-0.5 uppercase tracking-wide font-semibold text-[10px]">PayPal Dispute ID</p>
                                <p className="font-mono text-slate-700">{d.paypalDisputeId}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 mb-0.5 uppercase tracking-wide font-semibold text-[10px]">Dispute Reason</p>
                                <p className="text-slate-700">{d.reason.replace(/_/g, " ")}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 mb-0.5 uppercase tracking-wide font-semibold text-[10px]">Workflow Status</p>
                                <p className="text-slate-700">{d.responseWorkflowStatus}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 mb-0.5 uppercase tracking-wide font-semibold text-[10px]">PayPal Transaction ID</p>
                                <p className="font-mono text-slate-700">{d.transaction?.paypalTransactionId ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 mb-0.5 uppercase tracking-wide font-semibold text-[10px]">Payment Source</p>
                                <p className="text-slate-700">{d.transaction?.paymentSource ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 mb-0.5 uppercase tracking-wide font-semibold text-[10px]">Payer Email</p>
                                <p className="text-slate-700">{d.transaction?.payerEmail ?? d.buyerEmail}</p>
                              </div>
                              <div>
                                <p className="text-slate-400 mb-0.5 uppercase tracking-wide font-semibold text-[10px]">Transaction Date</p>
                                <p className="text-slate-700">
                                  {d.transaction?.transactionTime
                                    ? new Date(d.transaction.transactionTime).toLocaleString()
                                    : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400 mb-0.5 uppercase tracking-wide font-semibold text-[10px]">Dispute Amount</p>
                                <p className="font-semibold text-rose-600">{fmt(d.disputeAmount, d.currency)}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <Link
                                href="/"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Open Dispute Workbench
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
