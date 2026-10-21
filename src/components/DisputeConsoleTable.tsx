"use client";

import React, { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import {
  Clock,
  Sparkles,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  UserCheck,
  FileEdit,
} from "lucide-react";

export interface DisputeRow {
  id: string;
  paypalDisputeId: string;
  status: string;
  disputeLifeCycleStage: string;
  reason: string;
  disputeAmount: number;
  currency: string;
  buyerName: string;
  buyerEmail: string;
  responseDueDate: string;
  responseWorkflowStatus: "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "SUBMITTING" | "SUBMITTED" | "SUBMISSION_FAILED" | "AWAITING_CONFIRMATION";
  resolutionOutcome?: string;
  transaction?: {
    sellerTransactionId: string;
  };
  order?: {
    orderNumber: string;
  };
  trackingInfo?: {
    carrier: string;
    trackingNumber: string;
    status: string;
  };
  aiAnalysis?: {
    completenessScore: number;
    recommendedAction: string;
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
}: DisputeConsoleTableProps) {
  const [activeWorkflowFilter, setActiveWorkflowFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredData = useMemo(() => {
    return disputes.filter((row) => {
      // Workflow status filter
      if (activeWorkflowFilter !== "ALL") {
        if (activeWorkflowFilter === "URGENT") {
          const due = new Date(row.responseDueDate).getTime();
          const diffHours = (due - Date.now()) / (1000 * 3600);
          if (diffHours < 0 || diffHours > 48 || row.status === "RESOLVED") {
            return false;
          }
        } else if (row.responseWorkflowStatus !== activeWorkflowFilter) {
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
          (row.transaction?.sellerTransactionId && row.transaction.sellerTransactionId.toLowerCase().includes(q)) ||
          row.reason.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [disputes, activeWorkflowFilter, searchQuery]);

  // Render distinct workflow badge
  const renderWorkflowBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            <FileEdit className="w-3 h-3 text-slate-400" /> Draft
          </span>
        );
      case "NEEDS_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <AlertCircle className="w-3 h-3 text-amber-400" /> Needs Review
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            <UserCheck className="w-3 h-3 text-indigo-400" /> Approved
          </span>
        );
      case "SUBMITTING":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/40 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-sky-400" /> Submitting...
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Submitted
          </span>
        );
      case "SUBMISSION_FAILED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3 h-3 text-rose-400" /> Submission Failed
          </span>
        );
      case "AWAITING_CONFIRMATION":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <Clock className="w-3 h-3 text-purple-400" /> Awaiting Confirmation
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{status}</span>;
    }
  };

  const columnDefs = useMemo<ColDef<DisputeRow>[]>(() => {
    return [
      {
        headerName: "Dispute & Stage",
        field: "paypalDisputeId",
        minWidth: 190,
        flex: 1.1,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex flex-col justify-center h-full py-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                <span className="text-sky-400 font-mono text-xs">{params.data.paypalDisputeId}</span>
                <span className="text-[10px] text-slate-400 font-mono">({params.data.disputeLifeCycleStage})</span>
              </div>
              <span className="text-[11px] text-slate-300 truncate mt-0.5">
                {params.data.reason.replace(/_/g, " ")}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "Buyer & Order",
        field: "buyerName",
        minWidth: 190,
        flex: 1.1,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex flex-col justify-center h-full py-1">
              <span className="text-xs font-medium text-slate-200 truncate">{params.data.buyerName}</span>
              <span className="text-[11px] text-slate-400 truncate">{params.data.buyerEmail}</span>
              {params.data.order?.orderNumber && (
                <span className="text-[10px] text-slate-400 font-mono">Order #{params.data.order.orderNumber}</span>
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
        headerName: "Response Workflow State",
        field: "responseWorkflowStatus",
        minWidth: 180,
        width: 195,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex items-center h-full">
              {renderWorkflowBadge(params.data.responseWorkflowStatus)}
            </div>
          );
        },
      },
      {
        headerName: "Deadline Urgency",
        field: "responseDueDate",
        minWidth: 170,
        width: 175,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          if (params.data.status === "RESOLVED") {
            return <div className="flex items-center h-full text-slate-400 text-xs">Case Resolved</div>;
          }

          const dueDate = new Date(params.data.responseDueDate);
          const diffHours = Math.round((dueDate.getTime() - Date.now()) / (1000 * 3600));

          let badgeClass = "text-slate-300 bg-slate-800/80 border-slate-700";
          let label = "";

          if (diffHours <= 0) {
            badgeClass = "text-rose-400 bg-rose-500/20 border-rose-500/40 font-bold";
            label = "EXPIRED TODAY";
          } else if (diffHours <= 24) {
            badgeClass = "text-rose-300 bg-rose-500/20 border-rose-500/50 font-bold animate-pulse";
            label = `⏰ ${diffHours}h left!`;
          } else if (diffHours <= 48) {
            badgeClass = "text-amber-300 bg-amber-500/15 border-amber-500/40";
            label = `⚠️ ${diffHours}h left`;
          } else {
            label = `${Math.floor(diffHours / 24)} days left`;
          }

          return (
            <div className="flex flex-col justify-center h-full py-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border font-medium w-fit ${badgeClass}`}>
                {label}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "AI Completeness",
        minWidth: 160,
        flex: 0.9,
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data || !params.data.aiAnalysis) {
            return (
              <div className="flex items-center h-full text-xs text-slate-400 italic gap-1">
                <Sparkles className="w-3 h-3" /> Pending analysis
              </div>
            );
          }
          const score = params.data.aiAnalysis.completenessScore;
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
              <span className="text-[10px] text-sky-400 mt-0.5 truncate">
                {params.data.aiAnalysis.recommendedAction.replace(/_/g, " ")}
              </span>
            </div>
          );
        },
      },
      {
        headerName: "Action",
        width: 120,
        pinned: "right",
        cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex items-center h-full justify-end">
              <button
                onClick={() => onSelectDispute(params.data!.id)}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all"
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
      {/* Controls & Filter Tabs */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Distinct State Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: "All Cases" },
            { id: "NEEDS_REVIEW", label: "Needs Review" },
            { id: "APPROVED", label: "Approved" },
            { id: "SUBMITTED", label: "Submitted" },
            { id: "SUBMISSION_FAILED", label: "Failed" },
            { id: "URGENT", label: "Urgent (<48h)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveWorkflowFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeWorkflowFilter === tab.id
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                  : "bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dispute, buyer, order..."
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* AG Grid */}
      <div className="ag-theme-quartz-dark w-full h-[480px]">
        <AgGridReact
          rowData={filteredData}
          columnDefs={columnDefs}
          rowHeight={64}
          headerHeight={38}
          suppressCellFocus={true}
          animateRows={true}
          overlayNoRowsTemplate='<span class="text-slate-400 text-sm">No disputes matching current filter.</span>'
        />
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div>
          Showing <span className="text-slate-200 font-medium">{filteredData.length}</span> of{" "}
          <span className="text-slate-200 font-medium">{disputes.length}</span> disputes
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block animate-ping" />
          <span>Default: Human Approval Mandatory • Never Auto-Submits Without Sign-off</span>
        </div>
      </div>
    </div>
  );
}
