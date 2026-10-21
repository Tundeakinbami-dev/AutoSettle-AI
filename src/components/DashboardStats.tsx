"use client";

import React from "react";
import {
  DollarSign,
  AlertTriangle,
  Clock,
  Brain,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  XCircle,
  FileEdit,
} from "lucide-react";

interface StatsProps {
  stats: {
    totalCount: number;
    actionRequired: number;
    urgentCount: number;
    totalVolume: number;
    winRate: number;
    aiAnalyzedCount: number;
    avgResponseMinutes: string;
    workflowCounts?: {
      DRAFT: number;
      NEEDS_REVIEW: number;
      APPROVED: number;
      SUBMITTING: number;
      SUBMITTED: number;
      SUBMISSION_FAILED: number;
      AWAITING_CONFIRMATION: number;
    };
  } | null;
  loading: boolean;
}

export default function DashboardStats({ stats, loading }: StatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-slate-900/40 border border-slate-800/80 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Disputed Volume",
      value: `$${stats.totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: `${stats.totalCount} active disputes`,
      icon: DollarSign,
      iconColor: "text-sky-400",
      iconBg: "bg-sky-500/10 border-sky-500/20",
      accent: "from-sky-500/10 to-transparent",
    },
    {
      title: "Action Required",
      value: stats.actionRequired.toString(),
      subtitle: "Pending evidence submission",
      icon: AlertTriangle,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10 border-amber-500/20",
      accent: "from-amber-500/10 to-transparent",
    },
    {
      title: "Urgent Deadlines (<48h)",
      value: stats.urgentCount.toString(),
      subtitle: stats.urgentCount > 0 ? "Immediate response needed" : "All deadlines safe",
      icon: Clock,
      iconColor: stats.urgentCount > 0 ? "text-rose-400" : "text-emerald-400",
      iconBg: stats.urgentCount > 0 ? "bg-rose-500/10 border-rose-500/20" : "bg-emerald-500/10 border-emerald-500/20",
      accent: stats.urgentCount > 0 ? "from-rose-500/10 to-transparent" : "from-emerald-500/10 to-transparent",
      highlight: stats.urgentCount > 0,
    },
    {
      title: "Defense Success Rate",
      value: `${stats.winRate}%`,
      subtitle: "Historical resolution win",
      icon: ShieldCheck,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      accent: "from-emerald-500/10 to-transparent",
    },
    {
      title: "Avg Resolution Time",
      value: stats.avgResponseMinutes,
      subtitle: "vs 4.8 hrs manual review",
      icon: Brain,
      iconColor: "text-indigo-400",
      iconBg: "bg-indigo-500/10 border-indigo-500/20",
      accent: "from-indigo-500/10 to-transparent",
    },
  ];

  const wf = stats.workflowCounts || {
    DRAFT: 0,
    NEEDS_REVIEW: 0,
    APPROVED: 0,
    SUBMITTING: 0,
    SUBMITTED: 0,
    SUBMISSION_FAILED: 0,
    AWAITING_CONFIRMATION: 0,
  };

  return (
    <div className="space-y-3.5 mb-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`relative overflow-hidden rounded-xl bg-slate-900/60 border ${
                card.highlight
                  ? "border-rose-500/40 glow-urgent bg-gradient-to-b from-rose-950/20 to-slate-900/80"
                  : "border-slate-800/80 hover:border-slate-700/80"
              } p-4 transition-all duration-200 group`}
            >
              <div
                className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${card.accent} rounded-bl-full pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity`}
              />
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400 truncate">
                  {card.title}
                </span>
                <div
                  className={`w-7 h-7 rounded-lg border ${card.iconBg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="text-xl lg:text-2xl font-bold tracking-tight text-white mb-0.5">
                {card.value}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {card.subtitle}
              </p>
            </div>
          );
        })}
      </div>

      {/* Distinct Workflow Pipeline Strip */}
      <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
          Response Workflow Pipeline:
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
            <FileEdit className="w-3 h-3 text-slate-400" /> Draft: <strong className="text-white">{wf.DRAFT}</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px]">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> Needs Review: <strong className="text-white">{wf.NEEDS_REVIEW}</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[11px]">
            <UserCheck className="w-3 h-3 text-indigo-400" /> Approved: <strong className="text-white">{wf.APPROVED}</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px]">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Submitted: <strong className="text-white">{wf.SUBMITTED}</strong>
          </span>
          {wf.SUBMISSION_FAILED > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-bold">
              <XCircle className="w-3 h-3 text-rose-400" /> Failed: <strong className="text-white">{wf.SUBMISSION_FAILED}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
