"use client";

import React, { useState } from "react";
import { X, PlusCircle, CheckCircle2 } from "lucide-react";

interface NewDisputeModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function NewDisputeModal({
  onClose,
  onCreated,
}: NewDisputeModalProps) {
  const [buyerName, setBuyerName] = useState("Amara Kalu");
  const [buyerEmail, setBuyerEmail] = useState("amara.kalu@example.com");
  const [disputeAmount, setDisputeAmount] = useState("145.00");
  const [reason, setReason] = useState("MERCHANDISE_OR_SERVICE_NOT_RECEIVED");
  const [carrier, setCarrier] = useState("UPS");
  const [trackingStatus, setTrackingStatus] = useState("DELIVERED");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName,
          buyerEmail,
          disputeAmount: parseFloat(disputeAmount) || 100,
          reason,
          carrier,
          trackingStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          onCreated();
          onClose();
        }, 1000);
      }
    } catch (err) {
      console.error("Create dispute error:", err);
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

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <PlusCircle className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Create Test Dispute Intake</h3>
            <p className="text-xs text-slate-400">
              Manually add a dispute case to test the evidence compilation pipeline.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Buyer Name
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Buyer Email
              </label>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Dispute Amount ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={disputeAmount}
                onChange={(e) => setDisputeAmount(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Dispute Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
              >
                <option value="MERCHANDISE_OR_SERVICE_NOT_RECEIVED">Item Not Received</option>
                <option value="MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED">Not as Described</option>
                <option value="UNAUTHORISED">Unauthorised Transaction</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Carrier
              </label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
              >
                <option value="UPS">UPS</option>
                <option value="FEDEX">FedEx</option>
                <option value="USPS">USPS</option>
                <option value="DHL">DHL</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Tracking Delivery Status
              </label>
              <select
                value={trackingStatus}
                onChange={(e) => setTrackingStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
              >
                <option value="DELIVERED">Delivered (Signed)</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="EXCEPTION">Carrier Exception</option>
              </select>
            </div>
          </div>

          {success && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Dispute intake created! Refreshing console...</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              {isSubmitting ? "Creating..." : "Create Dispute"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
