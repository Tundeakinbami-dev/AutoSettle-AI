"use client";

import React, { useState } from "react";
import { X, Radio, Sparkles, Send, CheckCircle2 } from "lucide-react";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const templates: Record<string, any> = {
    INR: {
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      dispute_amount: { value: "195.00", currency_code: "USD" },
      buyer_info: { name: "Zachary Taylor", email: "z.taylor@example.com" },
      summary: "Item Not Received claim with UPS tracking and destination signature scan.",
    },
    SNAD: {
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
      dispute_amount: { value: "320.00", currency_code: "USD" },
      buyer_info: { name: "Valerie Dupuis", email: "v.dupuis@example.com" },
      summary: "Product significantly not as described; buyer claims wrong item was received.",
    },
    UNAUTH: {
      reason: "UNAUTHORISED",
      dispute_amount: { value: "89.50", currency_code: "USD" },
      buyer_info: { name: "Kenji Sato", email: "kenji.s@example.com" },
      summary: "Unauthorized chargeback claim; buyer states card was compromised.",
    },
  };

  const handleSimulate = async () => {
    setIsSubmitting(true);
    setResultMessage(null);
    try {
      const selectedTpl = templates[template];
      const payload = {
        event_type: eventType,
        id: `WH-SIM-${Date.now()}`,
        create_time: new Date().toISOString(),
        resource: {
          dispute_id: `PP-D-${Math.floor(20000 + Math.random() * 70000)}`,
          reason: selectedTpl.reason,
          status: "REQUIRED_ACTION",
          dispute_life_cycle_stage: "CHARGEBACK",
          dispute_amount: selectedTpl.dispute_amount,
          seller_response_due_date: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
          disputed_transactions: [
            {
              seller_transaction_id: `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`,
              buyer_info: selectedTpl.buyer_info,
            },
          ],
        },
      };

      const res = await fetch("/api/webhooks/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setResultMessage(
          `Webhook received! Dispute ${data.disputeId} created and ${
            data.autoAnalyzed ? "auto-analyzed by AI Agent." : "stored in console."
          }`
        );
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Webhook simulation error:", err);
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
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <Radio className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Simulate PayPal Webhook Event</h3>
            <p className="text-xs text-slate-400">
              Test real-time dispute ingestion and autonomous AI analysis.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Webhook Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
            >
              <option value="PAYMENT.DISPUTE.CREATED">PAYMENT.DISPUTE.CREATED (New Dispute Ingestion)</option>
              <option value="PAYMENT.DISPUTE.UPDATED">PAYMENT.DISPUTE.UPDATED (Evidence Required)</option>
              <option value="PAYMENT.DISPUTE.RESOLVED">PAYMENT.DISPUTE.RESOLVED (Dispute Closed)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Scenario Template</label>
            <div className="space-y-2">
              {[
                { id: "INR", title: "Item Not Received ($195.00)", desc: templates.INR.summary },
                { id: "SNAD", title: "Not as Described ($320.00)", desc: templates.SNAD.summary },
                { id: "UNAUTH", title: "Unauthorized Charge ($89.50)", desc: templates.UNAUTH.summary },
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
                  <div className="text-xs font-semibold">{t.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {resultMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{resultMessage}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSimulate}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all shadow-md"
            >
              <Send className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
              <span>{isSubmitting ? "Dispatching..." : "Dispatch Webhook"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
