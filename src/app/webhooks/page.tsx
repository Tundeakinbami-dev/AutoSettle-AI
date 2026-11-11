"use client";

import React, { useState, useEffect, useCallback } from "react";
import WebhookSimulatorModal from "@/components/WebhookSimulatorModal";
import { useAppContext } from "@/lib/app-context";
import {
  Webhook,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Info,
  Zap,
  AlertCircle,
  Copy,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WebhookEvent {
  id: string;
  paypalWebhookEventId: string | null;
  eventType: string;
  summary: string;
  status: string;
  signatureVerified: boolean;
  payloadSanitized: string;
  receivedAt: string;
  dispute: {
    id: string;
    paypalDisputeId: string;
    status: string;
    buyerName: string;
    disputeAmount: number;
    currency: string;
  } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PROCESSED: { label: "Processed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  IGNORED_DUPLICATE: { label: "Duplicate", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  FAILED_VERIFICATION: { label: "Sig. Failed", color: "bg-rose-100 text-rose-700", icon: XCircle },
};

const EVENT_TYPES = [
  "ALL",
  "PAYMENT.DISPUTE.CREATED",
  "PAYMENT.DISPUTE.UPDATED",
  "PAYMENT.DISPUTE.RESOLVED",
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs > 0) return `${hrs}h ago`;
  const mins = Math.floor(diff / 60000);
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const { refreshData } = useAppContext();
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (eventTypeFilter !== "ALL") params.set("eventType", eventTypeFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/webhook-events?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      setEvents(data.events || []);
      setTotal(data.total ?? 0);
    } catch (e: any) {
      setError(e.message || "Failed to load webhook events");
    } finally {
      setLoading(false);
    }
  }, [eventTypeFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const processedCount = events.filter((e) => e.status === "PROCESSED").length;
  const failedCount = events.filter((e) => e.status === "FAILED_VERIFICATION").length;
  const duplicateCount = events.filter((e) => e.status === "IGNORED_DUPLICATE").length;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
            <Webhook className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Webhook Lab</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono font-medium">
                Live Ingestion
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Incoming PayPal webhook event history, signature verifications, and interactive simulator.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSimulator(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            Simulate Event
          </button>
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Real vs Simulated events:</strong> Events ingested through the{" "}
          <code className="bg-sky-100 px-1 rounded">/api/webhooks/paypal</code> endpoint are labelled
          as <strong>SIMULATED</strong> when verified with a simulated payload secret.
          Real PayPal Sandbox events carry a verified PayPal signature. Both are processed identically by the
          ingestion pipeline.
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: total, icon: Webhook, color: "text-sky-600", bg: "bg-sky-50" },
          { label: "Processed", value: processedCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Duplicates Ignored", value: duplicateCount, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Verification Failed", value: failedCount, icon: XCircle, color: failedCount > 0 ? "text-rose-600" : "text-slate-400", bg: failedCount > 0 ? "bg-rose-50" : "bg-slate-50" },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">{card.value}</div>
                <div className="text-xs text-slate-500">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {EVENT_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setEventTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              eventTypeFilter === t
                ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t === "ALL" ? "All Event Types" : t}
          </button>
        ))}
      </div>

      {/* Event List */}
      {loading ? (
        <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center bg-white rounded-2xl border border-slate-200">
          <AlertTriangle className="w-10 h-10 text-rose-400" />
          <p className="text-sm font-semibold text-rose-600">Failed to load events</p>
          <p className="text-xs text-slate-500">{error}</p>
          <button onClick={fetchEvents} className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold">
            Retry
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Webhook className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No webhook events yet</p>
          <p className="text-xs text-slate-400">
            Use the <strong>Simulate Event</strong> button to send a test webhook through the ingestion pipeline.
          </p>
          <button
            onClick={() => setShowSimulator(true)}
            className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            Simulate Event
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 grid grid-cols-[1fr_1fr_1fr_1fr_1fr_32px] gap-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            <span>Event Type</span>
            <span>Summary</span>
            <span>Status</span>
            <span>Sig. Verified</span>
            <span>Received</span>
            <span />
          </div>
          {events.map((ev) => {
            const cfg = statusConfig[ev.status] ?? { label: ev.status, color: "bg-slate-100 text-slate-600", icon: Info };
            const StatusIcon = cfg.icon;
            return (
              <React.Fragment key={ev.id}>
                <div
                  className={`px-4 py-3 grid grid-cols-[1fr_1fr_1fr_1fr_1fr_32px] gap-4 items-center text-xs border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${
                    expanded === ev.id ? "bg-sky-50/40" : ""
                  }`}
                  onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
                >
                  <span className="font-mono text-slate-700 truncate text-[11px]">{ev.eventType}</span>
                  <span className="text-slate-600 truncate">{ev.summary}</span>
                  <span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </span>
                  <span>
                    {ev.signatureVerified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                        <XCircle className="w-3.5 h-3.5" /> No
                      </span>
                    )}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    <span title={new Date(ev.receivedAt).toLocaleString()}>{timeAgo(ev.receivedAt)}</span>
                  </span>
                  <span className="text-slate-400">
                    {expanded === ev.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                </div>

                {/* Expanded detail */}
                {expanded === ev.id && (
                  <div className="px-6 py-4 bg-sky-50/20 border-b border-slate-100 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-slate-400 mb-0.5 uppercase font-semibold text-[10px]">Event ID</p>
                        <p className="font-mono text-slate-700">{ev.paypalWebhookEventId ?? ev.id}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5 uppercase font-semibold text-[10px]">Internal DB ID</p>
                        <p className="font-mono text-slate-500 text-[11px]">{ev.id}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5 uppercase font-semibold text-[10px]">Received At</p>
                        <p className="text-slate-700">{new Date(ev.receivedAt).toLocaleString()}</p>
                      </div>
                      {ev.dispute && (
                        <div>
                          <p className="text-slate-400 mb-0.5 uppercase font-semibold text-[10px]">Linked Dispute</p>
                          <p className="font-mono text-slate-700">{ev.dispute.paypalDisputeId}</p>
                          <p className="text-slate-500 text-[11px]">{ev.dispute.buyerName} · {new Intl.NumberFormat("en-US", { style: "currency", currency: ev.dispute.currency }).format(ev.dispute.disputeAmount)}</p>
                        </div>
                      )}
                    </div>

                    {/* Sanitized Payload */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-slate-400 uppercase font-semibold text-[10px]">Sanitized Payload</p>
                        <button
                          onClick={() => handleCopy(ev.payloadSanitized, ev.id)}
                          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          {copied === ev.id ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <pre className="bg-slate-900 text-emerald-300 text-[11px] rounded-xl p-3 overflow-auto max-h-40 font-mono leading-relaxed">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(ev.payloadSanitized), null, 2);
                          } catch {
                            return ev.payloadSanitized;
                          }
                        })()}
                      </pre>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Simulator Modal */}
      {showSimulator && (
        <WebhookSimulatorModal
          onClose={() => setShowSimulator(false)}
          onSuccess={() => {
            setShowSimulator(false);
            fetchEvents();
            refreshData(true);
          }}
        />
      )}
    </div>
  );
}
