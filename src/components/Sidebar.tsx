"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  HelpCircle,
  Webhook,
  ChevronRight,
  Zap,
  LogOut,
  Brain,
  CheckSquare,
} from "lucide-react";

interface SidebarProps {
  activeNav?: string;
  onNavChange?: (item: string) => void;
  urgentCount?: number;
  onOpenSettingsModal?: () => void;
  onOpenWebhookModal?: () => void;
}

/** Items that navigate to dedicated top-level Next.js pages (router.push). */
const PAGE_ROUTES: Record<string, string> = {
  payments: "/payments",
  analytics: "/analytics",
  webhooks: "/webhooks",
  settings: "/settings",
};

/** Nav items rendered in the sidebar */
const navItems = [
  { id: "dashboard",  label: "Dashboard",           icon: LayoutDashboard },
  { id: "payments",   label: "Payment Intelligence", icon: Zap },
  { id: "disputes",   label: "Disputes Console",     icon: ShieldAlert },
  { id: "evidence",   label: "Evidence Files",       icon: FileText },
  { id: "ai",         label: "AI Investigations",    icon: Brain },
  { id: "approval",   label: "Approval Queue",       icon: CheckSquare },
  { id: "analytics",  label: "Analytics",            icon: BarChart3 },
  { id: "webhooks",   label: "Webhook Lab",          icon: Webhook },
];

export default function Sidebar({
  activeNav = "dashboard",
  onNavChange,
  urgentCount = 0,
  onOpenSettingsModal,
  onOpenWebhookModal,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  const handleNavClick = (id: string) => {
    if (PAGE_ROUTES[id]) {
      // Navigate to a full top-level page
      router.push(PAGE_ROUTES[id]);
    } else {
      // Let the parent (home page) handle in-page navigation
      onNavChange?.(id);
    }
  };

  return (
    <aside className={`sidebar-container${collapsed ? " sidebar-collapsed" : " sidebar-expanded"}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-logo-wrap">
          <div className="brand-logo">
            <ShieldAlert className="brand-logo-icon" />
          </div>
        </div>
        {!collapsed && (
          <div className="brand-text">
            <span className="brand-name">
              AutoSettle <span className="brand-accent">AI</span>
            </span>
            <span className="brand-tagline">Dispute Intelligence</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-collapse-btn"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight className={`sidebar-collapse-icon${collapsed ? "" : " rotate-180"}`} />
        </button>
      </div>

      {/* Urgent Alert */}
      {urgentCount > 0 && !collapsed && (
        <div className="sidebar-alert">
          <Zap className="sidebar-alert-icon" />
          <span>{urgentCount} urgent deadline{urgentCount > 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Navigation */}
      <div className="sidebar-nav-section">
        {!collapsed && <span className="sidebar-nav-label">Main Menu</span>}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`sidebar-nav-item${isActive ? " sidebar-nav-item-active" : ""}${collapsed ? " sidebar-nav-item-collapsed" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`sidebar-nav-icon${isActive ? " sidebar-nav-icon-active" : ""}`} />
                {!collapsed && (
                  <>
                    <span className="sidebar-nav-text">{item.label}</span>
                    {item.id === "disputes" && urgentCount > 0 && (
                      <span className="sidebar-nav-badge">{urgentCount}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom */}
      <div className="sidebar-bottom">
        <div className="sidebar-bottom-actions">
          <button
            onClick={() => {
              if (onOpenSettingsModal) {
                onOpenSettingsModal();
              } else {
                router.push("/settings");
              }
            }}
            className={`sidebar-nav-item${collapsed ? " sidebar-nav-item-collapsed" : ""}`}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className="sidebar-nav-icon" />
            {!collapsed && <span className="sidebar-nav-text">Settings</span>}
          </button>
          <button
            className={`sidebar-nav-item${collapsed ? " sidebar-nav-item-collapsed" : ""}`}
            title={collapsed ? "Help" : undefined}
          >
            <HelpCircle className="sidebar-nav-icon" />
            {!collapsed && <span className="sidebar-nav-text">Help & Support</span>}
          </button>
        </div>

        {!collapsed ? (
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">M</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">Merchant Pro</span>
              <span className="sidebar-user-email">merchant@paypal.com</span>
            </div>
            <button className="sidebar-user-logout" title="Logout">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="sidebar-user-avatar-sm">M</div>
        )}
      </div>
    </aside>
  );
}
