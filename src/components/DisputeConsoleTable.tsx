"use client";

import React, { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import {
  Clock,
  Sparkles,
  ArrowRight,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Truck,
  Shield,
  HelpCircle,
} from "lucide-react";

interface DisputeRow {
  id: string;
  paypalDisputeId: string;
  status: string;
  disputeLifeCycleStage: string;
  reason: string;
  disputeAmount: number;
  currency: string;
  buyerName: string;
  buyerEmail: string;
  sellerTransactionId: string;
  responseDueDate: string;
  aiAnalyzed: boolean;
  aiConfidenceScore?: number;
  aiRecommendedAction?: string;
  resolutionOutcome?: string;
  order?: {
    orderNumber: string;
  };
  trackingInfo?: {
    carrier: string;
    trackingNumber: string;
    status: string;
  };
}

interface DisputeConsoleTableProps {
  disputes: DisputeRow[];
  onSelectDispute: (disputeId: string) => void;
  loading: boolean;
}

export default function DisputeConsoleTable({
  disputes,
  onSelectDispute,
  loading,
}: DisputeConsoleTableProps) {
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filtered rows
  const filteredData = useMemo(() => {
    return disputes.filter((row) => {
      // Status filter
      if (activeFilter === "ACTION_REQUIRED") {
        if (row.status !== "REQUIRED_ACTION" && row.status !== "WAITING_FOR_SELLER") {
          return false;
        }
      } else if (activeFilter === "URGENT") {
        const due = new Date(row.responseDueDate).getTime();
        const diffHours = (due - Date.now()) / (1000 * 3600);
        if (diffHours < 0 || diffHours > 48 || row.status === "RESOLVED") {
          return false;
        }
      } else if (activeFilter === "UNDER_REVIEW") {
        if (row.status !== "UNDER_REVIEW" && row.status !== "WAITING_FOR_BUYER") {
          return false;
        }
      } else if (activeFilter === "RESOLVED") {
        if (row.status !== "RESOLVED") {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matches =
          row.paypalDisputeId.toLowerCase().includes(q) ||
          row.buyerName.toLowerCase().includes(q) ||
          row.buyerEmail.toLowerCase().includes(q) ||
          row.sellerTransactionId.toLowerCase().includes(q) ||
          row.reason.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [disputes, activeFilter, searchQuery]);

  // Format reason code for human readability
  const formatReason = (reason: string) => {
    switch (reason) {
      case "MERCHANDISE_OR_SERVICE_NOT_RECEIVED":
        return { label: "Item Not Received", color: "text-amber-300 bg-amber-500/10 border-amber-500/20" };
      case "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED":
        return { label: "Not as Described", color: "text-purple-300 bg-purple-500/10 border-purple-500/20" };
      case "UNAUTHORISED":
        return { label: "Unauthorised Charge", color: "text-rose-300 bg-rose-500/10 border-rose-500/20" };
      default:
        return { label: reason.replace(/_/g, " "), color: "text-slate-300 bg-slate-800 border-slate-700" };
    }
  };

  // AG Grid Column Definitions
  const columnDefs = useMemo<ColDef<DisputeRow>[]>(() => {
    return [
      {
        headerName: "Dispute & Reason",
        field: "paypalDisputeId",
        minWidth: 220,
        flex: 1.2,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          const reasonMeta = formatReason(params.data.reason);
          return (
            <div className="flex flex-col justify-center h-full py-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                <span className="text-sky-400 font-mono text-xs">{params.data.paypalDisputeId}</span>
                <span className="text-[10px] text-slate-400 font-mono">({params.data.disputeLifeCycleStage})</span>
              </div>
              <div className="mt-0.5">
                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium ${reasonMeta.color}`}>
                  {reasonMeta.label}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        headerName: "Buyer & Order",
        field: "buyerName",
        minWidth: 200,
        flex: 1.1,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex flex-col justify-center h-full py-1">
              <span className="text-xs font-medium text-slate-200 truncate">{params.data.buyerName}</span>
              <span className="text-[11px] text-slate-400 truncate">{params.data.buyerEmail}</span>
              {params.data.order?.orderNumber && (
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">Order #{params.data.order.orderNumber}</span>
              )}
            </div>
          );
        },
      },
      {
        headerName: "Amount",
        field: "disputeAmount",
        minWidth: 110,
        width: 120,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex items-center h-full font-semibold text-slate-100 font-mono text-sm">
              ${params.data.disputeAmount.toFixed(2)}
              <span className="text-[10px] text-slate-400 ml-1 font-normal">{params.data.currency}</span>
            </div>
          );
        },
      },
      {
        headerName: "Status",
        field: "status",
        minWidth: 140,
        width: 150,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          const status = params.data.status;
          if (status === "RESOLVED") {
            const outcome = params.data.resolutionOutcome || "CLOSED";
            return (
              <div className="flex items-center h-full">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  {outcome === "WON" ? "Won by Merchant" : outcome === "ACCEPTED" ? "Claim Accepted" : "Resolved"}
                </span>
              </div>
            );
          } else if (status === "REQUIRED_ACTION" || status === "WAITING_FOR_SELLER") {
            return (
              <div className="flex items-center h-full">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30">
                  <AlertCircle className="w-3 h-3" />
                  Action Required
                </span>
              </div>
            );
          } else {
            return (
              <div className="flex items-center h-full">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30">
                  <Clock className="w-3 h-3" />
                  Under Review
                </span>
              </div>
            );
          }
        },
      },
      {
        headerName: "Deadline Urgency",
        field: "responseDueDate",
        minWidth: 170,
        width: 180,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          if (params.data.status === "RESOLVED") {
            return (
              <div className="flex items-center h-full text-slate-400 text-xs">
                Case Concluded
              </div>
            );
          }

          const dueDate = new Date(params.data.responseDueDate);
          const diffMs = dueDate.getTime() - Date.now();
          const diffHours = Math.round(diffMs / (1000 * 3600));
          const diffDays = Math.floor(diffHours / 24);

          let badgeClass = "text-slate-300 bg-slate-800 border-slate-700";
          let label = "";

          if (diffHours <= 0) {
            badgeClass = "text-rose-400 bg-rose-500/20 border-rose-500/40 font-bold";
            label = "EXPIRED TODAY";
          } else if (diffHours <= 24) {
            badgeClass = "text-rose-300 bg-rose-500/20 border-rose-500/50 font-bold animate-pulse";
            label = `⏰ ${diffHours}h remaining!`;
          } else if (diffHours <= 48) {
            badgeClass = "text-amber-300 bg-amber-500/15 border-amber-500/40";
            label = `⚠️ ${diffHours}h remaining`;
          } else {
            badgeClass = "text-slate-300 bg-slate-800/80 border-slate-700";
            label = `${diffDays} days left`;
          }

          return (
            <div className="flex flex-col justify-center h-full py-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border font-medium w-fit ${badgeClass}`}>
                {label}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Due: {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "AI Evidence Analysis",
        minWidth: 190,
        flex: 1,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          if (!params.data.aiAnalyzed) {
            return (
              <div className="flex items-center h-full">
                <span className="text-xs text-slate-400 italic flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-slate-400" /> Pending analysis
                </span>
              </div>
            );
          }

          const score = params.data.aiConfidenceScore || 0;
          const action = params.data.aiRecommendedAction || "PROVIDE_EVIDENCE";

          return (
            <div className="flex flex-col justify-center h-full py-1">
              <div className="flex items-center gap-2">
                <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      score >= 80 ? "bg-emerald-400" : score >= 50 ? "bg-amber-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-200 font-mono">{score}%</span>
              </div>
              <div className="text-[10px] font-medium text-sky-400 truncate mt-0.5">
                {action === "PROVIDE_EVIDENCE" ? "Defend with Evidence" : action === "ACCEPT_CLAIM" ? "Accept Claim" : "Partial Refund Offer"}
              </div>
            </div>
          );
        },
      },
      {
        headerName: "Operations",
        width: 140,
        pinned: "right",
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex items-center h-full justify-end">
              <button
                onClick={() => onSelectDispute(params.data!.id)}
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white shadow-sm transition-all"
              >
                <span>Review</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          );
        },
      },
    ];
  }, [onSelectDispute]);

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-sm overflow-hidden shadow-xl">
      {/* Table Controls / Filter Tabs */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: "All Disputes" },
            { id: "ACTION_REQUIRED", label: "Action Required" },
            { id: "URGENT", label: "Urgent (<48h)" },
            { id: "UNDER_REVIEW", label: "Under Review" },
            { id: "RESOLVED", label: "Resolved" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === tab.id
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                  : "bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dispute ID, buyer, order..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* AG Grid Container */}
      <div className="ag-theme-quartz-dark w-full h-[480px]">
        <AgGridReact
          rowData={filteredData}
          columnDefs={columnDefs}
          rowHeight={64}
          headerHeight={38}
          suppressCellFocus={true}
          animateRows={true}
          overlayLoadingTemplate='<span class="text-slate-400 text-sm">Loading dispute operations console...</span>'
          overlayNoRowsTemplate='<span class="text-slate-400 text-sm">No disputes matching current filter criteria.</span>'
        />
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing <span className="text-slate-200 font-medium">{filteredData.length}</span> of{" "}
          <span className="text-slate-200 font-medium">{disputes.length}</span> disputes
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block animate-ping" />
          <span>Real-time PayPal Disputes API Sync Enabled</span>
        </div>
      </div>
    </div>
  );
}
