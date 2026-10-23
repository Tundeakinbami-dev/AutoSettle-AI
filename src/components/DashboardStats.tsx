"use client";

import React, { useState } from "react";
import {
  DollarSign,
  AlertTriangle,
  Clock,
  Brain,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  CheckCircle2,
  XCircle,
  FileEdit,
  ArrowUpRight,
  PieChart,
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
  const [activeChartTab, setActiveChartTab] = useState<"volume" | "resolution">("volume");

  if (loading || !stats) {
    return (
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse shadow-sm"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 rounded-2xl bg-white border border-slate-200 animate-pulse shadow-sm" />
          <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse shadow-sm" />
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Total Disputed Volume",
      value: `$${stats.totalVolume.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      trend: "+12.4%",
      trendType: "positive",
      subtitle: `${stats.totalCount} active merchant cases`,
      icon: DollarSign,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50 border-blue-100",
    },
    {
      title: "Action Required",
      value: stats.actionRequired.toString(),
      trend: `${stats.actionRequired} pending`,
      trendType: "warning",
      subtitle: "Awaiting evidence response",
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50 border-amber-100",
    },
    {
      title: "Urgent Deadlines (<48h)",
      value: stats.urgentCount.toString(),
      trend: stats.urgentCount > 0 ? "Critical" : "All safe",
      trendType: stats.urgentCount > 0 ? "urgent" : "positive",
      subtitle: stats.urgentCount > 0 ? "Immediate submission needed" : "Zero expired cases",
      icon: Clock,
      iconColor: stats.urgentCount > 0 ? "text-rose-600" : "text-emerald-600",
      iconBg:
        stats.urgentCount > 0
          ? "bg-rose-50 border-rose-100"
          : "bg-emerald-50 border-emerald-100",
      highlight: stats.urgentCount > 0,
    },
    {
      title: "Defense Win Rate",
      value: `${stats.winRate}%`,
      trend: "+8.1%",
      trendType: "positive",
      subtitle: "Historical claims defended",
      icon: ShieldCheck,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50 border-emerald-100",
    },
    {
      title: "Avg Resolution Velocity",
      value: stats.avgResponseMinutes,
      trend: "99.2% faster",
      trendType: "positive",
      subtitle: "vs 4.8 hrs manual review",
      icon: Brain,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50 border-indigo-100",
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
    <div className="space-y-4 mb-6">
      {/* Top Row Metric Cards (Dribbble Design) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`metric-card-dribbble ${
                card.highlight ? "border-rose-300 bg-rose-50/30" : ""
              }`}
            >
              {/* Header: Title + Icon */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-slate-500 truncate">
                  {card.title}
                </span>
                <div
                  className={`w-7 h-7 rounded-lg border ${card.iconBg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-3.5 h-3.5 ${card.iconColor}`} />
                </div>
              </div>

              {/* Main Metric Value */}
              <div className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 mb-2">
                {card.value}
              </div>

              {/* Footer: Trend Pill & Comparison */}
              <div className="flex items-center justify-between gap-1 text-[11px] pt-1.5 border-t border-slate-100">
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold ${
                    card.trendType === "positive"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : card.trendType === "urgent"
                      ? "bg-rose-50 text-rose-700 border border-rose-200 font-bold"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {card.trendType === "positive" && <ArrowUpRight className="w-3 h-3" />}
                  {card.trend}
                </span>
                <span className="text-slate-500 truncate text-[10px]">
                  {card.subtitle}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Section: Overview Area Chart & Distribution Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Revenue Defense & Dispute Volume Trend Area Chart */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Revenue Defense & Resolution Activity
                </h3>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                  Live Analytics
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly recovered merchant volume vs. disputes received
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveChartTab("volume")}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeChartTab === "volume"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Volume ($)
              </button>
              <button
                onClick={() => setActiveChartTab("resolution")}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeChartTab === "resolution"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Defense Win %
              </button>
            </div>
          </div>

          {/* SVG Area Chart Graphic (Clean Light Dribbble Theme) */}
          <div className="relative w-full h-44 my-1">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 600 160"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="chartGradientBlueLight" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="30" x2="600" y2="30" stroke="#F1F5F9" strokeDasharray="3 3" />
              <line x1="0" y1="70" x2="600" y2="70" stroke="#F1F5F9" strokeDasharray="3 3" />
              <line x1="0" y1="110" x2="600" y2="110" stroke="#F1F5F9" strokeDasharray="3 3" />
              <line x1="0" y1="150" x2="600" y2="150" stroke="#E2E8F0" />

              {/* Area Under Curve */}
              <path
                d="M 0,140 Q 60,110 120,120 T 240,80 T 360,95 T 480,45 T 600,30 L 600,150 L 0,150 Z"
                fill="url(#chartGradientBlueLight)"
              />

              {/* Smooth Spline Curve */}
              <path
                d="M 0,140 Q 60,110 120,120 T 240,80 T 360,95 T 480,45 T 600,30"
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Secondary Recovered Line */}
              <path
                d="M 0,150 Q 60,130 120,135 T 240,105 T 360,110 T 480,65 T 600,45"
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />

              {/* Highlight Nodes */}
              <circle cx="240" cy="80" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="480" cy="45" r="4" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="600" cy="30" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
            </svg>

            {/* Tooltip Pill */}
            <div className="absolute top-2 right-12 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] shadow-md pointer-events-none">
              <span className="text-slate-500">Current Month Protected: </span>
              <strong className="text-emerald-600 font-bold">$12,480.00</strong>
            </div>
          </div>

          {/* Month Axis Labels */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            <span>May</span>
            <span>Jun</span>
            <span>Jul</span>
            <span>Aug</span>
            <span>Sep</span>
            <span className="text-blue-600 font-semibold">Oct (Current)</span>
          </div>
        </div>

        {/* Right 1 Col: Reason Distribution & Workflow Pipeline */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Dispute Reason Breakdown
              </h3>
              <PieChart className="w-4 h-4 text-slate-400" />
            </div>

            {/* Distribution Visual Bars */}
            <div className="space-y-3 mt-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Item Not Received (INR)</span>
                  <span className="font-semibold text-slate-900">45%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: "45%" }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Not As Described (SNAD)</span>
                  <span className="font-semibold text-slate-900">35%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: "35%" }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Unauthorized Transaction</span>
                  <span className="font-semibold text-slate-900">20%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: "20%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Pipeline Pills Strip */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Defense Workflow Pipeline
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-600 text-[11px] flex items-center gap-1">
                  <FileEdit className="w-3 h-3 text-slate-400" /> Draft
                </span>
                <strong className="text-slate-900 text-xs">{wf.DRAFT}</strong>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-amber-800 text-[11px] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Review
                </span>
                <strong className="text-amber-900 text-xs">{wf.NEEDS_REVIEW}</strong>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-indigo-50 border border-indigo-200">
                <span className="text-indigo-800 text-[11px] flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-indigo-600" /> Approved
                </span>
                <strong className="text-indigo-900 text-xs">{wf.APPROVED}</strong>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-800 text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Submitted
                </span>
                <strong className="text-emerald-900 text-xs">{wf.SUBMITTED}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
