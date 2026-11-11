"use client";

import React, { useState } from "react";
import { X, Radio, Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface WebhookSimulatorModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function WebhookSimulatorModal({
  onClose,
  onSuccess,
}: WebhookSimulatorModalProps) {
  const [eventType, setEventType] = useState("PAYMENT.DISPUTE.CREATED");
  const [template, setTemplate] = useState("INR");
  const [targetDisputeId, setTargetDisputeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const templates: Record<string, any> = {
    INR: {
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      dispute_amount: { value: "195.00", currency_code: "USD" },
      buyer_info: { name: "Zachary Taylor", email: "z.taylor@example.com" },
      summary: "Item Not Received ($195.00) with UPS tracking and destination signature scan.",
    },
    SNAD: {
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
      dispute_amount: { value: "320.00", currency_code: "USD" },
      buyer_info: { name: "Valerie Dupuis", email: "v.dupuis@example.com" },
      summary: "Product significantly not as described ($320.00); buyer claims wrong item was received.",
    },
    UNAUTH: {
      reason: "UNAUTHORISED",
      dispute_amount: { value: "89.50", currency_code: "USD" },
      buyer_info: { name: "Kenji Sato", email: "kenji.s@example.com" },
      summary: "Unauthorized chargeback claim ($89.50); buyer states card was compromised.",
    },
  };

  const handleSimulate = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      const selectedTpl = templates[template];
      const disputeId =
        targetDisputeId.trim() ||
        (template === "INR" ? `PP-D-${Math.floor(20000 + Math.random() * 70000)}` : `PP-D-${Math.floor(20000 + Math.random() * 70000)}`);

      const payload = {
        event_type: eventType,
        scenario: template,
        id: `WH-SIM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        create_time: new Date().toISOString(),
        resource: {
          dispute_id: disputeId,
          reason: selectedTpl.reason,
          status:
            eventType === "PAYMENT.DISPUTE.RESOLVED"
              ? "RESOLVED"
              : "REQUIRED_ACTION",
          dispute_life_cycle_stage:
            eventType === "PAYMENT.DISPUTE.RESOLVED" ? "RESOLVED" : "CHARGEBACK",
          dispute_amount: selectedTpl.dispute_amount,
          seller_response_due_date: new Date(
            Date.now() + 6 * 24 * 3600 * 1000
          ).toISOString(),
          disputed_transactions: [
            {
              seller_transaction_id: `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`,
              buyer_info: selectedTpl.buyer_info,
            },
          ],
        },
      };

      // Call dedicated internal simulation endpoint
      const res = await fetch("/api/webhooks/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const errorText =
          data.error || data.message || `Server error (${res.status})`;
        setErrorMessage(errorText);
        return;
      }

      setResultMessage(
        `[SIMULATED] Webhook ${data.eventType} processed! Dispute ${data.disputeId} ingested ${
          data.autoAnalyzed ? "and auto-analyzed by AI Agent." : "into console."
        }`
      );

      // Trigger automatic refresh of webhook events, dispute table, and stats
      onSuccess();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Webhook simulation error:", err);
      setErrorMessage(err.message || "Network error while dispatching simulation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
          title="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <Radio className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Simulate PayPal Webhook Event</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                Dedicated Harness
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Dispatches internal simulated events via <code className="text-sky-300">/api/webhooks/simulate</code>.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Webhook Event Type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="PAYMENT.DISPUTE.CREATED">
                PAYMENT.DISPUTE.CREATED (New Dispute Ingestion)
              </option>
              <option value="PAYMENT.DISPUTE.UPDATED">
                PAYMENT.DISPUTE.UPDATED (Evidence Required)
              </option>
              <option value="PAYMENT.DISPUTE.RESOLVED">
                PAYMENT.DISPUTE.RESOLVED (Dispute Closed)
              </option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Scenario Template
            </label>
            <div className="space-y-2">
              {[
                {
                  id: "INR",
                  title: "Item Not Received ($195.00)",
                  desc: templates.INR.summary,
                },
                {
                  id: "SNAD",
                  title: "Not as Described ($320.00)",
                  desc: templates.SNAD.summary,
                },
                {
                  id: "UNAUTH",
                  title: "Unauthorized Charge ($89.50)",
                  desc: templates.UNAUTH.summary,
                },
              ].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    template === t.id
                      ? "bg-sky-500/15 border-sky-500/50 text-white"
                      : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center justify-between">
                    <span>{t.title}</span>
                    {template === t.id && (
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Target Dispute ID{" "}
              <span className="text-[10px] text-slate-500 font-normal">
                (Optional – leave blank to generate new dispute)
              </span>
            </label>
            <input
              type="text"
              placeholder="e.g. PP-D-91042 or leave blank"
              value={targetDisputeId}
              onChange={(e) => setTargetDisputeId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          {resultMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{resultMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSimulate}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all shadow-md shadow-sky-600/30 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isSubmitting ? "Dispatching..." : "Dispatch Webhook"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
