"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAppContext } from "@/lib/app-context";
import {
  Settings,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Webhook,
  Brain,
  User,
  Lock,
  Info,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SettingsData {
  businessName: string;
  supportEmail: string;
  mode: "DEMO" | "SANDBOX";
  requireHumanApproval: boolean;
  autoAnalyzeOnArrival: boolean;
  strictEvidenceEnforced: boolean;
  paypalEnvironment?: string;
  paypalClientId?: string;
  hasLivePayPalConfig?: boolean;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: {
  icon: React.ElementType; title: string; description: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-slate-100 mb-5">
      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-slate-600" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function ToggleSwitch({ enabled, onChange, label, description }: {
  enabled: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors ${
          enabled ? "bg-blue-600 border-blue-600" : "bg-slate-200 border-slate-200"
        }`}
      >
        <span
          className={`inline-block w-4 h-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { refreshData } = useAppContext();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [mode, setMode] = useState<"DEMO" | "SANDBOX">("DEMO");
  const [requireHumanApproval, setRequireHumanApproval] = useState(true);
  const [autoAnalyzeOnArrival, setAutoAnalyzeOnArrival] = useState(true);
  const [strictEvidenceEnforced, setStrictEvidenceEnforced] = useState(true);
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [paypalEnvironment, setPaypalEnvironment] = useState("sandbox");
  const [showSecret, setShowSecret] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      const s: SettingsData = data.settings;
      setSettings(s);
      setBusinessName(s.businessName ?? "");
      setSupportEmail(s.supportEmail ?? "");
      setMode(s.mode ?? "DEMO");
      setRequireHumanApproval(s.requireHumanApproval ?? true);
      setAutoAnalyzeOnArrival(s.autoAnalyzeOnArrival ?? true);
      setStrictEvidenceEnforced(s.strictEvidenceEnforced ?? true);
      setPaypalClientId(s.paypalClientId ?? "");
      setPaypalEnvironment(s.paypalEnvironment ?? "sandbox");
    } catch (e: any) {
      setError(e.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const payload: any = {
        businessName,
        supportEmail,
        mode,
        requireHumanApproval,
        autoAnalyzeOnArrival,
        strictEvidenceEnforced,
        paypalEnvironment,
      };
      if (paypalClientId.trim()) payload.paypalClientId = paypalClientId.trim();
      if (paypalClientSecret.trim()) payload.paypalClientSecret = paypalClientSecret.trim();

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");
      setSaveSuccess(true);
      setPaypalClientSecret("");
      await fetchSettings();
      await refreshData(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Merchant Settings</h1>
            <p className="text-xs text-slate-500">Configure AutoSettle AI policies and PayPal integration.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved successfully
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1 text-xs text-rose-600 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm shadow-blue-600/30"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Account & Profile */}
          <SettingCard>
            <SectionHeader icon={User} title="Account & Profile" description="Merchant business name and contact details." />
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  placeholder="Apex Gear Outfitters"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  placeholder="support@example.com"
                />
              </div>
            </div>
          </SettingCard>

          {/* PayPal Sandbox Configuration */}
          <SettingCard>
            <SectionHeader
              icon={Shield}
              title="PayPal Integration"
              description="PayPal API credentials and operating mode. Credentials are stored server-side and never exposed in cleartext."
            />

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-700 block mb-2">Operating Mode</label>
              <div className="flex gap-3">
                {(["DEMO", "SANDBOX"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      mode === m
                        ? m === "DEMO"
                          ? "bg-amber-50 border-amber-300 text-amber-700 shadow-sm"
                          : "bg-blue-50 border-blue-300 text-blue-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {m === "DEMO" ? "🎭 Demo Mode" : "🏖️ PayPal Sandbox"}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {mode === "DEMO"
                  ? "Demo mode uses seeded dispute data. No real PayPal API calls are made."
                  : "Sandbox mode connects to PayPal's test environment. Requires valid Sandbox credentials below."}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">PayPal Environment</label>
                <select
                  value={paypalEnvironment}
                  onChange={(e) => setPaypalEnvironment(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live (Production)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Client ID</label>
                <input
                  type="text"
                  value={paypalClientId}
                  onChange={(e) => setPaypalClientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="AaBb… (from PayPal Developer Dashboard)"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Client Secret
                  <span className="ml-1.5 text-[10px] text-amber-600 font-normal">(write-only – leave blank to keep existing)</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={paypalClientSecret}
                    onChange={(e) => setPaypalClientSecret(e.target.value)}
                    className="w-full pr-10 px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Enter new secret to update…"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Secret is stored server-side. It is never returned in GET responses.
                </p>
              </div>
            </div>
          </SettingCard>

          {/* Webhook Settings */}
          <SettingCard>
            <SectionHeader
              icon={Webhook}
              title="Webhook Configuration"
              description="Webhook endpoint and verification settings."
            />
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Webhook Ingestion Endpoint</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <code className="text-xs text-slate-600 font-mono flex-1">/api/webhooks/paypal</code>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">Active</span>
                </div>
              </div>
            </div>
          </SettingCard>

          {/* AI Analysis Preferences */}
          <SettingCard>
            <SectionHeader
              icon={Brain}
              title="AI Analysis Preferences"
              description="Control how the deterministic AI engine processes dispute cases."
            />
            <div className="divide-y divide-slate-100">
              <ToggleSwitch
                enabled={requireHumanApproval}
                onChange={setRequireHumanApproval}
                label="Require Human Approval"
                description="All AI-generated draft responses must be approved by a merchant user before submission. Strongly recommended."
              />
              <ToggleSwitch
                enabled={autoAnalyzeOnArrival}
                onChange={setAutoAnalyzeOnArrival}
                label="Auto-Analyse on Webhook Arrival"
                description="Automatically run AI gap analysis when a new dispute webhook is ingested."
              />
              <ToggleSwitch
                enabled={strictEvidenceEnforced}
                onChange={setStrictEvidenceEnforced}
                label="Strict Anti-Hallucination Mode"
                description="Reject any AI output that contains forbidden guarantee phrases or unverified facts."
              />
            </div>
          </SettingCard>

          {/* Save Button (bottom) */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm shadow-blue-600/30"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save All Changes
            </button>
          </div>
        </>
      )}
    </div>
  );
}
