"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  urgentCount?: number;
  onOpenSettingsModal?: () => void;
}

/** Nav items rendered in the sidebar with direct URL routes */
export const navItems = [
  { id: "dashboard",  label: "Dashboard",            icon: LayoutDashboard, href: "/" },
  { id: "payments",   label: "Payment Intelligence",  icon: Zap,             href: "/payments" },
  { id: "disputes",   label: "Disputes Console",      icon: ShieldAlert,     href: "/disputes" },
  { id: "evidence",   label: "Evidence Files",        icon: FileText,        href: "/evidence" },
  { id: "ai",         label: "AI Investigations",     icon: Brain,           href: "/ai" },
  { id: "approval",   label: "Approval Queue",        icon: CheckSquare,     href: "/approval" },
  { id: "analytics",  label: "Analytics",             icon: BarChart3,       href: "/analytics" },
  { id: "webhooks",   label: "Webhook Lab",           icon: Webhook,         href: "/webhooks" },
];

export default function Sidebar({
  urgentCount = 0,
  onOpenSettingsModal,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={`sidebar-container${collapsed ? " sidebar-collapsed" : " sidebar-expanded"}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <Link href="/" prefetch={true} className="flex items-center gap-3 no-underline">
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
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-collapse-btn"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={true}
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
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom */}
      <div className="sidebar-bottom">
        <div className="sidebar-bottom-actions">
          {onOpenSettingsModal ? (
            <button
              onClick={onOpenSettingsModal}
              className={`sidebar-nav-item${pathname === "/settings" ? " sidebar-nav-item-active" : ""}${collapsed ? " sidebar-nav-item-collapsed" : ""}`}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings className="sidebar-nav-icon" />
              {!collapsed && <span className="sidebar-nav-text">Settings</span>}
            </button>
          ) : (
            <Link
              href="/settings"
              prefetch={true}
              className={`sidebar-nav-item${pathname === "/settings" ? " sidebar-nav-item-active" : ""}${collapsed ? " sidebar-nav-item-collapsed" : ""}`}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings className="sidebar-nav-icon" />
              {!collapsed && <span className="sidebar-nav-text">Settings</span>}
            </Link>
          )}
          <button
            className={`sidebar-nav-item${collapsed ? " sidebar-nav-item-collapsed" : ""}`}
            title={collapsed ? "Help" : undefined}
            onClick={() => alert("AutoSettle AI Help: Autonomous PayPal Dispute Resolution & Evidence Orchestration Engine.")}
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
