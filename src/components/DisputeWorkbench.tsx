"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Clock,
  Send,
  UploadCloud,
  Check,
  ChevronRight,
  FileCheck,
  RefreshCw,
  PackageCheck,
  Truck,
  MessageSquare,
  History,
  Lock,
  UserCheck,
  XCircle,
  AlertCircle,
  RotateCcw,
  Loader2,
  FileEdit,
} from "lucide-react";

interface EvidenceItem {
  id: string;
  evidenceType: string;
  title: string;
  description: string;
  fileName?: string;
  fileUrl?: string;
  strength: string;
  verified: boolean;
  provenanceSource?: string;
}

interface CustomerMessage {
  id: string;
  sender: string;
  channel: string;
  timestamp: string;
  messageText: string;
}

interface DraftResponse {
  id: string;
  version: number;
  status: string;
  targetAction: string;
  rebuttalNarrative: string;
  characterCount: number;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

interface SubmissionAttempt {
  id: string;
  action: string;
  status: string;
  endpoint: string;
  httpStatusCode?: number;
  requestPayloadSanitized: string;
  responsePayloadSanitized?: string;
  errorMessage?: string;
  attemptedAt: string;
  completedAt?: string;
}

interface AuditLogEntry {
  id: string;
  eventType: string;
  severity: string;
  summary: string;
  detailsJson?: string;
  actor: string;
  actorId?: string;
  timestamp: string;
}

export interface DisputeDetail {
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
  merchantNotes?: string;
  resolutionOutcome?: string;
  responseWorkflowStatus: "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "SUBMITTING" | "SUBMITTED" | "SUBMISSION_FAILED" | "AWAITING_CONFIRMATION";
  transaction?: {
    sellerTransactionId: string;
    grossAmount: number;
    paymentStatus: string;
  };
  order?: {
    orderNumber: string;
    orderDate: string;
    customerName: string;
    customerEmail: string;
    shippingAddress: string;
    billingAddress: string;
    orderTotal: number;
    itemsJson: string;
  };
  trackingInfo?: {
    carrier: string;
    trackingNumber: string;
    status: string;
    deliveredDate?: string;
    signedBy?: string;
  };
  evidenceItems: EvidenceItem[];
  messages: CustomerMessage[];
  aiAnalysis?: {
    summary: string;
    completenessScore: number;
    recommendedAction: string;
    recommendationRationale: string;
    keyStrengthsJson: string;
    criticalGapsJson: string;
    citationsJson: string;
    riskLevel: string;
  };
  draftResponses: DraftResponse[];
  submissionAttempts: SubmissionAttempt[];
  auditLogs: AuditLogEntry[];
}

interface DisputeWorkbenchProps {
  dispute: DisputeDetail;
  onClose: () => void;
  onRefresh: () => void;
}

export default function DisputeWorkbench({
  dispute,
  onClose,
  onRefresh,
}: DisputeWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<"ANALYSIS" | "REBUTTAL" | "EVIDENCE" | "SUBMIT" | "AUDIT">("ANALYSIS");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [rebuttalText, setRebuttalText] = useState(
    dispute.draftResponses[0]?.rebuttalNarrative || ""
  );
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [selectedAction, setSelectedAction] = useState<"PROVIDE_EVIDENCE" | "ACCEPT_CLAIM" | "MAKE_OFFER">(
    (dispute.draftResponses[0]?.targetAction as any) ||
    (dispute.aiAnalysis?.recommendedAction as any) ||
    "PROVIDE_EVIDENCE"
  );
  const [authorizedByMerchant, setAuthorizedByMerchant] = useState(
    dispute.responseWorkflowStatus === "APPROVED" || dispute.responseWorkflowStatus === "SUBMITTED"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [offerAmount, setOfferAmount] = useState<string>((dispute.disputeAmount * 0.5).toFixed(2));
  const [simulateFailureToggle, setSimulateFailureToggle] = useState(false);

  // Evidence upload modal state
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [newEvidenceType, setNewEvidenceType] = useState("PROOF_OF_FULFILLMENT");
  const [newEvidenceTitle, setNewEvidenceTitle] = useState("");
  const [newEvidenceDesc, setNewEvidenceDesc] = useState("");
  const [isAddingEvidence, setIsAddingEvidence] = useState(false);

  // Parse JSON helpers
  const keyStrengths: string[] = dispute.aiAnalysis?.keyStrengthsJson
    ? JSON.parse(dispute.aiAnalysis.keyStrengthsJson)
    : [];
  const criticalGaps: string[] = dispute.aiAnalysis?.criticalGapsJson
    ? JSON.parse(dispute.aiAnalysis.criticalGapsJson)
    : [];
  const citations: Array<{ fact: string; source: string; verified: boolean }> = dispute.aiAnalysis?.citationsJson
    ? JSON.parse(dispute.aiAnalysis.citationsJson)
    : [];
  const orderItems = dispute.order?.itemsJson
    ? JSON.parse(dispute.order.itemsJson)
    : [];

  const dueDate = new Date(dispute.responseDueDate);
  const diffHours = Math.round((dueDate.getTime() - Date.now()) / (1000 * 3600));

  // Trigger AI Analysis
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/disputes/${dispute.id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRebuttalText(data.result.rebuttalDraft);
        if (data.result.recommendedAction) {
          setSelectedAction(data.result.recommendedAction);
        }
        onRefresh();
      }
    } catch (err) {
      console.error("AI Analysis error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save edited rebuttal text
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      await fetch(`/api/disputes/${dispute.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rebuttalNarrative: rebuttalText }),
      });
      onRefresh();
    } catch (err) {
      console.error("Save draft error:", err);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Grant Human Approval
  const handleGrantApproval = async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/disputes/${dispute.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver: "merchant_compliance_reviewer" }),
      });
      const data = await res.json();
      if (data.success) {
        setAuthorizedByMerchant(true);
        onRefresh();
      }
    } catch (err) {
      console.error("Approval error:", err);
    } finally {
      setIsApproving(false);
    }
  };

  // Add Evidence Item
  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvidenceTitle || !newEvidenceDesc) return;
    setIsAddingEvidence(true);
    try {
      const res = await fetch(`/api/disputes/${dispute.id}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceType: newEvidenceType,
          title: newEvidenceTitle,
          description: newEvidenceDesc,
          strength: "STRONG",
        }),
      });
      if (res.ok) {
        setNewEvidenceTitle("");
        setNewEvidenceDesc("");
        setShowAddEvidence(false);
        onRefresh();
      }
    } catch (err) {
      console.error("Add evidence error:", err);
    } finally {
      setIsAddingEvidence(false);
    }
  };

  // Submit to PayPal Disputes API
  const handleSubmitToPayPal = async () => {
    if (!authorizedByMerchant && dispute.responseWorkflowStatus !== "APPROVED") return;
    setIsSubmitting(true);
    setSubmissionResult(null);
    try {
      const res = await fetch(`/api/disputes/${dispute.id}/submit-paypal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: selectedAction,
          notes: rebuttalText,
          authorizedByMerchant: true,
          offerAmount: selectedAction === "MAKE_OFFER" ? offerAmount : undefined,
          evidenceType: dispute.trackingInfo ? "PROOF_OF_DELIVERY" : "PROOF_OF_FULFILLMENT",
          simulateError: simulateFailureToggle,
        }),
      });
      const data = await res.json();
      setSubmissionResult(data);
      onRefresh();
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Workflow Status Pill
  const renderWorkflowPill = () => {
    switch (dispute.responseWorkflowStatus) {
      case "DRAFT":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <FileEdit className="w-3.5 h-3.5 text-slate-400" /> State: Draft (Unapproved)
          </span>
        );
      case "NEEDS_REVIEW":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> State: Needs Review (Human Sign-off Pending)
          </span>
        );
      case "APPROVED":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" /> State: Approved (Authorized for PayPal Dispatch)
          </span>
        );
      case "SUBMITTING":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" /> State: Submitting to PayPal...
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> State: Submitted to PayPal Disputes API
          </span>
        );
      case "SUBMISSION_FAILED":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <XCircle className="w-3.5 h-3.5 text-rose-400" /> State: Submission Failed (Retry Available)
          </span>
        );
      case "AWAITING_CONFIRMATION":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <Clock className="w-3.5 h-3.5 text-purple-400" /> State: Awaiting Confirmation
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b101c] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-[#0f172a]/80 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-lg font-bold text-sky-400">
                {dispute.paypalDisputeId}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {dispute.disputeLifeCycleStage}
              </span>

              {/* DISTINCT RESPONSE WORKFLOW STATE PILL */}
              {renderWorkflowPill()}

              {/* Deadline Badge */}
              {dispute.status !== "RESOLVED" && (
                <div
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border ${
                    diffHours <= 24
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold animate-pulse"
                      : diffHours <= 48
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {diffHours <= 0
                      ? "Due Today"
                      : `${diffHours}h remaining (${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
              <span>
                Buyer: <strong className="text-slate-200">{dispute.buyerName}</strong> ({dispute.buyerEmail})
              </span>
              <span>•</span>
              <span>
                Amount: <strong className="text-slate-100 font-mono">${dispute.disputeAmount.toFixed(2)} {dispute.currency}</strong>
              </span>
              {dispute.transaction && (
                <>
                  <span>•</span>
                  <span>
                    Txn: <span className="font-mono text-slate-300">{dispute.transaction.sellerTransactionId}</span>
                  </span>
                </>
              )}
              {dispute.order && (
                <>
                  <span>•</span>
                  <span>
                    Order: <span className="font-mono text-sky-300">#{dispute.order.orderNumber}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 bg-[#090e17] flex items-center gap-2 overflow-x-auto">
          {[
            { id: "ANALYSIS", label: "AI Evidence Analysis", icon: Sparkles },
            { id: "REBUTTAL", label: "Factual Rebuttal & Review", icon: FileText },
            { id: "EVIDENCE", label: `Evidence Locker (${dispute.evidenceItems.length})`, icon: PackageCheck },
            { id: "SUBMIT", label: "PayPal API Submission", icon: Send },
            { id: "AUDIT", label: `Audit Trail (${dispute.auditLogs.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "border-sky-400 text-sky-300 bg-sky-500/5 font-semibold"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: AI ANALYSIS & EVIDENCE GAPS */}
          {activeTab === "ANALYSIS" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Completeness Gauge */}
                <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Evidence Completeness
                  </span>
                  <div className="flex items-center gap-4 my-2">
                    <div className="relative w-16 h-16 rounded-full flex items-center justify-center border-4 border-slate-800 bg-slate-950">
                      <span className="text-lg font-bold font-mono text-white">
                        {dispute.aiAnalysis?.completenessScore || 0}%
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">
                        {(dispute.aiAnalysis?.completenessScore || 0) >= 80
                          ? "Robust Defense"
                          : (dispute.aiAnalysis?.completenessScore || 0) >= 50
                          ? "Moderate Documentation"
                          : "High Risk of Forfeiture"}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {dispute.evidenceItems.length} verified records attached
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full"
                      style={{ width: `${dispute.aiAnalysis?.completenessScore || 0}%` }}
                    />
                  </div>
                </div>

                {/* AI Recommendation */}
                <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 flex flex-col justify-between md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      AI Action Strategy
                    </span>
                    <button
                      onClick={handleRunAnalysis}
                      disabled={isAnalyzing}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${isAnalyzing ? "animate-spin text-sky-400" : ""}`} />
                      <span>{isAnalyzing ? "Analyzing..." : "Re-Analyze"}</span>
                    </button>
                  </div>
                  <div className="my-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-200 font-semibold text-sm">
                      <ShieldCheck className="w-4 h-4 text-sky-400" />
                      <span>
                        {dispute.aiAnalysis?.recommendedAction === "PROVIDE_EVIDENCE"
                          ? "Defend Claim: Submit Factual Evidence"
                          : dispute.aiAnalysis?.recommendedAction === "ACCEPT_CLAIM"
                          ? "Accept Claim: Immediate Buyer Refund"
                          : "Offer Partial Refund Settlement"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {dispute.aiAnalysis?.recommendationRationale || "Analysis pending."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Evaluated against PayPal Seller Protection Criteria</span>
                  </div>
                </div>
              </div>

              {/* Strengths and Gaps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-900/50 border border-emerald-500/20 p-4">
                  <h4 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Verified Strengths ({keyStrengths.length})
                  </h4>
                  <ul className="space-y-2">
                    {keyStrengths.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-slate-900/50 border border-amber-500/20 p-4">
                  <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Evidence Gaps Detected ({criticalGaps.length})
                  </h4>
                  <ul className="space-y-2">
                    {criticalGaps.length > 0 ? (
                      criticalGaps.map((g, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-amber-200/90">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{g}</span>
                        </li>
                      ))
                    ) : (
                      <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Zero evidence gaps identified!
                      </p>
                    )}
                  </ul>
                </div>
              </div>

              {/* Anti-Hallucination Guardrail Notice */}
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <span>Strict Anti-Hallucination & Policy Guardrail</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded">
                        100% Provenance Passed
                      </span>
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Every cited fact is matched against database records. AutoSettle AI strictly forbids win guarantees.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("REBUTTAL")}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors"
                >
                  <span>Review Draft Statement</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FACTUAL REBUTTAL & HUMAN APPROVAL */}
          {activeTab === "REBUTTAL" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <span>Factual Response Statement</span>
                    <span className="text-xs font-normal text-slate-400 font-mono">
                      (Draft Version {dispute.draftResponses[0]?.version || 1})
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Review and edit before merchant approval.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">
                    {rebuttalText.length} / 2000 chars
                  </span>
                  <button
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>{isSavingDraft ? "Saving..." : "Save Draft"}</span>
                  </button>
                </div>
              </div>

              {/* Editable Textarea */}
              <textarea
                value={rebuttalText}
                onChange={(e) => setRebuttalText(e.target.value)}
                rows={11}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors leading-relaxed"
                placeholder="Drafting response statement..."
              />

              {/* Human Approval Action Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/30 via-slate-900 to-slate-950 border border-indigo-500/30 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <UserCheck className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-slate-200">
                      Human Approval Gate (Mandatory by Default)
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      {dispute.responseWorkflowStatus === "APPROVED"
                        ? `Approved by ${dispute.draftResponses[0]?.approvedBy || "merchant"}. Submission unlocked.`
                        : "A draft must never be submitted automatically. Click Approve Response to certify factual accuracy."}
                    </p>
                  </div>
                </div>

                {dispute.responseWorkflowStatus !== "APPROVED" && dispute.responseWorkflowStatus !== "SUBMITTED" ? (
                  <button
                    onClick={handleGrantApproval}
                    disabled={isApproving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
                  >
                    <Check className={`w-3.5 h-3.5 ${isApproving ? "animate-spin" : ""}`} />
                    <span>{isApproving ? "Approving..." : "Approve Response Draft"}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approved & Ready</span>
                  </div>
                )}
              </div>

              {/* Citations */}
              <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4">
                <h5 className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Verifiable Evidence Citations ({citations.length})</span>
                </h5>
                <div className="space-y-1.5">
                  {citations.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-200">{c.fact}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {c.source}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveTab("SUBMIT")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium"
                >
                  <span>Proceed to PayPal API Submission</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EVIDENCE LOCKER */}
          {activeTab === "EVIDENCE" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dispute.order && (
                  <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
                    <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <PackageCheck className="w-3.5 h-3.5 text-sky-400" />
                      <span>Linked Order #{dispute.order.orderNumber}</span>
                    </h5>
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div>
                        Purchased:{" "}
                        <span className="text-slate-100 font-medium">
                          {new Date(dispute.order.orderDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        Authorized Shipping Address:
                        <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded mt-1 font-mono">
                          {dispute.order.shippingAddress}
                        </p>
                      </div>
                      <div className="pt-1">
                        <span className="text-slate-400">Items:</span>
                        <div className="mt-1 space-y-1">
                          {orderItems.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-[11px] text-slate-200">
                              <span>{item.qty}x {item.description}</span>
                              <span className="font-mono text-slate-400">${item.price.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {dispute.trackingInfo && (
                  <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
                    <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{dispute.trackingInfo.carrier} Delivery Tracking</span>
                    </h5>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Tracking #:</span>
                        <span className="font-mono text-sky-300">{dispute.trackingInfo.trackingNumber}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Carrier Status:</span>
                        <span className="font-semibold text-emerald-400">{dispute.trackingInfo.status}</span>
                      </div>
                      {dispute.trackingInfo.deliveredDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Delivered Date:</span>
                          <span>{new Date(dispute.trackingInfo.deliveredDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {dispute.trackingInfo.signedBy && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Signed By:</span>
                          <span className="text-emerald-300 font-medium">"{dispute.trackingInfo.signedBy}"</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Evidence Documents */}
              <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Attached Evidence Documents ({dispute.evidenceItems.length})
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Files ready for packaging into PayPal Disputes API submission.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddEvidence(!showAddEvidence)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>+ Add Evidence</span>
                  </button>
                </div>

                {showAddEvidence && (
                  <form onSubmit={handleAddEvidence} className="mb-4 p-4 rounded-xl bg-slate-950 border border-sky-500/30 space-y-3">
                    <h6 className="text-xs font-semibold text-sky-300">Attach New Evidence to Locker</h6>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Evidence Category</label>
                        <select
                          value={newEvidenceType}
                          onChange={(e) => setNewEvidenceType(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                        >
                          <option value="PROOF_OF_DELIVERY">Proof of Delivery (Carrier POD)</option>
                          <option value="PROOF_OF_FULFILLMENT">Proof of Fulfillment / Invoice</option>
                          <option value="CUSTOMER_COMMUNICATION">Customer Communication / Chat</option>
                          <option value="REFUND_POLICY">Refund / Cancellation Policy</option>
                          <option value="TERMS_OF_SERVICE">Terms of Sale</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Evidence Title</label>
                        <input
                          type="text"
                          value={newEvidenceTitle}
                          onChange={(e) => setNewEvidenceTitle(e.target.value)}
                          placeholder="e.g. Warehouse Pick-Pack Photo"
                          required
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Factual Description & Notes</label>
                      <textarea
                        value={newEvidenceDesc}
                        onChange={(e) => setNewEvidenceDesc(e.target.value)}
                        placeholder="Detailed description of what this document proves..."
                        required
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddEvidence(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isAddingEvidence}
                        className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium"
                      >
                        {isAddingEvidence ? "Attaching..." : "Save to Locker"}
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {dispute.evidenceItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-sky-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{item.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                              {item.strength}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                        </div>
                      </div>
                      <span className="text-emerald-400 text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PAYPAL API SUBMISSION */}
          {activeTab === "SUBMIT" && (
            <div className="space-y-6">
              {/* CURRENT STATE BANNER */}
              <div className="p-4 rounded-xl border bg-slate-900/80 border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-white">
                      Submission State: <span className="font-mono text-sky-300">{dispute.responseWorkflowStatus}</span>
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      {dispute.responseWorkflowStatus === "SUBMITTED"
                        ? "Verified: PayPal Disputes API returned successful result. Response acknowledged."
                        : dispute.responseWorkflowStatus === "SUBMISSION_FAILED"
                        ? "PayPal API reported an error or timeout. You can retry with updated information."
                        : dispute.responseWorkflowStatus === "APPROVED"
                        ? "Approved by merchant. Ready for authorized dispatch."
                        : "Draft mode: Requires merchant authorization before PayPal submission."}
                    </p>
                  </div>
                </div>
                {renderWorkflowPill()}
              </div>

              {/* Action Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Select PayPal Disputes API Action
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      id: "PROVIDE_EVIDENCE",
                      title: "Provide Evidence",
                      desc: "Submit factual rebuttal narrative, tracking verification, and evidence locker attachments to PayPal.",
                    },
                    {
                      id: "ACCEPT_CLAIM",
                      title: "Accept Claim (Refund)",
                      desc: "Authorize full refund to buyer and conclude dispute immediately without further fees.",
                    },
                    {
                      id: "MAKE_OFFER",
                      title: "Offer Settlement",
                      desc: "Propose a partial refund amount to the buyer via PayPal Disputes negotiation channel.",
                    },
                  ].map((act) => (
                    <div
                      key={act.id}
                      onClick={() => setSelectedAction(act.id as any)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedAction === act.id
                          ? "bg-sky-500/10 border-sky-500/50 shadow-md ring-1 ring-sky-500/40"
                          : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-100 block mb-1">{act.title}</span>
                      <p className="text-[11px] text-slate-400">{act.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedAction === "MAKE_OFFER" && (
                <div className="p-4 rounded-xl bg-slate-900 border border-sky-500/30 space-y-2">
                  <label className="text-xs font-semibold text-slate-200">
                    Partial Refund Settlement Amount ({dispute.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="w-48 bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-slate-100 font-mono"
                  />
                </div>
              )}

              {/* Mandatory Merchant Authorization Gate */}
              <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={authorizedByMerchant}
                    onChange={(e) => setAuthorizedByMerchant(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-sky-600 bg-slate-900 border-slate-700 focus:ring-sky-500"
                  />
                  <div className="text-xs text-slate-300 leading-normal">
                    <strong className="text-white block mb-0.5">
                      Merchant Authorization & Compliance Confirmation
                    </strong>
                    I certify that I have reviewed the factual rebuttal and supporting evidence. The facts, carrier tracking, and attachments accurately represent this transaction without false or invented claims. I authorize submission to the PayPal Disputes API.
                  </div>
                </label>
              </div>

              {/* Demo Failure Toggle for Testing */}
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Simulate API Failure (Demo Test):</span>
                  <span className="block text-[11px]">Test how AutoSettle AI handles PayPal rejection without falsely marking draft as submitted.</span>
                </div>
                <input
                  type="checkbox"
                  checked={simulateFailureToggle}
                  onChange={(e) => setSimulateFailureToggle(e.target.checked)}
                  className="rounded text-rose-600 bg-slate-900 border-slate-700"
                />
              </div>

              {/* Submission CTA */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  POST /v1/customer/disputes/{dispute.paypalDisputeId}/{selectedAction.toLowerCase().replace(/_/g, "-")}
                </span>
                <button
                  onClick={handleSubmitToPayPal}
                  disabled={!authorizedByMerchant || isSubmitting}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-lg ${
                    authorizedByMerchant && !isSubmitting
                      ? "bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 text-white shadow-blue-500/25"
                      : "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                  }`}
                >
                  <Send className={`w-4 h-4 ${isSubmitting ? "animate-spin" : ""}`} />
                  <span>
                    {isSubmitting
                      ? "Submitting to PayPal Disputes API..."
                      : dispute.responseWorkflowStatus === "SUBMISSION_FAILED"
                      ? "Retry Submission to PayPal"
                      : "Submit to PayPal Disputes API"}
                  </span>
                </button>
              </div>

              {/* Submission Result Viewer */}
              {submissionResult && (
                <div
                  className={`p-4 rounded-xl border ${
                    submissionResult.success
                      ? "bg-slate-950 border-emerald-500/40"
                      : "bg-slate-950 border-rose-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs font-bold flex items-center gap-1.5 ${
                        submissionResult.success ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {submissionResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>PayPal API Confirmed (HTTP {submissionResult.statusCode} OK)</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-400" />
                          <span>Submission Failed (HTTP {submissionResult.statusCode || 400})</span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      State: {submissionResult.workflowStatus}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/90 p-3 rounded-lg overflow-x-auto max-h-48">
                    {JSON.stringify(submissionResult.paypalResponse || { error: submissionResult.error }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIT TRAIL */}
          {activeTab === "AUDIT" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Immutable Audit Trail & Compliance Log
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Captures all dispute events, approvals, webhook verifications, and API results.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {dispute.auditLogs.length} events logged
                </span>
              </div>

              <div className="space-y-3">
                {dispute.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sky-400 font-mono">{log.eventType}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                            log.severity === "SUCCESS"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              : log.severity === "ERROR"
                              ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                              : log.severity === "WARNING"
                              ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {log.severity}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-slate-200">{log.summary}</p>

                    <div className="text-[11px] text-slate-400">
                      Actor: <span className="text-slate-300 font-mono">{log.actor}</span>
                      {log.actorId && <span className="ml-1 text-slate-400">({log.actorId})</span>}
                    </div>

                    {log.detailsJson && (
                      <pre className="text-[10px] font-mono text-slate-300 bg-slate-900 p-2.5 rounded overflow-x-auto max-h-24">
                        {log.detailsJson}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
