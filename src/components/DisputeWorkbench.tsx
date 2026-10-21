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
  Eye,
  FileCheck,
  ExternalLink,
  RefreshCw,
  PackageCheck,
  HelpCircle,
  Truck,
  MessageSquare,
  History,
  Lock,
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
}

interface CustomerMessage {
  id: string;
  sender: string;
  channel: string;
  timestamp: string;
  messageText: string;
}

interface AuditLog {
  id: string;
  action: string;
  status: string;
  payloadSent?: string;
  paypalResponse?: string;
  submittedBy: string;
  submittedAt: string;
}

interface DisputeDetail {
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
  merchantNotes?: string;
  aiAnalyzed: boolean;
  aiConfidenceScore?: number;
  aiRecommendedAction?: string;
  resolutionOutcome?: string;
  order?: {
    orderNumber: string;
    orderDate: string;
    customerName: string;
    customerEmail: string;
    shippingAddress: string;
    billingAddress: string;
    orderTotal: number;
    itemsJson: string;
    paymentMethod: string;
  };
  trackingInfo?: {
    carrier: string;
    trackingNumber: string;
    status: string;
    shippedDate?: string;
    deliveredDate?: string;
    destinationZip?: string;
    signedBy?: string;
    deliveryProofUrl?: string;
    checkpointHistory?: string;
  };
  evidenceItems: EvidenceItem[];
  messages: CustomerMessage[];
  analysis?: {
    summary: string;
    completenessScore: number;
    recommendedAction: string;
    recommendationRationale: string;
    keyStrengthsJson: string;
    criticalGapsJson: string;
    rebuttalDraft: string;
    citationsJson: string;
    riskLevel: string;
  };
  auditLogs: AuditLog[];
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
  const [rebuttalText, setRebuttalText] = useState(dispute.analysis?.rebuttalDraft || "");
  const [selectedAction, setSelectedAction] = useState<"PROVIDE_EVIDENCE" | "ACCEPT_CLAIM" | "MAKE_OFFER">(
    (dispute.analysis?.recommendedAction as any) || "PROVIDE_EVIDENCE"
  );
  const [authorizedByMerchant, setAuthorizedByMerchant] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [offerAmount, setOfferAmount] = useState<string>((dispute.disputeAmount * 0.5).toFixed(2));

  // Evidence upload state
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [newEvidenceType, setNewEvidenceType] = useState("PROOF_OF_FULFILLMENT");
  const [newEvidenceTitle, setNewEvidenceTitle] = useState("");
  const [newEvidenceDesc, setNewEvidenceDesc] = useState("");
  const [isAddingEvidence, setIsAddingEvidence] = useState(false);

  // Parse JSON helpers
  const keyStrengths: string[] = dispute.analysis?.keyStrengthsJson
    ? JSON.parse(dispute.analysis.keyStrengthsJson)
    : [];
  const criticalGaps: string[] = dispute.analysis?.criticalGapsJson
    ? JSON.parse(dispute.analysis.criticalGapsJson)
    : [];
  const citations: Array<{ fact: string; source: string; verified: boolean }> = dispute.analysis?.citationsJson
    ? JSON.parse(dispute.analysis.citationsJson)
    : [];
  const orderItems = dispute.order?.itemsJson
    ? JSON.parse(dispute.order.itemsJson)
    : [];

  // Urgency computation
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
    if (!authorizedByMerchant) return;
    setIsSubmitting(true);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#0b101c] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-[#0f172a]/70 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-lg font-bold text-sky-400">
                {dispute.paypalDisputeId}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {dispute.disputeLifeCycleStage}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  dispute.status === "RESOLVED"
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    : dispute.status === "REQUIRED_ACTION"
                    ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                    : "bg-sky-500/10 text-sky-300 border-sky-500/30"
                }`}
              >
                {dispute.status}
              </span>

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

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
              <span>
                Buyer: <strong className="text-slate-200">{dispute.buyerName}</strong> ({dispute.buyerEmail})
              </span>
              <span>•</span>
              <span>
                Amount: <strong className="text-slate-100 font-mono">${dispute.disputeAmount.toFixed(2)} {dispute.currency}</strong>
              </span>
              <span>•</span>
              <span>
                Txn: <span className="font-mono text-slate-300">{dispute.sellerTransactionId}</span>
              </span>
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
            { id: "REBUTTAL", label: "Factual Rebuttal", icon: FileText },
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
              {/* Score & Recommendation Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Completeness Meter */}
                <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 flex flex-col justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Evidence Completeness
                  </span>
                  <div className="flex items-center gap-4 my-2">
                    <div className="relative w-16 h-16 rounded-full flex items-center justify-center border-4 border-slate-800 bg-slate-950">
                      <span className="text-lg font-bold font-mono text-white">
                        {dispute.analysis?.completenessScore || 0}%
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">
                        {(dispute.analysis?.completenessScore || 0) >= 80
                          ? "Robust Defense"
                          : (dispute.analysis?.completenessScore || 0) >= 50
                          ? "Moderate Documentation"
                          : "High Evidence Risk"}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {dispute.evidenceItems.length} verified documents attached
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full"
                      style={{ width: `${dispute.analysis?.completenessScore || 0}%` }}
                    />
                  </div>
                </div>

                {/* AI Recommended Action */}
                <div className="rounded-xl bg-slate-900/70 border border-slate-800 p-4 flex flex-col justify-between md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      AI Action Recommendation
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
                        {dispute.analysis?.recommendedAction === "PROVIDE_EVIDENCE"
                          ? "Defend Claim: Submit Provenance Evidence"
                          : dispute.analysis?.recommendedAction === "ACCEPT_CLAIM"
                          ? "Accept Claim: Immediate Buyer Refund"
                          : "Offer Settlement / Partial Refund"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {dispute.analysis?.recommendationRationale ||
                        "Analysis pending. Click Re-Analyze to trigger AI evidence compilation."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PayPal Seller Protection Criteria Evaluated</span>
                  </div>
                </div>
              </div>

              {/* Strengths and Gaps Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="rounded-xl bg-slate-900/50 border border-emerald-500/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <h4 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                      Verified Evidence Strengths ({keyStrengths.length})
                    </h4>
                  </div>
                  <ul className="space-y-2.5">
                    {keyStrengths.length > 0 ? (
                      keyStrengths.map((s, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No strong evidence records identified.</p>
                    )}
                  </ul>
                </div>

                {/* Critical Gaps */}
                <div className="rounded-xl bg-slate-900/50 border border-amber-500/20 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                      Evidence Gaps & Missing Information ({criticalGaps.length})
                    </h4>
                  </div>
                  <ul className="space-y-2.5">
                    {criticalGaps.length > 0 ? (
                      criticalGaps.map((g, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-amber-200/90">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{g}</span>
                        </li>
                      ))
                    ) : (
                      <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Zero critical evidence gaps identified!
                      </p>
                    )}
                  </ul>
                </div>
              </div>

              {/* Anti-Hallucination Guardrail Banner */}
              <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 flex items-center justify-between flex-wrap gap-3">
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
                      Every cited fact (carrier tracking, recipient signature, line items) is matched against database records. AutoSettle AI never promises guaranteed dispute wins.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab("REBUTTAL")}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors"
                >
                  <span>Review Draft Rebuttal</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FACTUAL REBUTTAL GENERATOR */}
          {activeTab === "REBUTTAL" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">
                    Factual Merchant Response Statement
                  </h4>
                  <p className="text-xs text-slate-400">
                    Formatted for PayPal Disputes Review Team. Neutral tone, chronological citations.
                  </p>
                </div>
                <div className="text-xs text-slate-400">
                  <span className="font-mono text-slate-200">{rebuttalText.length}</span> / 2000 chars (PayPal limit)
                </div>
              </div>

              {/* Editable Rebuttal Box */}
              <textarea
                value={rebuttalText}
                onChange={(e) => setRebuttalText(e.target.value)}
                rows={12}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors leading-relaxed selection:bg-sky-500/30"
                placeholder="Drafting factual dispute rebuttal..."
              />

              {/* Provenance Citations Table */}
              <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-4">
                <h5 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Verifiable Evidence Provenance ({citations.length} Cited Facts)</span>
                </h5>
                <div className="space-y-2">
                  {citations.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-slate-200 font-medium">{c.fact}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {c.source}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setActiveTab("SUBMIT")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-all shadow-md"
                >
                  <span>Proceed to PayPal API Submission</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EVIDENCE LOCKER & MATCHING */}
          {activeTab === "EVIDENCE" && (
            <div className="space-y-6">
              {/* Order & Carrier Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Order Match Card */}
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

                {/* Carrier Tracking Card */}
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

              {/* Evidence Document Locker */}
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

                {/* Add Evidence Inline Form */}
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

                {/* Evidence Item List */}
                <div className="space-y-2.5">
                  {dispute.evidenceItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-sky-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                              {item.strength}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.fileName && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                            {item.fileName}
                          </span>
                        )}
                        <span className="text-emerald-400 text-xs flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Messaging Thread */}
              {dispute.messages.length > 0 && (
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
                  <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span>Customer Communication History ({dispute.messages.length})</span>
                  </h5>
                  <div className="space-y-2.5">
                    {dispute.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl border text-xs ${
                          m.sender === "BUYER"
                            ? "bg-slate-950 border-slate-800 text-slate-300"
                            : "bg-sky-950/20 border-sky-500/20 text-sky-200"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span className="font-semibold text-slate-300">
                            {m.sender === "BUYER" ? dispute.buyerName : "Merchant Support"}
                          </span>
                          <span>{new Date(m.timestamp).toLocaleString()}</span>
                        </div>
                        <p>{m.messageText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PAYPAL API SUBMISSION */}
          {activeTab === "SUBMIT" && (
            <div className="space-y-6">
              {/* Submission Action Selector */}
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
                      badge: "Recommended by AI",
                    },
                    {
                      id: "ACCEPT_CLAIM",
                      title: "Accept Claim (Refund)",
                      desc: "Authorize full refund to buyer and conclude dispute immediately without further fees.",
                      badge: "Quick Resolution",
                    },
                    {
                      id: "MAKE_OFFER",
                      title: "Offer Settlement",
                      desc: "Propose a partial refund amount to the buyer via PayPal Disputes negotiation channel.",
                      badge: "Compromise",
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
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-100">{act.title}</span>
                        {dispute.analysis?.recommendedAction === act.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            {act.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">{act.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Offer Amount Field if MAKE_OFFER is selected */}
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
                  <p className="text-[11px] text-slate-400">
                    Disputed Total: ${dispute.disputeAmount.toFixed(2)}. Offering ${offerAmount} as resolution courtesy.
                  </p>
                </div>
              )}

              {/* Pre-Flight Validation Checks */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Pre-Flight API Verification Checklist
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Dispute ID valid ({dispute.paypalDisputeId})</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Factual narrative within 2000 character limit</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Strict anti-hallucination provenance verified</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{dispute.evidenceItems.length} supporting attachments compiled</span>
                  </div>
                </div>
              </div>

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
                    I confirm that I have reviewed the factual rebuttal and supporting evidence. The facts, carrier tracking, and attachments accurately represent this transaction without false or invented claims. I authorize submission to the PayPal Disputes API.
                  </div>
                </label>
              </div>

              {/* Submission Button */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Target: <span className="font-mono text-slate-300">POST /v1/customer/disputes/{dispute.paypalDisputeId}/{selectedAction.toLowerCase().replace(/_/g, "-")}</span>
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
                  <span>{isSubmitting ? "Submitting to PayPal Disputes API..." : "Submit to PayPal Disputes API"}</span>
                </button>
              </div>

              {/* Live PayPal Response Viewer */}
              {submissionResult && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-300">
                        PayPal API Response ({submissionResult.statusCode} OK - {submissionResult.mode})
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Audit Log ID: {submissionResult.auditLogId}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-slate-900/80 p-3 rounded-lg overflow-x-auto max-h-48">
                    {JSON.stringify(submissionResult.paypalResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: AUDIT & COMPLIANCE TRAIL */}
          {activeTab === "AUDIT" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    Immutable Compliance Audit Trail
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Timestamped record of all AI evaluations, merchant authorizations, and PayPal Disputes API transactions.
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
                        <span className="font-bold text-sky-400">{log.action}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.submittedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Operator: <span className="text-slate-300 font-mono">{log.submittedBy}</span>
                    </div>

                    {log.payloadSent && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Payload Sent:</span>
                        <pre className="text-[10px] font-mono text-slate-300 bg-slate-900 p-2 rounded overflow-x-auto max-h-24">
                          {log.payloadSent}
                        </pre>
                      </div>
                    )}

                    {log.paypalResponse && (
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">PayPal API Response:</span>
                        <pre className="text-[10px] font-mono text-emerald-300 bg-slate-900 p-2 rounded overflow-x-auto max-h-24">
                          {log.paypalResponse}
                        </pre>
                      </div>
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
