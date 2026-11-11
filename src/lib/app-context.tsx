"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

// Client-side in-memory cache to prevent redundant API roundtrips
interface CacheStore {
  disputes: any[] | null;
  disputesTime: number;
  stats: any | null;
  statsTime: number;
  settings: any | null;
  settingsTime: number;
}

const memoryCache: CacheStore = {
  disputes: null,
  disputesTime: 0,
  stats: null,
  statsTime: 0,
  settings: null,
  settingsTime: 0,
};

const CACHE_TTL_MS = 45000; // 45 seconds TTL for fast client transitions

interface AppContextType {
  disputes: any[];
  stats: any | null;
  isSandboxLive: boolean;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedDisputeId: string | null;
  selectedDisputeDetail: any | null;
  openDisputeWorkbench: (disputeId: string) => Promise<void>;
  closeDisputeWorkbench: () => void;
  refreshWorkbench: () => Promise<void>;
  refreshData: (force?: boolean) => Promise<void>;
  resetSeedData: () => Promise<void>;
  isResetting: boolean;
  showWebhookModal: boolean;
  setShowWebhookModal: (show: boolean) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (show: boolean) => void;
  showNewDisputeModal: boolean;
  setShowNewDisputeModal: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [disputes, setDisputes] = useState<any[]>(memoryCache.disputes || []);
  const [stats, setStats] = useState<any | null>(memoryCache.stats);
  const [isSandboxLive, setIsSandboxLive] = useState(false);
  const [loading, setLoading] = useState(!memoryCache.disputes);
  const [searchQuery, setSearchQuery] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Workbench state
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [selectedDisputeDetail, setSelectedDisputeDetail] = useState<any | null>(null);

  // Modals state
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNewDisputeModal, setShowNewDisputeModal] = useState(false);

  const fetchInProgress = useRef(false);

  const fetchData = useCallback(async (force = false) => {
    const now = Date.now();
    const canUseCache =
      !force &&
      memoryCache.disputes &&
      memoryCache.stats &&
      now - memoryCache.disputesTime < CACHE_TTL_MS &&
      now - memoryCache.statsTime < CACHE_TTL_MS;

    if (canUseCache) {
      setDisputes(memoryCache.disputes!);
      setStats(memoryCache.stats!);
      if (memoryCache.settings?.hasLivePayPalConfig) {
        setIsSandboxLive(Boolean(memoryCache.settings.hasLivePayPalConfig));
      }
      setLoading(false);
      return;
    }

    if (fetchInProgress.current) return;
    fetchInProgress.current = true;

    try {
      const [disputesRes, statsRes, settingsRes] = await Promise.all([
        fetch("/api/disputes"),
        fetch("/api/stats"),
        fetch("/api/settings"),
      ]);

      const [disputesData, statsData, settingsData] = await Promise.all([
        disputesRes.json(),
        statsRes.json(),
        settingsRes.json(),
      ]);

      if (disputesData.success) {
        memoryCache.disputes = disputesData.disputes;
        memoryCache.disputesTime = Date.now();
        setDisputes(disputesData.disputes);
      }
      if (statsData.success) {
        memoryCache.stats = statsData.stats;
        memoryCache.statsTime = Date.now();
        setStats(statsData.stats);
      }
      if (settingsData.success && settingsData.settings) {
        memoryCache.settings = settingsData.settings;
        memoryCache.settingsTime = Date.now();
        setIsSandboxLive(Boolean(settingsData.settings.hasLivePayPalConfig));
      }
    } catch (err) {
      console.error("AppContext fetchData error:", err);
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDisputeWorkbench = useCallback(async (disputeId: string) => {
    setSelectedDisputeId(disputeId);
    try {
      const res = await fetch(`/api/disputes/${disputeId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedDisputeDetail(data.dispute);
      }
    } catch (err) {
      console.error("Fetch single dispute error:", err);
    }
  }, []);

  const closeDisputeWorkbench = useCallback(() => {
    setSelectedDisputeId(null);
    setSelectedDisputeDetail(null);
  }, []);

  const refreshWorkbench = useCallback(async () => {
    if (selectedDisputeId) {
      await openDisputeWorkbench(selectedDisputeId);
    }
    await fetchData(true);
  }, [selectedDisputeId, openDisputeWorkbench, fetchData]);

  const resetSeedData = useCallback(async () => {
    if (!confirm("Reset database back to the 5 pristine demo dispute scenarios?")) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/disputes/reset-seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        // Invalidate cache
        memoryCache.disputes = null;
        memoryCache.stats = null;
        await fetchData(true);
        if (selectedDisputeId) {
          setSelectedDisputeDetail(null);
          setSelectedDisputeId(null);
        }
      }
    } catch (err) {
      console.error("Reset data error:", err);
    } finally {
      setIsResetting(false);
    }
  }, [fetchData, selectedDisputeId]);

  return (
    <AppContext.Provider
      value={{
        disputes,
        stats,
        isSandboxLive,
        loading,
        searchQuery,
        setSearchQuery,
        selectedDisputeId,
        selectedDisputeDetail,
        openDisputeWorkbench,
        closeDisputeWorkbench,
        refreshWorkbench,
        refreshData: fetchData,
        resetSeedData,
        isResetting,
        showWebhookModal,
        setShowWebhookModal,
        showSettingsModal,
        setShowSettingsModal,
        showNewDisputeModal,
        setShowNewDisputeModal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
