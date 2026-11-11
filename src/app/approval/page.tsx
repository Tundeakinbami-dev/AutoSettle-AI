"use client";

import React, { useState, useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import {
  CheckSquare,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Send,
  RefreshCw,
  Search,
  ChevronRight,
  ShieldAlert,
  Loader2,
} from "lucide-react";

export default function ApprovalQueuePage() {
  const { disputes, loading, openDisputeWorkbench, refreshData } = useAppContext();
  const [activeTab, setActiveTab] = useState<string>("NEEDS_REVIEW");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);

  const needsReviewCount = useMemo(() => {
    return disputes.filter((d) => d.responseWorkflowStatus === "NEEDS_REVIEW").length;
  }, [disputes]);

  const draftCount = useMemo(() => {
    return disputes.filter((d) => d.responseWorkflowStatus === "DRAFT").length;
  }, [disputes]);

  const approvedCount = useMemo(() => {
    return disputes.filter((d) => d.responseWorkflowStatus === "APPROVED").length;
  }, [disputes]);

  const urgentCount = useMemo(() => {
    return disputes.filter((d) => {
      const due = new Date(d.responseDueDate).getTime();
      const diffHours = (due - Date.now()) / (1000 * 3600);
      return diffHours > 0 && diffHours <= 48 && d.status !== "RESOLVED";
    }).length;
  }, [disputes]);

  const handleApprove = async (disputeId: string) => {
    setApprovingId(disputeId);
    setApprovalError(null);
    setApprovalSuccess(null);
    try {
      const res = await fetch(`/api/disputes/${disputeId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver: "merchant_compliance_reviewer" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setApprovalSuccess(data.message || `Dispute approved successfully.`);
        await refreshData(true);
      } else {
        setApprovalError(data.error || `Approval failed with status ${res.status}`);
      }
    } catch (err: any) {
      console.error("Approval error:", err);
      setApprovalError(err.message || "Network error while approving dispute.");
    } finally {
      setApprovingId(null);
    }
  };

  const filteredDisputes = useMemo(() => {
    return disputes.filter((d) => {
      if (activeTab === "NEEDS_REVIEW" && d.responseWorkflowStatus !== "NEEDS_REVIEW") return false;
      if (activeTab === "DRAFT" && d.responseWorkflowStatus !== "DRAFT") return false;
      if (activeTab === "APPROVED" && d.responseWorkflowStatus !== "APPROVED") return false;
      if (activeTab === "URGENT") {
        const due = new Date(d.responseDueDate).getTime();
        const diffHours = (due - Date.now()) / (1000 * 3600);
        if (diffHours < 0 || diffHours > 48 || d.status === "RESOLVED") return false;
      }

      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        const matches =
          d.paypalDisputeId?.toLowerCase().includes(q) ||
          d.buyerName?.toLowerCase().includes(q) ||
          d.reason?.toLowerCase().includes(q) ||
          d.draftResponses?.[0]?.rebuttalNarrative?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [disputes, activeTab, searchTerm]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Merchant Approval Queue</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-medium">
                Human-in-the-Loop
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Mandatory authorization gate. AutoSettle AI strictly requires merchant review before dispatching evidence packages to the PayPal Disputes API.
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

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-700">{needsReviewCount}</div>
            <div className="text-xs text-slate-500">Awaiting Sign-off</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-indigo-700">{approvedCount}</div>
            <div className="text-xs text-slate-500">Approved & Ready</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <FileEdit className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800">{draftCount}</div>
            <div className="text-xs text-slate-500">Unapproved Drafts</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            urgentCount > 0 ? "bg-rose-50" : "bg-emerald-50"
          }`}>
            <Clock className={`w-5 h-5 ${urgentCount > 0 ? "text-rose-600" : "text-emerald-600"}`} />
          </div>
          <div>
            <div className={`text-xl font-bold ${urgentCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {urgentCount}
            </div>
            <div className="text-xs text-slate-500">Expiring (&lt;48h)</div>
          </div>
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by dispute ID, buyer name, or narrative snippet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 shadow-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "NEEDS_REVIEW", label: `Needs Review (${needsReviewCount})` },
            { id: "APPROVED", label: `Approved (${approvedCount})` },
            { id: "DRAFT", label: `Drafts (${draftCount})` },
            { id: "URGENT", label: `Urgent (${urgentCount})` },
            { id: "ALL", label: "All Cases" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Alerts */}
      {approvalSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{approvalSuccess}</span>
          </div>
          <button onClick={() => setApprovalSuccess(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-2">✕</button>
        </div>
      )}
      {approvalError && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{approvalError}</span>
          </div>
          <button onClick={() => setApprovalError(null)} className="text-rose-600 hover:text-rose-800 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Approval Queue Cases */}
      <div className="space-y-4">
        {filteredDisputes.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
            <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No disputes matching queue criteria</p>
            <p className="text-xs text-slate-400 mt-1">All cases may be approved or submitted.</p>
          </div>
        ) : (
          filteredDisputes.map((dispute) => {
            const latestDraft = dispute.draftResponses?.[0];
            const isApproved = dispute.responseWorkflowStatus === "APPROVED";
            const isSubmitted = dispute.responseWorkflowStatus === "SUBMITTED";
            const isApprovingThis = approvingId === dispute.id;

            const dueDate = new Date(dispute.responseDueDate);
            const diffHours = Math.round((dueDate.getTime() - Date.now()) / (1000 * 3600));

            return (
              <div
                key={dispute.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
              >
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-sm text-blue-600">
                      {dispute.paypalDisputeId}
                    </span>
                    <span className="text-xs text-slate-800 font-semibold">
                      {dispute.buyerName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ${dispute.disputeAmount?.toFixed(2)} {dispute.currency}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {dispute.reason?.replace(/_/g, " ")}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                      isApproved
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : isSubmitted
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {dispute.responseWorkflowStatus?.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Deadline Urgency */}
                  <div className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                    diffHours <= 24
                      ? "bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse"
                      : diffHours <= 48
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}>
                    {diffHours <= 0 ? "Expired Today" : `⏰ ${diffHours}h remaining`}
                  </div>
                </div>

                {/* Draft Narrative Preview */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <FileEdit className="w-3.5 h-3.5 text-slate-400" />
                      <span>Draft Rebuttal Narrative (Version {latestDraft?.version || 1})</span>
                    </span>
                    <span className="font-mono text-[11px]">
                      {latestDraft?.characterCount || latestDraft?.rebuttalNarrative?.length || 0} / 2000 chars
                    </span>
                  </div>

                  <p className="text-xs font-mono text-slate-700 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                    {latestDraft?.rebuttalNarrative || "Draft rebuttal pending generation."}
                  </p>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Evidence files: <strong className="text-slate-700">{dispute.evidenceItems?.length || 0}</strong></span>
                    <span>•</span>
                    <span>Target: <strong className="text-slate-700">{latestDraft?.targetAction || "PROVIDE_EVIDENCE"}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDisputeWorkbench(dispute.id)}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <span>Review in Workbench</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {!isApproved && !isSubmitted && (
                      <button
                        onClick={() => handleApprove(dispute.id)}
                        disabled={isApprovingThis}
                        className="flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {isApprovingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        <span>{isApprovingThis ? "Approving..." : "Approve Response"}</span>
                      </button>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => openDisputeWorkbench(dispute.id)}
                        className="flex items-center gap-1 text-xs font-semibold px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Ready: Dispatch to PayPal</span>
                      </button>
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
