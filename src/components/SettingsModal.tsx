"use client";

import React, { useState, useEffect } from "react";
import { X, Settings, Key, Save, CheckCircle2, Lock, UserCheck } from "lucide-react";

interface SettingsModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ onClose, onSaved }: SettingsModalProps) {
  const [businessName, setBusinessName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [paypalEnvironment, setPaypalEnvironment] = useState("sandbox");
  const [mode, setMode] = useState("DEMO"); // DEMO or SANDBOX
  const [requireHumanApproval, setRequireHumanApproval] = useState(true); // DEFAULT: TRUE
  const [autoAnalyzeOnArrival, setAutoAnalyzeOnArrival] = useState(true);
  const [strictEvidenceEnforced, setStrictEvidenceEnforced] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (data.success && data.settings) {
          setBusinessName(data.settings.businessName || "Apex Gear Outfitters");
          setSupportEmail(data.settings.supportEmail || "support@apexgear.example.com");
          setPaypalClientId(data.settings.paypalClientId || "");
          setPaypalClientSecret(data.settings.paypalClientSecret || "");
          setPaypalEnvironment(data.settings.paypalEnvironment || "sandbox");
          setRequireHumanApproval(
            data.settings.requireHumanApproval !== undefined ? Boolean(data.settings.requireHumanApproval) : true
          );
          setAutoAnalyzeOnArrival(Boolean(data.settings.autoAnalyzeOnArrival));
          setStrictEvidenceEnforced(Boolean(data.settings.strictEvidenceEnforced));
        }
      } catch (err) {
        console.error("Fetch settings error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          supportEmail,
          paypalClientId,
          paypalClientSecret,
          paypalEnvironment,
          mode,
          requireHumanApproval,
          autoAnalyzeOnArrival,
          strictEvidenceEnforced,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => {
          onSaved();
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error("Save settings error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <Settings className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Merchant & Policy Settings</h3>
            <p className="text-xs text-slate-400">
              Configure PayPal Disputes API credentials and human review governance.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Support Email
                </label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                />
              </div>
            </div>

            {/* PayPal Credentials */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> PayPal REST Credentials (Disputes API)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Sandbox / Live</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">PayPal Client ID</label>
                  <input
                    type="text"
                    value={paypalClientId}
                    onChange={(e) => setPaypalClientId(e.target.value)}
                    placeholder="Enter sandbox client ID"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">PayPal Client Secret</label>
                  <input
                    type="text"
                    value={paypalClientSecret}
                    onChange={(e) => setPaypalClientSecret(e.target.value)}
                    placeholder="Enter secret"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Leave blank to use built-in high-fidelity Sandbox Simulation mode with zero setup.
              </p>
            </div>

            {/* MANDATORY HUMAN APPROVAL DEFAULT GOVERNANCE */}
            <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireHumanApproval}
                  onChange={(e) => setRequireHumanApproval(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 bg-slate-950 border-slate-700"
                />
                <div className="text-xs text-slate-200">
                  <strong className="text-indigo-300 block mb-0.5 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    Require Human Approval Before Submission (Default: Enabled)
                  </strong>
                  Prevents autonomous submissions to PayPal Disputes API without explicit human operator sign-off. Drafts remain in Needs Review until certified.
                </div>
              </label>
            </div>

            {/* Automation Toggles */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAnalyzeOnArrival}
                  onChange={(e) => setAutoAnalyzeOnArrival(e.target.checked)}
                  className="rounded text-sky-600 bg-slate-950 border-slate-700"
                />
                <span>Autonomous Analysis: Run evidence gap analysis immediately when a dispute arrives</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={strictEvidenceEnforced}
                  onChange={(e) => setStrictEvidenceEnforced(e.target.checked)}
                  className="rounded text-sky-600 bg-slate-950 border-slate-700"
                />
                <span>Strict Provenance: Reject any drafted claim that lacks verified carrier or invoice records</span>
              </label>
            </div>

            {saveSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Settings saved successfully!</span>
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
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all shadow-md"
              >
                <Save className={`w-3.5 h-3.5 ${isSaving ? "animate-spin" : ""}`} />
                <span>{isSaving ? "Saving..." : "Save Configuration"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
