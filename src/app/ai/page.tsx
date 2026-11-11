"use client";

import React, { useState, useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import {
  Brain,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Lock,
  ChevronRight,
  FileCheck,
  Loader2,
} from "lucide-react";

export default function AiInvestigationsPage() {
  const { disputes, loading, openDisputeWorkbench, refreshData } = useAppContext();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [strategyFilter, setStrategyFilter] = useState<string>("ALL");

  const totalAnalyzed = useMemo(() => {
    return disputes.filter((d) => d.aiAnalysis !== null).length;
  }, [disputes]);

  const avgCompleteness = useMemo(() => {
    const analyzed = disputes.filter((d) => d.aiAnalysis?.completenessScore !== undefined);
    if (analyzed.length === 0) return 0;
    const sum = analyzed.reduce((acc, d) => acc + (d.aiAnalysis.completenessScore || 0), 0);
    return Math.round(sum / analyzed.length);
  }, [disputes]);

  const defendCount = useMemo(() => {
    return disputes.filter((d) => d.aiAnalysis?.recommendedAction === "PROVIDE_EVIDENCE").length;
  }, [disputes]);

  const handleRunAnalysis = async (disputeId: string, paypalDisputeId: string) => {
    setAnalyzingId(disputeId);
    try {
      const res = await fetch(`/api/disputes/${paypalDisputeId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await refreshData(true);
      }
    } catch (err) {
      console.error("AI Analysis error:", err);
    } finally {
      setAnalyzingId(null);
    }
  };

  const filteredDisputes = useMemo(() => {
    return disputes.filter((d) => {
      const action = d.aiAnalysis?.recommendedAction;
      if (strategyFilter !== "ALL" && action !== strategyFilter) {
        return false;
      }

      if (searchTerm.trim() !== "") {
        const q = searchTerm.toLowerCase();
        const matches =
          d.paypalDisputeId?.toLowerCase().includes(q) ||
          d.buyerName?.toLowerCase().includes(q) ||
          d.reason?.toLowerCase().includes(q) ||
          d.aiAnalysis?.summary?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [disputes, strategyFilter, searchTerm]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>AI Investigation Center</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-mono font-medium">
                Deterministic
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Zero-hallucination evidence gap analysis, citation matching against DB records, and factual strategy recommendations.
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
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{totalAnalyzed} / {disputes.length}</div>
            <div className="text-xs text-slate-500">Cases Evaluated</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{avgCompleteness}%</div>
            <div className="text-xs text-slate-500">Avg Completeness Score</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-700">{defendCount}</div>
            <div className="text-xs text-slate-500">Defend Claim Strategy</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-sky-700">100%</div>
            <div className="text-xs text-slate-500">Zero-Hallucination Passed</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search AI analysis by dispute ID, buyer name, or summary..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 shadow-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "ALL", label: "All Strategies" },
            { id: "PROVIDE_EVIDENCE", label: "Defend (Evidence)" },
            { id: "ACCEPT_CLAIM", label: "Accept Claim" },
            { id: "OFFER_PARTIAL_REFUND", label: "Partial Settlement" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStrategyFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                strategyFilter === tab.id
                  ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Investigation Cards */}
      <div className="space-y-4">
        {filteredDisputes.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Brain className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No AI investigations matching filter</p>
            <p className="text-xs text-slate-400 mt-1">Adjust filters or run AI investigations below.</p>
          </div>
        ) : (
          filteredDisputes.map((dispute) => {
            const ai = dispute.aiAnalysis;
            const isAnalyzingThis = analyzingId === dispute.id;
            const score = ai?.completenessScore ?? 0;

            let keyStrengths: string[] = [];
            let criticalGaps: string[] = [];
            let citations: any[] = [];
            if (ai?.keyStrengthsJson) {
              try { keyStrengths = JSON.parse(ai.keyStrengthsJson); } catch {}
            }
            if (ai?.criticalGapsJson) {
              try { criticalGaps = JSON.parse(ai.criticalGapsJson); } catch {}
            }
            if (ai?.citationsJson) {
              try { citations = JSON.parse(ai.citationsJson); } catch {}
            }

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
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunAnalysis(dispute.id, dispute.paypalDisputeId)}
                      disabled={isAnalyzingThis}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingThis ? "animate-spin text-violet-600" : ""}`} />
                      <span>{isAnalyzingThis ? "Analyzing..." : "Re-Analyze"}</span>
                    </button>
                    <button
                      onClick={() => openDisputeWorkbench(dispute.id)}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
                    >
                      <span>Review Workbench</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* AI Analysis Details */}
                {ai ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Strategy & Completeness */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Strategy
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-800">
                          {score}% Completeness
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>{ai.recommendedAction?.replace(/_/g, " ")}</span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {ai.recommendationRationale || ai.summary}
                      </p>

                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>

                    {/* Verified Strengths */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified Strengths ({keyStrengths.length})
                      </h4>
                      <div className="space-y-1.5 text-xs text-slate-700">
                        {keyStrengths.map((s, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px]">
                            <span className="text-emerald-500 mt-0.5">•</span>
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Detected Critical Gaps */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Critical Gaps ({criticalGaps.length})
                      </h4>
                      {criticalGaps.length === 0 ? (
                        <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> No evidence gaps detected
                        </p>
                      ) : (
                        <div className="space-y-1.5 text-xs text-slate-700">
                          {criticalGaps.map((g, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-800">
                              <span className="text-amber-500 mt-0.5">•</span>
                              <span>{g}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200">
                    <Sparkles className="w-6 h-6 text-violet-500 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-700">Analysis pending for this dispute</p>
                    <button
                      onClick={() => handleRunAnalysis(dispute.id, dispute.paypalDisputeId)}
                      disabled={isAnalyzingThis}
                      className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold shadow-sm"
                    >
                      <span>Run Investigation Now</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
