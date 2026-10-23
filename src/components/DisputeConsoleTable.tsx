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
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <FileEdit className="w-3 h-3 text-slate-500" /> Draft
          </span>
        );
      case "NEEDS_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-500" /> Needs Review
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            <UserCheck className="w-3 h-3 text-indigo-600" /> Approved
          </span>
        );
      case "SUBMITTING":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-blue-600" /> Submitting...
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Submitted
          </span>
        );
      case "SUBMISSION_FAILED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Submission Failed
          </span>
        );
      case "AWAITING_CONFIRMATION":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            <Clock className="w-3 h-3 text-purple-500" /> Awaiting Confirmation
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
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
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <span className="text-blue-600 font-mono text-xs">{params.data.paypalDisputeId}</span>
                <span className="text-[10px] text-slate-500 font-mono">({params.data.disputeLifeCycleStage})</span>
              </div>
              <span className="text-[11px] text-slate-600 truncate mt-0.5">
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
              <span className="text-xs font-semibold text-slate-900 truncate">{params.data.buyerName}</span>
              <span className="text-[11px] text-slate-500 truncate">{params.data.buyerEmail}</span>
              {params.data.order?.orderNumber && (
                <span className="text-[10px] text-slate-500 font-mono">Order #{params.data.order.orderNumber}</span>
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
            <div className="flex items-center h-full font-bold text-slate-900 font-mono text-sm">
              ${params.data.disputeAmount.toFixed(2)}
              <span className="text-[10px] text-slate-500 ml-1 font-normal">{params.data.currency}</span>
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
            return <div className="flex items-center h-full text-slate-500 text-xs">Case Resolved</div>;
          }

          const dueDate = new Date(params.data.responseDueDate);
          const diffHours = Math.round((dueDate.getTime() - Date.now()) / (1000 * 3600));

          let badgeClass = "text-slate-700 bg-slate-100 border-slate-200";
          let label = "";

          if (diffHours <= 0) {
            badgeClass = "text-rose-700 bg-rose-50 border-rose-200 font-bold";
            label = "EXPIRED TODAY";
          } else if (diffHours <= 24) {
            badgeClass = "text-rose-700 bg-rose-50 border-rose-200 font-bold animate-pulse";
            label = `⏰ ${diffHours}h left!`;
          } else if (diffHours <= 48) {
            badgeClass = "text-amber-700 bg-amber-50 border-amber-200 font-medium";
            label = `⚠️ ${diffHours}h left`;
          } else {
            label = `${Math.floor(diffHours / 24)} days left`;
          }

          return (
            <div className="flex flex-col justify-center h-full py-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border w-fit ${badgeClass}`}>
                {label}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">
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
                <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-800 font-mono">{score}%</span>
              </div>
              <span className="text-[10px] text-blue-600 mt-0.5 truncate font-medium">
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
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
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
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Controls & Filter Tabs */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
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
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
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
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* AG Grid Light */}
      <div className="ag-theme-quartz w-full h-[480px]">
        <AgGridReact
          rowData={filteredData}
          columnDefs={columnDefs}
          rowHeight={64}
          headerHeight={38}
          suppressCellFocus={true}
          animateRows={true}
          overlayNoRowsTemplate='<span class="text-slate-500 text-sm">No disputes matching current filter.</span>'
        />
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <span className="text-slate-800 font-semibold">{filteredData.length}</span> of{" "}
          <span className="text-slate-800 font-semibold">{disputes.length}</span> disputes
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
          <span>Default: Human Approval Mandatory • Never Auto-Submits Without Sign-off</span>
        </div>
      </div>
    </div>
  );
}
