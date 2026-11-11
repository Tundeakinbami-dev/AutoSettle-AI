"use client";

import React, { useState, useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import {
  FileText,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  Truck,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  UploadCloud,
  FileCheck,
} from "lucide-react";

export default function EvidencePage() {
  const { disputes, loading, openDisputeWorkbench, refreshData } = useAppContext();
  const [filterType, setFilterType] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Aggregate stats
  const totalEvidenceCount = useMemo(() => {
    return disputes.reduce((acc, d) => acc + (d.evidenceItems?.length || 0), 0);
  }, [disputes]);

  const verifiedEvidenceCount = useMemo(() => {
    return disputes.reduce((acc, d) => {
      const verifiedInDispute = (d.evidenceItems || []).filter((e: any) => e.verified).length;
      return acc + verifiedInDispute;
    }, 0);
  }, [disputes]);

  const carrierTrackersCount = useMemo(() => {
    return disputes.filter((d) => d.trackingInfo).length;
  }, [disputes]);

  const disputesWithGaps = useMemo(() => {
    return disputes.filter((d) => {
      if (!d.aiAnalysis?.criticalGapsJson) return false;
      try {
        const gaps = JSON.parse(d.aiAnalysis.criticalGapsJson);
        return Array.isArray(gaps) && gaps.length > 0;
      } catch {
        return false;
      }
    }).length;
  }, [disputes]);

  const filteredDisputes = useMemo(() => {
    return disputes.filter((d) => {
      if (filterType === "WITH_TRACKING" && !d.trackingInfo) return false;
      if (filterType === "GAPS_DETECTED") {
        if (!d.aiAnalysis?.criticalGapsJson) return false;
        try {
          const gaps = JSON.parse(d.aiAnalysis.criticalGapsJson);
          if (!Array.isArray(gaps) || gaps.length === 0) return false;
        } catch {
          return false;
        }
      }
      if (filterType === "ROBUST") {
        if ((d.aiAnalysis?.completenessScore || 0) < 80) return false;
      }

      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        const matches =
          d.paypalDisputeId?.toLowerCase().includes(q) ||
          d.buyerName?.toLowerCase().includes(q) ||
          d.trackingInfo?.trackingNumber?.toLowerCase().includes(q) ||
          d.order?.orderNumber?.toLowerCase().includes(q) ||
          d.evidenceItems?.some((e: any) => e.title?.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [disputes, filterType, searchTerm]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Evidence Files &amp; Dossiers</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-medium">
                Vault
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Carrier delivery confirmations, fulfillment proofs, customer messaging, and policy documentation.
            </p>
          </div>
        </div>

        <button
          onClick={() => refreshData(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{totalEvidenceCount}</div>
            <div className="text-xs text-slate-500">Attached Documents</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{verifiedEvidenceCount}</div>
            <div className="text-xs text-slate-500">Verified by Provenance</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{carrierTrackersCount}</div>
            <div className="text-xs text-slate-500">Carrier Trackers Active</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            disputesWithGaps > 0 ? "bg-amber-50" : "bg-emerald-50"
          }`}>
            <AlertTriangle className={`w-5 h-5 ${disputesWithGaps > 0 ? "text-amber-600" : "text-emerald-600"}`} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{disputesWithGaps}</div>
            <div className="text-xs text-slate-500">Cases with Evidence Gaps</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by dispute ID, buyer name, tracking #, or document title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 shadow-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "ALL", label: "All Cases" },
            { id: "WITH_TRACKING", label: "Has Carrier Proof" },
            { id: "ROBUST", label: "Robust (80%+)" },
            { id: "GAPS_DETECTED", label: "Gaps Detected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filterType === tab.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Dossier List */}
      <div className="space-y-4">
        {filteredDisputes.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No evidence dossiers matching filter</p>
            <p className="text-xs text-slate-400 mt-1">Adjust filters or create a dispute intake.</p>
          </div>
        ) : (
          filteredDisputes.map((dispute) => {
            const completeness = dispute.aiAnalysis?.completenessScore ?? 0;
            const items = dispute.evidenceItems || [];

            return (
              <div
                key={dispute.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
              >
                {/* Dossier Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-sm text-blue-600">
                      {dispute.paypalDisputeId}
                    </span>
                    <span className="text-xs text-slate-600 font-semibold">
                      {dispute.buyerName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ${dispute.disputeAmount?.toFixed(2)} {dispute.currency}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {dispute.reason?.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Completeness Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">Completeness:</span>
                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            completeness >= 80 ? "bg-emerald-500" : completeness >= 50 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${completeness}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-800">{completeness}%</span>
                    </div>

                    <button
                      onClick={() => openDisputeWorkbench(dispute.id)}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors shadow-sm"
                    >
                      <span>Open Locker</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Evidence Artifacts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Carrier Proof */}
                  {dispute.trackingInfo ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-700 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-blue-600" />
                          <span>{dispute.trackingInfo.carrier} Delivery Tracking</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                          {dispute.trackingInfo.status}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-slate-600">
                        {dispute.trackingInfo.trackingNumber}
                      </p>
                      {dispute.trackingInfo.signedBy && (
                        <p className="text-[11px] text-slate-500">
                          Signed by: <strong className="text-slate-700">"{dispute.trackingInfo.signedBy}"</strong>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 text-xs flex items-center gap-2 text-rose-700">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>Carrier tracking missing</span>
                    </div>
                  )}

                  {/* Order Proof */}
                  {dispute.order ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-slate-700 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Order #{dispute.order.orderNumber}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {new Date(dispute.order.orderDate).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate">
                        Ship to: {dispute.order.shippingAddress}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Total: ${dispute.order.orderTotal?.toFixed(2)}
                      </p>
                    </div>
                  ) : null}

                  {/* Attached Documents List */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <span className="font-semibold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Attached Files ({items.length})</span>
                      </span>
                    </span>
                    {items.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">No files attached yet</span>
                    ) : (
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {items.slice(0, 3).map((item: any) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-[11px] bg-white px-2 py-1 rounded border border-slate-200"
                          >
                            <span className="truncate max-w-[140px] text-slate-700">{item.title}</span>
                            <span className="text-[9px] px-1 py-0.2 bg-emerald-50 text-emerald-700 rounded font-semibold">
                              {item.strength}
                            </span>
                          </div>
                        ))}
                        {items.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{items.length - 3} more records</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
